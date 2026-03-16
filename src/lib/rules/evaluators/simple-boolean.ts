// ============================================================
// Simple Boolean Rule Evaluators
// Handles: bachelor, entrance_exam, portfolio, research_plan
// All follow the same pattern: check a boolean field on input
// ============================================================

import {
  BachelorConfigSchema,
  EntranceExamConfigSchema,
  PortfolioConfigSchema,
  ResearchPlanConfigSchema,
  type BachelorConfig,
  type EntranceExamConfig,
  type PortfolioConfig,
  type ResearchPlanConfig,
  type RuleEvaluator,
  type RuleStudentInput,
  type RequirementRule,
  type RuleEvaluationResult,
} from "../types";

// -----------------------------------------------------------
// Bachelor evaluator
// -----------------------------------------------------------

export const bachelorEvaluator: RuleEvaluator<BachelorConfig> = {
  ruleType: "bachelor",

  validateConfig(config: unknown): BachelorConfig {
    return BachelorConfigSchema.parse(config);
  },

  evaluate(
    _config: BachelorConfig,
    input: RuleStudentInput,
    rule: RequirementRule
  ): RuleEvaluationResult {
    const passed = input.hasBachelor;
    return {
      ruleId: rule.id,
      ruleType: "bachelor",
      passed,
      effect: passed ? "none" : rule.effect,
      message: passed ? null : rule.effect_message || "الطالب لا يملك شهادة بكالوريوس",
      questionText: "هل لدى الطالب شهادة بكالوريوس؟",
    };
  },

  generateQuestion(): string {
    return "هل لدى الطالب شهادة بكالوريوس؟";
  },
};

// -----------------------------------------------------------
// Entrance exam evaluator
// -----------------------------------------------------------

export const entranceExamEvaluator: RuleEvaluator<EntranceExamConfig> = {
  ruleType: "entrance_exam",

  validateConfig(config: unknown): EntranceExamConfig {
    return EntranceExamConfigSchema.parse(config);
  },

  evaluate(
    _config: EntranceExamConfig,
    input: RuleStudentInput,
    rule: RequirementRule
  ): RuleEvaluationResult {
    const passed = input.hasEntranceExam ?? false;
    return {
      ruleId: rule.id,
      ruleType: "entrance_exam",
      passed,
      effect: passed ? "none" : "makes_conditional",
      message: passed
        ? null
        : rule.effect_message || "مشروط بدخول واجتياز امتحان القبول",
      questionText: "هل اجتاز الطالب امتحان القبول؟",
    };
  },

  generateQuestion(): string {
    return "هل اجتاز الطالب امتحان القبول؟";
  },
};

// -----------------------------------------------------------
// Portfolio evaluator
// -----------------------------------------------------------

export const portfolioEvaluator: RuleEvaluator<PortfolioConfig> = {
  ruleType: "portfolio",

  validateConfig(config: unknown): PortfolioConfig {
    return PortfolioConfigSchema.parse(config);
  },

  evaluate(
    _config: PortfolioConfig,
    input: RuleStudentInput,
    rule: RequirementRule
  ): RuleEvaluationResult {
    const passed = input.hasPortfolio ?? false;
    return {
      ruleId: rule.id,
      ruleType: "portfolio",
      passed,
      effect: passed ? "none" : rule.effect,
      message: passed ? null : rule.effect_message || "يحتاج تقديم بورتفوليو",
      questionText: "هل لدى الطالب بورتفوليو؟",
    };
  },

  generateQuestion(): string {
    return "هل لدى الطالب بورتفوليو؟";
  },
};

// -----------------------------------------------------------
// Research plan evaluator
// -----------------------------------------------------------

export const researchPlanEvaluator: RuleEvaluator<ResearchPlanConfig> = {
  ruleType: "research_plan",

  validateConfig(config: unknown): ResearchPlanConfig {
    return ResearchPlanConfigSchema.parse(config);
  },

  evaluate(
    _config: ResearchPlanConfig,
    input: RuleStudentInput,
    rule: RequirementRule
  ): RuleEvaluationResult {
    const passed = input.hasResearchPlan;
    return {
      ruleId: rule.id,
      ruleType: "research_plan",
      passed,
      effect: passed ? "none" : rule.effect,
      message: passed ? null : rule.effect_message || "يحتاج تقديم خطة بحث",
      questionText: "هل لدى الطالب خطة بحث؟",
    };
  },

  generateQuestion(): string {
    return "هل لدى الطالب خطة بحث؟";
  },
};
