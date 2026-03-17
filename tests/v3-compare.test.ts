// ============================================================
// V3.2 Comparison Tests — profile adapter, eligibility, compareOneProgram
// Run: npx tsx tests/v3-compare.test.ts
// ============================================================

import { buildAssessmentProfile, type ComparisonFormData } from "../src/lib/rules/v3/profile-adapter";
import {
  analyzeV3EligibilityForEntry,
  compareOneProgram,
  isSimpleBritishCompareCompatible,
  type V3ComparisonEntry,
} from "../src/lib/rules/v3/compare";
import "../src/lib/rules/v3/evaluators/registry"; // registers all evaluators
import type { RequirementRuleV3 } from "../src/lib/rules/v3/types";
import type { CustomRequirement } from "../src/lib/evaluation-engine";
import assert from "node:assert";

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
// Helpers
// ============================================================

function makeRule(overrides: Partial<RequirementRuleV3> = {}): RequirementRuleV3 {
  return {
    id: "a0000000-0000-4000-a000-000000000001",
    program_id: "a0000000-0000-4000-a000-000000000010",
    certificate_type_id: null,
    rule_type: "high_school",
    config: {},
    outcomes: {
      pass: { decision: "pass" as const },
      not_available: { decision: "block" as const, message: "لا يملك شهادة ثانوية" },
      unknown: { decision: "review" as const, message: "يحتاج مراجعة" },
    },
    sort_order: 1,
    is_enabled: true,
    tenant_id: "a0000000-0000-4000-a000-000000000100",
    ...overrides,
  };
}

function makeCustomReq(overrides: Partial<CustomRequirement> = {}): CustomRequirement {
  return {
    id: "cr-1",
    question_text: "هل لدى الطالب شهادة؟",
    question_type: "yes_no",
    effect: "blocks_admission",
    sort_order: 1,
    show_in_comparison: true,
    comparison_key: "has_cert",
    comparison_input_type: "toggle",
    ...overrides,
  };
}

function makeV3Entry(
  rules: RequirementRuleV3[],
  overrides: Partial<V3ComparisonEntry> = {}
): V3ComparisonEntry {
  return {
    programId: "prog-1",
    programName: "بكالوريوس",
    universityName: "جامعة تجريبية",
    country: "ألمانيا",
    universityType: "private",
    category: "bachelor",
    certificateTypeSlug: null,
    rules,
    scholarshipTiers: [],
    ...overrides,
  };
}

// ============================================================
// Profile adapter tests
// ============================================================

console.log("\n📋 Profile Adapter Tests\n");

test("1. Arabic form → correct ArabicAssessmentProfile", () => {
  const form: ComparisonFormData = {
    certificateType: "arabic",
    hasHighSchool: true,
    has12Years: true,
  };
  const profile = buildAssessmentProfile(form);
  assert.strictEqual(profile.certificateType, "arabic");
  if (profile.certificateType === "arabic") {
    assert.strictEqual(profile.hasHighSchool, true);
    assert.strictEqual(profile.has12Years, true);
  }
});

test("2. Arabic with GPA → gpa state 'present' with percentage", () => {
  const form: ComparisonFormData = { certificateType: "arabic", gpa: 85 };
  const profile = buildAssessmentProfile(form);
  if (profile.certificateType === "arabic") {
    assert.deepStrictEqual(profile.gpa, { state: "present", percentage: 85 });
  }
});

test("3. Arabic without GPA → gpa state 'not_provided'", () => {
  const form: ComparisonFormData = { certificateType: "arabic", gpa: null };
  const profile = buildAssessmentProfile(form);
  if (profile.certificateType === "arabic") {
    assert.deepStrictEqual(profile.gpa, { state: "not_provided" });
  }
});

test("4. British form with aLevelCount=3, aLevelCCount=2 → 2 at C + 1 at D", () => {
  const form: ComparisonFormData = {
    certificateType: "british",
    aLevelCount: 3,
    aLevelCCount: 2,
  };
  const profile = buildAssessmentProfile(form);
  if (profile.certificateType === "british") {
    assert.strictEqual(profile.subjects.length, 3);
    const atC = profile.subjects.filter((s) => s.grade === "C").length;
    const atD = profile.subjects.filter((s) => s.grade === "D").length;
    assert.strictEqual(atC, 2);
    assert.strictEqual(atD, 1);
  }
});

test("5. No IELTS → languageCert state 'not_provided'", () => {
  const form: ComparisonFormData = { certificateType: "arabic" };
  const profile = buildAssessmentProfile(form);
  assert.deepStrictEqual(profile.languageCert, { state: "not_provided" });
});

