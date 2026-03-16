// ============================================================
// V3.2 British Qualifications Evaluator Tests
// Run: npx tsx tests/v3-british-qualifications.test.ts
// ============================================================

import { normalizeGrade, isGradeAtLeast } from "../src/lib/rules/v3/evaluators/british-qualifications/grade-normalizer";
import { countSubjectsMeeting } from "../src/lib/rules/v3/evaluators/british-qualifications/counting-logic";
import { matchPathways } from "../src/lib/rules/v3/evaluators/british-qualifications/pathway-matcher";
import { britishQualificationsEvaluatorV3 } from "../src/lib/rules/v3/evaluators/british-qualifications";
import { evaluateRulesV3 } from "../src/lib/rules/v3/engine";
import "../src/lib/rules/v3/evaluators/registry"; // registers all evaluators
import type {
  BritishSubject,
  BritishAssessmentProfile,
  ArabicAssessmentProfile,
  RequirementRuleV3,
} from "../src/lib/rules/v3/types";
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

function makeBritishProfile(subjects: BritishSubject[]): BritishAssessmentProfile {
  return {
    certificateType: "british",
    subjects,
    sat: { state: "not_provided" },
    languageCert: { state: "not_provided" },
  };
}

function makeArabicProfile(): ArabicAssessmentProfile {
  return {
    certificateType: "arabic",
    hasHighSchool: true,
    has12Years: true,
    gpa: { state: "present", percentage: 85 },
    studyTrack: { state: "present", track: "scientific" },
    sat: { state: "not_provided" },
    languageCert: { state: "not_provided" },
  };
}

function makeRule(overrides: Partial<RequirementRuleV3> = {}): RequirementRuleV3 {
  return {
    id: "rule-bq-1",
    program_id: "prog-1",
    certificate_type_id: null,
    rule_type: "british_qualifications",
    config: {
      pathways: [{ requirements: [{ level: "a_level", min_count: 3, min_grade: "C" }] }],
    },
    outcomes: {
      pass: { decision: "pass" as const },
      count_fail: { decision: "block" as const, message: "عدد المواد غير كافٍ" },
      grade_fail: { decision: "conditional" as const, condition_code: "GRADE_LOW", message: "الدرجات أقل من المطلوب" },
    },
    sort_order: 1,
    is_enabled: true,
    tenant_id: "tenant-1",
    ...overrides,
  };
}

// ============================================================
// Grade normalizer tests
// ============================================================

console.log("\n📋 Grade Normalizer Tests\n");

test("1. normalizeGrade('A*', 'a_level') → 7", () => {
  assert.strictEqual(normalizeGrade("A*", "a_level"), 7);
});

test("2. normalizeGrade('a*', 'a_level') → 7 (case insensitive)", () => {
  assert.strictEqual(normalizeGrade("a*", "a_level"), 7);
});

test("3. normalizeGrade('A', 'a_level') → 6", () => {
  assert.strictEqual(normalizeGrade("A", "a_level"), 6);
});

test("4. normalizeGrade('C', 'a_level') → 4", () => {
  assert.strictEqual(normalizeGrade("C", "a_level"), 4);
});

test("5. normalizeGrade('U', 'a_level') → 1", () => {
  assert.strictEqual(normalizeGrade("U", "a_level"), 1);
});

test("6. normalizeGrade('9', 'o_level') → 18 (GCSE numeric)", () => {
  assert.strictEqual(normalizeGrade("9", "o_level"), 18);
});

test("7. normalizeGrade('4', 'o_level') → 8 (unique rank, not same as 5)", () => {
  assert.strictEqual(normalizeGrade("4", "o_level"), 8);
  assert.notStrictEqual(normalizeGrade("4", "o_level"), normalizeGrade("5", "o_level"));
});

test("8. normalizeGrade('5', 'a_level') → -1 (numeric NOT valid for A Level)", () => {
  assert.strictEqual(normalizeGrade("5", "a_level"), -1);
});

test("9. normalizeGrade('XYZ', 'a_level') → -1 (unrecognized)", () => {
  assert.strictEqual(normalizeGrade("XYZ", "a_level"), -1);
});

