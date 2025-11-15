-- Recreate companies_summary view to include shipping_instructions column
DROP VIEW IF EXISTS "public"."companies_summary";

CREATE VIEW "public"."companies_summary"
    WITH (security_invoker=on)
    AS
SELECT 
    c.*,
    count(distinct d.id) as nb_deals,
    count(distinct co.id) as nb_contacts
FROM 
    "public"."companies" c
LEFT JOIN 
    "public"."deals" d on c.id = d.company_id
LEFT JOIN 
    "public"."contacts" co on c.id = co.company_id
GROUP BY 
    c.id;

