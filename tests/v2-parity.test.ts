// ============================================================
// V2 Parity Tests — 30 test cases for the comparison engine
// Verifies V3 produces identical results to V2 for all 3 universities
// Run: npx tsx tests/v2-parity.test.ts
// ============================================================

import {
  evaluateProfileAgainstProgram,
  compareAllPrograms,
  type StudentProfile,
  type ProgramEntry,
} from "../src/lib/comparison-engine";
import type {
  Requirement,
  CustomRequirement,
  ScholarshipTier,
} from "../src/lib/evaluation-engine";
import assert from "node:assert";

// ============================================================
// Test fixtures — mirror seed data exactly
// ============================================================

function makeEntry(
  partial: Partial<ProgramEntry> & {
    programName: string;
    category: string;
    requirements: Requirement;
  }
): ProgramEntry {
  return {
    programId: partial.programId || crypto.randomUUID(),
    programName: partial.programName,
    universityName: partial.universityName || "جامعة تجريبية",
    country: partial.country || "ألمانيا",
    universityType: partial.universityType || "private",
    category: partial.category,
    certificateTypeSlug: partial.certificateTypeSlug ?? null,
    requirements: partial.requirements,
    customRequirements: partial.customRequirements || [],
    scholarshipTiers: partial.scholarshipTiers || [],
  };
}

// --- Constructor University ---

const CONSTRUCTOR_BACHELOR_ARABIC = makeEntry({
  programName: "بكالوريوس — شهادات عربية",
  universityName: "جامعة كونستركتر",
  category: "bachelor",
  certificateTypeSlug: "arabic",
  requirements: {
    requires_hs: true,
    requires_sat: true,
    sat_min: 1200,
    sat_effect: "conditional: يحتاج تقديم SAT بدرجة 1200+ قبل 31 ديسمبر",
    requires_ielts: true,
    ielts_min: 6.5,
    ielts_effect: "interview: سيتم ترتيب مقابلة لتقييم اللغة",
    requires_gpa: true,
    gpa_min: 80,
    gpa_effect: "scholarship",
    ielts_alternatives: { duolingo: 110 },
    result_notes: "الرسوم: 20,000 يورو/سنة",
  },
  scholarshipTiers: [
    { id: "s1", min_gpa: 95, max_gpa: 100, scholarship_percent: 35, label: "7000 يورو", sort_order: 1 },
    { id: "s2", min_gpa: 90, max_gpa: 94.99, scholarship_percent: 25, label: "5000 يورو", sort_order: 2 },
    { id: "s3", min_gpa: 85, max_gpa: 89.99, scholarship_percent: 15, label: "3000-5000 يورو", sort_order: 3 },
    { id: "s4", min_gpa: 80, max_gpa: 84.99, scholarship_percent: 15, label: "3000 يورو", sort_order: 4 },
    { id: "s5", min_gpa: 0, max_gpa: 79.99, scholarship_percent: 15, label: "3000 يورو محتملة", sort_order: 5 },
  ],
});

const CONSTRUCTOR_BACHELOR_BRITISH = makeEntry({
  programName: "بكالوريوس — شهادة بريطانية",
  universityName: "جامعة كونستركتر",
  category: "bachelor",
  certificateTypeSlug: "british",
  requirements: {
    requires_hs: true,
    requires_sat: true,
    sat_min: 1200,
    sat_effect: "conditional: يحتاج تقديم SAT بدرجة 1200+ قبل 31 ديسمبر",
    requires_ielts: true,
    ielts_min: 6.5,
    ielts_effect: "interview: سيتم ترتيب مقابلة لتقييم اللغة",
    ielts_alternatives: { duolingo: 110 },
    result_notes: "الرسوم: 20,000 يورو/سنة",
  },
  customRequirements: [
    { id: "cr1", question_text: "هل لدى الطالب 3 مواد A Level؟", question_type: "yes_no", effect: "blocks_admission", negative_message: "غير مؤهل — يحتاج 3 مواد A Level. جرّب السنة التأسيسية IFY", sort_order: 1 },
    { id: "cr2", question_text: "هل جميع المواد الثلاثة بدرجة C أو أعلى؟", question_type: "yes_no", effect: "blocks_admission", negative_message: "درجات أقل من C — جرّب مسار السنة التأسيسية IFY", sort_order: 2 },
    { id: "cr3", question_text: "هل لدى الطالب مادتان من المواد الأساسية المعترف بها؟", question_type: "yes_no", effect: "blocks_admission", negative_message: "لا يستوفي شرط المواد الأساسية", sort_order: 3 },
  ],
});