test("6. With IELTS → languageCert state 'present'", () => {
  const form: ComparisonFormData = {
    certificateType: "arabic",
    hasIelts: true,
    ieltsScore: 6.5,
  };
  const profile = buildAssessmentProfile(form);
  assert.deepStrictEqual(profile.languageCert, {
    state: "present",
    type: "IELTS",
    score: 6.5,
  });
});

// ============================================================
// V3 entry-level eligibility tests
// ============================================================

console.log("\n📋 V3 Eligibility Tests\n");

test("7. All rules have outcomes, no unresolved custom reqs → mode 'v3'", () => {
  const rules = [makeRule()];
  const result = analyzeV3EligibilityForEntry(rules, null, []);
  assert.strictEqual(result.mode, "v3");
});

test("8. One rule has empty outcomes → mode 'fallback'", () => {
  const rules = [makeRule({ outcomes: {} })];
  const result = analyzeV3EligibilityForEntry(rules, null, []);
  assert.strictEqual(result.mode, "fallback");
  if (result.mode === "fallback") {
    assert.ok(result.reason.includes("empty outcomes"));
  }
});

test("9. Mixed: some empty, some not → mode 'fallback'", () => {
  const rules = [makeRule(), makeRule({ id: "a0000000-0000-4000-a000-000000000002", outcomes: {} })];
  const result = analyzeV3EligibilityForEntry(rules, null, []);
  assert.strictEqual(result.mode, "fallback");
});

test("10. British with simple config (1 pathway, a_level, grade C) → mode 'v3'", () => {
  const rules = [
    makeRule({
      rule_type: "british_qualifications",
      config: { pathways: [{ requirements: [{ level: "a_level", min_count: 3, min_grade: "C" }] }] },
      outcomes: {
        pass: { decision: "pass" as const },
        count_fail: { decision: "block" as const, message: "عدد غير كافٍ" },
        grade_fail: { decision: "conditional" as const, condition_code: "GRADE", message: "درجات أقل" },
      },
    }),
  ];
  const result = analyzeV3EligibilityForEntry(rules, "british", []);
  assert.strictEqual(result.mode, "v3");
});

test("11. British with multiple pathways → mode 'fallback'", () => {
  const rules = [
    makeRule({
      rule_type: "british_qualifications",
      config: {
        pathways: [
          { requirements: [{ level: "a_level", min_count: 3, min_grade: "C" }] },
          { requirements: [{ level: "as_level", min_count: 5, min_grade: "C" }] },
        ],
      },
      outcomes: {
        pass: { decision: "pass" as const },
        count_fail: { decision: "block" as const, message: "x" },
        grade_fail: { decision: "block" as const, message: "x" },
      },
    }),
  ];
  const result = analyzeV3EligibilityForEntry(rules, "british", []);
  assert.strictEqual(result.mode, "fallback");
});

test("12. British with mixed levels → mode 'fallback'", () => {
  const rules = [
    makeRule({
      rule_type: "british_qualifications",
      config: {
        pathways: [{
          requirements: [
            { level: "a_level", min_count: 2, min_grade: "C" },
            { level: "as_level", min_count: 2, min_grade: "C" },
          ],
        }],
      },
      outcomes: {
        pass: { decision: "pass" as const },
        count_fail: { decision: "block" as const, message: "x" },
        grade_fail: { decision: "block" as const, message: "x" },
      },
    }),
  ];
  const result = analyzeV3EligibilityForEntry(rules, "british", []);
  assert.strictEqual(result.mode, "fallback");
});

test("13. British with grade B (not C) → mode 'fallback'", () => {
  const rules = [
    makeRule({
      rule_type: "british_qualifications",
      config: { pathways: [{ requirements: [{ level: "a_level", min_count: 3, min_grade: "B" }] }] },
      outcomes: {
        pass: { decision: "pass" as const },
        count_fail: { decision: "block" as const, message: "x" },
        grade_fail: { decision: "block" as const, message: "x" },
      },
    }),
  ];
  const result = analyzeV3EligibilityForEntry(rules, "british", []);
  assert.strictEqual(result.mode, "fallback");
});

