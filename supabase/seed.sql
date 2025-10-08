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
Tornado Tips', '2024-01-12'),
(1, 'Order #12346
Premium Wraps, Lightning Tips', '2024-01-11'),
(1, 'Order #12347
Storm Wraps, Thunder Tips', '2024-01-12'),
(1, 'Order #12348
Blaze Wraps, Fire Tips', '2024-01-13'),
(1, 'Order #12349
Frost Wraps, Ice Tips', '2024-01-14'),
(1, 'Order #12350
Shadow Wraps, Dark Tips', '2024-01-15'),
(1, 'Order #12351
Solar Wraps, Sun Tips', '2024-01-16'),
(1, 'Order #12352
Lunar Wraps, Moon Tips', '2024-01-17'),
(1, 'Order #12353
Cosmic Wraps, Star Tips', '2024-01-18'),
(1, 'Order #12354
Ocean Wraps, Wave Tips', '2024-01-19'),
(1, 'Order #12355
Mountain Wraps, Peak Tips', '2024-01-20'),
(1, 'Order #12356
Forest Wraps, Leaf Tips', '2024-01-21'),
(1, 'Order #12357
Desert Wraps, Sand Tips', '2024-01-22'),
(1, 'Order #12358
Arctic Wraps, Snow Tips', '2024-01-23'),
(1, 'Order #12359
Tropical Wraps, Palm Tips', '2024-01-24'),
(1, 'Order #12360
Urban Wraps, City Tips', '2024-01-25'),
(1, 'Order #12361
Rural Wraps, Farm Tips', '2024-01-26'),
(1, 'Order #12362
Coastal Wraps, Beach Tips', '2024-01-27'),
(1, 'Order #12363
Valley Wraps, River Tips', '2024-01-28'),
(1, 'Order #12364
Plateau Wraps, Mesa Tips', '2024-01-29'),
(1, 'Order #12365
Canyon Wraps, Cliff Tips', '2024-01-30'),
(1, 'Order #12366
Volcano Wraps, Lava Tips', '2024-01-31'),
(1, 'Order #12367
Glacier Wraps, Iceberg Tips', '2024-02-01'),
(1, 'Order #12368
Meadow Wraps, Flower Tips', '2024-02-02'),
(1, 'Order #12369
Cave Wraps, Rock Tips', '2024-02-03'),
(1, 'Order #12370
Sky Wraps, Cloud Tips', '2024-02-04'),
(1, 'Order #12371
Earth Wraps, Stone Tips', '2024-02-05'),
(1, 'Order #12372
Wind Wraps, Breeze Tips', '2024-02-06'),
(1, 'Order #12373
Rain Wraps, Drop Tips', '2024-02-07'),
(1, 'Order #12374
Snow Wraps, Flake Tips', '2024-02-08'),
(1, 'Order #12375
Fog Wraps, Mist Tips', '2024-02-09'),
(1, 'Order #12376
Hail Wraps, Pellet Tips', '2024-02-10'),
(1, 'Order #12377
Sleet Wraps, Slush Tips', '2024-02-11'),
(1, 'Order #12378
Dew Wraps, Moisture Tips', '2024-02-12'),
(1, 'Order #12379
Frost Wraps, Crystal Tips', '2024-02-13'),
(1, 'Order #12380
Heat Wraps, Warmth Tips', '2024-02-14'),
(1, 'Order #12381
Cold Wraps, Chill Tips', '2024-02-15'),
(1, 'Order #12382
Warm Wraps, Cozy Tips', '2024-02-16'),
(1, 'Order #12383
Cool Wraps, Fresh Tips', '2024-02-17'),
(1, 'Order #12384
Hot Wraps, Sizzle Tips', '2024-02-18'),
(1, 'Order #12385
Freeze Wraps, Numb Tips', '2024-02-19'),
(1, 'Order #12386
Melt Wraps, Liquid Tips', '2024-02-20'),
(1, 'Order #12387
Solid Wraps, Hard Tips', '2024-02-21'),
(1, 'Order #12388
Gas Wraps, Vapor Tips', '2024-02-22'),
(1, 'Order #12389
Plasma Wraps, Energy Tips', '2024-02-23'),
(1, 'Order #12390
Quantum Wraps, Particle Tips', '2024-02-24'),
(1, 'Order #12391
Atomic Wraps, Nucleus Tips', '2024-02-25'),
(1, 'Order #12392
Molecular Wraps, Bond Tips', '2024-02-26'),
(1, 'Order #12393
Cellular Wraps, Membrane Tips', '2024-02-27'),
(1, 'Order #12394
Organic Wraps, Carbon Tips', '2024-02-28'),
(1, 'Order #12395
Inorganic Wraps, Mineral Tips', '2024-02-29'),
(1, 'Order #12396
Synthetic Wraps, Polymer Tips', '2024-03-01'),
(1, 'Order #12397
Natural Wraps, Pure Tips', '2024-03-02'),
(1, 'Order #12398
Artificial Wraps, Man-made Tips', '2024-03-03'),
(1, 'Order #12399
Hybrid Wraps, Mixed Tips', '2024-03-04'),
(1, 'Order #12400
Fusion Wraps, Combined Tips', '2024-03-05');

-- Insert test tasks
INSERT INTO tasks (contact_id, type, text, due_date) VALUES 
(1, 'call', 'Follow up on proposal', '2024-01-20'),
(2, 'email', 'Send case studies', '2024-01-15');