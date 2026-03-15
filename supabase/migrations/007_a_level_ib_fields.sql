-- ============================================================
-- Migration 007: Add structured A Level and IB fields to requirements
-- Moves A Level logic from custom_requirements (free text) to proper columns.
-- Note: a_level_subjects_min, a_level_min_grade, a_level_requires_core
-- already exist from migration 003.
-- ============================================================

-- A Level fields
ALTER TABLE requirements ADD COLUMN IF NOT EXISTS requires_a_levels BOOLEAN DEFAULT FALSE;
ALTER TABLE requirements ADD COLUMN IF NOT EXISTS a_level_effect TEXT DEFAULT 'blocks_admission';

-- IB fields
ALTER TABLE requirements ADD COLUMN IF NOT EXISTS requires_ib BOOLEAN DEFAULT FALSE;
ALTER TABLE requirements ADD COLUMN IF NOT EXISTS ib_min_points INTEGER;
ALTER TABLE requirements ADD COLUMN IF NOT EXISTS ib_effect TEXT DEFAULT 'blocks_admission';
