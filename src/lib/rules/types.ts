// ============================================================
// Rule-based Requirements System — Types & Zod Schemas
// Runs alongside the old requirements system (no modifications)
// ============================================================

import { z } from "zod";

// -----------------------------------------------------------
// Effect types (shared across all rules)
// -----------------------------------------------------------

export const RuleEffectSchema = z.enum([
  "blocks_admission",
  "makes_conditional",
  "scholarship",
  "none",
]);
export type RuleEffect = z.infer<typeof RuleEffectSchema>;

// -----------------------------------------------------------
// Rule type identifiers
// -----------------------------------------------------------

export const RuleTypeSchema = z.enum([
  "high_school",
  "twelve_years",
  "language_cert",
  "sat",
  "gpa",
  "bachelor",
  "entrance_exam",
  "portfolio",
  "research_plan",
  "a_levels",
  "as_levels",
  "o_levels",
  "ib",
  "custom_yes_no",
  "custom_select",
]);
export type RuleType = z.infer<typeof RuleTypeSchema>;

// -----------------------------------------------------------
// Config schemas per rule type
// -----------------------------------------------------------

export const HighSchoolConfigSchema = z.object({
  // No config needed — just checks if student has HS diploma
});
export type HighSchoolConfig = z.infer<typeof HighSchoolConfigSchema>;

export const TwelveYearsConfigSchema = z.object({
  // No config needed — checks 12 years of study
});
export type TwelveYearsConfig = z.infer<typeof TwelveYearsConfigSchema>;

export const LanguageCertConfigSchema = z.object({
  cert_type: z.string().default("ielts"), // "ielts", "duolingo", "toefl", etc.
  min_score: z.number(),
  alternatives: z
    .record(z.string(), z.number())
    .optional()
    .default({}), // e.g. { duolingo: 110 }
});
export type LanguageCertConfig = z.infer<typeof LanguageCertConfigSchema>;

export const SATConfigSchema = z.object({
  min_score: z.number(),
});
export type SATConfig = z.infer<typeof SATConfigSchema>;

export const GPAConfigSchema = z.object({
  min_gpa: z.number(),
});
export type GPAConfig = z.infer<typeof GPAConfigSchema>;

export const BachelorConfigSchema = z.object({
  // No config — checks if student has bachelor degree
});
export type BachelorConfig = z.infer<typeof BachelorConfigSchema>;

export const EntranceExamConfigSchema = z.object({
  // No config — checks if entrance exam required
});
export type EntranceExamConfig = z.infer<typeof EntranceExamConfigSchema>;

export const PortfolioConfigSchema = z.object({
  // No config — checks if portfolio required
});
export type PortfolioConfig = z.infer<typeof PortfolioConfigSchema>;

export const ResearchPlanConfigSchema = z.object({
  // No config — checks if research plan required
});
export type ResearchPlanConfig = z.infer<typeof ResearchPlanConfigSchema>;

export const ALevelsConfigSchema = z.object({
  subjects_min: z.number().optional(),
  min_grade: z.string().optional(), // "A", "B", "C", etc.
  requires_core: z.boolean().optional().default(false),
});
export type ALevelsConfig = z.infer<typeof ALevelsConfigSchema>;

export const ASLevelsConfigSchema = z.object({
  subjects_min: z.number().optional(),
  min_grade: z.string().optional(),
});
export type ASLevelsConfig = z.infer<typeof ASLevelsConfigSchema>;

export const OLevelsConfigSchema = z.object({
  subjects_min: z.number().optional(),
  min_grade: z.string().optional(),
});
export type OLevelsConfig = z.infer<typeof OLevelsConfigSchema>;

export const IBConfigSchema = z.object({
  min_points: z.number().optional(),
});
export type IBConfig = z.infer<typeof IBConfigSchema>;

export const CustomYesNoConfigSchema = z.object({
  question_text: z.string(),
  positive_message: z.string().optional(),
  negative_message: z.string().optional(),
});
export type CustomYesNoConfig = z.infer<typeof CustomYesNoConfigSchema>;