test("10. isGradeAtLeast('B', 'C', 'a_level') → true", () => {
  assert.strictEqual(isGradeAtLeast("B", "C", "a_level"), true);
});

test("11. isGradeAtLeast('D', 'C', 'a_level') → false", () => {
  assert.strictEqual(isGradeAtLeast("D", "C", "a_level"), false);
});

test("12. isGradeAtLeast('A*', 'A', 'a_level') → true", () => {
  assert.strictEqual(isGradeAtLeast("A*", "A", "a_level"), true);
});

test("13. isGradeAtLeast('5', 'C', 'o_level') → true (5=10, C=8)", () => {
  assert.strictEqual(isGradeAtLeast("5", "C", "o_level"), true);
});

test("14. isGradeAtLeast('5', 'C', 'a_level') → false (numeric invalid for A Level)", () => {
  assert.strictEqual(isGradeAtLeast("5", "C", "a_level"), false);
});

// Invalid required-grade tests

test("15. isGradeAtLeast('A', '5', 'a_level') → false (required '5' invalid for A Level)", () => {
  assert.strictEqual(isGradeAtLeast("A", "5", "a_level"), false);
});

test("16. isGradeAtLeast('B', 'H', 'o_level') → false (required 'H' unrecognized for O Level)", () => {
  assert.strictEqual(isGradeAtLeast("B", "H", "o_level"), false);
});

// Cross-format GCSE tests

test("17. normalizeGrade('A *', 'a_level') → 7 (space stripped)", () => {
  assert.strictEqual(normalizeGrade("A *", "a_level"), 7);
});

test("18. isGradeAtLeast('B', '6', 'o_level') → true (B=12, 6=12, equal)", () => {
  assert.strictEqual(isGradeAtLeast("B", "6", "o_level"), true);
});

test("19. isGradeAtLeast('C', '6', 'o_level') → false (C=8, 6=12)", () => {
  assert.strictEqual(isGradeAtLeast("C", "6", "o_level"), false);
});

// Strict numeric ordering

test("20. isGradeAtLeast('4', '5', 'o_level') → false (4=8, 5=10)", () => {
  assert.strictEqual(isGradeAtLeast("4", "5", "o_level"), false);
});

test("21. isGradeAtLeast('7', '8', 'o_level') → false (7=14, 8=16)", () => {
  assert.strictEqual(isGradeAtLeast("7", "8", "o_level"), false);
});

test("22. isGradeAtLeast('5', '4', 'o_level') → true (5=10, 4=8)", () => {
  assert.strictEqual(isGradeAtLeast("5", "4", "o_level"), true);
});

test("23. isGradeAtLeast('4', 'C', 'o_level') → true (4=8, C=8, equivalent)", () => {
  assert.strictEqual(isGradeAtLeast("4", "C", "o_level"), true);
});

// ============================================================
// Counting logic tests
// ============================================================

console.log("\n📋 Counting Logic Tests\n");

test("24. 3 A Level subjects, min grade 'C' → count those with C+", () => {
  const subjects: BritishSubject[] = [
    { name: "Math", level: "a_level", grade: "B" },
    { name: "Physics", level: "a_level", grade: "C" },
    { name: "Chemistry", level: "a_level", grade: "D" },
  ];
  const result = countSubjectsMeeting(subjects, "a_level", "C");
  assert.strictEqual(result.totalAtLevel, 3);
  assert.strictEqual(result.meetingGrade, 2); // B and C pass, D fails
});

test("25. Mixed levels: counting A Level only returns 3", () => {
  const subjects: BritishSubject[] = [
    { name: "Math", level: "a_level", grade: "A" },
    { name: "Physics", level: "a_level", grade: "B" },
    { name: "Chemistry", level: "a_level", grade: "C" },
    { name: "English", level: "as_level", grade: "B" },
    { name: "Art", level: "as_level", grade: "A" },
  ];
  const result = countSubjectsMeeting(subjects, "a_level");
  assert.strictEqual(result.totalAtLevel, 3);
  assert.strictEqual(result.meetingGrade, 3);
});

