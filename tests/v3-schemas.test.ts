// ============================================================
// V3.2 Schema Tests
// Verifies all Zod schemas accept valid data and reject invalid data.
// Run: npx tsx tests/v3-schemas.test.ts
// ============================================================

import {
  DecisionSchema,
  RedirectTargetSchema,
  OutcomeDefinitionSchema,
  OutcomesMapSchema,
  RuleActionSchema,
  EvaluatorRawResultSchema,
  SatFieldSchema,
  LanguageCertFieldSchema,
  GpaFieldSchema,
  StudyTrackSchema,
  BritishSubjectSchema,
  BritishAssessmentProfileSchema,
  ArabicAssessmentProfileSchema,
  MasterAssessmentProfileSchema,
  AssessmentProfileV3Schema,
  PathwayRequirementSchema,
  PathwaySchema,
  BritishQualificationsConfigSchema,
  EngineTraceSchema,
  RequirementRuleV3Schema,
} from "../src/lib/rules/v3/schemas";

import {
  isBritishProfile,
  isArabicProfile,
  isMasterProfile,
} from "../src/lib/rules/v3/profile-types";

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

/** Assert that parsing succeeds. */
function assertParses(schema: { safeParse: (d: unknown) => { success: boolean; error?: unknown } }, data: unknown, label?: string) {
  const result = schema.safeParse(data);
  if (!result.success) {
    throw new Error(`Expected valid${label ? ` (${label})` : ""}: ${JSON.stringify((result as { error: { issues: unknown[] } }).error.issues)}`);
  }
}

/** Assert that parsing fails. */
function assertRejects(schema: { safeParse: (d: unknown) => { success: boolean } }, data: unknown, label?: string) {
  const result = schema.safeParse(data);
  if (result.success) {
    throw new Error(`Expected rejection${label ? ` (${label})` : ""} but parsed successfully`);
  }
}

// ============================================================
// Tests
// ============================================================

console.log("\n📋 V3.2 Schema Tests\n");

// -----------------------------------------------------------
// Decision
// -----------------------------------------------------------
console.log("Decision:");

test("accepts valid decisions", () => {
  for (const d of ["pass", "conditional", "block", "redirect", "review"]) {
    assertParses(DecisionSchema, d, d);
  }
});

test("rejects invalid decision", () => {
  assertRejects(DecisionSchema, "invalid");
  assertRejects(DecisionSchema, 123);
});

// -----------------------------------------------------------
// RedirectTarget
// -----------------------------------------------------------
console.log("\nRedirectTarget:");

test("accepts valid redirect target", () => {
  assertParses(RedirectTargetSchema, { category: "foundation", scope: "same_university" });
  assertParses(RedirectTargetSchema, { category: "bachelor", scope: "any" });
});

test("rejects redirect target with missing category", () => {
  assertRejects(RedirectTargetSchema, { scope: "any" });
});

test("rejects redirect target with invalid scope", () => {
  assertRejects(RedirectTargetSchema, { category: "foundation", scope: "global" });
});

// -----------------------------------------------------------
// OutcomeDefinition — strict validation
// -----------------------------------------------------------
console.log("\nOutcomeDefinition:");

test("pass decision without extra fields → accepted", () => {
  assertParses(OutcomeDefinitionSchema, { decision: "pass" });
});

test("block decision with message → accepted", () => {
  assertParses(OutcomeDefinitionSchema, {
    decision: "block",
    message: "الطالب لا يملك شهادة ثانوية",
  });
});

test("redirect decision WITH redirect → accepted", () => {
  assertParses(OutcomeDefinitionSchema, {
    decision: "redirect",
    message: "جرّب السنة التأسيسية",
    redirect: { category: "foundation", scope: "same_university" },
  });
});

test("redirect decision WITHOUT redirect → REJECTED", () => {
  assertRejects(OutcomeDefinitionSchema, {
    decision: "redirect",
    message: "جرّب السنة التأسيسية",
  });
});

test("conditional decision WITH condition_code → accepted", () => {
  assertParses(OutcomeDefinitionSchema, {
    decision: "conditional",
    condition_code: "SAT_REQUIRED",
    message: "يحتاج SAT",
    deadline: "31 ديسمبر",
  });
});