export const CustomSelectConfigSchema = z.object({
  question_text: z.string(),
  options: z.array(z.string()),
  option_effects: z
    .record(
      z.string(),
      z.object({
        effect: RuleEffectSchema,
        message: z.string().nullable().optional(),
      })
    )
    .optional()
    .default({}),
});
export type CustomSelectConfig = z.infer<typeof CustomSelectConfigSchema>;

// -----------------------------------------------------------
// Union config schema (discriminated by rule_type externally)
// -----------------------------------------------------------

export const RuleConfigSchema = z.union([
  HighSchoolConfigSchema,
  TwelveYearsConfigSchema,
  LanguageCertConfigSchema,
  SATConfigSchema,
  GPAConfigSchema,
  BachelorConfigSchema,
  EntranceExamConfigSchema,
  PortfolioConfigSchema,
  ResearchPlanConfigSchema,
  ALevelsConfigSchema,
  ASLevelsConfigSchema,
  OLevelsConfigSchema,
  IBConfigSchema,
  CustomYesNoConfigSchema,
  CustomSelectConfigSchema,
]);

// -----------------------------------------------------------
// RequirementRule — a single row in the requirement_rules table
// -----------------------------------------------------------

export const RequirementRuleSchema = z.object({
  id: z.string().uuid(),
  program_id: z.string().uuid(),
  certificate_type_id: z.string().uuid().nullable(),
  rule_type: RuleTypeSchema,
  config: z.record(z.unknown()), // Validated per-type by evaluators
  effect: RuleEffectSchema,
  effect_message: z.string().nullable().optional(),
  sort_order: z.number().default(0),
  is_enabled: z.boolean().default(true),
  tenant_id: z.string().uuid(),
});
export type RequirementRule = z.infer<typeof RequirementRuleSchema>;

// -----------------------------------------------------------
// Student input — what the student provides for evaluation
// -----------------------------------------------------------

export interface RuleStudentInput {
  hasHighSchool: boolean;
  has12Years: boolean;
  hasBachelor: boolean;
  certificateType: string; // "arabic" | "british" | "american" | "ib"

  // Language certs
  ielts: number | null;
  languageCertType?: string | null;
  languageCertScore?: number | null;

  // SAT
  hasSAT: boolean;
  satScore: number | null;

  // GPA
  gpa: number | null;

  // British qualifications
  aLevelCount: number | null;
  aLevelCCount: number | null; // A Levels at grade C or above
  asLevelCount?: number | null;
  oLevelCount?: number | null;

  // Other
  hasResearchPlan: boolean;
  hasPortfolio?: boolean;
  hasEntranceExam?: boolean;

  // Dynamic answers (for custom questions)
  dynamicAnswers?: Record<string, string | boolean | number>;
}

// -----------------------------------------------------------
// Evaluation result from a single rule
// -----------------------------------------------------------

export interface RuleEvaluationResult {
  ruleId: string;
  ruleType: RuleType;
  passed: boolean;
  effect: RuleEffect;
  message: string | null; // Arabic message to display
  questionText?: string; // The question that was asked (for UI)
}

// -----------------------------------------------------------
// Aggregate result from evaluating all rules for a program
// -----------------------------------------------------------

export interface RuleEngineResult {
  status: "positive" | "conditional" | "negative";
  results: RuleEvaluationResult[];
  notes: string[];
  scholarshipInfo: string | null;
}

// -----------------------------------------------------------
// Evaluator interface — implemented by each rule type
// -----------------------------------------------------------

export interface RuleEvaluator<TConfig = unknown> {
  ruleType: RuleType;
  validateConfig(config: unknown): TConfig;
  evaluate(
    config: TConfig,
    input: RuleStudentInput,
    rule: RequirementRule
  ): RuleEvaluationResult;
  /** Generate an Arabic question text for this rule */
  generateQuestion(config: TConfig, rule: RequirementRule): string;
}
