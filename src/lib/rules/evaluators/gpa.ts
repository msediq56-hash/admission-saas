// ============================================================
// GPA Rule Evaluator
// Checks: does the student meet the minimum GPA?
// ============================================================

import {
  GPAConfigSchema,
  type GPAConfig,
  type RuleEvaluator,
  type RuleStudentInput,
  type RequirementRule,
  type RuleEvaluationResult,
} from "../types";

export const gpaEvaluator: RuleEvaluator<GPAConfig> = {
  ruleType: "gpa",

  validateConfig(config: unknown): GPAConfig {
    return GPAConfigSchema.parse(config);
  },

  evaluate(
    config: GPAConfig,
    input: RuleStudentInput,
    rule: RequirementRule
  ): RuleEvaluationResult {
    const minGpa = config.min_gpa;
    const questionText = `هل معدل الطالب ${minGpa} أو أعلى؟`;

    if (input.gpa === null) {
      return {
        ruleId: rule.id,
        ruleType: "gpa",
        passed: false,
        effect: rule.effect,
        message: rule.effect_message || `يحتاج معدل ${minGpa} أو أعلى`,
        questionText,
      };
    }

    if (input.gpa >= minGpa) {
      return {
        ruleId: rule.id,
        ruleType: "gpa",
        passed: true,
        effect: "none",
        message: null,
        questionText,
      };
    }

    // GPA below minimum — check effect
    if (rule.effect === "scholarship") {
      return {
        ruleId: rule.id,
        ruleType: "gpa",
        passed: false,
        effect: "scholarship",
        message: rule.effect_message || `معدل الطالب (${input.gpa}) أقل من ${minGpa}`,
        questionText,
      };
    }

    return {
      ruleId: rule.id,
      ruleType: "gpa",
      passed: false,
      effect: rule.effect,
      message: rule.effect_message || `معدل الطالب (${input.gpa}) أقل من الحد الأدنى (${minGpa})`,
      questionText,
    };
  },

  generateQuestion(config: GPAConfig): string {
    return `هل معدل الطالب ${config.min_gpa} أو أعلى؟`;
  },
};