const CONSTRUCTOR_FOUNDATION_ARABIC = makeEntry({
  programName: "سنة تأسيسية — شهادات عربية",
  universityName: "جامعة كونستركتر",
  category: "foundation",
  certificateTypeSlug: "arabic",
  requirements: {
    requires_hs: true,
    result_notes: "الرسوم: 13,000 يورو",
  },
});

const CONSTRUCTOR_FOUNDATION_BRITISH = makeEntry({
  programName: "سنة تأسيسية — شهادة بريطانية",
  universityName: "جامعة كونستركتر",
  category: "foundation",
  certificateTypeSlug: "british",
  requirements: {
    requires_hs: true,
    result_notes: "الرسوم: 13,000 يورو",
  },
  customRequirements: [
    { id: "cr4", question_text: "هل لدى الطالب 3 مواد A Level؟", question_type: "yes_no", effect: "blocks_admission", negative_message: "يحتاج 3 مواد A Level — قد يحتاج مسار بديل", sort_order: 1 },
  ],
});

const CONSTRUCTOR_MASTER = makeEntry({
  programName: "ماجستير",
  universityName: "جامعة كونستركتر",
  category: "master",
  certificateTypeSlug: null,
  requirements: {
    requires_hs: false,
    requires_bachelor: true,
    requires_ielts: true,
    ielts_min: 6.5,
    ielts_effect: "interview: سيتم ترتيب مقابلة لتقييم اللغة",
    ielts_alternatives: { duolingo: 110 },
    result_notes: "يحتاج اختيار البرنامج في التقييم التفصيلي",
  },
});

// --- SRH University ---

const SRH_IEF = makeEntry({
  programName: "برنامج اللغة الإنجليزية التأسيسي المكثف (IEF)",
  universityName: "جامعة SRH",
  category: "foundation",
  certificateTypeSlug: "arabic",
  requirements: {
    requires_hs: true,
    requires_ielts: true,
    ielts_min: 4.0,
    ielts_effect: "blocks_if_below",
    result_notes: "الرسوم: 15,150 يورو (شاملة فصل اللغة + فصلين فاونديشن)",
  },
  customRequirements: [
    { id: "cr5", question_text: "هل مستوى اللغة أعلى من IELTS 5.0؟", question_type: "yes_no", effect: "makes_conditional", positive_message: "مستوى اللغة أعلى — جرّب الفاونديشن العادي", sort_order: 1 },
    { id: "cr6", question_text: "هل مستوى اللغة IELTS 6.5 أو أعلى؟", question_type: "yes_no", effect: "makes_conditional", positive_message: "مؤهل للبكالوريوس المباشر", sort_order: 2 },
  ],
});

const SRH_FOUNDATION_BUSINESS = makeEntry({
  programName: "فاونديشن في البزنس",
  universityName: "جامعة SRH",
  category: "foundation",
  certificateTypeSlug: "arabic",
  requirements: {
    requires_hs: true,
    requires_ielts: true,
    ielts_min: 5.0,
    ielts_effect: "blocks_if_below",
    result_notes: "الموقع: Berlin | القبول: أكتوبر ويناير",
  },
});

const SRH_FOUNDATION_CREATIVE = makeEntry({
  programName: "فاونديشن في الدراسات الإبداعية",
  universityName: "جامعة SRH",
  category: "foundation",
  certificateTypeSlug: "arabic",
  requirements: {
    requires_hs: true,
    requires_ielts: true,
    ielts_min: 5.0,
    ielts_effect: "blocks_if_below",
    result_notes: "الموقع: Berlin | القبول: أكتوبر ويناير",
  },
});

const SRH_FOUNDATION_ENGINEERING = makeEntry({
  programName: "فاونديشن الهندسة وتكنولوجيا المعلومات",
  universityName: "جامعة SRH",
  category: "foundation",
  certificateTypeSlug: "arabic",
  requirements: {
    requires_hs: true,
    requires_ielts: true,
    ielts_min: 5.0,
    ielts_effect: "blocks_if_below",
    result_notes: "الموقع: Berlin | القبول: أكتوبر ويناير",
  },
});

