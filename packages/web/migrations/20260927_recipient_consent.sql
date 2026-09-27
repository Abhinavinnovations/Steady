-- Additive only. No existing relationship is enrolled or backfilled.
CREATE TABLE recipient_links (
 token_hash TEXT PRIMARY KEY NOT NULL,
 partner_id INTEGER REFERENCES partners(id) ON DELETE SET NULL,
 owner_id TEXT NOT NULL REFERENCES user(id) ON DELETE CASCADE,
 recipient_key TEXT NOT NULL,
 kind TEXT NOT NULL CHECK(kind IN ('invite','stop')),
 expires_at INTEGER,
 decision TEXT CHECK(decision IN ('accepted','declined')),
 created_at INTEGER NOT NULL
);
CREATE INDEX recipient_links_partner ON recipient_links(partner_id);
CREATE TABLE recipient_consents (
 partner_id INTEGER PRIMARY KEY NOT NULL REFERENCES partners(id) ON DELETE CASCADE,
 accepted_at INTEGER NOT NULL,
 start_date TEXT NOT NULL,
 version TEXT NOT NULL
);
CREATE TABLE recipient_suppressions (
 recipient_key TEXT PRIMARY KEY NOT NULL,
 stopped_at INTEGER NOT NULL
);
CREATE TABLE miss_alert_deliveries (
 id INTEGER PRIMARY KEY AUTOINCREMENT,
 user_id TEXT NOT NULL REFERENCES user(id) ON DELETE CASCADE,
 partner_id INTEGER REFERENCES partners(id) ON DELETE SET NULL,
 missed_date TEXT NOT NULL,
 outcome TEXT NOT NULL CHECK(outcome IN ('sending','accepted','failed','unknown','suppressed')),
 code TEXT NOT NULL,
 provider_id TEXT,
 created_at INTEGER NOT NULL,
 updated_at INTEGER NOT NULL
);
CREATE UNIQUE INDEX miss_alert_deliveries_user_day ON miss_alert_deliveries(user_id,missed_date);
