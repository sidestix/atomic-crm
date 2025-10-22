-- Add address fields to contacts table to match company address structure
ALTER TABLE contacts ADD COLUMN address text;
ALTER TABLE contacts ADD COLUMN city text;
ALTER TABLE contacts ADD COLUMN zipcode text;
ALTER TABLE contacts ADD COLUMN stateAbbr text;
ALTER TABLE contacts ADD COLUMN country text;
