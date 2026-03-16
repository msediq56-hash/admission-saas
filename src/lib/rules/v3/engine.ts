// ============================================================
// V3.2 Engine — resolveOutcome + evaluateRulesV3
// Evaluators return raw outcomes; the engine resolves them
// into decisions + actions using OutcomeDefinition from DB.
// ============================================================

import type {
  AssessmentProfileV3,
  Decision,
  EngineResultV3,
  EngineTrace,
  EvaluatorRawResult,
  OutcomeDefinition,
  RedirectTarget,
  RequirementRuleV3,
  RuleAction,
  RuleEvaluationResultV3,
} from "./types";
import { getEvaluatorV3 } from "./evaluators/registry";

// -----------------------------------------------------------
// Decision precedence (lower = higher priority)
// -----------------------------------------------------------

const DECISION_PRIORITY: Record<Decision, number> = {
  block: 1,
  redirect: 2,
  review: 3,
  conditional: 4,
  pass: 5,
};

// -----------------------------------------------------------
// Stable stringify helper — recursive, sorts keys at ALL levels
// -----------------------------------------------------------

function stableStringify(obj: unknown): string {
  if (obj === null || obj === undefined) return String(obj);
  if (typeof obj !== "object") return JSON.stringify(obj);
  if (Array.isArray(obj))
    return "[" + obj.map(stableStringify).join(",") + "]";
  const sorted = Object.keys(obj as Record<string, unknown>).sort();
  return (
    "{" +
    sorted
      .map(
        (k) =>
          JSON.stringify(k) +
          ":" +
          stableStringify((obj as Record<string, unknown>)[k])
      )
      .join(",") +
    "}"
  );
}

function computeProfileHash(profile: AssessmentProfileV3): string {
  const serialized = stableStringify(profile);
  let hash = 0;
  for (let i = 0; i < serialized.length; i++) {
    const char = serialized.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash |= 0;
  }
  return hash.toString(36);
}

// -----------------------------------------------------------
// resolveOutcome — converts raw evaluator result to final result
// -----------------------------------------------------------

export function resolveOutcome(
  rawResult: EvaluatorRawResult,
  outcomes: Record<string, OutcomeDefinition>,
  ruleId: string,
  ruleType: string
): RuleEvaluationResultV3 {
  const def = outcomes[rawResult.outcomeKey];
  if (!def) {
    throw new Error(
      `Unknown outcome key "${rawResult.outcomeKey}" for rule ${ruleId} (${ruleType})`
    );
  }

  // Redirect MUST have a message
  if (def.decision === "redirect" && !def.message) {
    throw new Error(
      `Redirect outcome must have a message for rule ${ruleId} (${ruleType})`
    );
  }

  // Build actions from OutcomeDefinition — no duplication
  const actions: RuleAction[] = [];

  if (def.redirect) {
    actions.push({ type: "redirect", target: def.redirect });
  }

  if (def.condition_code && def.message) {
    actions.push({
      type: "condition",
      code: def.condition_code,
      message: def.message,
      ...(def.deadline ? { deadline: def.deadline } : {}),
    });
  } else if (def.decision === "review") {
    actions.push({
      type: "review",
      reason: def.message || "يحتاج مراجعة",
    });
  } else if (def.decision === "block" && def.message) {
    // note only for block when no other action already carries the message
    actions.push({ type: "note", message: def.message });
  }

  // Merge extra actions from evaluator
  if (rawResult.extraActions) {
    actions.push(...rawResult.extraActions);
  }

  return {
    outcomeKey: rawResult.outcomeKey,
    decision: def.decision,
    actions,
    facts: rawResult.facts,
  };
}

// -----------------------------------------------------------
// evaluateRulesV3 — main engine function
// -----------------------------------------------------------

export function evaluateRulesV3(
  rules: RequirementRuleV3[],
  profile: AssessmentProfileV3,
  options: { mode: "terminal" | "diagnostic" }
): EngineResultV3 {
  // Filter: only enabled rules with non-empty outcomes
  const activeRules = rules
    .filter((r) => r.is_enabled && Object.keys(r.outcomes).length > 0)
    .sort((a, b) => a.sort_order - b.sort_order);

  const ruleResults: Array<{
    ruleId: string;
    ruleType: string;
    result: RuleEvaluationResultV3;
  }> = [];

  let highestDecision: Decision = "pass";
  let stopped = false;
  let stoppedAtRule: string | undefined;
  let redirectCandidate: (RedirectTarget & { message: string }) | undefined;

  for (const rule of activeRules) {
    // Get evaluator from registry
    const evaluator = getEvaluatorV3(rule.rule_type);
    if (!evaluator) {
      // Unknown evaluator — skip silently
      continue;
    }

    // Validate config
    let config: unknown;
    try {
      config = evaluator.validateConfig(rule.config);
    } catch {
      // Invalid config — skip silently
      continue;
    }

    // Evaluate
    const rawResult = evaluator.evaluate(config, profile);

    // not_applicable → skip entirely
    if (rawResult.outcomeKey === "not_applicable") {
      continue;
    }

    // Resolve outcome
    const resolved = resolveOutcome(
      rawResult,
      rule.outcomes,
      rule.id,
      rule.rule_type
    );

    ruleResults.push({
      ruleId: rule.id,
      ruleType: rule.rule_type,
      result: resolved,
    });

    // Capture redirect candidate directly from OutcomeDefinition (first by sort_order wins)
    if (resolved.decision === "redirect" && !redirectCandidate) {
      const redirectAction = resolved.actions.find(a => a.type === "redirect");
      if (redirectAction && redirectAction.type === "redirect") {
        const outcomeDef = rule.outcomes[rawResult.outcomeKey];
        redirectCandidate = {
          ...redirectAction.target,
          message: outcomeDef.message || "",
        };
      }
    }

    // Track highest-priority decision
    if (
      DECISION_PRIORITY[resolved.decision] <
      DECISION_PRIORITY[highestDecision]
    ) {
      highestDecision = resolved.decision;
    }

    // Terminal mode: stop on block or redirect
    if (
      options.mode === "terminal" &&
      (resolved.decision === "block" || resolved.decision === "redirect")
    ) {
      stopped = true;
      stoppedAtRule = rule.id;
      break;
    }
  }

  // Collect conditions from "condition" actions
  const conditions: Array<{
    code: string;
    message: string;
    deadline?: string;
  }> = [];
  for (const rr of ruleResults) {
    for (const action of rr.result.actions) {
      if (action.type === "condition") {
        conditions.push({
          code: action.code,
          message: action.message,
          ...(action.deadline ? { deadline: action.deadline } : {}),
        });
      }
    }
  }

  // Redirect: only set when finalDecision === "redirect"
  const redirect = highestDecision === "redirect" ? redirectCandidate : undefined;

  // Collect review items
  const reviewItems: Array<{ reason: string }> = [];
  for (const rr of ruleResults) {
    for (const action of rr.result.actions) {
      if (action.type === "review") {
        reviewItems.push({ reason: action.reason });
      }
    }
  }

  const trace: EngineTrace = {
    evaluatedAt: new Date().toISOString(),
    profileHash: computeProfileHash(profile),
    rulesEvaluated: ruleResults.length,
    rulesStopped: stopped,
    ...(stoppedAtRule ? { stoppedAtRule } : {}),
    mode: options.mode,
  };

  return {
    finalDecision: highestDecision,
    ruleResults,
    conditions,
    ...(redirect ? { redirect } : {}),
    ...(reviewItems.length > 0 ? { reviewItems } : {}),
    trace,
  };
}

// Export helpers for testing
export { stableStringify, computeProfileHash };
