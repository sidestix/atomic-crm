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

  if (!data?.user || userError) {
    console.error(`Error inviting user: user_error=${userError}`);

    // #region agent log
    fetch('http://127.0.0.1:7243/ingest/699b37ff-b3cb-499b-9846-9bbbaa584a64',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'users/index.ts:createUser branch',message:'createUser failed',data:{hasUserError:!!userError,errorMsg:userError?.message,errorCode:userError?.code},timestamp:Date.now(),hypothesisId:'H3'})}).catch(()=>{});
    // #endregion

    // Check if this is a duplicate email error - check multiple possible error formats
    const errorMessage = (userError?.message || userError?.error_description || userError?.msg || '').toLowerCase();
    const errorCode = userError?.code || userError?.status_code || '';
    const errorString = JSON.stringify(userError || {}).toLowerCase();

    const isDuplicateEmail =
      errorCode === 'email_exists' ||
      errorCode === 'duplicate_email' ||
      errorCode === '23505' ||
      errorMessage.includes('duplicate') ||
      errorMessage.includes('already exists') ||
      errorMessage.includes('already registered') ||
      errorMessage.includes('unique constraint') ||
      errorMessage.includes('users_email_key') ||
      errorMessage.includes('email already') ||
      errorString.includes('duplicate') ||
      errorString.includes('users_email_key') ||
      errorString.includes('email_exists');

    if (isDuplicateEmail) {
      return createErrorResponse(409, "A user with this email address already exists");
    }

    return createErrorResponse(500, "Internal Server Error");
  }

  // #region agent log
  fetch('http://127.0.0.1:7243/ingest/699b37ff-b3cb-499b-9846-9bbbaa584a64',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'users/index.ts:before inviteUserByEmail',message:'user created, calling inviteUserByEmail',data:{userId:data.user?.id},timestamp:Date.now(),hypothesisId:'H1'})}).catch(()=>{});
  // #endregion

  const { error: emailError } =
    await supabaseAdmin.auth.admin.inviteUserByEmail(email);

  if (emailError) {
    console.error(`Error inviting user, email_error=${emailError}`);
    // #region agent log
    fetch('http://127.0.0.1:7243/ingest/699b37ff-b3cb-499b-9846-9bbbaa584a64',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'users/index.ts:emailError',message:'inviteUserByEmail failed',data:{emailErrorMsg:emailError?.message,emailErrorCode:emailError?.code,emailErrorName:emailError?.name,emailErrorStatus:emailError?.status},timestamp:Date.now(),hypothesisId:'H2,H3,H4,H5'})}).catch(()=>{});
    // #endregion
    return createErrorResponse(500, "Failed to send invitation mail");
  }

  try {
    // Wait for the database trigger to create the sales record
    // The trigger handle_new_user() creates the sales record automatically
    let retries = 10;
    let saleExists = false;
    
    while (retries > 0 && !saleExists) {
      const { data: salesData, error: salesError } = await supabaseAdmin
        .from("sales")
        .select("*")
        .eq("user_id", data.user.id)
        .single();
      
      if (salesData && !salesError) {
        saleExists = true;
        break;
      }
      
      // Wait 100ms before retrying
      await new Promise(resolve => setTimeout(resolve, 100));
      retries--;
    }

    if (!saleExists) {
      console.error(`Error: Sales record not created for user ${data.user.id} after retries`);
      return createErrorResponse(500, "Internal Server Error: Sales record not found");
    }

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