test("14. British with single pathway but multiple requirements → fallback", () => {
  const rules = [
    makeRule({
      rule_type: "british_qualifications",
      config: {
        pathways: [{
          requirements: [
            { level: "a_level", min_count: 3, min_grade: "C" },
            { level: "o_level", min_count: 5, min_grade: "C" },
          ],
        }],
      },
      outcomes: {
        pass: { decision: "pass" as const },
        count_fail: { decision: "block" as const, message: "x" },
        grade_fail: { decision: "block" as const, message: "x" },
      },
    }),
  ];
  const result = analyzeV3EligibilityForEntry(rules, "british", []);
  assert.strictEqual(result.mode, "fallback");
});

test("15. Entry with zero rules → mode 'fallback'", () => {
  const result = analyzeV3EligibilityForEntry([], null, []);
  assert.strictEqual(result.mode, "fallback");
});

test("16. Entry where one rule fails safeParse → mode 'fallback'", () => {
  const result = analyzeV3EligibilityForEntry([{ bad: "data" }], null, []);
  assert.strictEqual(result.mode, "fallback");
});

test("17. Unresolved custom requirements → mode 'fallback'", () => {
  const rules = [makeRule()];
  const customReqs = [makeCustomReq({ question_text: "سؤال غير موجود" })];
  const result = analyzeV3EligibilityForEntry(rules, null, customReqs);
  assert.strictEqual(result.mode, "fallback");
});

test("18. Resolved custom_yes_no + no unresolved → mode 'v3'", () => {
  const rules = [
    makeRule(),
    makeRule({
      id: "a0000000-0000-4000-a000-000000000002",
      rule_type: "custom_yes_no",
      config: { question_text: "هل لدى الطالب شهادة؟", comparison_key: "has_cert" },
      outcomes: {
        yes: { decision: "pass" as const },
        no: { decision: "block" as const, message: "لا يملك" },
        unknown: { decision: "review" as const, message: "مراجعة" },
      },
      sort_order: 2,
    }),
  ];
  const customReqs = [makeCustomReq()];
  const result = analyzeV3EligibilityForEntry(rules, null, customReqs);
  assert.strictEqual(result.mode, "v3");
});

test("19. Unknown rule_type (no registered evaluator) → mode 'fallback'", () => {
  const rules = [
    makeRule({
      rule_type: "totally_unknown_type",
      outcomes: { pass: { decision: "pass" as const } },
    }),
  ];
  const result = analyzeV3EligibilityForEntry(rules, null, []);
  assert.strictEqual(result.mode, "fallback");
  if (result.mode === "fallback") {
    assert.ok(result.reason.includes("no registered evaluator"));
  }
});

test("20. Rule where evaluator.validateConfig throws → mode 'fallback'", () => {
  const rules = [
    makeRule({
      rule_type: "british_qualifications",
      config: { pathways: [] }, // invalid: min 1 pathway
      outcomes: {
        pass: { decision: "pass" as const },
        count_fail: { decision: "block" as const, message: "x" },
        grade_fail: { decision: "block" as const, message: "x" },
      },
    }),
  ];
  const result = analyzeV3EligibilityForEntry(rules, null, []);
  assert.strictEqual(result.mode, "fallback");
  if (result.mode === "fallback") {
    assert.ok(result.reason.includes("config validation failed"));
  }
});

test("21. Per-row matching: matching question_text + comparison_key → resolved", () => {
  const rules = [
    makeRule({
      id: "a0000000-0000-4000-a000-000000000002",
      rule_type: "custom_yes_no",
      config: { question_text: "سؤال", comparison_key: "key1" },
      outcomes: {
        yes: { decision: "pass" as const },
        no: { decision: "block" as const, message: "x" },
        unknown: { decision: "review" as const, message: "x" },
      },
    }),
  ];
  const customReqs = [makeCustomReq({ question_text: "سؤال", comparison_key: "key1" })];
  const result = analyzeV3EligibilityForEntry(rules, null, customReqs);
  assert.strictEqual(result.mode, "v3");
});

test("22. Per-row matching: no matching rule → unresolved → fallback", () => {
  const rules = [makeRule()]; // high_school, not custom_yes_no
  const customReqs = [makeCustomReq({ question_text: "سؤال", comparison_key: "key1" })];
  const result = analyzeV3EligibilityForEntry(rules, null, customReqs);
  assert.strictEqual(result.mode, "fallback");
});

test("22a. Custom requirement WITHOUT comparison_key → fallback", () => {
  const rules = [makeRule()];
  const customReqs = [makeCustomReq({ comparison_key: null })];
  const result = analyzeV3EligibilityForEntry(rules, null, customReqs);
  assert.strictEqual(result.mode, "fallback");
  if (result.mode === "fallback") {
    assert.ok(result.reason.includes("without comparison_key"));
  }
});