const SRH_PRE_MASTER = makeEntry({
  programName: "بري ماستر (ما قبل الماجستير)",
  universityName: "جامعة SRH",
  category: "foundation",
  certificateTypeSlug: "arabic",
  requirements: {
    requires_hs: false,
    requires_bachelor: true,
    requires_ielts: true,
    ielts_min: 5.5,
    ielts_effect: "blocks_if_below",
    result_notes: "الموقع: برلين | الرسوم: 5,950 يورو | المدة: فصل واحد",
  },
});

const SRH_BACHELOR = makeEntry({
  programName: "بكالوريوس",
  universityName: "جامعة SRH",
  category: "bachelor",
  certificateTypeSlug: "arabic",
  requirements: {
    requires_hs: true,
    requires_ielts: true,
    ielts_min: 6.5,
    ielts_effect: "blocks_if_below",
    result_notes: "بعض البرامج تتطلب بورتفوليو أو أوديشن (يُحدد في التقييم التفصيلي)",
  },
});

const SRH_MASTER = makeEntry({
  programName: "ماجستير",
  universityName: "جامعة SRH",
  category: "master",
  certificateTypeSlug: "arabic",
  requirements: {
    requires_hs: false,
    requires_bachelor: true,
    requires_ielts: true,
    ielts_min: 6.5,
    ielts_effect: "blocks_if_below",
    result_notes: "بعض البرامج تتطلب خبرة عملية أو بورتفوليو",
  },
  customRequirements: [
    { id: "cr7", question_text: "هل مستوى اللغة بين IELTS 5.5 و 6.4؟", question_type: "yes_no", effect: "makes_conditional", positive_message: "مؤهل للبري ماستر (فصل تحضيري ثم ماجستير)", sort_order: 1 },
  ],
});

// --- Debrecen University ---

const DEBRECEN_FOUNDATION = makeEntry({
  programName: "فاونديشن",
  universityName: "جامعة ديبريسن",
  country: "هنغاريا",
  universityType: "public",
  category: "foundation",
  certificateTypeSlug: "arabic",
  requirements: {
    requires_hs: true,
    requires_12_years: true,
    result_notes: "رسوم تقديم: 150$ + رسوم امتحان: 350$ | 7 برامج تحضيرية متاحة",
  },
});

const DEBRECEN_BACHELOR = makeEntry({
  programName: "بكالوريوس",
  universityName: "جامعة ديبريسن",
  country: "هنغاريا",
  universityType: "public",
  category: "bachelor",
  certificateTypeSlug: "arabic",
  requirements: {
    requires_hs: true,
    requires_12_years: true,
    requires_entrance_exam: true,
    result_notes: "رسوم تقديم: 150$ + رسوم امتحان: 350$ | الرسوم: 6,000-10,000$/سنة | 34 تخصصاً — مشروط بامتحان القبول",
  },
});

const DEBRECEN_MASTER = makeEntry({
  programName: "ماجستير",
  universityName: "جامعة ديبريسن",
  country: "هنغاريا",
  universityType: "public",
  category: "master",
  certificateTypeSlug: "arabic",
  requirements: {
    requires_hs: false,
    requires_bachelor: true,
    requires_ielts: true,
    ielts_min: 6.0,
    ielts_effect: "blocks_if_below",
    result_notes: "رسوم تقديم: 150$ + رسوم امتحان: 350$ | الرسوم: 5,500-10,000$/سنة | 43 تخصصاً",
  },
});

const DEBRECEN_PHD = makeEntry({
  programName: "دكتوراة",
  universityName: "جامعة ديبريسن",
  country: "هنغاريا",
  universityType: "public",
  category: "phd",
  certificateTypeSlug: "arabic",
  requirements: {
    requires_hs: false,
    requires_bachelor: true,
    requires_ielts: true,
    ielts_min: 6.0,
    ielts_effect: "blocks_if_below",
    requires_research_plan: true,
    result_notes: "رسوم تقديم: 150$ + رسوم امتحان: 350$ | 26 تخصصاً",
  },
});

