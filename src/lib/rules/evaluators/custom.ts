// ============================================================
// Custom Question Evaluators (yes_no and select)
// Replaces the old custom_requirements table pattern
// ============================================================

import {
  CustomYesNoConfigSchema,
  CustomSelectConfigSchema,
  type CustomYesNoConfig,
  type CustomSelectConfig,
  type RuleEvaluator,
  type RuleStudentInput,
  type RequirementRule,
  type RuleEvaluationResult,
} from "../types";

// -----------------------------------------------------------
// Custom Yes/No evaluator
// -----------------------------------------------------------

export const customYesNoEvaluator: RuleEvaluator<CustomYesNoConfig> = {
  ruleType: "custom_yes_no",

  validateConfig(config: unknown): CustomYesNoConfig {
    return CustomYesNoConfigSchema.parse(config);
  },

  evaluate(
    config: CustomYesNoConfig,
    input: RuleStudentInput,
    rule: RequirementRule
  ): RuleEvaluationResult {
    const answer = input.dynamicAnswers?.[rule.id];

    // No answer provided — treat as not passed
    if (answer === undefined || answer === null) {
      return {
        ruleId: rule.id,
        ruleType: "custom_yes_no",
        passed: false,
        effect: rule.effect,
        message: config.negative_message || rule.effect_message || null,
        questionText: config.question_text,
      };
    }

    const isYes = answer === "yes" || answer === true || answer === "نعم";

    if (isYes) {
      return {
        ruleId: rule.id,
        ruleType: "custom_yes_no",
        passed: true,
        effect: "none",
        message: config.positive_message || null,
        questionText: config.question_text,
      };
    }

    return {
      ruleId: rule.id,
      ruleType: "custom_yes_no",
      passed: false,
      effect: rule.effect,
      message: config.negative_message || rule.effect_message || null,
      questionText: config.question_text,
    };
  },

  generateQuestion(config: CustomYesNoConfig): string {
    return config.question_text;
  },
};

// -----------------------------------------------------------
// Custom Select evaluator
// -----------------------------------------------------------

export const customSelectEvaluator: RuleEvaluator<CustomSelectConfig> = {
  ruleType: "custom_select",

  validateConfig(config: unknown): CustomSelectConfig {
    return CustomSelectConfigSchema.parse(config);
  },

  evaluate(
    config: CustomSelectConfig,
    input: RuleStudentInput,
    rule: RequirementRule
  ): RuleEvaluationResult {
    const answer = input.dynamicAnswers?.[rule.id];

    // No answer — treat as not passed
    if (answer === undefined || answer === null) {
      return {
        ruleId: rule.id,
        ruleType: "custom_select",
        passed: false,
        effect: rule.effect,
        message: rule.effect_message || null,
        questionText: config.question_text,
      };
    }

    const selectedOption = String(answer);
    const optionEffect = config.option_effects?.[selectedOption];

    if (optionEffect) {
      const eff = optionEffect.effect;
      if (eff === "none") {
        return {
          ruleId: rule.id,
          ruleType: "custom_select",
          passed: true,
          effect: "none",
          message: optionEffect.message || null,
          questionText: config.question_text,
        };
      }
      return {
        ruleId: rule.id,
        ruleType: "custom_select",
        passed: false,
        effect: eff,
        message: optionEffect.message || rule.effect_message || null,
        questionText: config.question_text,
      };
    }

    // No specific option effect — use rule's default effect
    return {
      ruleId: rule.id,
      ruleType: "custom_select",
      passed: true,
      effect: "none",
      message: null,
      questionText: config.question_text,
    };
  },

  generateQuestion(config: CustomSelectConfig): string {
    return config.question_text;
  },
};