test("conditional decision WITHOUT condition_code → REJECTED", () => {
  assertRejects(OutcomeDefinitionSchema, {
    decision: "conditional",
    message: "يحتاج SAT",
  });
});

test("review decision WITH message → accepted", () => {
  assertParses(OutcomeDefinitionSchema, {
    decision: "review",
    message: "مطلوب مراجعة المستندات",
  });
});

test("review decision WITHOUT message → REJECTED", () => {
  assertRejects(OutcomeDefinitionSchema, {
    decision: "review",
  });
});

// -----------------------------------------------------------
// OutcomesMap
// -----------------------------------------------------------
console.log("\nOutcomesMap:");

test("accepts empty map {} (legacy backward compat — not migrated to V3)", () => {
  assertParses(OutcomesMapSchema, {});
});

test("accepts map with valid outcomes", () => {
  assertParses(OutcomesMapSchema, {
    met: { decision: "pass" },
    not_met: {
      decision: "block",
      message: "الطالب لا يملك شهادة ثانوية",
    },
  });
});

test("rejects map with invalid outcome", () => {
  assertRejects(OutcomesMapSchema, {
    met: { decision: "invalid_decision" },
  });
});

// -----------------------------------------------------------
// RuleAction
// -----------------------------------------------------------
console.log("\nRuleAction:");

test("accepts redirect action", () => {
  assertParses(RuleActionSchema, {
    type: "redirect",
    target: { category: "foundation", scope: "same_university" },
  });
});

test("accepts condition action", () => {
  assertParses(RuleActionSchema, {
    type: "condition",
    code: "SAT_REQUIRED",
    message: "يحتاج SAT",
    deadline: "31 ديسمبر",
  });
});

test("accepts scholarship action", () => {
  assertParses(RuleActionSchema, { type: "scholarship", tier: "gold" });
});

test("accepts note action", () => {
  assertParses(RuleActionSchema, { type: "note", message: "ملاحظة" });
});

test("accepts review action", () => {
  assertParses(RuleActionSchema, { type: "review", reason: "مراجعة مطلوبة" });
});

test("rejects action with unknown type", () => {
  assertRejects(RuleActionSchema, { type: "unknown_type" });
});

// -----------------------------------------------------------
// EvaluatorRawResult
// -----------------------------------------------------------
console.log("\nEvaluatorRawResult:");

test("accepts valid raw result", () => {
  assertParses(EvaluatorRawResultSchema, {
    outcomeKey: "met",
    facts: { score: 7.0, needed: 6.5 },
  });
});

test("accepts raw result with extraActions", () => {
  assertParses(EvaluatorRawResultSchema, {
    outcomeKey: "not_met",
    facts: {},
    extraActions: [{ type: "note", message: "ملاحظة" }],
  });
});

test("rejects raw result without outcomeKey", () => {
  assertRejects(EvaluatorRawResultSchema, { facts: {} });
});

// -----------------------------------------------------------
// SatField — 3 states
// -----------------------------------------------------------
console.log("\nSatField:");

test("accepts present SAT with score", () => {
  assertParses(SatFieldSchema, { state: "present", score: 1200 });
});

test("accepts not_provided SAT", () => {
  assertParses(SatFieldSchema, { state: "not_provided" });
});

test("accepts unknown SAT", () => {
  assertParses(SatFieldSchema, { state: "unknown" });
});

test("rejects present SAT without score", () => {
  assertRejects(SatFieldSchema, { state: "present" });
});

test("rejects SAT with out-of-range score", () => {
  assertRejects(SatFieldSchema, { state: "present", score: 200 });
  assertRejects(SatFieldSchema, { state: "present", score: 2000 });
});

// -----------------------------------------------------------
// LanguageCertField — 3 states
// -----------------------------------------------------------
console.log("\nLanguageCertField:");

test("accepts present language cert", () => {
  assertParses(LanguageCertFieldSchema, {
    state: "present",
    type: "ielts",
    score: 6.5,
  });
});

test("accepts not_provided language cert", () => {
  assertParses(LanguageCertFieldSchema, { state: "not_provided" });
});

test("accepts unknown language cert", () => {
  assertParses(LanguageCertFieldSchema, { state: "unknown" });
});

