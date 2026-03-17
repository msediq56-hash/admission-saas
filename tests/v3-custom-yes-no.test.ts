// ============================================================
// V3.2 custom_yes_no Evaluator Tests
// Run: npx tsx tests/v3-custom-yes-no.test.ts
// ============================================================

import { customYesNoEvaluatorV3 } from "../src/lib/rules/v3/evaluators/custom-yes-no";
import "../src/lib/rules/v3/evaluators/registry"; // registers all evaluators
import type {
  ArabicAssessmentProfile,
  BritishAssessmentProfile,
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

function makeArabicProfile(
  dynamicAnswers?: Record<string, string | boolean | number>
): ArabicAssessmentProfile {
  return {
    certificateType: "arabic",
    hasHighSchool: true,
    has12Years: true,
    gpa: { state: "present", percentage: 85 },
    studyTrack: { state: "present", track: "scientific" },
    sat: { state: "not_provided" },
    languageCert: { state: "not_provided" },
    dynamicAnswers,
  };
}

function makeBritishProfile(
  dynamicAnswers?: Record<string, string | boolean | number>
): BritishAssessmentProfile {
  return {
    certificateType: "british",
    subjects: [{ name: "Math", level: "a_level", grade: "B" }],
    sat: { state: "not_provided" },
    languageCert: { state: "not_provided" },
    dynamicAnswers,
  };
}

// ============================================================
// Evaluator tests
// ============================================================

console.log("\n📋 custom_yes_no Evaluator Tests\n");

test("1. answer true → 'yes'", () => {
  const config = customYesNoEvaluatorV3.validateConfig({
    question_text: "هل لدى الطالب شهادة؟",
    comparison_key: "has_cert",
  });
  const profile = makeArabicProfile({ has_cert: true });
  const result = customYesNoEvaluatorV3.evaluate(config, profile);
  assert.strictEqual(result.outcomeKey, "yes");
  assert.strictEqual((result.facts as any).answer, true);
});

test("2. answer false → 'no'", () => {
  const config = customYesNoEvaluatorV3.validateConfig({
    question_text: "هل لدى الطالب شهادة؟",
    comparison_key: "has_cert",
  });
  const profile = makeArabicProfile({ has_cert: false });
  const result = customYesNoEvaluatorV3.evaluate(config, profile);
  assert.strictEqual(result.outcomeKey, "no");
  assert.strictEqual((result.facts as any).answer, false);
});

test("3. answer 'yes' (string) → 'yes'", () => {
  const config = customYesNoEvaluatorV3.validateConfig({
    question_text: "هل لدى الطالب شهادة؟",
    comparison_key: "has_cert",
  });
  const profile = makeArabicProfile({ has_cert: "yes" });
  const result = customYesNoEvaluatorV3.evaluate(config, profile);
  assert.strictEqual(result.outcomeKey, "yes");
});

test("4. answer not provided → 'unknown'", () => {
  const config = customYesNoEvaluatorV3.validateConfig({
    question_text: "هل لدى الطالب شهادة؟",
    comparison_key: "has_cert",
  });
  const profile = makeArabicProfile({}); // no has_cert key
  const result = customYesNoEvaluatorV3.evaluate(config, profile);
  assert.strictEqual(result.outcomeKey, "unknown");
  assert.strictEqual((result.facts as any).reason, "answer not provided");
});

test("5. no comparison_key in config → 'unknown'", () => {
  const config = customYesNoEvaluatorV3.validateConfig({
    question_text: "هل لدى الطالب شهادة؟",
  });
  const profile = makeArabicProfile({ has_cert: true });
  const result = customYesNoEvaluatorV3.evaluate(config, profile);
  assert.strictEqual(result.outcomeKey, "unknown");
  assert.strictEqual((result.facts as any).reason, "no comparison_key in config");
});

test("6. config validation passes with valid config", () => {
  const config = customYesNoEvaluatorV3.validateConfig({
    question_text: "سؤال",
    comparison_key: "some_key",
    positive_message: "نعم",
    negative_message: "لا",
  });
  assert.strictEqual(config.question_text, "سؤال");
  assert.strictEqual(config.comparison_key, "some_key");
});

test("7. config validation passes without comparison_key (optional)", () => {
  const config = customYesNoEvaluatorV3.validateConfig({
    question_text: "سؤال",
  });
  assert.strictEqual(config.comparison_key, undefined);
});

// ============================================================
// dynamicAnswers addition doesn't break profiles
// ============================================================

console.log("\n📋 dynamicAnswers Profile Compatibility Tests\n");

test("8. Arabic profile with dynamicAnswers is valid", () => {
  const profile = makeArabicProfile({ key1: true, key2: 42, key3: "option_a" });
  assert.strictEqual(profile.certificateType, "arabic");
  assert.strictEqual(profile.dynamicAnswers?.key1, true);
  assert.strictEqual(profile.dynamicAnswers?.key2, 42);
  assert.strictEqual(profile.dynamicAnswers?.key3, "option_a");
});

test("9. Profile without dynamicAnswers is still valid", () => {
  const profile: ArabicAssessmentProfile = {
    certificateType: "arabic",
    hasHighSchool: true,
    has12Years: true,
    gpa: { state: "present", percentage: 85 },
    studyTrack: { state: "present", track: "scientific" },
    sat: { state: "not_provided" },
    languageCert: { state: "not_provided" },
    // no dynamicAnswers
  };
  assert.strictEqual(profile.dynamicAnswers, undefined);
});

test("10. British profile with dynamicAnswers works with evaluator", () => {
  const config = customYesNoEvaluatorV3.validateConfig({
    question_text: "Has interview?",
    comparison_key: "has_interview",
  });
  const profile = makeBritishProfile({ has_interview: true });
  const result = customYesNoEvaluatorV3.evaluate(config, profile);
  assert.strictEqual(result.outcomeKey, "yes");
});

test("11. no dynamicAnswers on profile → 'unknown'", () => {
  const config = customYesNoEvaluatorV3.validateConfig({
    question_text: "Has interview?",
    comparison_key: "has_interview",
  });
  // Profile without dynamicAnswers
  const profile: ArabicAssessmentProfile = {
    certificateType: "arabic",
    hasHighSchool: true,
    has12Years: true,
    gpa: { state: "present", percentage: 85 },
    studyTrack: { state: "present", track: "scientific" },
    sat: { state: "not_provided" },
    languageCert: { state: "not_provided" },
  };
  const result = customYesNoEvaluatorV3.evaluate(config, profile);
  assert.strictEqual(result.outcomeKey, "unknown");
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