test("26. No grade requirement → meetingGrade = totalAtLevel", () => {
  const subjects: BritishSubject[] = [
    { name: "Math", level: "a_level", grade: "D" },
    { name: "English", level: "a_level", grade: "E" },
  ];
  const result = countSubjectsMeeting(subjects, "a_level");
  assert.strictEqual(result.totalAtLevel, 2);
  assert.strictEqual(result.meetingGrade, 2);
});

test("27. Empty subjects → 0, 0", () => {
  const result = countSubjectsMeeting([], "a_level", "C");
  assert.strictEqual(result.totalAtLevel, 0);
  assert.strictEqual(result.meetingGrade, 0);
});

// ============================================================
// Pathway matcher tests
// ============================================================

console.log("\n📋 Pathway Matcher Tests\n");

test("28. Single pathway '3 A Levels at C' — student has 3 at B → pass", () => {
  const subjects: BritishSubject[] = [
    { name: "Math", level: "a_level", grade: "B" },
    { name: "Physics", level: "a_level", grade: "B" },
    { name: "Chemistry", level: "a_level", grade: "B" },
  ];
  const result = matchPathways(subjects, [
    { requirements: [{ level: "a_level", min_count: 3, min_grade: "C" }] },
  ]);
  assert.strictEqual(result.outcomeKey, "pass");
  assert.strictEqual(result.matchedPathway?.index, 0);
});

test("29. Single pathway '3 A Levels at C' — student has 2 → count_fail", () => {
  const subjects: BritishSubject[] = [
    { name: "Math", level: "a_level", grade: "A" },
    { name: "Physics", level: "a_level", grade: "A" },
  ];
  const result = matchPathways(subjects, [
    { requirements: [{ level: "a_level", min_count: 3, min_grade: "C" }] },
  ]);
  assert.strictEqual(result.outcomeKey, "count_fail");
});

test("30. Single pathway '3 A Levels at C' — 3 subjects but only 2 at C+ → grade_fail", () => {
  const subjects: BritishSubject[] = [
    { name: "Math", level: "a_level", grade: "B" },
    { name: "Physics", level: "a_level", grade: "C" },
    { name: "Chemistry", level: "a_level", grade: "E" },
  ];
  const result = matchPathways(subjects, [
    { requirements: [{ level: "a_level", min_count: 3, min_grade: "C" }] },
  ]);
  assert.strictEqual(result.outcomeKey, "grade_fail");
});

test("31. Two pathways: first fails (count), second passes → pass (second pathway)", () => {
  const subjects: BritishSubject[] = [
    { name: "Math", level: "a_level", grade: "A" },
    { name: "Physics", level: "a_level", grade: "B" },
    { name: "English", level: "as_level", grade: "B" },
    { name: "Art", level: "as_level", grade: "C" },
    { name: "History", level: "as_level", grade: "C" },
  ];
  const result = matchPathways(subjects, [
    // First: 3 A Levels at C → fail (only 2)
    { label: "Standard", requirements: [{ level: "a_level", min_count: 3, min_grade: "C" }] },
    // Second: 2 A Levels at B + 3 AS Levels at C → pass
    { label: "Alternative", requirements: [
      { level: "a_level", min_count: 2, min_grade: "B" },
      { level: "as_level", min_count: 3, min_grade: "C" },
    ]},
  ]);
  assert.strictEqual(result.outcomeKey, "pass");
  assert.strictEqual(result.matchedPathway?.index, 1);
  assert.strictEqual(result.matchedPathway?.label, "Alternative");
});

test("32. Two pathways: first = pure grade_fail, second = count_fail → overall grade_fail", () => {
  const subjects: BritishSubject[] = [
    { name: "Math", level: "a_level", grade: "D" },
    { name: "Physics", level: "a_level", grade: "E" },
    { name: "Chemistry", level: "a_level", grade: "D" },
  ];
  const result = matchPathways(subjects, [
    // First: 3 A Levels at C → has 3, none at C → pure grade_fail
    { requirements: [{ level: "a_level", min_count: 3, min_grade: "C" }] },
    // Second: 4 A Levels → only 3 → count_fail
    { requirements: [{ level: "a_level", min_count: 4 }] },
  ]);
  assert.strictEqual(result.outcomeKey, "grade_fail");
});

