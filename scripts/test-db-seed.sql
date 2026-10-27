-- Rows a production database already has, so the preview schema push runs against populated tables.
INSERT INTO admins (email, name, password_hash, role)
VALUES ('master@shpe.test', 'Mara Master', '$2b$04$NACOT9LOFcgJq9l/.1YDN.Fpc9oyYUlxH64RmFdQTyCrYbJCScMN6', 'master');

INSERT INTO sponsors (name, tier, website, bg_color, sort_order)
VALUES ('Acme Engineering', 'Gold', 'https://acme.example', '#ffffff', 1);

INSERT INTO members (email, name, password_hash, role, email_confirmed_at, age_confirmed_at, privacy_policy_version, terms_accepted_at)
VALUES ('sam@shpe.test', 'Sam Supporter', '$2b$04$NACOT9LOFcgJq9l/.1YDN.Fpc9oyYUlxH64RmFdQTyCrYbJCScMN6', 'supporter', now(), now(), '2026-01', now());

INSERT INTO events (title, description, location, type, date, time)
VALUES ('General Meeting', 'Kickoff', 'Student Center 221', 'Meeting', '2026-09-03', '6:00 PM');
