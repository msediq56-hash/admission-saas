// ============================================================
// V3.2 Engine Types — Pure TypeScript Interfaces
// NO Zod imports, NO runtime code. Data contracts only.
//
// Key architectural split:
//   Evaluator → returns EvaluatorRawResult (outcomeKey + facts)
//   Engine    → resolves OutcomeDefinition → RuleEvaluationResultV3
// ============================================================

// -----------------------------------------------------------
// Decision types — ordered by precedence (block > redirect > review > conditional > pass)
// -----------------------------------------------------------

/** Final decision for a rule or the entire evaluation. */
export type Decision = "pass" | "conditional" | "block" | "redirect" | "review";

// -----------------------------------------------------------
// Redirect target — where to send the student
// -----------------------------------------------------------

/** Describes which program category to redirect to and whether it's scoped to the same university. */
export interface RedirectTarget {
  category: string;
  scope: "same_university" | "any";
}

// -----------------------------------------------------------
// Outcome definition — stored in requirement_rules.outcomes JSONB
// -----------------------------------------------------------

/**
 * Maps an outcomeKey (returned by an evaluator) to a decision + actions.
 * Stored in the DB as part of requirement_rules.outcomes.
 *
 * Empty outcomes ({}) means the rule has NOT been migrated to V3 yet.
 * The V3 engine MUST skip rules with empty outcomes.
 */
export interface OutcomeDefinition {
  decision: Decision;
  /** Human-readable message (Arabic). REQUIRED when decision = "review". */
  message?: string;
  /** REQUIRED when decision = "redirect". */
  redirect?: RedirectTarget;
  /** REQUIRED when decision = "conditional". */
  condition_code?: string;
  /** Optional deadline for conditional decisions (e.g. "31 ديسمبر"). */
  deadline?: string;
}

// -----------------------------------------------------------
// Evaluator raw result — what evaluators return
// -----------------------------------------------------------

/**
 * Raw outcome from an evaluator. Contains NO decision/actions —
 * the engine resolves those from OutcomeDefinition in the DB.
 */
export interface EvaluatorRawResult {
  /** Key that maps to an OutcomeDefinition in the rule's outcomes JSONB. */
  outcomeKey: string;
  /** Arbitrary facts extracted during evaluation (e.g. { score: 5.5, needed: 6.5 }). */
  facts: Record<string, unknown>;
  /** Optional extra actions the evaluator wants to attach (e.g. scholarship tiers). */
  extraActions?: RuleAction[];
}

// -----------------------------------------------------------
// Actions — built by engine from OutcomeDefinition, not by evaluator
// -----------------------------------------------------------

/** Discriminated union of all possible actions the engine can produce. */
export type RuleAction =
  | { type: "redirect"; target: RedirectTarget }
  | { type: "condition"; code: string; message: string; deadline?: string }
  | { type: "scholarship"; tier?: string; message?: string }
  | { type: "note"; message: string }
  | { type: "review"; reason: string };

// -----------------------------------------------------------
// Result after engine resolves outcome
// -----------------------------------------------------------

/** A single rule's evaluation result after the engine resolves the outcome. */
export interface RuleEvaluationResultV3 {
  outcomeKey: string;
  decision: Decision;
  actions: RuleAction[];
  facts: Record<string, unknown>;
}

// -----------------------------------------------------------
// Engine trace — for debugging, not stored in DB
// -----------------------------------------------------------

/** Diagnostic trace of a single engine run. */
export interface EngineTrace {
  evaluatedAt: string;
  profileHash: string;
  rulesEvaluated: number;
  rulesStopped: boolean;
  stoppedAtRule?: string;
  mode: "terminal" | "diagnostic";
}

// -----------------------------------------------------------
// Full engine result
// -----------------------------------------------------------

/** Complete result of evaluating a student profile against a program's rules. */
export interface EngineResultV3 {
  finalDecision: Decision;
  ruleResults: Array<{
    ruleId: string;
    ruleType: string;
    result: RuleEvaluationResultV3;
  }>;
  conditions: Array<{ code: string; message: string; deadline?: string }>;
  redirect?: RedirectTarget & { message: string };
  reviewItems?: Array<{ reason: string }>;
  trace: EngineTrace;
}

