import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import * as jose from "jsr:@panva/jose@6";
import { createClient } from "jsr:@supabase/supabase-js@2";
import { supabaseAdmin } from "../_shared/supabaseAdmin.ts";
import { corsHeaders, createErrorResponse } from "../_shared/utils.ts";

const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
if (!supabaseUrl) {
  throw new Error("Missing SUPABASE_URL env var");
}
const jwtIssuer = Deno.env.get("SB_JWT_ISSUER") ?? `${supabaseUrl}/auth/v1`;
const jwtKeys = jose.createRemoteJWKSet(
  new URL(`${supabaseUrl}/auth/v1/.well-known/jwks.json`),
);

const getAuthToken = (req: Request) => {
  const authHeader = req.headers.get("authorization");
  if (!authHeader) {
    return null;
  }
  const [bearer, token] = authHeader.split(" ");
  if (bearer !== "Bearer" || !token) {
    return null;
  }
  return token;
};

const getForwardedIssuer = (req: Request) => {
  const forwardedHostHeader = req.headers.get("x-forwarded-host");
  const forwardedHost = forwardedHostHeader
    ? forwardedHostHeader.split(",")[0]?.trim()
    : null;
  const host = forwardedHost ?? req.headers.get("host");
  if (!host) return null;
  const forwardedPort = req.headers.get("x-forwarded-port");
  const forwardedProto = req.headers.get("x-forwarded-proto") ?? "http";
  const hostWithPort =
    forwardedPort && !host.includes(":") ? `${host}:${forwardedPort}` : host;
  return `${forwardedProto}://${hostWithPort}/auth/v1`;
};

const verifySupabaseJwt = async (req: Request) => {
  const token = getAuthToken(req);
  if (!token) {
    return createErrorResponse(401, "Missing authorization header");
  }
  const forwardedIssuer = getForwardedIssuer(req);
  const issuers = forwardedIssuer ? [jwtIssuer, forwardedIssuer] : jwtIssuer;
  try {
    await jose.jwtVerify(token, jwtKeys, { issuer: issuers });
    return null;
  } catch (error) {
    console.error("jwt.verify.error", error);
    return createErrorResponse(401, "Invalid JWT");
  }
};

const withAuth = async (
  req: Request,
  next: (req: Request) => Promise<Response>,
) => {
  if (req.method === "OPTIONS") {
    return next(req);
  }
  const response = await verifySupabaseJwt(req);
  if (response) return response;
  return next(req);
};

async function updateSaleDisabled(user_id: string, disabled: boolean) {
  return await supabaseAdmin
    .from("sales")
    .update({ disabled: disabled ?? false })
    .eq("user_id", user_id);
}

async function updateSaleAdministrator(
  user_id: string,
  administrator: boolean,
) {
  const { data: sales, error: salesError } = await supabaseAdmin
    .from("sales")
    .update({ administrator })
    .eq("user_id", user_id)
    .select("*");

  if (!sales?.length || salesError) {
    console.error("Error updating user:", salesError);
    throw salesError ?? new Error("Failed to update sale");
  }
  return sales.at(0);
}

async function updateSaleAvatar(user_id: string, avatar: string) {
  const { data: sales, error: salesError } = await supabaseAdmin
    .from("sales")
    .update({ avatar })
    .eq("user_id", user_id)
    .select("*");

  if (!sales?.length || salesError) {
    console.error("Error updating user:", salesError);
    throw salesError ?? new Error("Failed to update sale");
  }
  return sales.at(0);
}

async function inviteUser(req: Request, currentUserSale: any) {
  const { email, password, first_name, last_name, disabled, administrator } =
    await req.json();

  if (!currentUserSale.administrator) {
    return createErrorResponse(401, "Not Authorized");
  }

  const { data, error: userError } = await supabaseAdmin.auth.admin.createUser({
    email,
    password,
    user_metadata: { first_name, last_name },
  });

  const { error: emailError } =
    await supabaseAdmin.auth.admin.inviteUserByEmail(email);

  if (!data?.user || userError) {
    console.error(`Error inviting user: user_error=${userError}`);
    return createErrorResponse(500, "Internal Server Error");
  }

  if (!data?.user || userError || emailError) {
    console.error(`Error inviting user, email_error=${emailError}`);
    return createErrorResponse(500, "Failed to send invitation mail");
  }

  try {
    await updateSaleDisabled(data.user.id, disabled);
    const sale = await updateSaleAdministrator(data.user.id, administrator);

    return new Response(
      JSON.stringify({
        data: sale,
      }),
      {
        headers: { "Content-Type": "application/json", ...corsHeaders },
      },
    );
  } catch (e) {
    console.error("Error patching sale:", e);
    return createErrorResponse(500, "Internal Server Error");
  }
}

async function patchUser(req: Request, currentUserSale: any) {
  const {
    sales_id,
    email,
    first_name,
    last_name,
    avatar,
    administrator,
    disabled,
  } = await req.json();
  const { data: sale } = await supabaseAdmin
    .from("sales")
    .select("*")
    .eq("id", sales_id)
    .single();

  if (!sale) {
    return createErrorResponse(404, "Not Found");
  }

  // Users can only update their own profile unless they are an administrator
  if (!currentUserSale.administrator && currentUserSale.id !== sale.id) {
    return createErrorResponse(401, "Not Authorized");
  }

  const { data, error: userError } =
    await supabaseAdmin.auth.admin.updateUserById(sale.user_id, {
      email,
      ban_duration: disabled ? "87600h" : "none",
      user_metadata: { first_name, last_name },
    });

  if (!data?.user || userError) {
    console.error("Error patching user:", userError);
    return createErrorResponse(500, "Internal Server Error");
  }

  if (avatar) {
    await updateSaleAvatar(data.user.id, avatar);
  }

  // Only administrators can update the administrator and disabled status
  if (!currentUserSale.administrator) {
    const { data: new_sale } = await supabaseAdmin
      .from("sales")
      .select("*")
      .eq("id", sales_id)
      .single();
    return new Response(
      JSON.stringify({
        data: new_sale,
      }),
      {
        headers: {
          "Content-Type": "application/json",
          ...corsHeaders,
        },
      },
    );
  }

  try {
    await updateSaleDisabled(data.user.id, disabled);
    const sale = await updateSaleAdministrator(data.user.id, administrator);
    return new Response(
      JSON.stringify({
        data: sale,
      }),
      {
        headers: {
          "Content-Type": "application/json",
          ...corsHeaders,
        },
      },
    );
  } catch (e) {
    console.error("Error patching sale:", e);
    return createErrorResponse(500, "Internal Server Error");
  }
}

Deno.serve((req: Request) =>
  withAuth(req, async (authedReq) => {
    if (authedReq.method === "OPTIONS") {
      return new Response(null, {
        status: 204,
        headers: corsHeaders,
      });
    }

    const authHeader = authedReq.headers.get("Authorization")!;
    const localClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      { global: { headers: { Authorization: authHeader } } },
    );
    const { data } = await localClient.auth.getUser();
    if (!data?.user) {
      return createErrorResponse(401, "Unauthorized");
    }
    const currentUserSale = await supabaseAdmin
      .from("sales")
      .select("*")
      .eq("user_id", data.user.id)
      .single();

    if (!currentUserSale?.data) {
      return createErrorResponse(401, "Unauthorized");
    }
    if (authedReq.method === "POST") {
      return inviteUser(authedReq, currentUserSale.data);
    }

    if (authedReq.method === "PATCH") {
      return patchUser(authedReq, currentUserSale.data);
    }

    return createErrorResponse(405, "Method Not Allowed");
  })
);
