-- Migration 009: Language certificates (replaces IELTS-only with multi-cert system)
-- Adds requires_language_cert, accepted_language_certs (JSONB), language_cert_effect
-- Keeps requires_ielts / ielts_min / ielts_effect for backward compatibility

ALTER TABLE requirements ADD COLUMN IF NOT EXISTS requires_language_cert BOOLEAN DEFAULT FALSE;
ALTER TABLE requirements ADD COLUMN IF NOT EXISTS accepted_language_certs JSONB;
ALTER TABLE requirements ADD COLUMN IF NOT EXISTS language_cert_effect TEXT DEFAULT 'blocks_if_below';

-- Data migration: Copy existing IELTS data into the new language cert fields
-- Only for rows that have requires_ielts = true
UPDATE requirements
SET
  requires_language_cert = TRUE,
  accepted_language_certs = jsonb_build_array(
    jsonb_build_object('type', 'IELTS', 'min_score', ielts_min)
  ),
  language_cert_effect = COALESCE(ielts_effect, 'blocks_if_below')
WHERE requires_ielts = TRUE AND requires_language_cert = FALSE;