test("rejects present language cert without type", () => {
  assertRejects(LanguageCertFieldSchema, { state: "present", score: 6.5 });
});

// -----------------------------------------------------------
// GpaField
// -----------------------------------------------------------
console.log("\nGpaField:");

test("accepts present GPA", () => {
  assertParses(GpaFieldSchema, { state: "present", percentage: 85 });
});

test("rejects GPA over 100", () => {
  assertRejects(GpaFieldSchema, { state: "present", percentage: 105 });
});

// -----------------------------------------------------------
// StudyTrack
// -----------------------------------------------------------
console.log("\nStudyTrack:");

test("accepts present study track", () => {
  assertParses(StudyTrackSchema, { state: "present", track: "scientific" });
  assertParses(StudyTrackSchema, { state: "present", track: "literary" });
  assertParses(StudyTrackSchema, { state: "present", track: "other" });
});

test("rejects invalid track value", () => {
  assertRejects(StudyTrackSchema, { state: "present", track: "engineering" });
});

// -----------------------------------------------------------
// BritishSubject
// -----------------------------------------------------------
console.log("\nBritishSubject:");

test("accepts valid british subject", () => {
  assertParses(BritishSubjectSchema, {
    name: "Mathematics",
    level: "a_level",
    grade: "A",
  });
});

test("rejects subject with invalid level", () => {
  assertRejects(BritishSubjectSchema, {
    name: "Math",
    level: "gcse",
    grade: "A",
  });
});

// -----------------------------------------------------------
// AssessmentProfileV3 — discriminated union
// -----------------------------------------------------------
console.log("\nAssessmentProfileV3 (discriminated union):");

const validBritish = {
  certificateType: "british" as const,
  subjects: [{ name: "Math", level: "a_level" as const, grade: "A" }],
  sat: { state: "not_provided" as const },
  languageCert: { state: "present" as const, type: "ielts", score: 7.0 },
};

const validArabic = {
  certificateType: "arabic" as const,
  hasHighSchool: true,
  has12Years: true,
  gpa: { state: "present" as const, percentage: 90 },
  studyTrack: { state: "present" as const, track: "scientific" as const },
  sat: { state: "not_provided" as const },
  languageCert: { state: "not_provided" as const },
};

const validMaster = {
  certificateType: "master" as const,
  hasBachelor: true,
  hasResearchPlan: false,
  languageCert: { state: "present" as const, type: "ielts", score: 6.5 },
};

test("accepts valid British profile", () => {
  assertParses(AssessmentProfileV3Schema, validBritish);
});

test("accepts valid Arabic profile", () => {
  assertParses(AssessmentProfileV3Schema, validArabic);
});

test("accepts valid Master profile", () => {
  assertParses(AssessmentProfileV3Schema, validMaster);
});

test("accepts Arabic profile with 'unknown' fields", () => {
  assertParses(AssessmentProfileV3Schema, {
    ...validArabic,
    hasHighSchool: "unknown",
    has12Years: "unknown",
  });
});

test("rejects profile with invalid certificateType", () => {
  assertRejects(AssessmentProfileV3Schema, {
    ...validArabic,
    certificateType: "american",
  });
});

test("rejects British profile with missing subjects", () => {
  const { subjects: _s, ...rest } = validBritish;
  void _s;
  assertRejects(AssessmentProfileV3Schema, rest);
});

test("rejects Arabic profile with missing gpa", () => {
  const { gpa: _g, ...rest } = validArabic;
  void _g;
  assertRejects(AssessmentProfileV3Schema, rest);
});

// -----------------------------------------------------------
// Type guards
// -----------------------------------------------------------
console.log("\nType guards:");

test("isBritishProfile correctly identifies British", () => {
  const parsed = AssessmentProfileV3Schema.parse(validBritish);
  assert.strictEqual(isBritishProfile(parsed), true);
  assert.strictEqual(isArabicProfile(parsed), false);
  assert.strictEqual(isMasterProfile(parsed), false);
});

test("isArabicProfile correctly identifies Arabic", () => {
  const parsed = AssessmentProfileV3Schema.parse(validArabic);
  assert.strictEqual(isArabicProfile(parsed), true);
  assert.strictEqual(isBritishProfile(parsed), false);
});