test("33. Two pathways: both count_fail → overall count_fail", () => {
  const subjects: BritishSubject[] = [
    { name: "Math", level: "a_level", grade: "A" },
  ];
  const result = matchPathways(subjects, [
    { requirements: [{ level: "a_level", min_count: 3, min_grade: "C" }] },
    { requirements: [{ level: "a_level", min_count: 2 }] },
  ]);
  assert.strictEqual(result.outcomeKey, "count_fail");
});

test("34. Mixed failure in single pathway: count + grade issues → count_fail", () => {
  const subjects: BritishSubject[] = [
    { name: "Math", level: "a_level", grade: "D" },
    { name: "Physics", level: "a_level", grade: "D" },
    { name: "English", level: "as_level", grade: "A" },
  ];
  const result = matchPathways(subjects, [
    // 2 A Levels at B (grade issue: have 2 but grades D) + 2 AS Levels at C (count issue: only 1)
    { requirements: [
      { level: "a_level", min_count: 2, min_grade: "B" },
      { level: "as_level", min_count: 2, min_grade: "C" },
    ]},
  ]);
  assert.strictEqual(result.outcomeKey, "count_fail"); // mixed = count_fail
});

test("35. All pathways have mixed failures → overall count_fail", () => {
  const subjects: BritishSubject[] = [
    { name: "Math", level: "a_level", grade: "D" },
    { name: "English", level: "as_level", grade: "A" },
  ];
  const result = matchPathways(subjects, [
    // Pathway 1: 2 A Levels at B (grade) + 2 AS Levels (count) → mixed = count_fail
    { requirements: [
      { level: "a_level", min_count: 2, min_grade: "B" },
      { level: "as_level", min_count: 2 },
    ]},
    // Pathway 2: 3 A Levels (count) + 2 AS at C (count) → count_fail
    { requirements: [
      { level: "a_level", min_count: 3 },
      { level: "as_level", min_count: 2, min_grade: "C" },
    ]},
  ]);
  assert.strictEqual(result.outcomeKey, "count_fail");
});

// ============================================================
// Evaluator integration tests
// ============================================================

console.log("\n📋 Evaluator Integration Tests\n");

test("36. british profile + 3 A Levels at C+ → 'pass'", () => {
  const profile = makeBritishProfile([
    { name: "Math", level: "a_level", grade: "B" },
    { name: "Physics", level: "a_level", grade: "C" },
    { name: "Chemistry", level: "a_level", grade: "A" },
  ]);
  const config = { pathways: [{ requirements: [{ level: "a_level" as const, min_count: 3, min_grade: "C" }] }] };
  const result = britishQualificationsEvaluatorV3.evaluate(config, profile);
  assert.strictEqual(result.outcomeKey, "pass");
  assert.strictEqual((result.facts as any).subjectCount, 3);
});

test("37. british profile + 2 A Levels → 'count_fail'", () => {
  const profile = makeBritishProfile([
    { name: "Math", level: "a_level", grade: "A" },
    { name: "Physics", level: "a_level", grade: "A" },
  ]);
  const config = { pathways: [{ requirements: [{ level: "a_level" as const, min_count: 3, min_grade: "C" }] }] };
  const result = britishQualificationsEvaluatorV3.evaluate(config, profile);
  assert.strictEqual(result.outcomeKey, "count_fail");
});

test("38. british profile + 3 A Levels, 1 below C → 'grade_fail'", () => {
  const profile = makeBritishProfile([
    { name: "Math", level: "a_level", grade: "B" },
    { name: "Physics", level: "a_level", grade: "C" },
    { name: "Chemistry", level: "a_level", grade: "E" },
  ]);
  const config = { pathways: [{ requirements: [{ level: "a_level" as const, min_count: 3, min_grade: "C" }] }] };
  const result = britishQualificationsEvaluatorV3.evaluate(config, profile);
  assert.strictEqual(result.outcomeKey, "grade_fail");
});

test("39. arabic profile → 'not_applicable'", () => {
  const profile = makeArabicProfile();
  const config = { pathways: [{ requirements: [{ level: "a_level" as const, min_count: 3, min_grade: "C" }] }] };
  const result = britishQualificationsEvaluatorV3.evaluate(config, profile);
  assert.strictEqual(result.outcomeKey, "not_applicable");
});