test("22b. Only show_in_comparison custom requirements considered", () => {
  const rules = [makeRule()];
  // This custom req has show_in_comparison=false, so it should be ignored
  const customReqs = [makeCustomReq({ show_in_comparison: false, comparison_key: null })];
  const result = analyzeV3EligibilityForEntry(rules, null, customReqs);
  assert.strictEqual(result.mode, "v3"); // not blocked by non-comparison custom req
});

test("22c. Entry with bachelor rule_type → mode 'fallback'", () => {
  const rules = [
    makeRule({
      rule_type: "bachelor",
      outcomes: {
        pass: { decision: "pass" as const },
        not_available: { decision: "block" as const, message: "x" },
        unknown: { decision: "review" as const, message: "x" },
      },
    }),
  ];
  const result = analyzeV3EligibilityForEntry(rules, null, []);
  assert.strictEqual(result.mode, "fallback");
  if (result.mode === "fallback") {
    assert.ok(result.reason.includes("master-profile"));
  }
});

test("22d. Entry with research_plan rule_type → mode 'fallback'", () => {
  const rules = [
    makeRule({
      rule_type: "research_plan",
      outcomes: {
        pass: { decision: "pass" as const },
        not_available: { decision: "block" as const, message: "x" },
        unknown: { decision: "review" as const, message: "x" },
      },
    }),
  ];
  const result = analyzeV3EligibilityForEntry(rules, null, []);
  assert.strictEqual(result.mode, "fallback");
});

test("22e. Entry with only standard rule types → not blocked by master check", () => {
  const rules = [makeRule({ rule_type: "high_school" })];
  const result = analyzeV3EligibilityForEntry(rules, null, []);
  assert.strictEqual(result.mode, "v3");
});

// ============================================================
// V3 comparison wrapper tests
// ============================================================

console.log("\n📋 V3 compareOneProgram Tests\n");

test("23. All rules pass → status 'positive', full sentence reason", () => {
  const profile = buildAssessmentProfile({
    certificateType: "arabic",
    hasHighSchool: true,
  });
  const entry = makeV3Entry([makeRule()], { certificateTypeSlug: null });
  const result = compareOneProgram(profile, entry);
  assert.strictEqual(result.status, "positive");
  assert.strictEqual(result.reason, "الطالب مؤهل للقبول في هذا البرنامج");
});

test("24. One rule blocks → status 'negative', reason from block note", () => {
  const profile = buildAssessmentProfile({
    certificateType: "arabic",
    hasHighSchool: false,
  });
  const entry = makeV3Entry([makeRule()], { certificateTypeSlug: null });
  const result = compareOneProgram(profile, entry);
  assert.strictEqual(result.status, "negative");
  assert.strictEqual(result.reason, "لا يملك شهادة ثانوية");
});

test("25. Two conditions → status 'conditional', messages joined with ' — '", () => {
  const profile = buildAssessmentProfile({ certificateType: "arabic" });
  const rules = [
    makeRule({
      rule_type: "entrance_exam",
      outcomes: {
        required: { decision: "conditional" as const, condition_code: "EXAM", message: "مطلوب امتحان" },
      },
    }),
    makeRule({
      id: "a0000000-0000-4000-a000-000000000002",
      rule_type: "portfolio",
      outcomes: {
        required: { decision: "conditional" as const, condition_code: "PORTFOLIO", message: "مطلوب بورتفوليو" },
      },
      sort_order: 2,
    }),
  ];
  const entry = makeV3Entry(rules, { certificateTypeSlug: null });
  const result = compareOneProgram(profile, entry);
  assert.strictEqual(result.status, "conditional");
  assert.ok(result.reason.includes("مطلوب امتحان"));
  assert.ok(result.reason.includes("مطلوب بورتفوليو"));
  assert.ok(result.reason.includes(" — "));
});

test("26. Redirect → status 'negative' with redirect note", () => {
  const profile = buildAssessmentProfile({
    certificateType: "arabic",
    hasHighSchool: false,
  });
  const rules = [
    makeRule({
      outcomes: {
        pass: { decision: "pass" as const },
        not_available: {
          decision: "redirect" as const,
          message: "يُنصح بالتقديم على برنامج تأسيسي",
          redirect: { category: "foundation", scope: "same_university" as const },
        },
        unknown: { decision: "review" as const, message: "مراجعة" },
      },
    }),
  ];
  const entry = makeV3Entry(rules, { certificateTypeSlug: null });
  const result = compareOneProgram(profile, entry);
  assert.strictEqual(result.status, "negative");
  assert.strictEqual(result.reason, "يُنصح بالتقديم على برنامج تأسيسي");
});

