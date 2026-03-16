// ============================================================
// SAT Rule Evaluator
// Checks: does the student have SAT with minimum score?
// ============================================================

import {
  SATConfigSchema,
  type SATConfig,
  type RuleEvaluator,
  type RuleStudentInput,
  type RequirementRule,
  type RuleEvaluationResult,
} from "../types";

export const satEvaluator: RuleEvaluator<SATConfig> = {
  ruleType: "sat",

  validateConfig(config: unknown): SATConfig {
    return SATConfigSchema.parse(config);
  },

  evaluate(
    config: SATConfig,
    input: RuleStudentInput,
    rule: RequirementRule
  ): RuleEvaluationResult {
    const minScore = config.min_score;
    const questionText = `هل لدى الطالب SAT بدرجة ${minScore} أو أعلى؟`;

    // Student doesn't have SAT at all
    if (!input.hasSAT || input.satScore === null) {
      // Check effect — some programs allow conditional without SAT
      if (
        rule.effect === "makes_conditional" ||
        rule.effect_message?.includes("conditional")
      ) {
        return {
          ruleId: rule.id,
          ruleType: "sat",
          passed: false,
          effect: "makes_conditional",
          message:
            rule.effect_message ||
            `يحتاج تقديم SAT بدرجة ${minScore}+`,
          questionText,
        };
      }
      return {
        ruleId: rule.id,
        ruleType: "sat",
        passed: false,
        effect: rule.effect,
        message:
          rule.effect_message || `يحتاج SAT بدرجة ${minScore} أو أعلى`,
        questionText,
      };
    }

    // Student has SAT — check score
    if (input.satScore >= minScore) {
      return {
        ruleId: rule.id,
        ruleType: "sat",
        passed: true,
        effect: "none",
        message: null,
        questionText,
      };
    }

    // Score below minimum
    // Check if conditional effect
    if (
      rule.effect === "makes_conditional" ||
      rule.effect_message?.includes("conditional")
    ) {
      return {
        ruleId: rule.id,
        ruleType: "sat",
        passed: false,
        effect: "makes_conditional",
        message:
          rule.effect_message ||
          `درجة SAT (${input.satScore}) أقل من الحد الأدنى (${minScore})`,
        questionText,
      };
    }

    return {
      ruleId: rule.id,
      ruleType: "sat",
      passed: false,
      effect: rule.effect,
      message:
        rule.effect_message ||
        `درجة SAT (${input.satScore}) أقل من الحد الأدنى (${minScore})`,
      questionText,
    };
  },

  generateQuestion(config: SATConfig): string {
    return `هل لدى الطالب SAT بدرجة ${config.min_score} أو أعلى؟`;
  },
};
