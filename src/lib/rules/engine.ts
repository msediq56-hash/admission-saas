// ============================================================
// Rule Engine — evaluates a set of RequirementRules against student input
// This is the new system that runs ALONGSIDE the old evaluation engine
// ============================================================

import type {
  RequirementRule,
  RuleStudentInput,
  RuleEvaluationResult,
  RuleEngineResult,
  RuleType,
} from "./types";
import { getEvaluator } from "./registry";

/**
 * Evaluate all rules for a program against student input.
 * Rules are sorted by sort_order and evaluated in sequence.
 *
 * Logic:
 * - Any rule with effect "blocks_admission" that fails → status = "negative"
 * - Any rule with effect "makes_conditional" that fails → status = "conditional"
 * - If all rules pass → status = "positive"
 * - Scholarship effects are collected as notes
 */
export function evaluateRules(
  rules: RequirementRule[],
  input: RuleStudentInput
): RuleEngineResult {
  // Filter to enabled rules and sort by sort_order
  const activeRules = rules
    .filter((r) => r.is_enabled)
    .sort((a, b) => a.sort_order - b.sort_order);

  const results: RuleEvaluationResult[] = [];
  const notes: string[] = [];
  let status: "positive" | "conditional" | "negative" = "positive";
  let scholarshipInfo: string | null = null;

  for (const rule of activeRules) {
    const evaluator = getEvaluator(rule.rule_type as RuleType);

    if (!evaluator) {
      // Unknown rule type — skip with warning
      results.push({
        ruleId: rule.id,
        ruleType: rule.rule_type as RuleType,
        passed: false,
        effect: "none",
        message: `نوع القاعدة غير معروف: ${rule.rule_type}`,
      });
      continue;
    }

    // Validate config
    let config: unknown;
    try {
      config = evaluator.validateConfig(rule.config);
    } catch {
      results.push({
        ruleId: rule.id,
        ruleType: rule.rule_type as RuleType,
        passed: false,
        effect: "none",
        message: `خطأ في إعدادات القاعدة: ${rule.rule_type}`,
      });
      continue;
    }

    // Evaluate
    const result = evaluator.evaluate(config, input, rule);
    results.push(result);

    if (!result.passed) {
      // Determine impact on overall status
      if (result.effect === "blocks_admission") {
        status = "negative";
        if (result.message) notes.push(result.message);
      } else if (result.effect === "makes_conditional") {
        if (status !== "negative") {
          status = "conditional";
        }
        if (result.message) notes.push(result.message);
      } else if (result.effect === "scholarship") {
        // Scholarship doesn't block — just adds info
        if (result.message) {
          scholarshipInfo = result.message;
        }
      }
    }
  }

  return {
    status,
    results,
    notes,
    scholarshipInfo,
  };
}

/**
 * Convert old-style Requirement + CustomRequirements into RequirementRule[].
 * This is used for parity testing — converts the old format to the new format
 * so both engines can be compared.
 */
