-- Migration: Add AS Level and O Level / GCSE structured fields for British certificates
-- These complement the existing A Level fields

ALTER TABLE requirements ADD COLUMN IF NOT EXISTS requires_as_levels BOOLEAN DEFAULT FALSE;
ALTER TABLE requirements ADD COLUMN IF NOT EXISTS as_level_subjects_min INTEGER;
ALTER TABLE requirements ADD COLUMN IF NOT EXISTS as_level_min_grade TEXT;
ALTER TABLE requirements ADD COLUMN IF NOT EXISTS as_level_effect TEXT DEFAULT 'blocks_admission';

ALTER TABLE requirements ADD COLUMN IF NOT EXISTS requires_o_levels BOOLEAN DEFAULT FALSE;
ALTER TABLE requirements ADD COLUMN IF NOT EXISTS o_level_subjects_min INTEGER;
ALTER TABLE requirements ADD COLUMN IF NOT EXISTS o_level_min_grade TEXT;
ALTER TABLE requirements ADD COLUMN IF NOT EXISTS o_level_effect TEXT DEFAULT 'blocks_admission';
