-- Enable the pg_trgm extension for fuzzy matching
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Create an optimized global search function that combines full-text search with fuzzy matching
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
      -- Calculate relevance score based on full-text search rank and trigram similarity
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
      ) as relevance_score
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

    UNION ALL

    -- Search in contact notes
    SELECT
      "contactNotes".id,
      'note'::TEXT as entity_type,
      'Note from ' || COALESCE(contacts.first_name || ' ' || contacts.last_name, 'Unknown Contact') as title,
      TO_CHAR("contactNotes".date, 'MMM DD, YYYY') as subtitle,
      LEFT("contactNotes".text, 200) as snippet,
      '/contacts/' || contacts.id::TEXT || '/show?note=' || "contactNotes".id::TEXT as url,
      jsonb_build_object(
        'contact_name', COALESCE(contacts.first_name || ' ' || contacts.last_name, ''),
        'contact_id', contacts.id,
        'note_date', "contactNotes".date,
        'attachment_count', COALESCE(array_length("contactNotes".attachments, 1), 0)
      ) as metadata,
      -- Calculate relevance score for notes
      (
        COALESCE(ts_rank(
          to_tsvector('english', COALESCE("contactNotes".text, '')),
          plainto_tsquery('english', search_query)
        ), 0) * 0.8 +
        COALESCE(similarity(COALESCE("contactNotes".text, ''), search_query), 0) * 0.2
      ) as relevance_score
    FROM "contactNotes"
    LEFT JOIN contacts ON "contactNotes".contact_id = contacts.id
    WHERE
      to_tsvector('english', COALESCE("contactNotes".text, '')) @@ plainto_tsquery('english', search_query)
      OR
      similarity(COALESCE("contactNotes".text, ''), search_query) > 0.3
      OR
      LOWER(COALESCE("contactNotes".text, '')) LIKE '%' || LOWER(search_query) || '%'

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
      -- Calculate relevance score for companies
      (
        COALESCE(ts_rank(
          to_tsvector('english',
            COALESCE(companies.name, '') || ' ' ||
            COALESCE(companies.description, '') || ' ' ||
            COALESCE(companies.website, '') || ' ' ||
            COALESCE(companies.sector, '')
          ),
          plainto_tsquery('english', search_query)
        ), 0) * 0.7 +
        COALESCE(similarity(COALESCE(companies.name, ''), search_query), 0) * 0.3
      ) as relevance_score
    FROM companies
    WHERE
      to_tsvector('english',
        COALESCE(companies.name, '') || ' ' ||
        COALESCE(companies.description, '') || ' ' ||
        COALESCE(companies.website, '') || ' ' ||
        COALESCE(companies.sector, '')
      ) @@ plainto_tsquery('english', search_query)
      OR
      similarity(COALESCE(companies.name, ''), search_query) > 0.3
      OR
      LOWER(COALESCE(companies.name, '')) LIKE '%' || LOWER(search_query) || '%'
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
    -- Finally by ID for consistent ordering
    search_results.id
  LIMIT result_limit
  OFFSET result_offset;
END;
$$;

-- Create optimized indexes for full-text search
CREATE INDEX IF NOT EXISTS idx_contacts_fts
ON contacts USING gin(to_tsvector('english',
  COALESCE(first_name, '') || ' ' ||
  COALESCE(last_name, '') || ' ' ||
  COALESCE(title, '') || ' ' ||
  COALESCE(background, '')
));

CREATE INDEX IF NOT EXISTS idx_contact_notes_fts
ON "contactNotes" USING gin(to_tsvector('english', COALESCE(text, '')));

CREATE INDEX IF NOT EXISTS idx_companies_fts
ON companies USING gin(to_tsvector('english',
  COALESCE(name, '') || ' ' ||
  COALESCE(description, '') || ' ' ||
  COALESCE(website, '') || ' ' ||
  COALESCE(sector, '')
));

-- Create trigram indexes for fuzzy matching
CREATE INDEX IF NOT EXISTS idx_contacts_trgm
ON contacts USING gin(
  (COALESCE(first_name, '') || ' ' || COALESCE(last_name, '')) gin_trgm_ops
);

CREATE INDEX IF NOT EXISTS idx_contact_notes_trgm
ON "contactNotes" USING gin(COALESCE(text, '') gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_companies_trgm
ON companies USING gin(COALESCE(name, '') gin_trgm_ops);

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION global_search_optimized(TEXT, INTEGER, INTEGER) TO authenticated;
