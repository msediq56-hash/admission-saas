-- ============================================================
-- Migration 003: Certificate Types System
-- Adds certificate_types table, links programs to cert types,
-- and extends requirements with A Level fields.
-- ============================================================

-- 1. Create certificate_types table
create table certificate_types (
  id uuid default gen_random_uuid() primary key,
  tenant_id uuid references tenants,
  slug text not null,
  name_ar text not null,
  name_en text not null,
  grading_system text not null check (grading_system in ('percentage', 'a_level_grades', 'gpa_4', 'ib_points')),
  scale_min decimal default 0,
  scale_max decimal default 100,
  has_subject_requirements bool default false,
  min_subjects int,
  min_grade text,
  requires_core_subjects bool default false,
  template_questions jsonb,
  is_system bool default false,
  sort_order int default 0,
  created_at timestamptz default now()
);

-- 2. Alter programs table
alter table programs add column certificate_type_id uuid references certificate_types;

-- 3. Alter requirements table
alter table requirements add column a_level_subjects_min int;
alter table requirements add column a_level_min_grade text;
alter table requirements add column a_level_requires_core bool default false;

-- 4. RLS for certificate_types
alter table certificate_types enable row level security;

-- SELECT: visible if tenant_id matches OR tenant_id IS NULL (system templates)
create policy "certificate_types_select"
  on certificate_types for select
  using (tenant_id is null or tenant_id = get_user_tenant_id());

-- INSERT: only for own tenant, non-system types
create policy "certificate_types_insert"
  on certificate_types for insert
  with check (tenant_id = get_user_tenant_id() and is_system = false);

-- UPDATE: only for own tenant, non-system types
create policy "certificate_types_update"
  on certificate_types for update
  using (tenant_id = get_user_tenant_id() and is_system = false);

-- DELETE: only for own tenant, non-system types
create policy "certificate_types_delete"
  on certificate_types for delete
  using (tenant_id = get_user_tenant_id() and is_system = false);

-- 5. Indexes
create index idx_certificate_types_tenant_id on certificate_types(tenant_id);
create index idx_certificate_types_slug on certificate_types(slug);
create index idx_programs_certificate_type_id on programs(certificate_type_id);

-- 6. Seed system certificate types (tenant_id = NULL, is_system = true)
insert into certificate_types (tenant_id, slug, name_ar, name_en, grading_system, scale_min, scale_max, has_subject_requirements, min_subjects, min_grade, requires_core_subjects, template_questions, is_system, sort_order)
values
  (
    null,
    'arabic',
    'شهادات عربية',
    'Arabic certificates',
    'percentage',
    0, 100,
    false,
    null, null, false,
    null,
    true, 1
  ),
  (
    null,
    'british',
    'شهادة بريطانية (A Level)',
    'British A Levels',
    'a_level_grades',
    null, null,
    true,
    3, 'C', true,
    '[{"text":"هل لدى الطالب 3 مواد A Level؟","type":"yes_no","effect":"blocks_admission","negative_message":"غير مؤهل — يحتاج 3 مواد A Level"},{"text":"هل جميع المواد الثلاثة بدرجة C أو أعلى؟","type":"yes_no","effect":"blocks_admission","negative_message":"درجات أقل من C"},{"text":"هل لدى الطالب مادتان من المواد الأساسية المعترف بها؟","type":"yes_no","effect":"blocks_admission","negative_message":"لا يستوفي شرط المواد الأساسية"}]'::jsonb,
    true, 2
  ),
  (
    null,
    'american',
    'شهادة أمريكية',
    'American High School Diploma',
    'gpa_4',
    0, 4.0,
    false,
    null, null, false,
    null,
    true, 3
  ),
  (
    null,
    'ib',
    'البكالوريا الدولية (IB)',
    'International Baccalaureate',
    'ib_points',
    0, 45,
    false,
    null, null, false,
    null,
    true, 4
  );