test("40. british profile + empty subjects → 'count_fail'", () => {
  const profile = makeBritishProfile([]);
  const config = { pathways: [{ requirements: [{ level: "a_level" as const, min_count: 3, min_grade: "C" }] }] };
  const result = britishQualificationsEvaluatorV3.evaluate(config, profile);
  assert.strictEqual(result.outcomeKey, "count_fail");
  assert.strictEqual((result.facts as any).subjectCount, 0);
});

test("41. Complex pathway: '3 A Levels at C' OR '2 A Levels at B + 3 AS at C'", () => {
  const config = {
    pathways: [
      { label: "Standard", requirements: [{ level: "a_level" as const, min_count: 3, min_grade: "C" }] },
      { label: "Alternative", requirements: [
        { level: "a_level" as const, min_count: 2, min_grade: "B" },
        { level: "as_level" as const, min_count: 3, min_grade: "C" },
      ]},
    ],
  };

  // Passes first pathway
  const profile1 = makeBritishProfile([
    { name: "Math", level: "a_level", grade: "C" },
    { name: "Physics", level: "a_level", grade: "C" },
    { name: "Chemistry", level: "a_level", grade: "C" },
  ]);
  const result1 = britishQualificationsEvaluatorV3.evaluate(config, profile1);
  assert.strictEqual(result1.outcomeKey, "pass");
  assert.strictEqual((result1.facts as any).matchedPathway?.label, "Standard");

  // Passes second pathway (only 2 A Levels but with AS)
  const profile2 = makeBritishProfile([
    { name: "Math", level: "a_level", grade: "A" },
    { name: "Physics", level: "a_level", grade: "B" },
    { name: "English", level: "as_level", grade: "B" },
    { name: "Art", level: "as_level", grade: "C" },
    { name: "History", level: "as_level", grade: "C" },
  ]);
  const result2 = britishQualificationsEvaluatorV3.evaluate(config, profile2);
  assert.strictEqual(result2.outcomeKey, "pass");
  assert.strictEqual((result2.facts as any).matchedPathway?.label, "Alternative");
});

test("42. Config validation: valid pathways → passes", () => {
  const config = { pathways: [{ requirements: [{ level: "a_level", min_count: 3, min_grade: "C" }] }] };
  const validated = britishQualificationsEvaluatorV3.validateConfig(config);
  assert.deepStrictEqual(validated.pathways.length, 1);
});

test("43. Config validation: empty pathways → throws", () => {
  assert.throws(() => {
    britishQualificationsEvaluatorV3.validateConfig({ pathways: [] });
  });
});

// ============================================================
// Engine integration tests
// ============================================================

console.log("\n📋 Engine Integration Tests\n");

test("44. Full engine: british profile passes → engine returns 'pass'", () => {
  const profile = makeBritishProfile([
    { name: "Math", level: "a_level", grade: "B" },
    { name: "Physics", level: "a_level", grade: "C" },
    { name: "Chemistry", level: "a_level", grade: "A" },
  ]);
  const rule = makeRule();
  const result = evaluateRulesV3([rule], profile, { mode: "terminal" });
  assert.strictEqual(result.finalDecision, "pass");
  assert.strictEqual(result.ruleResults.length, 1);
  assert.strictEqual(result.ruleResults[0].result.outcomeKey, "pass");
});

test("45. Full engine: british profile fails → engine returns block for count_fail", () => {
  const profile = makeBritishProfile([
    { name: "Math", level: "a_level", grade: "A" },
  ]);
  const rule = makeRule();
  const result = evaluateRulesV3([rule], profile, { mode: "terminal" });
  assert.strictEqual(result.finalDecision, "block");
  assert.strictEqual(result.ruleResults[0].result.outcomeKey, "count_fail");
  assert.strictEqual(result.ruleResults[0].result.decision, "block");
});

test("46. Full engine: arabic profile → not_applicable is skipped", () => {
  const profile = makeArabicProfile();
  const rule = makeRule();
  const result = evaluateRulesV3([rule], profile, { mode: "diagnostic" });
  // Rule is skipped entirely (not_applicable)
  assert.strictEqual(result.ruleResults.length, 0);
  assert.strictEqual(result.finalDecision, "pass"); // no rules evaluated → pass
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
