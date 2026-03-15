-- ============================================================
-- Migration 008: Dynamic comparison fields for custom_requirements
-- Allows custom_requirements to appear in the comparison form
-- and be evaluated by the comparison engine.
-- ============================================================

-- custom_requirements columns
ALTER TABLE custom_requirements ADD COLUMN IF NOT EXISTS show_in_comparison BOOLEAN DEFAULT FALSE;
ALTER TABLE custom_requirements ADD COLUMN IF NOT EXISTS comparison_input_type TEXT CHECK (comparison_input_type IN ('toggle', 'number', 'select'));
ALTER TABLE custom_requirements ADD COLUMN IF NOT EXISTS comparison_key TEXT;

CREATE INDEX IF NOT EXISTS idx_custom_requirements_comparison ON custom_requirements(show_in_comparison) WHERE show_in_comparison = true;

-- major_subject_requirements columns (for consistency)
ALTER TABLE major_subject_requirements ADD COLUMN IF NOT EXISTS show_in_comparison BOOLEAN DEFAULT FALSE;
ALTER TABLE major_subject_requirements ADD COLUMN IF NOT EXISTS comparison_input_type TEXT CHECK (comparison_input_type IN ('toggle', 'number', 'select'));
ALTER TABLE major_subject_requirements ADD COLUMN IF NOT EXISTS comparison_key TEXT;