const DEBRECEN_MEDICAL = makeEntry({
  programName: "طبيات / صيدلة",
  universityName: "جامعة ديبريسن",
  country: "هنغاريا",
  universityType: "public",
  category: "bachelor",
  certificateTypeSlug: "arabic",
  requirements: {
    requires_hs: true,
    requires_12_years: true,
    requires_entrance_exam: true,
    result_notes: "رسوم تقديم: 150$ + رسوم امتحان: 350$ | الرسوم: 8,000-17,500$/سنة | 3 برامج: طب، أسنان، صيدلة",
  },
  customRequirements: [
    { id: "cr8", question_text: "ما هو اختيار مواد امتحان القبول؟", question_type: "select", options: ["أحياء + فيزياء", "أحياء + كيمياء"], effect: "makes_conditional", positive_message: "مشروط بدخول واجتياز امتحان القبول", sort_order: 1 },
  ],
});

// ============================================================
// Default profiles
// ============================================================

const BASE_ARABIC: StudentProfile = {
  hasHighSchool: true,
  hasBachelor: false,
  has12Years: true,
  ielts: null,
  hasSAT: false,
  satScore: null,
  gpa: null,
  hasResearchPlan: false,
  certificateType: "arabic",
  aLevelCount: null,
  aLevelCCount: null,
};

const BASE_BRITISH: StudentProfile = {
  hasHighSchool: true,
  hasBachelor: false,
  has12Years: true,
  ielts: null,
  hasSAT: false,
  satScore: null,
  gpa: null,
  hasResearchPlan: false,
  certificateType: "british",
  aLevelCount: 3,
  aLevelCCount: 3,
};

// ============================================================
// Test runner
// ============================================================

let passed = 0;
let failed = 0;
const failures: string[] = [];

function test(name: string, fn: () => void) {
  try {
    fn();
    passed++;
    console.log(`  ✓ ${name}`);
  } catch (e: unknown) {
    failed++;
    const msg = e instanceof Error ? e.message : String(e);
    failures.push(`${name}: ${msg}`);
    console.log(`  ✗ ${name}`);
    console.log(`    → ${msg}`);
  }
}

// ============================================================
// Constructor — Arabic certificate (8 cases)
// ============================================================
console.log("\n═══ جامعة كونستركتر — شهادات عربية ═══");

// Case 1
test("عربي + ثانوية + SAT 1300 + IELTS 7.0 + معدل 96 → بكالوريوس مؤهل + منحة 35%", () => {
  const profile: StudentProfile = { ...BASE_ARABIC, hasSAT: true, satScore: 1300, ielts: 7.0, gpa: 96 };
  const result = evaluateProfileAgainstProgram(profile, CONSTRUCTOR_BACHELOR_ARABIC);
  assert.strictEqual(result.status, "positive");
  assert.ok(result.scholarshipInfo?.includes("35%"), `منحة يجب أن تحتوي 35%, حصلنا: ${result.scholarshipInfo}`);
});

// Case 2
test("عربي + ثانوية + SAT 1300 + IELTS 7.0 + معدل 85 → بكالوريوس مؤهل + منحة 15%", () => {
  const profile: StudentProfile = { ...BASE_ARABIC, hasSAT: true, satScore: 1300, ielts: 7.0, gpa: 85 };
  const result = evaluateProfileAgainstProgram(profile, CONSTRUCTOR_BACHELOR_ARABIC);
  assert.strictEqual(result.status, "positive");
  assert.ok(result.scholarshipInfo?.includes("15%"), `منحة يجب أن تحتوي 15%, حصلنا: ${result.scholarshipInfo}`);
});

// Case 3
test("عربي + ثانوية + بدون SAT + IELTS 7.0 → بكالوريوس مشروط (يحتاج SAT)", () => {
  const profile: StudentProfile = { ...BASE_ARABIC, ielts: 7.0 };
  const result = evaluateProfileAgainstProgram(profile, CONSTRUCTOR_BACHELOR_ARABIC);
  assert.strictEqual(result.status, "conditional");
  assert.ok(result.reason.includes("SAT"), `السبب يجب أن يذكر SAT, حصلنا: ${result.reason}`);
});

// Case 4
test("عربي + ثانوية + SAT 1300 + بدون IELTS → بكالوريوس مؤهل (ملاحظة مقابلة، ليس حظر)", () => {
  const profile: StudentProfile = { ...BASE_ARABIC, hasSAT: true, satScore: 1300 };
  const result = evaluateProfileAgainstProgram(profile, CONSTRUCTOR_BACHELOR_ARABIC);
  // Interview effect should NOT block — status should be positive (no SAT condition since SAT >= 1200)
  assert.strictEqual(result.status, "positive");
  assert.ok(result.notes.some(n => n.includes("مقابلة")), `يجب أن تحتوي ملاحظة المقابلة`);
});

