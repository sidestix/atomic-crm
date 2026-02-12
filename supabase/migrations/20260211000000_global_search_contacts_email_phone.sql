-- Add email and phone matching to global search for contacts (same behavior as contact list search)
CREATE OR REPLACE FUNCTION global_search_optimized(
  search_query TEXT,
  result_limit INTEGER DEFAULT 10,
  result_offset INTEGER DEFAULT 0
)
RETURNS TABLE (
  id BIGINT,
  entity_type TEXT,
  title TEXT,
  subtitle TEXT,
  snippet TEXT,
  url TEXT,
  metadata JSONB,
  relevance_score double precision
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  WITH search_results AS (
    -- Search in contacts with full-text search and trigram similarity
    SELECT
      contacts.id,
      'contact'::TEXT as entity_type,
      COALESCE(contacts.first_name || ' ' || contacts.last_name, '') as title,
      COALESCE(contacts.title, '') as subtitle,
      COALESCE(contacts.background, '') as snippet,
      '/contacts/' || contacts.id::TEXT || '/show' as url,
      jsonb_build_object(
        'email', (
          SELECT string_agg(email_item->>'email', ', ')
          FROM jsonb_array_elements(COALESCE(contacts.email_jsonb, '[]'::jsonb)) as email_item
          WHERE email_item->>'email' IS NOT NULL
        ),
        'phone', (
          SELECT string_agg(phone_item->>'number', ', ')
          FROM jsonb_array_elements(COALESCE(contacts.phone_jsonb, '[]'::jsonb)) as phone_item
          WHERE phone_item->>'number' IS NOT NULL
        )
      ) as metadata,
      -- Calculate relevance score (×3 so contacts compete with notes)
      (
        COALESCE(ts_rank(
          to_tsvector('english',
            COALESCE(contacts.first_name, '') || ' ' ||
            COALESCE(contacts.last_name, '') || ' ' ||
            COALESCE(contacts.title, '') || ' ' ||
            COALESCE(contacts.background, '')
          ),
          plainto_tsquery('english', search_query)
        ), 0) * 0.7 +
        COALESCE(similarity(
          COALESCE(contacts.first_name, '') || ' ' || COALESCE(contacts.last_name, ''),
          search_query
        ), 0) * 0.3
      ) * 3 AS relevance_score
    FROM contacts
    LEFT JOIN companies ON contacts.company_id = companies.id
    WHERE
      -- Full-text search for natural language queries
      to_tsvector('english',
        COALESCE(contacts.first_name, '') || ' ' ||
        COALESCE(contacts.last_name, '') || ' ' ||
        COALESCE(contacts.title, '') || ' ' ||
        COALESCE(contacts.background, '')
      ) @@ plainto_tsquery('english', search_query)
      OR
      -- Trigram similarity for fuzzy matching
      similarity(
        COALESCE(contacts.first_name, '') || ' ' || COALESCE(contacts.last_name, ''),
        search_query
      ) > 0.3
      OR
      -- Fallback to LIKE for exact matches
      LOWER(COALESCE(contacts.first_name, '') || ' ' || COALESCE(contacts.last_name, '')) LIKE '%' || LOWER(search_query) || '%'
      OR
      -- Match on any contact email (same behavior as contact list search)
      EXISTS (
        SELECT 1
        FROM jsonb_array_elements(COALESCE(contacts.email_jsonb, '[]'::jsonb)) AS e
        WHERE e->>'email' IS NOT NULL
          AND (e->>'email') ILIKE '%' || search_query || '%'
      )
      OR
      -- Match on any contact phone number
      EXISTS (
        SELECT 1
        FROM jsonb_array_elements(COALESCE(contacts.phone_jsonb, '[]'::jsonb)) AS p
        WHERE p->>'number' IS NOT NULL
          AND (p->>'number') ILIKE '%' || search_query || '%'
      )

    UNION ALL

    -- Search in contact notes
    SELECT
      "contactNotes".id,
      'note'::TEXT as entity_type,
      'Note from ' || COALESCE(contacts.first_name || ' ' || contacts.last_name, 'Unknown Contact') as title,
      TO_CHAR("contactNotes".date, 'FMMonth FMDD, YYYY') as subtitle,
      LEFT("contactNotes".text, 200) as snippet,
      '/contacts/' || contacts.id::TEXT || '/show?note=' || "contactNotes".id::TEXT as url,
      jsonb_build_object(
        'contact_name', COALESCE(contacts.first_name || ' ' || contacts.last_name, ''),
        'contact_id', contacts.id,
        'note_date', "contactNotes".date,
        'attachment_count', COALESCE(array_length("contactNotes".attachments, 1), 0)
      ) as metadata,
      -- Categorical relevance for notes: exact/full match = 1.0, similarity-only = 0.5 (ties → id DESC)
      (
        CASE
          WHEN to_tsvector('english', COALESCE("contactNotes".text, '')) @@ plainto_tsquery('english', search_query)
            OR LOWER(COALESCE("contactNotes".text, '')) LIKE '%' || LOWER(search_query) || '%'
          THEN 1.0
          ELSE 0.5
        END
      )::double precision AS relevance_score
    FROM "contactNotes"
    LEFT JOIN contacts ON "contactNotes".contact_id = contacts.id
    WHERE
      to_tsvector('english', COALESCE("contactNotes".text, '')) @@ plainto_tsquery('english', search_query)
      OR
      similarity(COALESCE("contactNotes".text, ''), search_query) > 0.3
      OR
      LOWER(COALESCE("contactNotes".text, '')) LIKE '%' || LOWER(search_query) || '%'

    UNION ALL

    -- Search in company notes
    SELECT
      "companyNotes".id,
      'note'::TEXT as entity_type,
      'Note from ' || COALESCE(companies.name, 'Unknown Company') as title,
      TO_CHAR("companyNotes".date, 'FMMonth FMDD, YYYY') as subtitle,
      LEFT("companyNotes".text, 200) as snippet,
      '/companies/' || companies.id::TEXT || '/show?note=' || "companyNotes".id::TEXT as url,
      jsonb_build_object(
        'company_name', COALESCE(companies.name, ''),
        'company_id', companies.id,
        'note_date', "companyNotes".date,
        'attachment_count', COALESCE(array_length("companyNotes".attachments, 1), 0)
      ) as metadata,
      -- Categorical relevance for notes: exact/full match = 1.0, similarity-only = 0.5 (ties → id DESC)
      (
        CASE
          WHEN to_tsvector('english', COALESCE("companyNotes".text, '')) @@ plainto_tsquery('english', search_query)
            OR LOWER(COALESCE("companyNotes".text, '')) LIKE '%' || LOWER(search_query) || '%'
          THEN 1.0
          ELSE 0.5
        END
      )::double precision AS relevance_score
    FROM "companyNotes"
    LEFT JOIN companies ON "companyNotes".company_id = companies.id
    WHERE
      to_tsvector('english', COALESCE("companyNotes".text, '')) @@ plainto_tsquery('english', search_query)
      OR
      similarity(COALESCE("companyNotes".text, ''), search_query) > 0.3
      OR
      LOWER(COALESCE("companyNotes".text, '')) LIKE '%' || LOWER(search_query) || '%'

    UNION ALL

    -- Search in companies
    SELECT
      companies.id,
      'company'::TEXT as entity_type,
      companies.name as title,
      COALESCE(companies.sector, '') as subtitle,
      COALESCE(companies.description, companies.website, '') as snippet,
      '/companies/' || companies.id::TEXT || '/show' as url,
      jsonb_build_object(
        'sector', companies.sector,
        'website', companies.website,
        'city', companies.city,
        'contact_count', (
          SELECT COUNT(*)
          FROM contacts c
          WHERE c.company_id = companies.id
        )
      ) as metadata,
      -- Calculate relevance score (×3 so companies compete with notes)
      (
        COALESCE(ts_rank(
          to_tsvector('english',
            COALESCE(companies.name, '') || ' ' ||
            COALESCE(companies.description, '') || ' ' ||
            COALESCE(companies.website, '') || ' ' ||
            COALESCE(companies.sector, '') || ' ' ||
            COALESCE(companies.phone_number, '')
          ),
          plainto_tsquery('english', search_query)
        ), 0) * 0.7 +
        COALESCE(similarity(COALESCE(companies.name, ''), search_query), 0) * 0.3
      ) * 3 AS relevance_score
    FROM companies
    WHERE
      to_tsvector('english',
        COALESCE(companies.name, '') || ' ' ||
        COALESCE(companies.description, '') || ' ' ||
        COALESCE(companies.website, '') || ' ' ||
        COALESCE(companies.sector, '') || ' ' ||
        COALESCE(companies.phone_number, '')
      ) @@ plainto_tsquery('english', search_query)
      OR
      similarity(COALESCE(companies.name, ''), search_query) > 0.3
      OR
      LOWER(COALESCE(companies.name, '')) LIKE '%' || LOWER(search_query) || '%'
      OR
      -- Match on company phone number
      LOWER(COALESCE(companies.phone_number, '')) LIKE '%' || LOWER(search_query) || '%'
  )
  SELECT * FROM search_results
  ORDER BY
    -- Order by relevance score (highest first)
    search_results.relevance_score DESC,
    -- Then by entity type priority
    CASE search_results.entity_type
      WHEN 'contact' THEN 1
      WHEN 'note' THEN 2
      WHEN 'company' THEN 3
    END,
    -- Finally by ID for consistent ordering (newest first)
    search_results.id DESC
  LIMIT result_limit
  OFFSET result_offset;
END;
$$;
