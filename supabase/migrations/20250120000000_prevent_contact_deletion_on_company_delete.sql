-- Change contacts.company_id foreign key constraint from CASCADE to SET NULL
-- This prevents contacts from being deleted when their associated company is deleted
-- Instead, contacts will remain but their company_id will be set to NULL

-- Drop the existing constraint
ALTER TABLE "public"."contacts" 
DROP CONSTRAINT IF EXISTS "contacts_company_id_fkey";

-- Recreate the constraint with ON DELETE SET NULL instead of ON DELETE CASCADE
ALTER TABLE "public"."contacts" 
ADD CONSTRAINT "contacts_company_id_fkey" 
FOREIGN KEY (company_id) 
REFERENCES companies(id) 
ON UPDATE CASCADE 
ON DELETE SET NULL 
NOT VALID;

-- Validate the constraint
ALTER TABLE "public"."contacts" 
VALIDATE CONSTRAINT "contacts_company_id_fkey";