// Case 5
test("عربي + بدون ثانوية → بكالوريوس غير مؤهل", () => {
  const profile: StudentProfile = { ...BASE_ARABIC, hasHighSchool: false };
  const result = evaluateProfileAgainstProgram(profile, CONSTRUCTOR_BACHELOR_ARABIC);
  assert.strictEqual(result.status, "negative");
});

// Case 6
test("عربي + ثانوية → سنة تأسيسية مؤهل", () => {
  const result = evaluateProfileAgainstProgram(BASE_ARABIC, CONSTRUCTOR_FOUNDATION_ARABIC);
  assert.strictEqual(result.status, "positive");
});

// Case 7
test("عربي + بدون ثانوية → سنة تأسيسية غير مؤهل", () => {
  const profile: StudentProfile = { ...BASE_ARABIC, hasHighSchool: false };
  const result = evaluateProfileAgainstProgram(profile, CONSTRUCTOR_FOUNDATION_ARABIC);
  assert.strictEqual(result.status, "negative");
});

// Case 8
test("عربي + بكالوريوس + IELTS 7.0 → ماجستير مؤهل", () => {
  const profile: StudentProfile = { ...BASE_ARABIC, hasBachelor: true, ielts: 7.0 };
  const result = evaluateProfileAgainstProgram(profile, CONSTRUCTOR_MASTER);
  assert.strictEqual(result.status, "positive");
});

// ============================================================
// Constructor — British certificate (7 cases)
// ============================================================
console.log("\n═══ جامعة كونستركتر — شهادة بريطانية ═══");

// Case 9
test("بريطاني + 3 A Level + 3 C+ + SAT 1300 + IELTS 7.0 → بكالوريوس مؤهل", () => {
  const profile: StudentProfile = { ...BASE_BRITISH, hasSAT: true, satScore: 1300, ielts: 7.0 };
  const result = evaluateProfileAgainstProgram(profile, CONSTRUCTOR_BACHELOR_BRITISH);
  assert.strictEqual(result.status, "positive");
});

// Case 10
test("بريطاني + 3 A Level + 2 C+ → بكالوريوس غير مؤهل (درجات أقل من C)", () => {
  const profile: StudentProfile = { ...BASE_BRITISH, aLevelCCount: 2, hasSAT: true, satScore: 1300, ielts: 7.0 };
  const result = evaluateProfileAgainstProgram(profile, CONSTRUCTOR_BACHELOR_BRITISH);
  assert.strictEqual(result.status, "negative");
  assert.ok(result.reason.includes("C"), `السبب يجب أن يذكر C, حصلنا: ${result.reason}`);
});

// Case 11
test("بريطاني + 2 A Level → بكالوريوس غير مؤهل (يحتاج 3)", () => {
  const profile: StudentProfile = { ...BASE_BRITISH, aLevelCount: 2, aLevelCCount: 2, hasSAT: true, satScore: 1300, ielts: 7.0 };
  const result = evaluateProfileAgainstProgram(profile, CONSTRUCTOR_BACHELOR_BRITISH);
  assert.strictEqual(result.status, "negative");
  assert.ok(result.reason.includes("3 مواد A Level"), `السبب يجب أن يذكر 3 A Level, حصلنا: ${result.reason}`);
});

// Case 12
test("بريطاني + 3 A Level + 3 C+ + بدون SAT → بكالوريوس مشروط (يحتاج SAT)", () => {
  const profile: StudentProfile = { ...BASE_BRITISH, ielts: 7.0 };
  const result = evaluateProfileAgainstProgram(profile, CONSTRUCTOR_BACHELOR_BRITISH);
  assert.strictEqual(result.status, "conditional");
  assert.ok(result.reason.includes("SAT"), `السبب يجب أن يذكر SAT, حصلنا: ${result.reason}`);
});

// Case 13
test("بريطاني + 3 A Level + 3 C+ → سنة تأسيسية مؤهل", () => {
  const result = evaluateProfileAgainstProgram(BASE_BRITISH, CONSTRUCTOR_FOUNDATION_BRITISH);
  assert.strictEqual(result.status, "positive");
});

