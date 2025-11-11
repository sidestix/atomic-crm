-- Update contacts_summary view to include manual_discount_ids
DROP VIEW contacts_summary;

CREATE VIEW contacts_summary
AS
SELECT 
    co.id,
    co.first_name,
    co.last_name,
    co.gender,
    co.title,
    co.email_jsonb,
    jsonb_path_query_array(co.email_jsonb, '$[*].email')::text as email_fts,
    co.phone_jsonb,
    jsonb_path_query_array(co.phone_jsonb, '$[*].number')::text as phone_fts,
    co."address",
    co."city",
    co."zipcode",
    co."stateAbbr",
    co."country",
    co.background,
    co.avatar,
    co.first_seen,
    co.last_seen,
    co.has_newsletter,
    co.status,
    co.tags,
    co.company_id,
    co.sales_id,
    co.linkedin_url,
    co.related_contact_ids,
    co.manual_discount_ids,
    c.name as company_name,
    count(distinct t.id) as nb_tasks
FROM
    contacts co
LEFT JOIN
    tasks t on co.id = t.contact_id
LEFT JOIN
    companies c on co.company_id = c.id
GROUP BY
    co.id, c.name;