test("isMasterProfile correctly identifies Master", () => {
  const parsed = AssessmentProfileV3Schema.parse(validMaster);
  assert.strictEqual(isMasterProfile(parsed), true);
  assert.strictEqual(isBritishProfile(parsed), false);
});

// -----------------------------------------------------------
// BritishQualificationsConfig — pathways
// -----------------------------------------------------------
console.log("\nBritishQualificationsConfig:");

test("accepts valid pathways config", () => {
  assertParses(BritishQualificationsConfigSchema, {
    pathways: [
      {
        label: "Standard A Level",
        requirements: [
          { level: "a_level", min_count: 3, min_grade: "C" },
        ],
      },
    ],
  });
});

test("accepts pathways with multiple requirements", () => {
  assertParses(BritishQualificationsConfigSchema, {
    pathways: [
      {
        requirements: [
          { level: "a_level", min_count: 2, min_grade: "C" },
          { level: "as_level", min_count: 1 },
        ],
      },
    ],
  });
});

test("rejects pathways with empty requirements", () => {
  assertRejects(BritishQualificationsConfigSchema, {
    pathways: [{ requirements: [] }],
  });
});

test("rejects empty pathways array", () => {
  assertRejects(BritishQualificationsConfigSchema, {
    pathways: [],
  });
});

// -----------------------------------------------------------
// EngineTrace
// -----------------------------------------------------------
console.log("\nEngineTrace:");

test("accepts valid engine trace", () => {
  assertParses(EngineTraceSchema, {
    evaluatedAt: "2026-03-16T00:00:00Z",
    profileHash: "abc123",
    rulesEvaluated: 5,
    rulesStopped: false,
    mode: "terminal",
  });
});

test("accepts trace with stoppedAtRule", () => {
  assertParses(EngineTraceSchema, {
    evaluatedAt: "2026-03-16T00:00:00Z",
    profileHash: "abc123",
    rulesEvaluated: 3,
    rulesStopped: true,
    stoppedAtRule: "rule-123",
    mode: "diagnostic",
  });
});

// -----------------------------------------------------------
// RequirementRuleV3
// -----------------------------------------------------------
console.log("\nRequirementRuleV3:");

test("accepts valid rule with outcomes", () => {
  assertParses(RequirementRuleV3Schema, {
    id: "550e8400-e29b-41d4-a716-446655440000",
    program_id: "550e8400-e29b-41d4-a716-446655440001",
    certificate_type_id: null,
    rule_type: "high_school",
    config: {},
    outcomes: {
      met: { decision: "pass" },
      not_met: { decision: "block", message: "الطالب لا يملك شهادة ثانوية" },
    },
    sort_order: 1,
    is_enabled: true,
    tenant_id: "550e8400-e29b-41d4-a716-446655440002",
  });
});

test("accepts rule with empty outcomes (legacy not-migrated)", () => {
  assertParses(RequirementRuleV3Schema, {
    id: "550e8400-e29b-41d4-a716-446655440000",
    program_id: "550e8400-e29b-41d4-a716-446655440001",
    certificate_type_id: "550e8400-e29b-41d4-a716-446655440003",
    rule_type: "sat",
    config: { min_score: 1200 },
    outcomes: {},
    sort_order: 2,
    is_enabled: true,
    tenant_id: "550e8400-e29b-41d4-a716-446655440002",
    effect: "makes_conditional",
    effect_message: "يحتاج SAT",
  });
});

test("rejects rule with missing id", () => {
  assertRejects(RequirementRuleV3Schema, {
    program_id: "550e8400-e29b-41d4-a716-446655440001",
    rule_type: "high_school",
    config: {},
    outcomes: {},
    sort_order: 1,
    is_enabled: true,
    tenant_id: "550e8400-e29b-41d4-a716-446655440002",
  });
});

// ============================================================
// Summary
// ============================================================

console.log("\n========================================");
console.log(`✅ Passed: ${passed}`);
console.log(`❌ Failed: ${failed}`);
if (failures.length > 0) {
  console.log("\nFailures:");
  for (const f of failures) {
    console.log(`  → ${f}`);
  }
}
console.log("========================================\n");

process.exit(failed > 0 ? 1 : 0);