// Case 14
test("بريطاني + 3 A Level + 1 C+ → سنة تأسيسية مؤهل (لا يحتاج C للفاونديشن)", () => {
  const profile: StudentProfile = { ...BASE_BRITISH, aLevelCCount: 1 };
  const result = evaluateProfileAgainstProgram(profile, CONSTRUCTOR_FOUNDATION_BRITISH);
  assert.strictEqual(result.status, "positive");
});

// Case 15
test("بريطاني + 2 A Level → سنة تأسيسية غير مؤهل (يحتاج 3)", () => {
  const profile: StudentProfile = { ...BASE_BRITISH, aLevelCount: 2, aLevelCCount: 2 };
  const result = evaluateProfileAgainstProgram(profile, CONSTRUCTOR_FOUNDATION_BRITISH);
  assert.strictEqual(result.status, "negative");
  assert.ok(result.reason.includes("3 مواد A Level"), `السبب يجب أن يذكر 3 A Level, حصلنا: ${result.reason}`);
});

// ============================================================
// SRH (8 cases)
// ============================================================
console.log("\n═══ جامعة SRH ═══");

// Case 16
test("ثانوية + IELTS 4.5 → IEF مؤهل", () => {
  const profile: StudentProfile = { ...BASE_ARABIC, ielts: 4.5 };
  const result = evaluateProfileAgainstProgram(profile, SRH_IEF);
  assert.strictEqual(result.status, "positive");
});

// Case 17
test("ثانوية + IELTS 3.5 → IEF غير مؤهل (أقل من 4.0)", () => {
  const profile: StudentProfile = { ...BASE_ARABIC, ielts: 3.5 };
  const result = evaluateProfileAgainstProgram(profile, SRH_IEF);
  assert.strictEqual(result.status, "negative");
  assert.ok(result.reason.includes("IELTS"), `السبب يجب أن يذكر IELTS, حصلنا: ${result.reason}`);
});

// Case 18
test("ثانوية + بدون IELTS → IEF غير مؤهل", () => {
  const result = evaluateProfileAgainstProgram(BASE_ARABIC, SRH_IEF);
  assert.strictEqual(result.status, "negative");
});

// Case 19
test("ثانوية + IELTS 5.5 → فاونديشن بزنس مؤهل", () => {
  const profile: StudentProfile = { ...BASE_ARABIC, ielts: 5.5 };
  const result = evaluateProfileAgainstProgram(profile, SRH_FOUNDATION_BUSINESS);
  assert.strictEqual(result.status, "positive");
});

// Case 20
test("ثانوية + IELTS 4.5 → فاونديشن بزنس غير مؤهل (أقل من 5.0)", () => {
  const profile: StudentProfile = { ...BASE_ARABIC, ielts: 4.5 };
  const result = evaluateProfileAgainstProgram(profile, SRH_FOUNDATION_BUSINESS);
  assert.strictEqual(result.status, "negative");
});

// Case 21
test("ثانوية + IELTS 7.0 → بكالوريوس SRH مؤهل", () => {
  const profile: StudentProfile = { ...BASE_ARABIC, ielts: 7.0 };
  const result = evaluateProfileAgainstProgram(profile, SRH_BACHELOR);
  assert.strictEqual(result.status, "positive");
});

// Case 22
test("ثانوية + IELTS 5.5 → بكالوريوس SRH غير مؤهل (أقل من 6.5)", () => {
  const profile: StudentProfile = { ...BASE_ARABIC, ielts: 5.5 };
  const result = evaluateProfileAgainstProgram(profile, SRH_BACHELOR);
  assert.strictEqual(result.status, "negative");
});

// Case 23
test("بكالوريوس + IELTS 7.0 → ماجستير SRH مؤهل", () => {
  const profile: StudentProfile = { ...BASE_ARABIC, hasBachelor: true, ielts: 7.0 };
  const result = evaluateProfileAgainstProgram(profile, SRH_MASTER);
  assert.strictEqual(result.status, "positive");
});

// ============================================================
// Debrecen (7 cases)
// ============================================================
console.log("\n═══ جامعة ديبريسن ═══");

// Case 24
test("ثانوية + 12 سنة → فاونديشن ديبريسن مؤهل", () => {
  const result = evaluateProfileAgainstProgram(BASE_ARABIC, DEBRECEN_FOUNDATION);
  assert.strictEqual(result.status, "positive");
});