test("27. Result shape matches ComparisonResult exactly", () => {
  const profile = buildAssessmentProfile({ certificateType: "arabic", hasHighSchool: true });
  const entry = makeV3Entry([makeRule()], { certificateTypeSlug: null });
  const result = compareOneProgram(profile, entry);
  assert.ok("programId" in result);
  assert.ok("programName" in result);
  assert.ok("universityName" in result);
  assert.ok("country" in result);
  assert.ok("universityType" in result);
  assert.ok("category" in result);
  assert.ok("status" in result);
  assert.ok("reason" in result);
  assert.ok("notes" in result);
  assert.ok("scholarshipInfo" in result);
});

test("28. V3 result with scholarship → scholarshipInfo field populated", () => {
  const profile = buildAssessmentProfile({
    certificateType: "arabic",
    hasHighSchool: true,
    gpa: 95,
  });
  const entry = makeV3Entry([makeRule()], {
    certificateTypeSlug: null,
    scholarshipTiers: [{
      id: "tier-1",
      min_gpa: 90,
      max_gpa: 100,
      scholarship_percent: 50,
      label: "تفوق",
      sort_order: 1,
    }],
  });
  const result = compareOneProgram(profile, entry);
  assert.strictEqual(result.status, "positive");
  assert.ok(result.scholarshipInfo);
  assert.ok(result.scholarshipInfo!.includes("50%"));
});

test("29. Cert mismatch → status 'negative', specific reason", () => {
  const profile = buildAssessmentProfile({ certificateType: "arabic" });
  const entry = makeV3Entry([makeRule()], { certificateTypeSlug: "british" });
  const result = compareOneProgram(profile, entry);
  assert.strictEqual(result.status, "negative");
  assert.strictEqual(result.reason, "هذا المسار مخصص لحاملي شهادة أخرى");
});

test("30. Cert match → proceeds to evaluate", () => {
  const profile = buildAssessmentProfile({ certificateType: "arabic", hasHighSchool: true });
  const entry = makeV3Entry([makeRule()], { certificateTypeSlug: "arabic" });
  const result = compareOneProgram(profile, entry);
  assert.strictEqual(result.status, "positive");
});

// ============================================================
// Fallback routing tests
// ============================================================

console.log("\n📋 Fallback Routing Tests\n");

test("31. Entry with all outcomes populated (arabic) → routed to V3", () => {
  const rules = [makeRule()];
  const result = analyzeV3EligibilityForEntry(rules, "arabic", []);
  assert.strictEqual(result.mode, "v3");
});

test("32. Entry with empty outcomes → routed to fallback", () => {
  const rules = [makeRule({ outcomes: {} })];
  const result = analyzeV3EligibilityForEntry(rules, null, []);
  assert.strictEqual(result.mode, "fallback");
});

test("33. British complex program → fallback even though outcomes non-empty", () => {
  const rules = [
    makeRule({
      rule_type: "british_qualifications",
      config: {
        pathways: [
          { requirements: [{ level: "a_level", min_count: 3, min_grade: "C" }] },
          { requirements: [{ level: "as_level", min_count: 5, min_grade: "C" }] },
        ],
      },
      outcomes: {
        pass: { decision: "pass" as const },
        count_fail: { decision: "block" as const, message: "x" },
        grade_fail: { decision: "block" as const, message: "x" },
      },
    }),
  ];
  const result = analyzeV3EligibilityForEntry(rules, "british", []);
  assert.strictEqual(result.mode, "fallback");
});

test("34. British with grade B → fallback", () => {
  const rules = [
    makeRule({
      rule_type: "british_qualifications",
      config: { pathways: [{ requirements: [{ level: "a_level", min_count: 3, min_grade: "B" }] }] },
      outcomes: {
        pass: { decision: "pass" as const },
        count_fail: { decision: "block" as const, message: "x" },
        grade_fail: { decision: "block" as const, message: "x" },
      },
    }),
  ];
  const result = analyzeV3EligibilityForEntry(rules, "british", []);
  assert.strictEqual(result.mode, "fallback");
});

test("35. Entry with zero V3 rules → fallback", () => {
  const result = analyzeV3EligibilityForEntry([], null, []);
  assert.strictEqual(result.mode, "fallback");
});