export function convertLegacyToRules(
  programId: string,
  tenantId: string,
  certificateTypeId: string | null,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  requirement: Record<string, any>,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  customRequirements: Record<string, any>[] = []
): RequirementRule[] {
  const rules: RequirementRule[] = [];
  let sortOrder = 0;

  function makeRule(
    ruleType: string,
    config: Record<string, unknown>,
    effect: string,
    effectMessage?: string | null
  ): RequirementRule {
    return {
      id: `legacy-${ruleType}-${sortOrder}`,
      program_id: programId,
      certificate_type_id: certificateTypeId,
      rule_type: ruleType,
      config,
      effect: effect as RequirementRule["effect"],
      effect_message: effectMessage ?? null,
      sort_order: sortOrder++,
      is_enabled: true,
      tenant_id: tenantId,
    };
  }

  // High school
  if (requirement.requires_hs) {
    rules.push(makeRule("high_school", {}, "blocks_admission"));
  }

  // 12 years
  if (requirement.requires_12_years) {
    rules.push(makeRule("twelve_years", {}, "blocks_admission"));
  }

  // Bachelor
  if (requirement.requires_bachelor) {
    rules.push(makeRule("bachelor", {}, "blocks_admission"));
  }

  // IELTS / Language cert
  if (requirement.requires_ielts && requirement.ielts_min) {
    let effect = "blocks_admission";
    let effectMessage: string | null = null;

    const ieltsEffect = requirement.ielts_effect as string | undefined;
    if (ieltsEffect) {
      if (ieltsEffect.startsWith("interview:")) {
        effect = "makes_conditional";
        effectMessage = ieltsEffect.replace("interview: ", "").replace("interview:", "");
      } else if (ieltsEffect === "blocks_if_below") {
        effect = "blocks_admission";
      } else if (ieltsEffect.startsWith("conditional:")) {
        effect = "makes_conditional";
        effectMessage = ieltsEffect.replace("conditional: ", "").replace("conditional:", "");
      }
    }

    rules.push(
      makeRule(
        "language_cert",
        {
          cert_type: "ielts",
          min_score: requirement.ielts_min,
          alternatives: requirement.ielts_alternatives || {},
        },
        effect,
        effectMessage
      )
    );
  }

  // SAT
  if (requirement.requires_sat && requirement.sat_min) {
    let effect = "blocks_admission";
    let effectMessage: string | null = null;

    const satEffect = requirement.sat_effect as string | undefined;
    if (satEffect) {
      if (satEffect.startsWith("conditional:")) {
        effect = "makes_conditional";
        effectMessage = satEffect.replace("conditional: ", "").replace("conditional:", "");
      }
    }

    rules.push(
      makeRule("sat", { min_score: requirement.sat_min }, effect, effectMessage)
    );
  }

  // GPA
  if (requirement.requires_gpa && requirement.gpa_min) {
    let effect = "blocks_admission";
    const gpaEffect = requirement.gpa_effect as string | undefined;
    if (gpaEffect === "scholarship") {
      effect = "scholarship";
    } else if (gpaEffect === "makes_conditional") {
      effect = "makes_conditional";
    }

    rules.push(
      makeRule("gpa", { min_gpa: requirement.gpa_min }, effect)
    );
  }

  // Entrance exam
  if (requirement.requires_entrance_exam) {
    rules.push(makeRule("entrance_exam", {}, "makes_conditional", "مشروط بدخول واجتياز امتحان القبول"));
  }

  // Portfolio
  if (requirement.requires_portfolio) {
    rules.push(makeRule("portfolio", {}, "blocks_admission"));
  }

  // Research plan
  if (requirement.requires_research_plan) {
    rules.push(makeRule("research_plan", {}, "blocks_admission"));
  }

  // A Levels
  if (requirement.requires_a_levels) {
    rules.push(
      makeRule(
        "a_levels",
        {
          subjects_min: requirement.a_level_subjects_min,
          min_grade: requirement.a_level_min_grade,
          requires_core: requirement.a_level_requires_core || false,
        },
        requirement.a_level_effect || "blocks_admission"
      )
    );
  }

  // AS Levels
  if (requirement.requires_as_levels) {
    rules.push(
      makeRule(
        "as_levels",
        {
          subjects_min: requirement.as_level_subjects_min,
          min_grade: requirement.as_level_min_grade,
        },
        requirement.as_level_effect || "blocks_admission"
      )
    );
  }

  // O Levels
  if (requirement.requires_o_levels) {
    rules.push(
      makeRule(
        "o_levels",
        {
          subjects_min: requirement.o_level_subjects_min,
          min_grade: requirement.o_level_min_grade,
        },
        requirement.o_level_effect || "blocks_admission"
      )
    );
  }

  // Custom requirements
  for (const cr of customRequirements) {
    if (cr.question_type === "yes_no") {
      rules.push(
        makeRule(
          "custom_yes_no",
          {
            question_text: cr.question_text,
            positive_message: cr.positive_message || null,
            negative_message: cr.negative_message || null,
          },
          cr.effect || "makes_conditional",
          cr.negative_message
        )
      );
    } else if (cr.question_type === "select") {
      rules.push(
        makeRule(
          "custom_select",
          {
            question_text: cr.question_text,
            options: cr.options || [],
            option_effects: cr.option_effects || {},
          },
          cr.effect || "makes_conditional"
        )
      );
    }
  }

  return rules;
}
