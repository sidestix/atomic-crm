-- Index foreign key columns for faster JOINs and CASCADE operations.
-- Postgres does not create these automatically when you add a foreign key.

-- companies
CREATE INDEX IF NOT EXISTS companies_sales_id_idx ON public.companies (sales_id);

-- contactNotes
CREATE INDEX IF NOT EXISTS "contactNotes_contact_id_idx" ON public."contactNotes" (contact_id);
CREATE INDEX IF NOT EXISTS "contactNotes_sales_id_idx" ON public."contactNotes" (sales_id);

-- contacts
CREATE INDEX IF NOT EXISTS contacts_company_id_idx ON public.contacts (company_id);
CREATE INDEX IF NOT EXISTS contacts_sales_id_idx ON public.contacts (sales_id);

-- dealNotes
CREATE INDEX IF NOT EXISTS "dealNotes_deal_id_idx" ON public."dealNotes" (deal_id);
CREATE INDEX IF NOT EXISTS "dealNotes_sales_id_idx" ON public."dealNotes" (sales_id);

-- deals
CREATE INDEX IF NOT EXISTS deals_company_id_idx ON public.deals (company_id);
CREATE INDEX IF NOT EXISTS deals_sales_id_idx ON public.deals (sales_id);

-- tasks (contact_id, company_id, sales_id)
CREATE INDEX IF NOT EXISTS tasks_contact_id_idx ON public.tasks (contact_id);
CREATE INDEX IF NOT EXISTS tasks_company_id_idx ON public.tasks (company_id);
CREATE INDEX IF NOT EXISTS tasks_sales_id_idx ON public.tasks (sales_id);

-- companyNotes
CREATE INDEX IF NOT EXISTS "companyNotes_company_id_idx" ON public."companyNotes" (company_id);
CREATE INDEX IF NOT EXISTS "companyNotes_sales_id_idx" ON public."companyNotes" (sales_id);
