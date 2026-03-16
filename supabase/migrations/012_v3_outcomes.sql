-- V3.2: Add outcomes column + tracking fields to requirement_rules
-- Additive only — does not modify or remove existing columns

ALTER TABLE requirement_rules
  ADD COLUMN IF NOT EXISTS outcomes JSONB NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS source_note TEXT,
  ADD COLUMN IF NOT EXISTS verified_at TIMESTAMPTZ;

COMMENT ON COLUMN requirement_rules.outcomes IS 'V3.2: Maps outcomeKey → OutcomeDefinition. Empty {} means rule not yet migrated to V3 — not valid for V3 engine execution';
COMMENT ON COLUMN requirement_rules.source_note IS 'V3.2: Origin tracking — who/what created this rule';
COMMENT ON COLUMN requirement_rules.verified_at IS 'V3.2: When this rule was last verified against official requirements';
