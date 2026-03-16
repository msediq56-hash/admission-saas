// ============================================================
// Language Certificate Rule Evaluator
// Checks: IELTS, Duolingo, TOEFL, etc. with minimum score
// Supports alternatives (e.g. IELTS 6.5 OR Duolingo 110)
// ============================================================

import {
  LanguageCertConfigSchema,
  type LanguageCertConfig,
  type RuleEvaluator,
  type RuleStudentInput,
  type RequirementRule,
  type RuleEvaluationResult,
} from "../types";

export const languageCertEvaluator: RuleEvaluator<LanguageCertConfig> = {
  ruleType: "language_cert",

  validateConfig(config: unknown): LanguageCertConfig {
    return LanguageCertConfigSchema.parse(config);
  },

  evaluate(
    config: LanguageCertConfig,
    input: RuleStudentInput,
    rule: RequirementRule
  ): RuleEvaluationResult {
    const certName = config.cert_type.toUpperCase();
    const minScore = config.min_score;

    // Check primary cert (IELTS by default)
    let score: number | null = null;
    if (config.cert_type === "ielts") {
      score = input.ielts;
    } else if (input.languageCertType === config.cert_type) {
      score = input.languageCertScore ?? null;
    }

    // If primary cert meets requirement
    if (score !== null && score >= minScore) {
      return {
        ruleId: rule.id,
        ruleType: "language_cert",
        passed: true,
        effect: "none",
        message: null,
        questionText: `هل لدى الطالب ${certName} بدرجة ${minScore} أو أعلى؟`,
      };
    }

    // Check alternatives
    const alternatives = config.alternatives || {};
    for (const [altCert, altMin] of Object.entries(alternatives)) {
      let altScore: number | null = null;
      if (altCert === "ielts") {
        altScore = input.ielts;
      } else if (altCert === "duolingo" && input.languageCertType === "duolingo") {
        altScore = input.languageCertScore ?? null;
      } else if (input.languageCertType === altCert) {
        altScore = input.languageCertScore ?? null;
      }
      // Also check dynamicAnswers for alternatives
      if (altScore === null && input.dynamicAnswers) {
        const altKey = `alt_${altCert}`;
        const dynVal = input.dynamicAnswers[altKey];
        if (typeof dynVal === "number") altScore = dynVal;
      }
      if (altScore !== null && altScore >= altMin) {
        return {
          ruleId: rule.id,
          ruleType: "language_cert",
          passed: true,
          effect: "none",
          message: null,
          questionText: `هل لدى الطالب ${certName} بدرجة ${minScore} أو أعلى؟`,
        };
      }
    }

    // Handle different effects
    const effect = rule.effect;

    // "interview" effect — student doesn't have cert but gets an interview
    if (effect === "makes_conditional" || rule.effect_message?.includes("مقابلة")) {
      return {
        ruleId: rule.id,
        ruleType: "language_cert",
        passed: false,
        effect: "makes_conditional",
        message:
          rule.effect_message ||
          `يحتاج ${certName} بدرجة ${minScore} أو أعلى`,
        questionText: `هل لدى الطالب ${certName} بدرجة ${minScore} أو أعلى؟`,
      };
    }

    // Default: blocks admission
    return {
      ruleId: rule.id,
      ruleType: "language_cert",
      passed: false,
      effect: rule.effect,
      message:
        rule.effect_message ||
        `يحتاج ${certName} بدرجة ${minScore} أو أعلى`,
      questionText: `هل لدى الطالب ${certName} بدرجة ${minScore} أو أعلى؟`,
    };
  },

  generateQuestion(config: LanguageCertConfig): string {
    const certName = config.cert_type.toUpperCase();
    return `هل لدى الطالب ${certName} بدرجة ${config.min_score} أو أعلى؟`;
  },
};
