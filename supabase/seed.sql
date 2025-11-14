-- Insert test companies first
INSERT INTO companies (name, sector, website, city, "stateAbbr", description) VALUES 
('Acme Corp', 'Technology', 'https://acme.com', 'San Francisco', 'CA', 'Leading software company'),
('TechStart Inc', 'Startup', 'https://techstart.com', 'Austin', 'TX', 'Innovative startup in AI space');

-- Insert test contacts (after companies exist)
INSERT INTO contacts (first_name, last_name, email_jsonb, title, gender, first_seen, last_seen, company_id, sales_id) VALUES 
('John', 'Smith', '[{"email": "john@example.com", "type": "work"}]', 'Sales Manager', NULL, '2024-01-01T00:00:00Z', '2024-01-15T00:00:00Z', 1, NULL),
('Jane', 'Doe', '[{"email": "jane@example.com", "type": "work"}]', 'Marketing Director', NULL, '2024-01-02T00:00:00Z', '2024-01-16T00:00:00Z', 2, NULL),
('Mike', 'Johnson', '[{"email": "mike@example.com", "type": "work"}]', 'CEO', NULL, '2024-01-03T00:00:00Z', '2024-01-17T00:00:00Z', 1, NULL);

-- Insert test contact notes
INSERT INTO "contactNotes" (contact_id, text, date, sales_id) VALUES 
(1, 'Order #12345
Boundless (wraps), Revolution Tips', '2024-01-10', NULL),
(2, 'Order #46234
Tornado Tips', '2024-01-12', NULL),
(1, 'Order #12346
Premium Wraps, Lightning Tips', '2024-01-11', NULL),
(1, 'Order #12347
Storm Wraps, Thunder Tips', '2024-01-12', NULL),
(1, 'Order #12348
Blaze Wraps, Fire Tips', '2024-01-13', NULL),
(1, 'Order #12349
Frost Wraps, Ice Tips', '2024-01-14', NULL),
(1, 'Order #12350
Shadow Wraps, Dark Tips', '2024-01-15', NULL),
(1, 'Order #12351
Solar Wraps, Sun Tips', '2024-01-16', NULL),
(1, 'Order #12352
Lunar Wraps, Moon Tips', '2024-01-17', NULL),
(1, 'Order #12353
Cosmic Wraps, Star Tips', '2024-01-18', NULL),
(1, 'Order #12354
Ocean Wraps, Wave Tips', '2024-01-19', NULL),
(1, 'Order #12355
Mountain Wraps, Peak Tips', '2024-01-20', NULL),
(1, 'Order #12356
Forest Wraps, Leaf Tips', '2024-01-21', NULL),
(1, 'Order #12357
Desert Wraps, Sand Tips', '2024-01-22', NULL),
(1, 'Order #12358
Arctic Wraps, Snow Tips', '2024-01-23', NULL),
(1, 'Order #12359
Tropical Wraps, Palm Tips', '2024-01-24', NULL),
(1, 'Order #12360
Urban Wraps, City Tips', '2024-01-25', NULL),
(1, 'Order #12361
Rural Wraps, Farm Tips', '2024-01-26', NULL),
(1, 'Order #12362
Coastal Wraps, Beach Tips', '2024-01-27', NULL),
(1, 'Order #12363
Valley Wraps, River Tips', '2024-01-28', NULL),
(1, 'Order #12364
Plateau Wraps, Mesa Tips', '2024-01-29', NULL),
(1, 'Order #12365
Canyon Wraps, Cliff Tips', '2024-01-30', NULL),
(1, 'Order #12366
Volcano Wraps, Lava Tips', '2024-01-31', NULL),
(1, 'Order #12367
Glacier Wraps, Iceberg Tips', '2024-02-01', NULL),
(1, 'Order #12368
Meadow Wraps, Flower Tips', '2024-02-02', NULL),
(1, 'Order #12369
Cave Wraps, Rock Tips', '2024-02-03', NULL),
(1, 'Order #12370
Sky Wraps, Cloud Tips', '2024-02-04', NULL),
(1, 'Order #12371
Earth Wraps, Stone Tips', '2024-02-05', NULL),
(1, 'Order #12372
Wind Wraps, Breeze Tips', '2024-02-06', NULL),
(1, 'Order #12373
Rain Wraps, Drop Tips', '2024-02-07', NULL),
(1, 'Order #12374
Snow Wraps, Flake Tips', '2024-02-08', NULL),
(1, 'Order #12375
Fog Wraps, Mist Tips', '2024-02-09', NULL),
(1, 'Order #12376
Hail Wraps, Pellet Tips', '2024-02-10', NULL),
(1, 'Order #12377
Sleet Wraps, Slush Tips', '2024-02-11', NULL),
(1, 'Order #12378
Dew Wraps, Moisture Tips', '2024-02-12', NULL),
(1, 'Order #12379
Frost Wraps, Crystal Tips', '2024-02-13', NULL),
(1, 'Order #12380
Heat Wraps, Warmth Tips', '2024-02-14', NULL),
(1, 'Order #12381
Cold Wraps, Chill Tips', '2024-02-15', NULL),
(1, 'Order #12382
Warm Wraps, Cozy Tips', '2024-02-16', NULL),
(1, 'Order #12383
Cool Wraps, Fresh Tips', '2024-02-17', NULL),
(1, 'Order #12384
Hot Wraps, Sizzle Tips', '2024-02-18', NULL),
(1, 'Order #12385
Freeze Wraps, Numb Tips', '2024-02-19', NULL),
(1, 'Order #12386
Melt Wraps, Liquid Tips', '2024-02-20', NULL),
(1, 'Order #12387
Solid Wraps, Hard Tips', '2024-02-21', NULL),
(1, 'Order #12388
Gas Wraps, Vapor Tips', '2024-02-22', NULL),
(1, 'Order #12389
Plasma Wraps, Energy Tips', '2024-02-23', NULL),
(1, 'Order #12390
Quantum Wraps, Particle Tips', '2024-02-24', NULL),
(1, 'Order #12391
Atomic Wraps, Nucleus Tips', '2024-02-25', NULL),
(1, 'Order #12392
Molecular Wraps, Bond Tips', '2024-02-26', NULL),
(1, 'Order #12393
Cellular Wraps, Membrane Tips', '2024-02-27', NULL),
(1, 'Order #12394
Organic Wraps, Carbon Tips', '2024-02-28', NULL),
(1, 'Order #12395
Inorganic Wraps, Mineral Tips', '2024-02-29', NULL),
(1, 'Order #12396
Synthetic Wraps, Polymer Tips', '2024-03-01', NULL),
(1, 'Order #12397
Natural Wraps, Pure Tips', '2024-03-02', NULL),
(1, 'Order #12398
Artificial Wraps, Man-made Tips', '2024-03-03', NULL),
(1, 'Order #12399
Hybrid Wraps, Mixed Tips', '2024-03-04', NULL),
(1, 'Order #12400
Fusion Wraps, Combined Tips', '2024-03-05', NULL);

-- Insert test company notes
INSERT INTO "companyNotes" (company_id, text, date, sales_id) VALUES 
(1, 'Order #20001
Enterprise Package, Premium Support', '2024-01-05', NULL),
(1, 'Order #20002
Advanced Features, API Access', '2024-01-12', NULL),
(1, 'Order #20003
Demo Scheduled, Custom Integration', '2024-01-18', NULL),
(2, 'Order #20004
Startup Package, Basic Features', '2024-01-08', NULL),
(2, 'Order #20005
Vendor Evaluation, Competitive Analysis', '2024-01-15', NULL),
(2, 'Order #20006
API Integration, Developer Tools', '2024-01-22', NULL);

-- Insert test tasks
INSERT INTO tasks (contact_id, type, text, due_date, sales_id) VALUES 
(1, 'call', 'Follow up on proposal', '2024-01-20', NULL),
(2, 'email', 'Send case studies', '2024-01-15', NULL);