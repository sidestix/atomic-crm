-- Add shipping_instructions field to companies table
ALTER TABLE "public"."companies" 
ADD COLUMN "shipping_instructions" TEXT;

