-- Migration 004: majors and major_subject_requirements tables
-- Adds per-program specializations with certificate-type-specific subject prerequisites

-- ============================================
-- Table: majors
-- ============================================
create table majors (
  id uuid default gen_random_uuid() primary key,
  program_id uuid references programs not null,
  tenant_id uuid references tenants not null,
  name_ar text not null,
  name_en text,
  group_code text,           -- 'G1', 'G2', 'G3', 'G4' etc. for grouping majors with same subject requirements
  sort_order int default 0,
  is_active bool default true,
  created_at timestamptz default now()
);

-- Indexes
create index idx_majors_program_id on majors(program_id);
create index idx_majors_tenant_id on majors(tenant_id);

-- RLS
alter table majors enable row level security;

create policy "Tenant isolation for majors"
  on majors for all
  using (tenant_id = get_user_tenant_id());

-- ============================================
-- Table: major_subject_requirements
-- ============================================
create table major_subject_requirements (
  id uuid default gen_random_uuid() primary key,
  major_id uuid references majors not null,
  certificate_type_id uuid references certificate_types not null,
  tenant_id uuid references tenants not null,
  question_text text not null,
  question_type text not null check (question_type in ('yes_no', 'select')),
  options jsonb,
  effect text not null check (effect in ('blocks_admission', 'makes_conditional')),
  negative_message text,
  positive_message text,
  sort_order int default 0,
  created_at timestamptz default now()
);

-- Indexes
create index idx_major_subject_requirements_major_id on major_subject_requirements(major_id);
create index idx_major_subject_requirements_cert_type on major_subject_requirements(certificate_type_id);

-- RLS
alter table major_subject_requirements enable row level security;

create policy "Tenant isolation for major_subject_requirements"
  on major_subject_requirements for all
  using (tenant_id = get_user_tenant_id());
