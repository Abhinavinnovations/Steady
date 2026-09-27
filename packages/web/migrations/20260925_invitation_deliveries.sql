-- Additive, manually reviewed migration. Apply only once after a verified backup.
-- Applied to configured database September 25, 2026; see EMAIL_SETUP.md.
-- No existing table changes, relationship backfill, sends or alert replay.
CREATE TABLE invitation_deliveries (
  id TEXT PRIMARY KEY NOT NULL,
  partner_id INTEGER NOT NULL REFERENCES partners(id) ON DELETE CASCADE,
  outcome TEXT NOT NULL,
  provider_id TEXT,
  code TEXT NOT NULL,
  payload TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  lease_until INTEGER NOT NULL
);
CREATE INDEX invitation_deliveries_partner_created ON invitation_deliveries(partner_id, created_at);
