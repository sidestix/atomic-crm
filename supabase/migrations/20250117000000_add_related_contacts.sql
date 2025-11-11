-- Add related_contact_ids array field to contacts table for many-to-many relationships
ALTER TABLE contacts ADD COLUMN "related_contact_ids" bigint[];

-- Create index for array searches (GIN index for array containment queries)
CREATE INDEX contacts_related_contact_ids_idx ON contacts USING GIN (related_contact_ids);

