// ============================================================
// V3.2 Engine + Evaluator Tests
// Run: npx tsx tests/v3-engine.test.ts
// ============================================================

import { resolveOutcome, evaluateRulesV3 } from "../src/lib/rules/v3/engine";
import "../src/lib/rules/v3/evaluators/registry"; // registers all evaluators
import { getEvaluatorV3 } from "../src/lib/rules/v3/evaluators/registry";
import type {
  AssessmentProfileV3,
  ArabicAssessmentProfile,
  BritishAssessmentProfile,
  MasterAssessmentProfile,
  RequirementRuleV3,
  OutcomeDefinition,
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
// Test profiles
// ============================================================

const arabicProfile: ArabicAssessmentProfile = {
  certificateType: "arabic",
  hasHighSchool: true,
  has12Years: true,
  gpa: { state: "present", percentage: 90 },
  studyTrack: { state: "present", track: "scientific" },
  sat: { state: "present", score: 1300 },
  languageCert: { state: "present", type: "ielts", score: 7.0 },
};

const britishProfile: BritishAssessmentProfile = {
  certificateType: "british",
  subjects: [
    { name: "Math", level: "a_level", grade: "A" },
    { name: "Physics", level: "a_level", grade: "B" },
    { name: "Chemistry", level: "a_level", grade: "C" },
  ],
  sat: { state: "present", score: 1300 },
  languageCert: { state: "present", type: "ielts", score: 7.0 },
};

const masterProfile: MasterAssessmentProfile = {
  certificateType: "master",
  hasBachelor: true,
  hasResearchPlan: true,
  languageCert: { state: "present", type: "ielts", score: 7.0 },
};

// Helper to make a rule
function makeRule(
  overrides: Partial<RequirementRuleV3> & { rule_type: string; outcomes: Record<string, OutcomeDefinition> }
): RequirementRuleV3 {
  return {
    id: overrides.id || "rule-" + Math.random().toString(36).slice(2, 8),
    program_id: "prog-1",
    certificate_type_id: null,
    config: {},
    sort_order: 1,
    is_enabled: true,
    tenant_id: "tenant-1",
    ...overrides,
  };
}

// ============================================================
// resolveOutcome tests
// ============================================================

console.log("\n📋 V3.2 Engine Tests\n");
console.log("resolveOutcome:");

test("pass outcome → decision: pass, no actions", () => {
  const result = resolveOutcome(
    { outcomeKey: "pass", facts: { hasHighSchool: true } },
    { pass: { decision: "pass" } },
    "rule-1",
    "high_school"
  );
  assert.strictEqual(result.decision, "pass");
  assert.strictEqual(result.actions.length, 0);
  assert.strictEqual(result.outcomeKey, "pass");
});

test("conditional outcome → condition action, NO duplicate note", () => {
  const result = resolveOutcome(
    { outcomeKey: "not_available", facts: {} },
    {
      not_available: {
        decision: "conditional",
        condition_code: "SAT_REQUIRED",
        message: "يحتاج SAT",
        deadline: "31 ديسمبر",
      },
    },
    "rule-2",
    "sat"
  );
  assert.strictEqual(result.decision, "conditional");
  assert.strictEqual(result.actions.length, 1);
  assert.strictEqual(result.actions[0].type, "condition");
  const action = result.actions[0] as { type: "condition"; code: string; message: string; deadline?: string };
  assert.strictEqual(action.code, "SAT_REQUIRED");
  assert.strictEqual(action.message, "يحتاج SAT");
  assert.strictEqual(action.deadline, "31 ديسمبر");
});

test("redirect outcome → redirect action", () => {
  const result = resolveOutcome(
    { outcomeKey: "not_met", facts: {} },
    {
      not_met: {
        decision: "redirect",
        message: "جرّب السنة التأسيسية",
        redirect: { category: "foundation", scope: "same_university" },
      },
    },
    "rule-3",
    "a_levels"
  );
  assert.strictEqual(result.decision, "redirect");
  assert.ok(result.actions.some((a) => a.type === "redirect"));
});

test("review outcome → review action, NO duplicate note", () => {
  const result = resolveOutcome(
    { outcomeKey: "needs_review", facts: {} },
    {
      needs_review: {
        decision: "review",
        message: "مطلوب مراجعة المستندات",
      },
    },
    "rule-4",
    "custom"
  );
  assert.strictEqual(result.decision, "review");
  assert.strictEqual(result.actions.length, 1);
  assert.strictEqual(result.actions[0].type, "review");
  const action = result.actions[0] as { type: "review"; reason: string };
  assert.strictEqual(action.reason, "مطلوب مراجعة المستندات");
});

test("block with message → note action", () => {
  const result = resolveOutcome(
    { outcomeKey: "not_available", facts: {} },
    {
      not_available: {
        decision: "block",
        message: "الطالب لا يملك شهادة ثانوية",
      },
    },
    "rule-5",
    "high_school"
  );
  assert.strictEqual(result.decision, "block");
  assert.strictEqual(result.actions.length, 1);
  assert.strictEqual(result.actions[0].type, "note");
});

test("throws on unknown outcomeKey — includes ruleId and ruleType", () => {
  try {
    resolveOutcome(
      { outcomeKey: "nonexistent", facts: {} },
      { pass: { decision: "pass" } },
      "rule-99",
      "high_school"
    );
    assert.fail("Should have thrown");
  } catch (e) {
    const msg = (e as Error).message;
    assert.ok(msg.includes("nonexistent"), "should mention key");
    assert.ok(msg.includes("rule-99"), "should mention ruleId");
    assert.ok(msg.includes("high_school"), "should mention ruleType");
  }
});

test("merges extraActions from evaluator", () => {
  const result = resolveOutcome(
    {
      outcomeKey: "pass",
      facts: {},
      extraActions: [{ type: "scholarship", tier: "gold", message: "منحة" }],
    },
    { pass: { decision: "pass" } },
    "rule-6",
    "gpa"
  );
  assert.strictEqual(result.actions.length, 1);
  assert.strictEqual(result.actions[0].type, "scholarship");
});

test("redirect decision WITHOUT message → throws", () => {
  try {
    resolveOutcome(
      { outcomeKey: "not_met", facts: {} },
      {
        not_met: {
          decision: "redirect",
          redirect: { category: "foundation", scope: "same_university" },
        },
      },
      "rule-r1",
      "a_levels"
    );
    assert.fail("Should have thrown");
  } catch (e) {
    const msg = (e as Error).message;
    assert.ok(msg.includes("message"), "should mention message");
    assert.ok(msg.includes("rule-r1"), "should mention ruleId");
  }
});

test("redirect decision WITH message → succeeds", () => {
  const result = resolveOutcome(
    { outcomeKey: "not_met", facts: {} },
    {
      not_met: {
        decision: "redirect",
        message: "جرّب التأسيسية",
        redirect: { category: "foundation", scope: "same_university" },
      },
    },
    "rule-r2",
    "a_levels"
  );
  assert.strictEqual(result.decision, "redirect");
  assert.ok(result.actions.some((a) => a.type === "redirect"));
});

// ============================================================
// not_applicable handling
// ============================================================

console.log("\nnot_applicable handling:");

test("rule returns not_applicable → skipped entirely", () => {
  const rule = makeRule({
    rule_type: "high_school",
    config: {},
    outcomes: {
      pass: { decision: "pass" },
      not_available: { decision: "block", message: "لا يملك ثانوية" },
    },
    sort_order: 1,
  });

  // British profile → high_school returns not_applicable
  const result = evaluateRulesV3([rule], britishProfile, {
    mode: "diagnostic",
  });
  assert.strictEqual(result.ruleResults.length, 0);
  assert.strictEqual(result.finalDecision, "pass");
});

// ============================================================
// Engine terminal mode
// ============================================================

console.log("\nEngine terminal mode:");

test("single passing rule → finalDecision: pass", () => {
  const rule = makeRule({
    rule_type: "high_school",
    config: {},
    outcomes: {
      pass: { decision: "pass" },
      not_available: { decision: "block", message: "لا يملك ثانوية" },
    },
    sort_order: 1,
  });
  const result = evaluateRulesV3([rule], arabicProfile, {
    mode: "terminal",
  });
  assert.strictEqual(result.finalDecision, "pass");
  assert.strictEqual(result.trace.rulesStopped, false);
});

test("single blocking rule → finalDecision: block, rulesStopped: true", () => {
  const noHsProfile: ArabicAssessmentProfile = {
    ...arabicProfile,
    hasHighSchool: false,
  };
  const rule = makeRule({
    rule_type: "high_school",
    config: {},
    outcomes: {
      pass: { decision: "pass" },
      not_available: { decision: "block", message: "لا يملك ثانوية" },
    },
    sort_order: 1,
  });
  const result = evaluateRulesV3([rule], noHsProfile, {
    mode: "terminal",
  });
  assert.strictEqual(result.finalDecision, "block");
  assert.strictEqual(result.trace.rulesStopped, true);
});

test("block then conditional → stops at block, conditional never evaluated", () => {
  const noHsProfile: ArabicAssessmentProfile = {
    ...arabicProfile,
    hasHighSchool: false,
  };
  const blockRule = makeRule({
    id: "block-rule",
    rule_type: "high_school",
    config: {},
    outcomes: {
      pass: { decision: "pass" },
      not_available: { decision: "block", message: "لا يملك ثانوية" },
    },
    sort_order: 1,
  });
  const condRule = makeRule({
    id: "cond-rule",
    rule_type: "sat",
    config: { min_score: 1200 },
    outcomes: {
      pass: { decision: "pass" },
      not_available: { decision: "conditional", condition_code: "SAT", message: "يحتاج SAT" },
    },
    sort_order: 2,
  });
  const result = evaluateRulesV3([blockRule, condRule], noHsProfile, {
    mode: "terminal",
  });
  assert.strictEqual(result.finalDecision, "block");
  assert.strictEqual(result.ruleResults.length, 1);
  assert.strictEqual(result.trace.rulesStopped, true);
});

test("redirect then pass → stops at redirect", () => {
  const rule = makeRule({
    rule_type: "entrance_exam",
    config: {},
    outcomes: {
      required: {
        decision: "redirect",
        message: "جرّب التأسيسية",
        redirect: { category: "foundation", scope: "same_university" },
      },
    },
    sort_order: 1,
  });
  const passRule = makeRule({
    rule_type: "portfolio",
    config: {},
    outcomes: { required: { decision: "pass" } },
    sort_order: 2,
  });
  const result = evaluateRulesV3([rule, passRule], arabicProfile, {
    mode: "terminal",
  });
  assert.strictEqual(result.finalDecision, "redirect");
  assert.strictEqual(result.ruleResults.length, 1);
  assert.strictEqual(result.trace.rulesStopped, true);
});

// ============================================================
// Engine diagnostic mode
// ============================================================

console.log("\nEngine diagnostic mode:");

test("block + conditional → evaluates ALL, finalDecision: block, rulesStopped: false", () => {
  const noHsProfile: ArabicAssessmentProfile = {
    ...arabicProfile,
    hasHighSchool: false,
  };
  const blockRule = makeRule({
    rule_type: "high_school",
    config: {},
    outcomes: {
      pass: { decision: "pass" },
      not_available: { decision: "block", message: "لا يملك ثانوية" },
    },
    sort_order: 1,
  });
  const condRule = makeRule({
    rule_type: "sat",
    config: { min_score: 1400 },
    outcomes: {
      pass: { decision: "pass" },
      score_below: { decision: "conditional", condition_code: "SAT_LOW", message: "SAT منخفض" },
      not_available: { decision: "conditional", condition_code: "SAT", message: "يحتاج SAT" },
    },
    sort_order: 2,
  });
  const result = evaluateRulesV3([blockRule, condRule], noHsProfile, {
    mode: "diagnostic",
  });
  assert.strictEqual(result.finalDecision, "block");
  assert.strictEqual(result.ruleResults.length, 2);
  assert.strictEqual(result.trace.rulesStopped, false);
});

// ============================================================
// Decision precedence
// ============================================================

console.log("\nDecision precedence:");

test("conditional + review → review wins", () => {
  const condRule = makeRule({
    rule_type: "entrance_exam",
    config: {},
    outcomes: {
      required: { decision: "conditional", condition_code: "EXAM", message: "يحتاج امتحان" },
    },
    sort_order: 1,
  });
  const reviewRule = makeRule({
    rule_type: "portfolio",
    config: {},
    outcomes: {
      required: { decision: "review", message: "يحتاج مراجعة" },
    },
    sort_order: 2,
  });
  const result = evaluateRulesV3([condRule, reviewRule], arabicProfile, {
    mode: "diagnostic",
  });
  assert.strictEqual(result.finalDecision, "review");
});

test("pass + conditional → conditional wins", () => {
  const passRule = makeRule({
    rule_type: "high_school",
    config: {},
    outcomes: { pass: { decision: "pass" } },
    sort_order: 1,
  });
  const condRule = makeRule({
    rule_type: "entrance_exam",
    config: {},
    outcomes: {
      required: { decision: "conditional", condition_code: "EXAM", message: "يحتاج امتحان" },
    },
    sort_order: 2,
  });
  const result = evaluateRulesV3([passRule, condRule], arabicProfile, {
    mode: "diagnostic",
  });
  assert.strictEqual(result.finalDecision, "conditional");
});

test("block + redirect + review + conditional → block wins", () => {
  const noHsProfile: ArabicAssessmentProfile = {
    ...arabicProfile,
    hasHighSchool: false,
  };
  const rules = [
    makeRule({
      rule_type: "high_school",
      config: {},
      outcomes: {
        pass: { decision: "pass" },
        not_available: { decision: "block", message: "لا يملك ثانوية" },
      },
      sort_order: 1,
    }),
    makeRule({
      rule_type: "entrance_exam",
      config: {},
      outcomes: {
        required: {
          decision: "redirect",
          message: "جرّب التأسيسية",
          redirect: { category: "foundation", scope: "same_university" },
        },
      },
      sort_order: 2,
    }),
    makeRule({
      rule_type: "portfolio",
      config: {},
      outcomes: { required: { decision: "review", message: "يحتاج مراجعة" } },
      sort_order: 3,
    }),
  ];
  const result = evaluateRulesV3(rules, noHsProfile, {
    mode: "diagnostic",
  });
  assert.strictEqual(result.finalDecision, "block");
});

// ============================================================
// Redirect field
// ============================================================

console.log("\nRedirect field:");

test("diagnostic: redirect + block → finalDecision: block, redirect NOT populated", () => {
  const noHsProfile: ArabicAssessmentProfile = {
    ...arabicProfile,
    hasHighSchool: false,
  };
  const rules = [
    makeRule({
      rule_type: "high_school",
      config: {},
      outcomes: {
        pass: { decision: "pass" },
        not_available: { decision: "block", message: "لا يملك ثانوية" },
      },
      sort_order: 1,
    }),
    makeRule({
      rule_type: "entrance_exam",
      config: {},
      outcomes: {
        required: {
          decision: "redirect",
          message: "جرّب التأسيسية",
          redirect: { category: "foundation", scope: "same_university" },
        },
      },
      sort_order: 2,
    }),
  ];
  const result = evaluateRulesV3(rules, noHsProfile, {
    mode: "diagnostic",
  });
  assert.strictEqual(result.finalDecision, "block");
  assert.strictEqual(result.redirect, undefined);
});

test("terminal: redirect rule → stops, redirect IS populated with message", () => {
  const rule = makeRule({
    rule_type: "entrance_exam",
    config: {},
    outcomes: {
      required: {
        decision: "redirect",
        message: "جرّب التأسيسية",
        redirect: { category: "foundation", scope: "same_university" },
      },
    },
    sort_order: 1,
  });
  const result = evaluateRulesV3([rule], arabicProfile, {
    mode: "terminal",
  });
  assert.strictEqual(result.finalDecision, "redirect");
  assert.ok(result.redirect);
  assert.strictEqual(result.redirect!.category, "foundation");
  assert.strictEqual(result.redirect!.message, "جرّب التأسيسية");
});

test("redirect outcome message preserved → NOT empty string", () => {
  const rule = makeRule({
    rule_type: "entrance_exam",
    config: {},
    outcomes: {
      required: {
        decision: "redirect",
        message: "يُنصح بالتقديم على برنامج تأسيسي",
        redirect: { category: "foundation", scope: "same_university" },
      },
    },
    sort_order: 1,
  });
  const result = evaluateRulesV3([rule], arabicProfile, {
    mode: "diagnostic",
  });
  assert.strictEqual(result.finalDecision, "redirect");
  assert.ok(result.redirect);
  assert.strictEqual(result.redirect!.message, "يُنصح بالتقديم على برنامج تأسيسي");
});

test("redirect in terminal mode → stops AND redirect.message preserved", () => {
  const redirectRule = makeRule({
    rule_type: "entrance_exam",
    config: {},
    outcomes: {
      required: {
        decision: "redirect",
        message: "يُنصح بالتقديم على برنامج تأسيسي",
        redirect: { category: "foundation", scope: "any" },
      },
    },
    sort_order: 1,
  });
  const passRule = makeRule({
    rule_type: "portfolio",
    config: {},
    outcomes: { required: { decision: "pass" } },
    sort_order: 2,
  });
  const result = evaluateRulesV3([redirectRule, passRule], arabicProfile, {
    mode: "terminal",
  });
  assert.strictEqual(result.finalDecision, "redirect");
  assert.strictEqual(result.trace.rulesStopped, true);
  assert.strictEqual(result.ruleResults.length, 1);
  assert.ok(result.redirect);
  assert.strictEqual(result.redirect!.message, "يُنصح بالتقديم على برنامج تأسيسي");
  assert.strictEqual(result.redirect!.scope, "any");
});

// ============================================================
// Edge cases
// ============================================================

console.log("\nEdge cases:");

test("empty rules → pass", () => {
  const result = evaluateRulesV3([], arabicProfile, { mode: "diagnostic" });
  assert.strictEqual(result.finalDecision, "pass");
});

test("all disabled → pass", () => {
  const rule = makeRule({
    rule_type: "high_school",
    config: {},
    outcomes: {
      pass: { decision: "pass" },
      not_available: { decision: "block", message: "test" },
    },
    is_enabled: false,
    sort_order: 1,
  });
  const result = evaluateRulesV3([rule], arabicProfile, { mode: "diagnostic" });
  assert.strictEqual(result.finalDecision, "pass");
});

test("rules with empty outcomes ({}) skipped", () => {
  const rule = makeRule({
    rule_type: "high_school",
    config: {},
    outcomes: {} as Record<string, OutcomeDefinition>,
    sort_order: 1,
  });
  const result = evaluateRulesV3([rule], arabicProfile, { mode: "diagnostic" });
  assert.strictEqual(result.finalDecision, "pass");
  assert.strictEqual(result.ruleResults.length, 0);
});

test("unknown evaluator → rule skipped silently", () => {
  const rule = makeRule({
    rule_type: "nonexistent_evaluator",
    config: {},
    outcomes: { pass: { decision: "pass" } },
    sort_order: 1,
  });
  const result = evaluateRulesV3([rule], arabicProfile, { mode: "diagnostic" });
  assert.strictEqual(result.finalDecision, "pass");
  assert.strictEqual(result.ruleResults.length, 0);
});

// ============================================================
// Evaluator tests
// ============================================================

console.log("\nEvaluator tests:");

test("high_school: arabic + has HS → pass", () => {
  const ev = getEvaluatorV3("high_school")!;
  const config = ev.validateConfig({});
  const result = ev.evaluate(config, arabicProfile);
  assert.strictEqual(result.outcomeKey, "pass");
});

test("high_school: arabic + no HS → not_available", () => {
  const ev = getEvaluatorV3("high_school")!;
  const config = ev.validateConfig({});
  const result = ev.evaluate(config, { ...arabicProfile, hasHighSchool: false });
  assert.strictEqual(result.outcomeKey, "not_available");
});

test("high_school: british profile → not_applicable", () => {
  const ev = getEvaluatorV3("high_school")!;
  const config = ev.validateConfig({});
  const result = ev.evaluate(config, britishProfile);
  assert.strictEqual(result.outcomeKey, "not_applicable");
});

test("language_cert: present + above min → pass", () => {
  const ev = getEvaluatorV3("language_cert")!;
  const config = ev.validateConfig({ cert_type: "ielts", min_score: 6.5 });
  const result = ev.evaluate(config, arabicProfile); // has ielts 7.0
  assert.strictEqual(result.outcomeKey, "pass");
  assert.strictEqual(result.facts.met, true);
});

test("language_cert: present + below min → score_below", () => {
  const ev = getEvaluatorV3("language_cert")!;
  const config = ev.validateConfig({ cert_type: "ielts", min_score: 8.0 });
  const result = ev.evaluate(config, arabicProfile); // has ielts 7.0
  assert.strictEqual(result.outcomeKey, "score_below");
  assert.strictEqual(result.facts.met, false);
});

test("language_cert: not_provided → not_available", () => {
  const ev = getEvaluatorV3("language_cert")!;
  const config = ev.validateConfig({ cert_type: "ielts", min_score: 6.5 });
  const profile: ArabicAssessmentProfile = {
    ...arabicProfile,
    languageCert: { state: "not_provided" },
  };
  const result = ev.evaluate(config, profile);
  assert.strictEqual(result.outcomeKey, "not_available");
});

test("language_cert: alternative type matches → pass", () => {
  const ev = getEvaluatorV3("language_cert")!;
  const config = ev.validateConfig({
    cert_type: "ielts",
    min_score: 6.5,
    alternatives: { Duolingo: 110 },
  });
  const profile: ArabicAssessmentProfile = {
    ...arabicProfile,
    languageCert: { state: "present", type: "duolingo", score: 120 },
  };
  const result = ev.evaluate(config, profile);
  assert.strictEqual(result.outcomeKey, "pass");
});

test("language_cert: wrong type → wrong_type", () => {
  const ev = getEvaluatorV3("language_cert")!;
  const config = ev.validateConfig({ cert_type: "ielts", min_score: 6.5 });
  const profile: ArabicAssessmentProfile = {
    ...arabicProfile,
    languageCert: { state: "present", type: "toefl", score: 100 },
  };
  const result = ev.evaluate(config, profile);
  assert.strictEqual(result.outcomeKey, "wrong_type");
});

test("sat: present + above → pass", () => {
  const ev = getEvaluatorV3("sat")!;
  const config = ev.validateConfig({ min_score: 1200 });
  const result = ev.evaluate(config, arabicProfile); // has 1300
  assert.strictEqual(result.outcomeKey, "pass");
});

test("sat: below → score_below", () => {
  const ev = getEvaluatorV3("sat")!;
  const config = ev.validateConfig({ min_score: 1400 });
  const result = ev.evaluate(config, arabicProfile); // has 1300
  assert.strictEqual(result.outcomeKey, "score_below");
});

test("sat: master profile → not_applicable", () => {
  const ev = getEvaluatorV3("sat")!;
  const config = ev.validateConfig({ min_score: 1200 });
  const result = ev.evaluate(config, masterProfile);
  assert.strictEqual(result.outcomeKey, "not_applicable");
});

test("gpa: present + above min → pass (uses percentage)", () => {
  const ev = getEvaluatorV3("gpa")!;
  const config = ev.validateConfig({ min_gpa: 80 });
  const result = ev.evaluate(config, arabicProfile); // gpa.percentage = 90
  assert.strictEqual(result.outcomeKey, "pass");
  assert.strictEqual(result.facts.gpa, 90);
});

test("gpa: present + below → below_minimum", () => {
  const ev = getEvaluatorV3("gpa")!;
  const config = ev.validateConfig({ min_gpa: 95 });
  const result = ev.evaluate(config, arabicProfile); // gpa.percentage = 90
  assert.strictEqual(result.outcomeKey, "below_minimum");
});

test("gpa: not_provided → not_available", () => {
  const ev = getEvaluatorV3("gpa")!;
  const config = ev.validateConfig({ min_gpa: 80 });
  const profile: ArabicAssessmentProfile = {
    ...arabicProfile,
    gpa: { state: "not_provided" },
  };
  const result = ev.evaluate(config, profile);
  assert.strictEqual(result.outcomeKey, "not_available");
});

test("study_track: allowed → pass", () => {
  const ev = getEvaluatorV3("study_track")!;
  const config = ev.validateConfig({ allowed_tracks: ["scientific"] });
  const result = ev.evaluate(config, arabicProfile); // track = scientific
  assert.strictEqual(result.outcomeKey, "pass");
});

test("study_track: wrong → wrong_track", () => {
  const ev = getEvaluatorV3("study_track")!;
  const config = ev.validateConfig({ allowed_tracks: ["literary"] });
  const result = ev.evaluate(config, arabicProfile); // track = scientific
  assert.strictEqual(result.outcomeKey, "wrong_track");
});

test("study_track: not_provided → not_available", () => {
  const ev = getEvaluatorV3("study_track")!;
  const config = ev.validateConfig({ allowed_tracks: ["scientific"] });
  const profile: ArabicAssessmentProfile = {
    ...arabicProfile,
    studyTrack: { state: "not_provided" },
  };
  const result = ev.evaluate(config, profile);
  assert.strictEqual(result.outcomeKey, "not_available");
});

test("entrance_exam: always required", () => {
  const ev = getEvaluatorV3("entrance_exam")!;
  const config = ev.validateConfig({});
  const result = ev.evaluate(config, arabicProfile);
  assert.strictEqual(result.outcomeKey, "required");
});

test("research_plan: master + has it → pass", () => {
  const ev = getEvaluatorV3("research_plan")!;
  const config = ev.validateConfig({});
  const result = ev.evaluate(config, masterProfile);
  assert.strictEqual(result.outcomeKey, "pass");
});

test("research_plan: non-master → not_applicable", () => {
  const ev = getEvaluatorV3("research_plan")!;
  const config = ev.validateConfig({});
  const result = ev.evaluate(config, arabicProfile);
  assert.strictEqual(result.outcomeKey, "not_applicable");
});

// ============================================================
// Config validation tests
// ============================================================

console.log("\nConfig validation:");

test("sat: valid config → passes", () => {
  const ev = getEvaluatorV3("sat")!;
  const config = ev.validateConfig({ min_score: 1200 });
  assert.ok(config);
});

test("sat: invalid config → throws", () => {
  const ev = getEvaluatorV3("sat")!;
  try {
    ev.validateConfig({ min_score: "abc" });
    assert.fail("Should have thrown");
  } catch (e) {
    assert.ok(e instanceof Error);
  }
});

test("gpa: valid config → passes", () => {
  const ev = getEvaluatorV3("gpa")!;
  const config = ev.validateConfig({ min_gpa: 2.5 });
  assert.ok(config);
});

test("gpa: missing min_gpa → throws", () => {
  const ev = getEvaluatorV3("gpa")!;
  try {
    ev.validateConfig({});
    assert.fail("Should have thrown");
  } catch (e) {
    assert.ok(e instanceof Error);
  }
});

test("study_track: valid config → passes", () => {
  const ev = getEvaluatorV3("study_track")!;
  const config = ev.validateConfig({ allowed_tracks: ["scientific"] });
  assert.ok(config);
});

test("study_track: invalid track value → throws", () => {
  const ev = getEvaluatorV3("study_track")!;
  try {
    ev.validateConfig({ allowed_tracks: ["invalid"] });
    assert.fail("Should have thrown");
  } catch (e) {
    assert.ok(e instanceof Error);
  }
});

test("language_cert: valid config → passes", () => {
  const ev = getEvaluatorV3("language_cert")!;
  const config = ev.validateConfig({ cert_type: "ielts", min_score: 6.5 });
  assert.ok(config);
});

test("language_cert: missing cert_type → throws", () => {
  const ev = getEvaluatorV3("language_cert")!;
  try {
    ev.validateConfig({ min_score: 6.5 });
    assert.fail("Should have thrown");
  } catch (e) {
    assert.ok(e instanceof Error);
  }
});

test("high_school: empty config → passes", () => {
  const ev = getEvaluatorV3("high_school")!;
  const config = ev.validateConfig({});
  assert.ok(config !== undefined);
});

test("high_school: extra field → throws (strict)", () => {
  const ev = getEvaluatorV3("high_school")!;
  try {
    ev.validateConfig({ extra: "field" });
    assert.fail("Should have thrown");
  } catch (e) {
    assert.ok(e instanceof Error);
  }
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