// Case 25
test("ثانوية + بدون 12 سنة → فاونديشن ديبريسن غير مؤهل", () => {
  const profile: StudentProfile = { ...BASE_ARABIC, has12Years: false };
  const result = evaluateProfileAgainstProgram(profile, DEBRECEN_FOUNDATION);
  assert.strictEqual(result.status, "negative");
});

// Case 26
test("ثانوية + 12 سنة → بكالوريوس ديبريسن مشروط (امتحان قبول)", () => {
  const result = evaluateProfileAgainstProgram(BASE_ARABIC, DEBRECEN_BACHELOR);
  assert.strictEqual(result.status, "conditional");
  assert.ok(result.reason.includes("امتحان"), `السبب يجب أن يذكر امتحان, حصلنا: ${result.reason}`);
});

// Case 27
test("بكالوريوس + IELTS 6.5 → ماجستير ديبريسن مؤهل", () => {
  const profile: StudentProfile = { ...BASE_ARABIC, hasBachelor: true, ielts: 6.5 };
  const result = evaluateProfileAgainstProgram(profile, DEBRECEN_MASTER);
  assert.strictEqual(result.status, "positive");
});

// Case 28
test("بكالوريوس + IELTS 5.0 → ماجستير ديبريسن غير مؤهل", () => {
  const profile: StudentProfile = { ...BASE_ARABIC, hasBachelor: true, ielts: 5.0 };
  const result = evaluateProfileAgainstProgram(profile, DEBRECEN_MASTER);
  assert.strictEqual(result.status, "negative");
});

// Case 29
test("بكالوريوس + IELTS 6.5 + خطة بحث → دكتوراة مؤهل", () => {
  const profile: StudentProfile = { ...BASE_ARABIC, hasBachelor: true, ielts: 6.5, hasResearchPlan: true };
  const result = evaluateProfileAgainstProgram(profile, DEBRECEN_PHD);
  assert.strictEqual(result.status, "positive");
});

// Case 30
test("بكالوريوس + IELTS 6.5 + بدون خطة بحث → دكتوراة مشروط", () => {
  const profile: StudentProfile = { ...BASE_ARABIC, hasBachelor: true, ielts: 6.5 };
  const result = evaluateProfileAgainstProgram(profile, DEBRECEN_PHD);
  assert.strictEqual(result.status, "conditional");
  assert.ok(result.reason.includes("بحث"), `السبب يجب أن يذكر بحث, حصلنا: ${result.reason}`);
});

// ============================================================
// Cross-program suggestions test (filter-after-comparison fix)
// ============================================================
console.log("\n═══ اقتراحات عبر البرامج ═══");

test("اقتراحات الترقية: مؤهل للفاونديشن + البكالوريوس → الفاونديشن يحتوي اقتراح ترقية", () => {
  // Student eligible for both foundation and bachelor at Constructor
  const profile: StudentProfile = { ...BASE_ARABIC, hasSAT: true, satScore: 1300, ielts: 7.0, gpa: 90 };
  const entries = [CONSTRUCTOR_FOUNDATION_ARABIC, CONSTRUCTOR_BACHELOR_ARABIC];
  const results = compareAllPrograms(profile, entries);

  // Find foundation result
  const foundationResult = results.find(r => r.category === "foundation");
  assert.ok(foundationResult, "يجب أن يكون هناك نتيجة فاونديشن");
  assert.strictEqual(foundationResult!.status, "positive");
  // Foundation should have upgrade suggestion since bachelor is also eligible
  assert.ok(
    foundationResult!.notes.some(n => n.includes("💡") && n.includes("البكالوريوس")),
    `الفاونديشن يجب أن يحتوي اقتراح ترقية للبكالوريوس, الملاحظات: ${JSON.stringify(foundationResult!.notes)}`
  );
});

// ============================================================
// Summary
// ============================================================
console.log("\n════════════════════════════════════════");
console.log(`النتائج: ${passed} نجاح، ${failed} فشل من أصل ${passed + failed} اختبار`);
if (failures.length > 0) {
  console.log("\nالاختبارات الفاشلة:");
  for (const f of failures) {
    console.log(`  ✗ ${f}`);
  }
}
console.log("════════════════════════════════════════\n");

process.exit(failed > 0 ? 1 : 0);
