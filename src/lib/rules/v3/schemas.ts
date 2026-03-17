// ============================================================
// V3.2 Engine Zod Schemas — ALL validation schemas live here.
// NO TypeScript interfaces defined here — only z.infer<> exports.
//
// Corresponding pure TS interfaces are in types.ts.
// ============================================================

import { z } from "zod";

// -----------------------------------------------------------
// Decision
// -----------------------------------------------------------

export const DecisionSchema = z.enum([
  "pass",
  "conditional",
  "block",
  "redirect",
  "review",
]);
export type DecisionZ = z.infer<typeof DecisionSchema>;

// -----------------------------------------------------------
// Redirect target
// -----------------------------------------------------------

export const RedirectTargetSchema = z.object({
  category: z.string().min(1),
  scope: z.enum(["same_university", "any"]),
});
export type RedirectTargetZ = z.infer<typeof RedirectTargetSchema>;

// -----------------------------------------------------------
// Outcome definition — with strict validation
// -----------------------------------------------------------

export const OutcomeDefinitionSchema = z
  .object({
    decision: DecisionSchema,
    message: z.string().optional(),
    redirect: RedirectTargetSchema.optional(),
    condition_code: z.string().optional(),
    deadline: z.string().optional(),
  })
  .superRefine((data, ctx) => {
    if (data.decision === "redirect" && !data.redirect) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "redirect field is REQUIRED when decision = 'redirect'",
        path: ["redirect"],
      });
    }
    if (data.decision === "conditional" && !data.condition_code) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message:
          "condition_code field is REQUIRED when decision = 'conditional'",
        path: ["condition_code"],
      });
    }
    if (data.decision === "review" && !data.message) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "message field is REQUIRED when decision = 'review'",
        path: ["message"],
      });
    }
  });
export type OutcomeDefinitionZ = z.infer<typeof OutcomeDefinitionSchema>;

// -----------------------------------------------------------
// Outcomes map — record of outcomeKey → OutcomeDefinition
// -----------------------------------------------------------

export const OutcomesMapSchema = z.record(
  z.string(),
  OutcomeDefinitionSchema
);
export type OutcomesMapZ = z.infer<typeof OutcomesMapSchema>;

// -----------------------------------------------------------
// Rule actions — discriminated union on "type"
// -----------------------------------------------------------

export const RuleActionSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("redirect"),
    target: RedirectTargetSchema,
  }),
  z.object({
    type: z.literal("condition"),
    code: z.string(),
    message: z.string(),
    deadline: z.string().optional(),
  }),
  z.object({
    type: z.literal("scholarship"),
    tier: z.string().optional(),
    message: z.string().optional(),
  }),
  z.object({
    type: z.literal("note"),
    message: z.string(),
  }),
  z.object({
    type: z.literal("review"),
    reason: z.string(),
  }),
]);
export type RuleActionZ = z.infer<typeof RuleActionSchema>;

// -----------------------------------------------------------
// Evaluator raw result
// -----------------------------------------------------------

export const EvaluatorRawResultSchema = z.object({
  outcomeKey: z.string(),
  facts: z.record(z.string(), z.unknown()),
  extraActions: z.array(RuleActionSchema).optional(),
});
export type EvaluatorRawResultZ = z.infer<typeof EvaluatorRawResultSchema>;

// -----------------------------------------------------------
// Data state — three-state discriminated union
// -----------------------------------------------------------

export const DataStateSchema = z.enum(["present", "not_provided", "unknown"]);
export type DataStateZ = z.infer<typeof DataStateSchema>;

// -----------------------------------------------------------
// SAT field — discriminated union on "state"
// -----------------------------------------------------------

export const SatFieldSchema = z.discriminatedUnion("state", [
  z.object({
    state: z.literal("present"),
    score: z.number().min(400).max(1600),
  }),
  z.object({ state: z.literal("not_provided") }),
  z.object({ state: z.literal("unknown") }),
]);
export type SatFieldZ = z.infer<typeof SatFieldSchema>;

// -----------------------------------------------------------
// Language certificate field — discriminated union on "state"
// -----------------------------------------------------------

export const LanguageCertFieldSchema = z.discriminatedUnion("state", [
  z.object({
    state: z.literal("present"),
    type: z.string().min(1),
    score: z.number().min(0),
  }),
  z.object({ state: z.literal("not_provided") }),
  z.object({ state: z.literal("unknown") }),
]);
export type LanguageCertFieldZ = z.infer<typeof LanguageCertFieldSchema>;

// -----------------------------------------------------------
// GPA field — discriminated union on "state"
// -----------------------------------------------------------

export const GpaFieldSchema = z.discriminatedUnion("state", [
  z.object({
    state: z.literal("present"),
    percentage: z.number().min(0).max(100),
  }),
  z.object({ state: z.literal("not_provided") }),
  z.object({ state: z.literal("unknown") }),
]);
export type GpaFieldZ = z.infer<typeof GpaFieldSchema>;

// -----------------------------------------------------------
// Study track — discriminated union on "state"
// -----------------------------------------------------------

