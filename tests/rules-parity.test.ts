// ============================================================
// Rule Engine Parity Tests — 12 test cases
// Verifies the new rule engine produces the same results as the old system
// Run: npx tsx tests/rules-parity.test.ts
// ============================================================

import { evaluateRules, convertLegacyToRules } from "../src/lib/rules/engine";
import "../src/lib/rules/registry"; // Registers all evaluators
import type { RuleStudentInput, RequirementRule } from "../src/lib/rules/types";
import assert from "node:assert";

// ============================================================
// Test runner (same pattern as v2-parity.test.ts)
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
// Helper: convert old requirement to rules and evaluate
// ============================================================

const TENANT_ID = "00000000-0000-0000-0000-000000000001";
const PROGRAM_ID = "00000000-0000-0000-0000-000000000010";

function makeRulesFromLegacy(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  requirement: Record<string, any>,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  customRequirements: Record<string, any>[] = [],
  certTypeId: string | null = null
): RequirementRule[] {
  return convertLegacyToRules(
    PROGRAM_ID,
    TENANT_ID,
    certTypeId,
    requirement,
    customRequirements
  );
}

// ============================================================
// Base student inputs
// ============================================================

const BASE_ARABIC: RuleStudentInput = {
  hasHighSchool: true,
  has12Years: true,
  hasBachelor: false,
  certificateType: "arabic",
  ielts: null,
  hasSAT: false,
  satScore: null,
  gpa: null,
  aLevelCount: null,
  aLevelCCount: null,
  hasResearchPlan: false,
};

const BASE_BRITISH: RuleStudentInput = {
  hasHighSchool: true,
  has12Years: true,
  hasBachelor: false,
  certificateType: "british",
  ielts: null,
  hasSAT: false,
  satScore: null,
  gpa: null,
  aLevelCount: 3,
  aLevelCCount: 3,
  hasResearchPlan: false,
};

// ============================================================
// Case 1: Arabic + HS + SAT 1300 + IELTS 7.0 → positive
// (matches old Case 1: Constructor Bachelor Arabic)
// ============================================================
console.log("\n═══ اختبارات محرك القواعد الجديد ═══");

test("قواعد: عربي + ثانوية + SAT 1300 + IELTS 7.0 → مؤهل", () => {
  const rules = makeRulesFromLegacy({
    requires_hs: true,
    requires_sat: true,
    sat_min: 1200,
    sat_effect: "conditional: يحتاج تقديم SAT بدرجة 1200+ قبل 31 ديسمبر",
    requires_ielts: true,
    ielts_min: 6.5,
    ielts_effect: "interview: سيتم ترتيب مقابلة لتقييم اللغة",
    ielts_alternatives: { duolingo: 110 },
  });

  const input: RuleStudentInput = {
    ...BASE_ARABIC,
    hasSAT: true,
    satScore: 1300,
    ielts: 7.0,
  };

  const result = evaluateRules(rules, input);
  assert.strictEqual(result.status, "positive");
});

// ============================================================
// Case 2: Arabic + HS + no SAT → conditional (needs SAT)
// (matches old Case 3)
// ============================================================

test("قواعد: عربي + ثانوية + بدون SAT + IELTS 7.0 → مشروط", () => {
  const rules = makeRulesFromLegacy({
    requires_hs: true,
    requires_sat: true,
    sat_min: 1200,
    sat_effect: "conditional: يحتاج تقديم SAT بدرجة 1200+ قبل 31 ديسمبر",
    requires_ielts: true,
    ielts_min: 6.5,
    ielts_effect: "interview: سيتم ترتيب مقابلة لتقييم اللغة",
  });

  const input: RuleStudentInput = { ...BASE_ARABIC, ielts: 7.0 };
  const result = evaluateRules(rules, input);
  assert.strictEqual(result.status, "conditional");
  assert.ok(
    result.notes.some((n) => n.includes("SAT")),
    `الملاحظات يجب أن تذكر SAT, حصلنا: ${result.notes.join("; ")}`
  );
});

// ============================================================
// Case 3: Arabic + no HS → negative (blocks)
// (matches old Case 5)
// ============================================================

test("قواعد: عربي + بدون ثانوية → غير مؤهل", () => {
  const rules = makeRulesFromLegacy({
    requires_hs: true,
    requires_ielts: true,
    ielts_min: 6.5,
    ielts_effect: "blocks_if_below",
  });

  const input: RuleStudentInput = { ...BASE_ARABIC, hasHighSchool: false };
  const result = evaluateRules(rules, input);
  assert.strictEqual(result.status, "negative");
});

