-- Add company_id column to tasks table
ALTER TABLE "public"."tasks" 
ADD COLUMN "company_id" bigint;

-- Make contact_id nullable (tasks can now be associated with either contact or company)
ALTER TABLE "public"."tasks" 
ALTER COLUMN "contact_id" DROP NOT NULL;

-- Add foreign key constraint for company_id
ALTER TABLE "public"."tasks" 
ADD CONSTRAINT "tasks_company_id_fkey" 
FOREIGN KEY (company_id) 
REFERENCES companies(id) 
ON UPDATE CASCADE 
ON DELETE CASCADE 
NOT VALID;

ALTER TABLE "public"."tasks" 
VALIDATE CONSTRAINT "tasks_company_id_fkey";

-- Add check constraint to ensure at least one of contact_id or company_id is set
ALTER TABLE "public"."tasks" 
ADD CONSTRAINT "tasks_contact_or_company_check" 
CHECK (
  (contact_id IS NOT NULL AND company_id IS NULL) OR 
  (contact_id IS NULL AND company_id IS NOT NULL)
);

