# Project Instructions — Admission Eligibility SaaS (V3)

## What is this project?

A multi-tenant SaaS platform for education consultancy offices to evaluate student eligibility for university admission. Each office manages its own universities, programs, admission rules, and users.

Currently in V3 phase: internal product for one client (United Education). SaaS features (multi-tenant, billing, white-label) will be added later.

## Who uses it?

- **Advisors**: Evaluate students against university requirements, compare across universities
- **Admins**: Manage universities, programs, requirements, and advisor accounts
- **Owners**: Full control including branding and settings

## Tech stack

- **Framework**: Next.js (App Router)
- **Database**: Supabase (PostgreSQL + Auth + Storage)
- **Styling**: Tailwind CSS + shadcn/ui
- **i18n**: next-intl (Arabic first, translation-ready)
- **Hosting**: Vercel (later)

## Critical rules — ALWAYS follow these

### Arabic UI
- Everything visible to the user must be in **Arabic only** (for now)
- All UI text must come from translation files (`messages/ar.json`), never hardcoded
- Layout must be RTL (right-to-left)
- English is allowed only in: code, filenames, internal keys, database columns

### Architecture
- **Source of truth**: `requirements` + `custom_requirements` tables for evaluation logic
- **JSON fields**: Used ONLY for complex flow logic that cannot be represented as table fields
- **University complexity levels**: simple (table-driven), hybrid (table + custom requirements), complex (needs JSON flow config)
- The evaluation engine reads requirements and builds questions dynamically — questions are NOT stored separately
- The comparison engine reads the same requirements to evaluate all paths

### Database model (hybrid)
Core tables with structured fields + JSON payload fields for complex logic:
- `tenants` — offices/companies
- `users` — advisors, admins, owners (linked to Supabase Auth)
- `universities` — per tenant, with country, type, visibility
- `programs` — per university, with category, complexity_level, metadata JSON
- `requirements` — per program, structured fields (requires_hs, ielts_min, sat_required, etc.)
- `custom_requirements` — per program, structured custom conditions (question + effect + message)
- `scholarship_tiers` — optional, for GPA-based scholarship logic
- `certificate_types` — certificate templates (arabic, british, american, IB) with grading systems and subject rules
- `majors` — specializations within a program (e.g. 18 bachelor majors at Constructor)
- `major_subject_requirements` — per-major, per-certificate-type subject prerequisites
- `audit_log` — who changed what and when

### Row Level Security
- Every table with `tenant_id` must have RLS policies
- Users can only see data belonging to their tenant
- Advisors see only universities assigned to them (or all if no restriction)

### Data integrity
- Do NOT invent admission rules — only use approved reference data
- Do NOT silently change existing business logic
- All requirement changes must be logged in audit_log
- Admin must confirm before saving changes (preview first)

### V2 reference
- The V2 project (admission-tool-v2) contains reference data for 3 universities
- Reference documents are in V2's `docs/reference/` folder
- V3 must produce identical results to V2 for the same inputs (30 test cases verify this)

## Database schema overview

### requirements table (the "comprehensive form")
```
requires_hs, requires_12_years, requires_ielts, ielts_min, ielts_effect,
requires_sat, sat_min, sat_effect, requires_gpa, gpa_min, gpa_effect,
requires_bachelor, requires_entrance_exam, requires_portfolio,
requires_audition, requires_work_experience, requires_research_plan,
ielts_alternatives, result_notes,
a_level_subjects_min, a_level_min_grade, a_level_requires_core
```

### custom_requirements table (structured custom conditions)
```
question_text, question_type (yes_no/select), effect (blocks_admission/makes_conditional),
negative_message, positive_message, sort_order
```

## Certificate types system

* System templates (is_system=true): arabic, british, american, IB — visible to all tenants, readonly
* Tenant custom types (is_system=false): created by admin, only visible to their tenant
* Each program links to a certificate_type via certificate_type_id
* British certificates auto-generate A Level questions from template_questions
* The evaluation engine uses certificate_type properties instead of relying on program names

## Majors and subject requirements

* Each program can have multiple majors (specializations)
* Each major can have subject requirements that vary by certificate type
* Example: Constructor British bachelor → CS major → needs Math A Level C+ and one science A Level
* Example: Constructor Arabic bachelor → CS major → no additional subject requirements
* Majors are optional — programs without majors work exactly as before
* The evaluation engine asks major-selection and subject questions AFTER basic requirements
* Majors are grouped by `group_code` (G1, G2, G3, G4) — majors in the same group share the same subject requirements

## How evaluation works

1. User selects university → program
2. System reads `requirements` for that program
3. For each requirement that is true, system generates a question dynamically:
   - `requires_hs = true` → "هل لدى الطالب شهادة ثانوية؟"
   - `requires_ielts = true, ielts_min = 6.5` → "هل لدى الطالب IELTS بدرجة 6.5 أو أعلى؟"
4. System also reads `custom_requirements` and asks those in order
5. Based on answers, system calculates result: positive / conditional / negative

## How comparison works

1. Advisor enters student profile (HS, certificate type, IELTS, SAT, GPA, bachelor)
2. System reads ALL programs for the tenant's universities
3. For each program, evaluates requirements against the profile
4. Groups results: eligible / conditional / needs more info / not eligible
5. Filters by selected program types (foundation, bachelor, master, etc.)

## File structure
```
app/
  (auth)/login/           — login page
  (advisor)/evaluate/     — step-by-step evaluation
  (advisor)/compare/      — comparison mode
  (admin)/universities/   — manage universities
  (admin)/universities/new/ — add university (comprehensive form)
  (admin)/users/          — manage advisors
  (admin)/settings/       — branding (logo, colors)
  layout.tsx              — root layout with RTL + i18n
components/               — shared UI components
lib/
  supabase.ts             — Supabase client
  evaluation-engine.ts    — builds questions from requirements, calculates results
  comparison-engine.ts    — evaluates student profile against all programs
  auth.ts                 — role-based access control
messages/
  ar.json                 — Arabic translations (primary)
supabase/
  migrations/             — database schema
tests/                    — test cases including V2 parity tests
```

## Roles and permissions

| Role | Can evaluate | Can compare | Can edit universities | Can add universities | Can manage users | Can change branding |
|------|-------------|-------------|----------------------|---------------------|-----------------|-------------------|
| advisor | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| admin | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ |
| owner | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |

## Communication style

The project owner is not a developer. When asking questions:
- Use simple language, not technical jargon
- Give clear options when a decision is needed
- Before coding, give a concise implementation plan

## Current status

### Phase 1 — V3 Internal (IN PROGRESS)
- [ ] Project setup (Next.js + Supabase + Tailwind + next-intl)
- [ ] Database schema + RLS
- [ ] Authentication + roles
- [ ] Migrate 3 universities from V2
- [ ] V2 parity tests (30 cases)
- [ ] Advisor: evaluation flow
- [ ] Advisor: comparison mode
- [ ] Admin: edit universities
- [ ] Admin: add university (comprehensive form)
- [ ] Admin: manage advisors
- [ ] Admin: branding (logo + colors)
- [ ] Professional design

### Phase 2 — Prove internal usage
- [ ] United Education team uses daily
- [ ] Add more universities via admin
- [ ] Fix issues, gather feedback

### Phase 3 — SaaS (FUTURE)
- [ ] Multi-tenant
- [ ] Stripe billing
- [ ] Draft/publish/versioning
- [ ] External customers