export const StudyTrackSchema = z.discriminatedUnion("state", [
  z.object({
    state: z.literal("present"),
    track: z.enum(["scientific", "literary", "other"]),
  }),
  z.object({ state: z.literal("not_provided") }),
  z.object({ state: z.literal("unknown") }),
]);
export type StudyTrackZ = z.infer<typeof StudyTrackSchema>;

// -----------------------------------------------------------
// British subject
// -----------------------------------------------------------

export const BritishSubjectSchema = z.object({
  name: z.string().min(1),
  level: z.enum(["a_level", "as_level", "o_level"]),
  grade: z.string().min(1),
});
export type BritishSubjectZ = z.infer<typeof BritishSubjectSchema>;

// -----------------------------------------------------------
// Assessment profiles — discriminated union on "certificateType"
// -----------------------------------------------------------

export const BritishAssessmentProfileSchema = z.object({
  certificateType: z.literal("british"),
  subjects: z.array(BritishSubjectSchema),
  intendedMajor: z.string().optional(),
  sat: SatFieldSchema,
  languageCert: LanguageCertFieldSchema,
  dynamicAnswers: z.record(z.union([z.string(), z.boolean(), z.number()])).optional(),
});
export type BritishAssessmentProfileZ = z.infer<
  typeof BritishAssessmentProfileSchema
>;

export const ArabicAssessmentProfileSchema = z.object({
  certificateType: z.literal("arabic"),
  hasHighSchool: z.union([z.boolean(), z.literal("unknown")]),
  has12Years: z.union([z.boolean(), z.literal("unknown")]),
  gpa: GpaFieldSchema,
  studyTrack: StudyTrackSchema,
  intendedMajor: z.string().optional(),
  sat: SatFieldSchema,
  languageCert: LanguageCertFieldSchema,
  dynamicAnswers: z.record(z.union([z.string(), z.boolean(), z.number()])).optional(),
});
export type ArabicAssessmentProfileZ = z.infer<
  typeof ArabicAssessmentProfileSchema
>;

export const MasterAssessmentProfileSchema = z.object({
  certificateType: z.literal("master"),
  hasBachelor: z.union([z.boolean(), z.literal("unknown")]),
  hasResearchPlan: z.union([z.boolean(), z.literal("unknown")]),
  languageCert: LanguageCertFieldSchema,
  dynamicAnswers: z.record(z.union([z.string(), z.boolean(), z.number()])).optional(),
});
export type MasterAssessmentProfileZ = z.infer<
  typeof MasterAssessmentProfileSchema
>;

export const AssessmentProfileV3Schema = z.discriminatedUnion(
  "certificateType",
  [
    BritishAssessmentProfileSchema,
    ArabicAssessmentProfileSchema,
    MasterAssessmentProfileSchema,
  ]
);
export type AssessmentProfileV3Z = z.infer<typeof AssessmentProfileV3Schema>;

// -----------------------------------------------------------
// British pathways config
// -----------------------------------------------------------

export const PathwayRequirementSchema = z.object({
  level: z.enum(["a_level", "as_level", "o_level"]),
  min_count: z.number().int().min(1),
  min_grade: z.string().optional(),
});
export type PathwayRequirementZ = z.infer<typeof PathwayRequirementSchema>;

export const PathwaySchema = z.object({
  label: z.string().optional(),
  requirements: z.array(PathwayRequirementSchema).min(1),
});
export type PathwayZ = z.infer<typeof PathwaySchema>;

export const BritishQualificationsConfigSchema = z.object({
  pathways: z.array(PathwaySchema).min(1),
});
export type BritishQualificationsConfigZ = z.infer<
  typeof BritishQualificationsConfigSchema
>;

// -----------------------------------------------------------
// Engine trace
// -----------------------------------------------------------

export const EngineTraceSchema = z.object({
  evaluatedAt: z.string(),
  profileHash: z.string(),
  rulesEvaluated: z.number().int().min(0),
  rulesStopped: z.boolean(),
  stoppedAtRule: z.string().optional(),
  mode: z.enum(["terminal", "diagnostic"]),
});
export type EngineTraceZ = z.infer<typeof EngineTraceSchema>;

// -----------------------------------------------------------
// Requirement rule V3 — DB row with outcomes column
// -----------------------------------------------------------

export const RequirementRuleV3Schema = z.object({
  id: z.string().uuid(),
  program_id: z.string().uuid(),
  certificate_type_id: z.string().uuid().nullable(),
  rule_type: z.string(),
  config: z.record(z.string(), z.unknown()).default({}),
  outcomes: OutcomesMapSchema.default({}),
  sort_order: z.number().int(),
  is_enabled: z.boolean(),
  tenant_id: z.string().uuid(),
  source_note: z.string().nullable().optional(),
  verified_at: z.string().nullable().optional(),
  // Legacy fields
  effect: z.string().nullable().optional(),
  effect_message: z.string().nullable().optional(),
});
export type RequirementRuleV3Z = z.infer<typeof RequirementRuleV3Schema>;
