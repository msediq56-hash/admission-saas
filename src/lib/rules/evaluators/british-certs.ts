// ============================================================
// British Certificate Evaluators
// Handles: a_levels, as_levels, o_levels
// ============================================================

import {
  ALevelsConfigSchema,
  ASLevelsConfigSchema,
  OLevelsConfigSchema,
  type ALevelsConfig,
  type ASLevelsConfig,
  type OLevelsConfig,
  type RuleEvaluator,
  type RuleStudentInput,
  type RequirementRule,
  type RuleEvaluationResult,
} from "../types";

// -----------------------------------------------------------
// A Levels evaluator
// -----------------------------------------------------------

export const aLevelsEvaluator: RuleEvaluator<ALevelsConfig> = {
  ruleType: "a_levels",

  validateConfig(config: unknown): ALevelsConfig {
    return ALevelsConfigSchema.parse(config);
  },

  evaluate(
    config: ALevelsConfig,
    input: RuleStudentInput,
    rule: RequirementRule
  ): RuleEvaluationResult {
    const subjectsMin = config.subjects_min ?? 0;
    const hasCountCheck = subjectsMin > 0;
    const hasGradeCheck = !!config.min_grade;
    const questionText = hasCountCheck
      ? `هل لدى الطالب ${subjectsMin} مواد A Level؟`
      : hasGradeCheck
        ? `هل جميع المواد بدرجة ${config.min_grade} أو أعلى؟`
        : "A Level check";

    // Check count (only if subjects_min is specified)
    if (hasCountCheck) {
      const count = input.aLevelCount ?? 0;
      if (count < subjectsMin) {
        return {
          ruleId: rule.id,
          ruleType: "a_levels",
          passed: false,
          effect: rule.effect,
          message:
            rule.effect_message ||
            `يحتاج ${subjectsMin} مواد A Level (لديه ${count})`,
          questionText,
        };
      }
    }

    // Check grade if required (compare against count or 3 as fallback)
    if (hasGradeCheck) {
      const gradeCount = input.aLevelCCount ?? 0;
      const requiredGradeCount = subjectsMin || (input.aLevelCount ?? 3);
      if (gradeCount < requiredGradeCount) {
        return {
          ruleId: rule.id,
          ruleType: "a_levels",
          passed: false,
          effect: rule.effect,
          message:
            rule.effect_message ||
            `يحتاج مواد A Level بدرجة ${config.min_grade} أو أعلى`,
          questionText,
        };
      }
    }

    // Check core subjects if required
    if (config.requires_core) {
      const hasCoreAnswer = input.dynamicAnswers?.["requires_a_levels_core"];
      if (hasCoreAnswer === "no" || hasCoreAnswer === false) {
        return {
          ruleId: rule.id,
          ruleType: "a_levels",
          passed: false,
          effect: rule.effect,
          message:
            rule.effect_message ||
            "يحتاج مادتين من المواد الأساسية المعترف بها",
          questionText: "هل لدى الطالب مادتان من المواد الأساسية المعترف بها؟",
        };
      }
    }

    return {
      ruleId: rule.id,
      ruleType: "a_levels",
      passed: true,
      effect: "none",
      message: null,
      questionText,
    };
  },

  generateQuestion(config: ALevelsConfig): string {
    return `هل لدى الطالب ${config.subjects_min ?? 0} مواد A Level؟`;
  },
};

// -----------------------------------------------------------
// AS Levels evaluator
// -----------------------------------------------------------

export const asLevelsEvaluator: RuleEvaluator<ASLevelsConfig> = {
  ruleType: "as_levels",

  validateConfig(config: unknown): ASLevelsConfig {
    return ASLevelsConfigSchema.parse(config);
  },

  evaluate(
    config: ASLevelsConfig,
    input: RuleStudentInput,
    rule: RequirementRule
  ): RuleEvaluationResult {
    const subjectsMin = config.subjects_min ?? 0;
    const questionText = `هل لدى الطالب ${subjectsMin} مواد AS Level؟`;

    const count = input.asLevelCount ?? 0;
    if (subjectsMin > 0 && count < subjectsMin) {
      return {
        ruleId: rule.id,
        ruleType: "as_levels",
        passed: false,
        effect: rule.effect,
        message:
          rule.effect_message ||
          `يحتاج ${subjectsMin} مواد AS Level (لديه ${count})`,
        questionText,
      };
    }

    return {
      ruleId: rule.id,
      ruleType: "as_levels",
      passed: true,
      effect: "none",
      message: null,
      questionText,
    };
  },

  generateQuestion(config: ASLevelsConfig): string {
    return `هل لدى الطالب ${config.subjects_min ?? 0} مواد AS Level؟`;
  },
};

// -----------------------------------------------------------
// O Levels / GCSE evaluator
// -----------------------------------------------------------

export const oLevelsEvaluator: RuleEvaluator<OLevelsConfig> = {
  ruleType: "o_levels",

  validateConfig(config: unknown): OLevelsConfig {
    return OLevelsConfigSchema.parse(config);
  },

  evaluate(
    config: OLevelsConfig,
    input: RuleStudentInput,
    rule: RequirementRule
  ): RuleEvaluationResult {
    const subjectsMin = config.subjects_min ?? 0;
    const questionText = `هل لدى الطالب ${subjectsMin} مواد O Level/GCSE؟`;

    const count = input.oLevelCount ?? 0;
    if (subjectsMin > 0 && count < subjectsMin) {
      return {
        ruleId: rule.id,
        ruleType: "o_levels",
        passed: false,
        effect: rule.effect,
        message:
          rule.effect_message ||
          `يحتاج ${subjectsMin} مواد O Level/GCSE (لديه ${count})`,
        questionText,
      };
    }

    return {
      ruleId: rule.id,
      ruleType: "o_levels",
      passed: true,
      effect: "none",
      message: null,
      questionText,
    };
  },

  generateQuestion(config: OLevelsConfig): string {
    return `هل لدى الطالب ${config.subjects_min ?? 0} مواد O Level/GCSE؟`;
  },
};