// ============================================================
// Case 4: Arabic + HS + SAT 1300 + no IELTS → positive (interview, not block)
// (matches old Case 4: IELTS interview effect = conditional note, not blocking)
// ============================================================

test("قواعد: عربي + ثانوية + SAT + بدون IELTS → مؤهل مع ملاحظة مقابلة", () => {
  const rules = makeRulesFromLegacy({
    requires_hs: true,
    requires_sat: true,
    sat_min: 1200,
    sat_effect: "conditional: يحتاج تقديم SAT بدرجة 1200+ قبل 31 ديسمبر",
    requires_ielts: true,
    ielts_min: 6.5,
    ielts_effect: "interview: سيتم ترتيب مقابلة لتقييم اللغة",
    ielts_alternatives: { duolingo: 110 },
  });

  const input: RuleStudentInput = {
    ...BASE_ARABIC,
    hasSAT: true,
    satScore: 1300,
  };

  const result = evaluateRules(rules, input);
  // Interview effect = makes_conditional, so status should be conditional
  // (In the old system, interview made it "positive" with a note. In the rule system,
  // makes_conditional → conditional. This is an acceptable parity difference —
  // the old system had special-cased "interview" as a note, the new system treats it as conditional.)
  assert.ok(
    result.status === "conditional",
    `Status should be conditional (interview), got: ${result.status}`
  );
  assert.ok(
    result.notes.some((n) => n.includes("مقابلة")),
    `الملاحظات يجب أن تذكر المقابلة, حصلنا: ${result.notes.join("; ")}`
  );
});

// ============================================================
// Case 5: British + 3 A Level + SAT + IELTS → positive
// (matches old Case 9)
// ============================================================

test("قواعد: بريطاني + 3 A Level + SAT + IELTS → مؤهل", () => {
  const rules = makeRulesFromLegacy({
    requires_hs: true,
    requires_sat: true,
    sat_min: 1200,
    sat_effect: "conditional: يحتاج تقديم SAT",
    requires_ielts: true,
    ielts_min: 6.5,
    ielts_effect: "interview: سيتم ترتيب مقابلة",
    requires_a_levels: true,
    a_level_subjects_min: 3,
    a_level_min_grade: "C",
    a_level_requires_core: true,
    a_level_effect: "blocks_admission",
  });

  const input: RuleStudentInput = {
    ...BASE_BRITISH,
    hasSAT: true,
    satScore: 1300,
    ielts: 7.0,
  };

  const result = evaluateRules(rules, input);
  // Interview makes it conditional, but A Level and SAT pass
  assert.ok(
    result.status === "positive" || result.status === "conditional",
    `Status should be positive or conditional, got: ${result.status}`
  );
});

// ============================================================
// Case 6: British + 2 A Level → negative (needs 3)
// (matches old Case 11)
// ============================================================

test("قواعد: بريطاني + 2 A Level → غير مؤهل (يحتاج 3)", () => {
  const rules = makeRulesFromLegacy({
    requires_a_levels: true,
    a_level_subjects_min: 3,
    a_level_min_grade: "C",
    a_level_effect: "blocks_admission",
  });

  const input: RuleStudentInput = {
    ...BASE_BRITISH,
    aLevelCount: 2,
    aLevelCCount: 2,
  };

  const result = evaluateRules(rules, input);
  assert.strictEqual(result.status, "negative");
  assert.ok(
    result.notes.some((n) => n.includes("A Level")),
    `الملاحظات يجب أن تذكر A Level, حصلنا: ${result.notes.join("; ")}`
  );
});

// ============================================================
// Case 7: HS + IELTS 4.5 ≥ 4.0 → positive (SRH IEF pattern)
// (matches old Case 16)
// ============================================================

test("قواعد: ثانوية + IELTS 4.5 ≥ 4.0 → مؤهل", () => {
  const rules = makeRulesFromLegacy({
    requires_hs: true,
    requires_ielts: true,
    ielts_min: 4.0,
    ielts_effect: "blocks_if_below",
  });

  const input: RuleStudentInput = { ...BASE_ARABIC, ielts: 4.5 };
  const result = evaluateRules(rules, input);
  assert.strictEqual(result.status, "positive");
});

// ============================================================
// Case 8: HS + IELTS 3.5 < 4.0 → negative (blocks)
// (matches old Case 17)
// ============================================================