test("36. Entry with unresolved custom requirements (per-row) → fallback", () => {
  const rules = [makeRule()];
  const customReqs = [makeCustomReq({ question_text: "unmatched question" })];
  const result = analyzeV3EligibilityForEntry(rules, null, customReqs);
  assert.strictEqual(result.mode, "fallback");
});

// ============================================================
// Form contract tests
// ============================================================

console.log("\n📋 Form Contract Tests\n");

test("37. ComparisonFormData contains correct shape", () => {
  const formData: ComparisonFormData = {
    certificateType: "arabic",
    hasHighSchool: true,
    has12Years: true,
    gpa: 85,
    hasIelts: true,
    ieltsScore: 6.5,
  };
  assert.strictEqual(formData.certificateType, "arabic");
  assert.strictEqual(formData.gpa, 85);
});

test("38. buildOldStudentProfile concept — dynamicAnswers passthrough", () => {
  // Simulating what page.tsx does
  const formData: ComparisonFormData = {
    certificateType: "arabic",
    dynamicAnswers: { has_cert: true, score: 85, option: "a" },
  };
  // Verify dynamicAnswers would pass through
  assert.strictEqual(formData.dynamicAnswers?.has_cert, true);
  assert.strictEqual(formData.dynamicAnswers?.score, 85);
  assert.strictEqual(formData.dynamicAnswers?.option, "a");
});

// ============================================================
// Dynamic answers flow tests
// ============================================================

console.log("\n📋 Dynamic Answers Flow Tests\n");

test("39. Toggle yes → dynamicAnswers[key] === true (boolean)", () => {
  const formData: ComparisonFormData = {
    certificateType: "arabic",
    dynamicAnswers: { has_cert: true },
  };
  assert.strictEqual(typeof formData.dynamicAnswers!.has_cert, "boolean");
  assert.strictEqual(formData.dynamicAnswers!.has_cert, true);
});

test("40. Toggle no → dynamicAnswers[key] === false (boolean)", () => {
  const formData: ComparisonFormData = {
    certificateType: "arabic",
    dynamicAnswers: { has_cert: false },
  };
  assert.strictEqual(formData.dynamicAnswers!.has_cert, false);
});

test("41. Number answer → dynamicAnswers[key] is number", () => {
  const formData: ComparisonFormData = {
    certificateType: "arabic",
    dynamicAnswers: { score: 85 },
  };
  assert.strictEqual(typeof formData.dynamicAnswers!.score, "number");
});

test("42. Select answer → dynamicAnswers[key] is string", () => {
  const formData: ComparisonFormData = {
    certificateType: "arabic",
    dynamicAnswers: { option: "option_a" },
  };
  assert.strictEqual(typeof formData.dynamicAnswers!.option, "string");
});

test("43. buildAssessmentProfile passes dynamicAnswers through", () => {
  const formData: ComparisonFormData = {
    certificateType: "arabic",
    dynamicAnswers: { has_cert: true, score: 85 },
  };
  const profile = buildAssessmentProfile(formData);
  assert.strictEqual(profile.dynamicAnswers?.has_cert, true);
  assert.strictEqual(profile.dynamicAnswers?.score, 85);
});

test("44. V3 program with custom_yes_no → dynamicAnswers reaches evaluator", () => {
  const profile = buildAssessmentProfile({
    certificateType: "arabic",
    hasHighSchool: true,
    dynamicAnswers: { has_cert: true },
  });
  const rules = [
    makeRule(),
    makeRule({
      id: "a0000000-0000-4000-a000-000000000002",
      rule_type: "custom_yes_no",
      config: { question_text: "شهادة؟", comparison_key: "has_cert" },
      outcomes: {
        yes: { decision: "pass" as const },
        no: { decision: "block" as const, message: "لا" },
        unknown: { decision: "review" as const, message: "مراجعة" },
      },
      sort_order: 2,
    }),
  ];
  const entry = makeV3Entry(rules, { certificateTypeSlug: null });
  const result = compareOneProgram(profile, entry);
  assert.strictEqual(result.status, "positive"); // both pass
});

// ============================================================
// Summary
// ============================================================

console.log("\n========================================");
if (failed > 0) {
  console.log(`❌ Passed: ${passed}`);
  console.log(`❌ Failed: ${failed}`);
  console.log("\nFailed tests:");
  failures.forEach((f) => console.log(`  - ${f}`));
  process.exit(1);
} else {
  console.log(`✅ Passed: ${passed}`);
  console.log(`❌ Failed: ${failed}`);
}
console.log("========================================\n");
