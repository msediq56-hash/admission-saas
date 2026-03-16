// ============================================================
// High School Rule Evaluator
// Checks: does the student have a high school diploma?
// Also handles the "twelve_years" variant
// ============================================================

import {
  HighSchoolConfigSchema,
  TwelveYearsConfigSchema,
  type HighSchoolConfig,
  type TwelveYearsConfig,
  type RuleEvaluator,
  type RuleStudentInput,
  type RequirementRule,
  type RuleEvaluationResult,
} from "../types";

// -----------------------------------------------------------
// High School evaluator
// -----------------------------------------------------------

export const highSchoolEvaluator: RuleEvaluator<HighSchoolConfig> = {
  ruleType: "high_school",

  validateConfig(config: unknown): HighSchoolConfig {
    return HighSchoolConfigSchema.parse(config);
  },

  evaluate(
    _config: HighSchoolConfig,
    input: RuleStudentInput,
    rule: RequirementRule
  ): RuleEvaluationResult {
    const passed = input.hasHighSchool;
    return {
      ruleId: rule.id,
      ruleType: "high_school",
      passed,
      effect: passed ? "none" : rule.effect,
      message: passed
        ? null
        : rule.effect_message || "الطالب لا يملك شهادة ثانوية",
      questionText: "هل لدى الطالب شهادة ثانوية؟",
    };
  },

  generateQuestion(): string {
    return "هل لدى الطالب شهادة ثانوية؟";
  },
};

// -----------------------------------------------------------
// Twelve Years evaluator
// -----------------------------------------------------------

export const twelveYearsEvaluator: RuleEvaluator<TwelveYearsConfig> = {
  ruleType: "twelve_years",

  validateConfig(config: unknown): TwelveYearsConfig {
    return TwelveYearsConfigSchema.parse(config);
  },

  evaluate(
    _config: TwelveYearsConfig,
    input: RuleStudentInput,
    rule: RequirementRule
  ): RuleEvaluationResult {
    const passed = input.has12Years;
    return {
      ruleId: rule.id,
      ruleType: "twelve_years",
      passed,
      effect: passed ? "none" : rule.effect,
      message: passed
        ? null
        : rule.effect_message || "الطالب لم يكمل 12 سنة دراسة",
      questionText: "هل أكمل الطالب 12 سنة دراسية؟",
    };
  },

  generateQuestion(): string {
    return "هل أكمل الطالب 12 سنة دراسية؟";
  },
};