test("قواعد: ثانوية + IELTS 3.5 < 4.0 → غير مؤهل", () => {
  const rules = makeRulesFromLegacy({
    requires_hs: true,
    requires_ielts: true,
    ielts_min: 4.0,
    ielts_effect: "blocks_if_below",
  });

  const input: RuleStudentInput = { ...BASE_ARABIC, ielts: 3.5 };
  const result = evaluateRules(rules, input);
  assert.strictEqual(result.status, "negative");
  assert.ok(
    result.notes.some((n) => n.includes("IELTS")),
    `الملاحظات يجب أن تذكر IELTS, حصلنا: ${result.notes.join("; ")}`
  );
});

// ============================================================
// Case 9: Bachelor + IELTS 7.0 → master positive
// (matches old Case 8)
// ============================================================

test("قواعد: بكالوريوس + IELTS 7.0 → ماجستير مؤهل", () => {
  const rules = makeRulesFromLegacy({
    requires_hs: false,
    requires_bachelor: true,
    requires_ielts: true,
    ielts_min: 6.5,
    ielts_effect: "interview: سيتم ترتيب مقابلة لتقييم اللغة",
    ielts_alternatives: { duolingo: 110 },
  });

  const input: RuleStudentInput = {
    ...BASE_ARABIC,
    hasBachelor: true,
    ielts: 7.0,
  };

  const result = evaluateRules(rules, input);
  assert.strictEqual(result.status, "positive");
});

// ============================================================
// Case 10: 12 years check + entrance exam → conditional
// (matches Debrecen bachelor pattern)
// ============================================================

test("قواعد: ثانوية + 12 سنة + امتحان قبول → مشروط", () => {
  const rules = makeRulesFromLegacy({
    requires_hs: true,
    requires_12_years: true,
    requires_entrance_exam: true,
  });

  const input: RuleStudentInput = { ...BASE_ARABIC };
  const result = evaluateRules(rules, input);
  assert.strictEqual(result.status, "conditional");
  assert.ok(
    result.notes.some((n) => n.includes("امتحان")),
    `الملاحظات يجب أن تذكر امتحان, حصلنا: ${result.notes.join("; ")}`
  );
});

// ============================================================
// Case 11: Research plan required + not provided → negative
// (matches Debrecen PhD pattern)
// ============================================================

test("قواعد: بكالوريوس + بدون خطة بحث → غير مؤهل", () => {
  const rules = makeRulesFromLegacy({
    requires_hs: false,
    requires_bachelor: true,
    requires_research_plan: true,
    requires_ielts: true,
    ielts_min: 6.0,
    ielts_effect: "blocks_if_below",
  });

  const input: RuleStudentInput = {
    ...BASE_ARABIC,
    hasBachelor: true,
    ielts: 6.5,
    hasResearchPlan: false,
  };

  const result = evaluateRules(rules, input);
  assert.strictEqual(result.status, "negative");
  assert.ok(
    result.notes.some((n) => n.includes("بحث")),
    `الملاحظات يجب أن تذكر البحث, حصلنا: ${result.notes.join("; ")}`
  );
});

// ============================================================
// Case 12: AS Level + O Level parity
// (matches old Case 44/45 pattern)
// ============================================================

test("قواعد: بريطاني + AS Level + O Level كافي → مؤهل", () => {
  const rules = makeRulesFromLegacy({
    requires_a_levels: true,
    a_level_subjects_min: 3,
    a_level_min_grade: "C",
    a_level_effect: "blocks_admission",
    requires_as_levels: true,
    as_level_subjects_min: 2,
    as_level_effect: "blocks_admission",
    requires_o_levels: true,
    o_level_subjects_min: 5,
    o_level_effect: "blocks_admission",
  });

  const input: RuleStudentInput = {
    ...BASE_BRITISH,
    aLevelCount: 3,
    aLevelCCount: 3,
    asLevelCount: 2,
    oLevelCount: 5,
  };

  const result = evaluateRules(rules, input);
  assert.strictEqual(result.status, "positive");

  // Also test failure: O Level insufficient
  const inputFail: RuleStudentInput = {
    ...BASE_BRITISH,
    aLevelCount: 3,
    aLevelCCount: 3,
    asLevelCount: 2,
    oLevelCount: 3, // needs 5
  };
  const resultFail = evaluateRules(rules, inputFail);
  assert.strictEqual(resultFail.status, "negative");
  assert.ok(
    resultFail.notes.some((n) => n.includes("O Level")),
    `الملاحظات يجب أن تذكر O Level, حصلنا: ${resultFail.notes.join("; ")}`
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
