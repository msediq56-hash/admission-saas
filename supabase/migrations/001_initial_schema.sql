-- ============================================================
-- 001_initial_schema.sql
-- مخطط قاعدة البيانات الأولي لمنصة تقييم أهلية القبول
-- ============================================================

-- ---------- الجداول ----------

-- المؤسسات (المستأجرون)
create table tenants (
  id uuid default gen_random_uuid() primary key,
  name text not null,
  slug text unique not null,
  logo_url text,
  primary_color text default '#1a2d47',
  created_at timestamptz default now()
);

-- المستخدمون
create table users (
  id uuid primary key references auth.users,
  tenant_id uuid references tenants not null,
  email text not null,
  full_name text,
  role text not null check (role in ('advisor', 'admin', 'owner')),
  is_active bool default true,
  created_at timestamptz default now()
);

-- الجامعات
create table universities (
  id uuid default gen_random_uuid() primary key,
  tenant_id uuid references tenants not null,
  name text not null,
  country text not null,
  type text check (type in ('public', 'private')),
  is_active bool default true,
  sort_order int default 0,
  created_at timestamptz default now()
);

-- البرامج الأكاديمية
create table programs (
  id uuid default gen_random_uuid() primary key,
  university_id uuid references universities not null,
  tenant_id uuid references tenants not null,
  name text not null,
  category text not null check (category in ('foundation', 'bachelor', 'master', 'phd', 'language')),
  complexity_level text check (complexity_level in ('simple', 'hybrid', 'complex')) default 'simple',
  metadata jsonb,
  is_active bool default true,
  sort_order int default 0,
  created_at timestamptz default now()
);

-- متطلبات القبول
create table requirements (
  id uuid default gen_random_uuid() primary key,
  program_id uuid references programs not null,
  tenant_id uuid references tenants not null,
  requires_hs bool default true,
  requires_12_years bool default false,
  requires_ielts bool default false,
  ielts_min decimal,
  ielts_effect text,
  requires_sat bool default false,
  sat_min int,
  sat_effect text,
  requires_gpa bool default false,
  gpa_min decimal,
  gpa_effect text,
  requires_bachelor bool default false,
  requires_entrance_exam bool default false,
  requires_portfolio bool default false,
  requires_audition bool default false,
  requires_work_experience bool default false,
  requires_research_plan bool default false,
  ielts_alternatives jsonb,
  result_notes text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- متطلبات مخصصة
create table custom_requirements (
  id uuid default gen_random_uuid() primary key,
  program_id uuid references programs not null,
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

-- شرائح المنح الدراسية
create table scholarship_tiers (
  id uuid default gen_random_uuid() primary key,
  program_id uuid references programs not null,
  tenant_id uuid references tenants not null,
  min_gpa decimal not null,
  max_gpa decimal not null,
  scholarship_percent int not null,
  label text,
  sort_order int default 0,
  created_at timestamptz default now()
);

-- سجل التدقيق
create table audit_log (
  id uuid default gen_random_uuid() primary key,
  tenant_id uuid references tenants,
  user_id uuid,
  action text not null,
  table_name text,
  record_id uuid,
  old_data jsonb,
  new_data jsonb,
  created_at timestamptz default now()
);

-- ---------- الفهارس ----------

create index idx_users_tenant_id on users (tenant_id);
create index idx_universities_tenant_id on universities (tenant_id);
create index idx_programs_tenant_id on programs (tenant_id);
create index idx_programs_university_id on programs (university_id);
create index idx_requirements_tenant_id on requirements (tenant_id);
create index idx_requirements_program_id on requirements (program_id);
create index idx_custom_requirements_tenant_id on custom_requirements (tenant_id);
create index idx_custom_requirements_program_id on custom_requirements (program_id);
create index idx_scholarship_tiers_tenant_id on scholarship_tiers (tenant_id);
create index idx_scholarship_tiers_program_id on scholarship_tiers (program_id);
create index idx_audit_log_tenant_id on audit_log (tenant_id);

-- ---------- دالة معرف المستأجر ----------

create or replace function get_user_tenant_id()
returns uuid
language sql
stable
security definer
as $$
  select tenant_id from users where id = auth.uid()
$$;

-- ---------- تفعيل أمان مستوى الصف ----------

alter table tenants enable row level security;
alter table users enable row level security;
alter table universities enable row level security;
alter table programs enable row level security;
alter table requirements enable row level security;
alter table custom_requirements enable row level security;
alter table scholarship_tiers enable row level security;
alter table audit_log enable row level security;

-- ---------- سياسات أمان مستوى الصف ----------

-- tenants
create policy "tenants_select" on tenants for select using (id = get_user_tenant_id());
create policy "tenants_insert" on tenants for insert with check (id = get_user_tenant_id());
create policy "tenants_update" on tenants for update using (id = get_user_tenant_id());
create policy "tenants_delete" on tenants for delete using (id = get_user_tenant_id());

-- users
create policy "users_select" on users for select using (tenant_id = get_user_tenant_id());
create policy "users_insert" on users for insert with check (tenant_id = get_user_tenant_id());
create policy "users_update" on users for update using (tenant_id = get_user_tenant_id());
create policy "users_delete" on users for delete using (tenant_id = get_user_tenant_id());

-- universities
create policy "universities_select" on universities for select using (tenant_id = get_user_tenant_id());
create policy "universities_insert" on universities for insert with check (tenant_id = get_user_tenant_id());
create policy "universities_update" on universities for update using (tenant_id = get_user_tenant_id());
create policy "universities_delete" on universities for delete using (tenant_id = get_user_tenant_id());

-- programs
create policy "programs_select" on programs for select using (tenant_id = get_user_tenant_id());
create policy "programs_insert" on programs for insert with check (tenant_id = get_user_tenant_id());
create policy "programs_update" on programs for update using (tenant_id = get_user_tenant_id());
create policy "programs_delete" on programs for delete using (tenant_id = get_user_tenant_id());

-- requirements
create policy "requirements_select" on requirements for select using (tenant_id = get_user_tenant_id());
create policy "requirements_insert" on requirements for insert with check (tenant_id = get_user_tenant_id());
create policy "requirements_update" on requirements for update using (tenant_id = get_user_tenant_id());
create policy "requirements_delete" on requirements for delete using (tenant_id = get_user_tenant_id());

-- custom_requirements
create policy "custom_requirements_select" on custom_requirements for select using (tenant_id = get_user_tenant_id());
create policy "custom_requirements_insert" on custom_requirements for insert with check (tenant_id = get_user_tenant_id());
create policy "custom_requirements_update" on custom_requirements for update using (tenant_id = get_user_tenant_id());
create policy "custom_requirements_delete" on custom_requirements for delete using (tenant_id = get_user_tenant_id());

-- scholarship_tiers
create policy "scholarship_tiers_select" on scholarship_tiers for select using (tenant_id = get_user_tenant_id());
create policy "scholarship_tiers_insert" on scholarship_tiers for insert with check (tenant_id = get_user_tenant_id());
create policy "scholarship_tiers_update" on scholarship_tiers for update using (tenant_id = get_user_tenant_id());
create policy "scholarship_tiers_delete" on scholarship_tiers for delete using (tenant_id = get_user_tenant_id());

-- audit_log (فقط قراءة وإدراج)
create policy "audit_log_select" on audit_log for select using (tenant_id = get_user_tenant_id());
create policy "audit_log_insert" on audit_log for insert with check (tenant_id = get_user_tenant_id());
