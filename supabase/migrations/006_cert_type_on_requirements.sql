-- ============================================================
-- Migration 006: Move certificate_type to requirements level
-- Adds certificate_type_id to requirements, custom_requirements,
-- and scholarship_tiers so one program can have multiple
-- requirement rows (one per certificate type).
-- ============================================================

-- 1. Add certificate_type_id to requirements
alter table requirements
  add column certificate_type_id uuid references certificate_types;

-- 2. Add certificate_type_id to custom_requirements
alter table custom_requirements
  add column certificate_type_id uuid references certificate_types;

-- 3. Add certificate_type_id to scholarship_tiers
alter table scholarship_tiers
  add column certificate_type_id uuid references certificate_types;

-- 4. Indexes for the new columns
create index idx_requirements_certificate_type_id
  on requirements(certificate_type_id);
create index idx_custom_requirements_certificate_type_id
  on custom_requirements(certificate_type_id);
create index idx_scholarship_tiers_certificate_type_id
  on scholarship_tiers(certificate_type_id);

-- 5. Drop the unique constraint on requirements.program_id (if any)
--    so that multiple requirement rows per program are allowed.
--    (The original schema did not add a UNIQUE constraint, but
--     just in case, we add a composite index for performance.)
create index idx_requirements_program_cert
  on requirements(program_id, certificate_type_id);