// -----------------------------------------------------------
// Evaluator interface
// -----------------------------------------------------------

/**
 * V3 evaluator contract. Each evaluator:
 * 1. Validates its config from the DB
 * 2. Evaluates the profile and returns a RAW outcome (outcomeKey + facts)
 * 3. Does NOT make decisions — the engine does that using OutcomeDefinition
 */
export interface RuleEvaluatorV3<TConfig = unknown> {
  ruleType: string;
  validateConfig(config: unknown): TConfig;
  evaluate(config: TConfig, profile: AssessmentProfileV3): EvaluatorRawResult;
}

// -----------------------------------------------------------
// DB row type
// -----------------------------------------------------------

/**
 * Represents a row from the requirement_rules table with V3.2 columns.
 * Uses null (not undefined) for nullable DB columns.
 */
export interface RequirementRuleV3 {
  id: string;
  program_id: string;
  certificate_type_id: string | null;
  rule_type: string;
  config: Record<string, unknown>;
  /** Maps outcomeKey → OutcomeDefinition. Empty {} = not migrated, skip in V3 engine. */
  outcomes: Record<string, OutcomeDefinition>;
  sort_order: number;
  is_enabled: boolean;
  tenant_id: string;
  source_note?: string | null;
  verified_at?: string | null;
  // Legacy fields (kept for backward compat with old engine)
  effect?: string | null;
  effect_message?: string | null;
}

// -----------------------------------------------------------
// Assessment profile — discriminated union
// -----------------------------------------------------------

/** V3 assessment profile — discriminated union by certificateType. */
export type AssessmentProfileV3 =
  | BritishAssessmentProfile
  | ArabicAssessmentProfile
  | MasterAssessmentProfile;

/** A single British subject with level and grade. */
export interface BritishSubject {
  name: string;
  level: "a_level" | "as_level" | "o_level";
  grade: string;
}

/** SAT field — flat discriminated union on "state". */
export type SatField =
  | { state: "present"; score: number }
  | { state: "not_provided" }
  | { state: "unknown" };

/** Language certificate field — flat discriminated union on "state". */
export type LanguageCertField =
  | { state: "present"; type: string; score: number }
  | { state: "not_provided" }
  | { state: "unknown" };

/** GPA field — flat discriminated union on "state" (percentage 0-100). */
export type GpaField =
  | { state: "present"; percentage: number }
  | { state: "not_provided" }
  | { state: "unknown" };

/** Study track for Arabic certificates — flat discriminated union. */
export type StudyTrack =
  | { state: "present"; track: "scientific" | "literary" | "other" }
  | { state: "not_provided" }
  | { state: "unknown" };

/** British certificate profile. */
export interface BritishAssessmentProfile {
  certificateType: "british";
  subjects: BritishSubject[];
  intendedMajor?: string;
  sat: SatField;
  languageCert: LanguageCertField;
}

/** Arabic certificate profile. */
export interface ArabicAssessmentProfile {
  certificateType: "arabic";
  hasHighSchool: boolean | "unknown";
  has12Years: boolean | "unknown";
  gpa: GpaField;
  studyTrack: StudyTrack;
  intendedMajor?: string;
  sat: SatField;
  languageCert: LanguageCertField;
}

/** Master's / postgraduate profile. */
export interface MasterAssessmentProfile {
  certificateType: "master";
  hasBachelor: boolean | "unknown";
  hasResearchPlan: boolean | "unknown";
  languageCert: LanguageCertField;
}

// -----------------------------------------------------------
// British pathways config (stored in rule config)
// -----------------------------------------------------------

/** A single pathway requirement (e.g. "3 A Levels at C"). */
export interface PathwayRequirement {
  level: "a_level" | "as_level" | "o_level";
  min_count: number;
  min_grade?: string;
}

/** A named pathway with one or more requirements. */
export interface Pathway {
  label?: string;
  requirements: PathwayRequirement[];
}

/** Config for british_qualifications rule type. */
export interface BritishQualificationsConfig {
  pathways: Pathway[];
}
