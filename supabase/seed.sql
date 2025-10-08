-- Insert test companies first
INSERT INTO companies (name, sector, website, city, "stateAbbr", description) VALUES 
('Acme Corp', 'Technology', 'https://acme.com', 'San Francisco', 'CA', 'Leading software company'),
('TechStart Inc', 'Startup', 'https://techstart.com', 'Austin', 'TX', 'Innovative startup in AI space');

-- Insert test contacts (after companies exist)
INSERT INTO contacts (first_name, last_name, email_jsonb, title, background, company_id) VALUES 
('John', 'Smith', '[{"email": "john@example.com", "type": "work"}]', 'Sales Manager', 'Experienced sales professional with 10+ years in tech', 1),
('Jane', 'Doe', '[{"email": "jane@example.com", "type": "work"}]', 'Marketing Director', 'Creative marketing leader specializing in digital campaigns', 2),
('Mike', 'Johnson', '[{"email": "mike@example.com", "type": "work"}]', 'CEO', 'Serial entrepreneur with multiple successful exits', 1);

-- Insert test contact notes
INSERT INTO "contactNotes" (contact_id, text, date) VALUES 
(1, 'Order #12345
Boundless (wraps), Revolution Tips', '2024-01-10'),
(2, 'Order #46234
Tornado Tips', '2024-01-12');

-- Insert test tasks
INSERT INTO tasks (contact_id, type, text, due_date) VALUES 
(1, 'call', 'Follow up on proposal', '2024-01-20'),
(2, 'email', 'Send case studies', '2024-01-15');