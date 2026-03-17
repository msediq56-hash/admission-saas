// ============================================================
// V3 Comparison — per-program V3 eligibility check + wrapper
// ============================================================

import type {
  AssessmentProfileV3,
  RequirementRuleV3,
} from "./types";
import type { ComparisonResult } from "@/lib/comparison-engine";
import type { ScholarshipTier, CustomRequirement } from "@/lib/evaluation-engine";
import { RequirementRuleV3Schema } from "./schemas";
import { getEvaluatorV3 } from "./evaluators/registry";
import { evaluateRulesV3 } from "./engine";

// -----------------------------------------------------------
// V3 Eligibility — single entry-level decision point
// -----------------------------------------------------------

interface V3Eligible {
  mode: "v3";
  rules: RequirementRuleV3[];
}

interface V3Fallback {
  mode: "fallback";
  reason: string;
}

export type V3EligibilityResult = V3Eligible | V3Fallback;

/**
 * Single decision point: should this program entry use V3 or fallback?
 * All checks happen inside, in order. Any failure → fallback with reason.
 */
export function analyzeV3EligibilityForEntry(
  rawRules: unknown[],
  certType: string | null,
  customRequirements: CustomRequirement[]
): V3EligibilityResult {
  // CHECK 1: Must have at least one rule
  if (rawRules.length === 0) {
    return { mode: "fallback", reason: "no rules for this program" };
  }

  // CHECK 2: All rules must parse as RequirementRuleV3
  const parsed: RequirementRuleV3[] = [];
  for (const raw of rawRules) {
    const result = RequirementRuleV3Schema.safeParse(raw);
    if (!result.success) {
      return { mode: "fallback", reason: "rule failed V3 schema parsing" };
    }
    parsed.push(result.data);
  }

  // CHECK 3: All rules must have non-empty outcomes
  const allHaveOutcomes = parsed.every(
    (r) => r.outcomes && Object.keys(r.outcomes).length > 0
  );
  if (!allHaveOutcomes) {
    return { mode: "fallback", reason: "some rules have empty outcomes" };
  }

  // CHECK 4: Every rule must have a registered evaluator AND pass validateConfig
  for (const rule of parsed) {
    const evaluator = getEvaluatorV3(rule.rule_type);
    if (!evaluator) {
      return {
        mode: "fallback",
        reason: `no registered evaluator for rule_type: ${rule.rule_type}`,
      };
    }
    try {
      evaluator.validateConfig(rule.config);
    } catch {
      return {
        mode: "fallback",
        reason: `config validation failed for rule_type: ${rule.rule_type}`,
      };
    }
  }

  // CHECK 5: No unresolved custom requirements (per-row matching)
  const comparisonCustomReqs = customRequirements.filter(
    (cr) => cr.show_in_comparison
  );
  for (const cr of comparisonCustomReqs) {
    if (!cr.comparison_key) {
      return {
        mode: "fallback",
        reason: `custom requirement without comparison_key: ${cr.question_text}`,
      };
    }

    const matched = parsed.find((rule) => {
      if (rule.rule_type !== "custom_yes_no") return false;
      if (!rule.outcomes || Object.keys(rule.outcomes).length === 0)
        return false;
      if (rule.config.question_text !== cr.question_text) return false;
      if (!rule.config.comparison_key) return false;
      if (rule.config.comparison_key !== cr.comparison_key) return false;
      return true;
    });

    if (!matched) {
      return {
        mode: "fallback",
        reason: `unresolved custom requirement: ${cr.question_text}`,
      };
    }
  }

  // CHECK 6: Master/PhD programs must NOT enter V3 in this phase
  const masterRuleTypes = ["bachelor", "research_plan"];
  const hasMasterRules = parsed.some((r) =>
    masterRuleTypes.includes(r.rule_type)
  );
  if (hasMasterRules) {
    return {
      mode: "fallback",
      reason: "master-profile inputs not represented in compare form yet",
    };
  }

  // CHECK 7: British pathway compatibility
  if (certType === "british") {
    const britishRules = parsed.filter(
      (r) => r.rule_type === "british_qualifications"
    );
    for (const rule of britishRules) {
      if (!isSimpleBritishCompareCompatible(rule.config)) {
        return {
          mode: "fallback",
          reason: "british pathway too complex for current form",
        };
      }
    }
  }

  return { mode: "v3", rules: parsed };
}

/**
 * Check if a british_qualifications config is representable by the current
 * compare form (which only captures: aLevelCount + aLevelCCount).
 *
 * INTENTIONALLY narrow: only "N A Levels at grade C" matches.
 */
export function isSimpleBritishCompareCompatible(
  config: Record<string, unknown>
): boolean {
  const pathways = (
    config as {
      pathways?: Array<{
        requirements?: Array<{ level?: string; min_grade?: string }>;
      }>;
    }
  ).pathways;
  if (!pathways || pathways.length === 0) return false;
  if (pathways.length !== 1) return false;
  const reqs = pathways[0].requirements || [];
  if (reqs.length !== 1) return false;
  return reqs[0].level === "a_level" && reqs[0].min_grade === "C";
}

// -----------------------------------------------------------
// V3 Comparison Entry — what compareOneProgram needs
// -----------------------------------------------------------

export interface V3ComparisonEntry {
  programId: string;
  programName: string;
  universityName: string;
  country: string;
  universityType: string;
  category: string;
  certificateTypeSlug: string | null;
  rules: RequirementRuleV3[];
  scholarshipTiers: ScholarshipTier[];
}

// -----------------------------------------------------------
// Compare one program with V3 engine
// -----------------------------------------------------------

export function compareOneProgram(
  profile: AssessmentProfileV3,
  entry: V3ComparisonEntry
): ComparisonResult {
  const base = {
    programId: entry.programId,
    programName: entry.programName,
    universityName: entry.universityName,
    country: entry.country,
    universityType: entry.universityType,
    category: entry.category,
  };

  // MISMATCH GUARD — must run before evaluateRulesV3
  if (
    entry.certificateTypeSlug !== null &&
    entry.certificateTypeSlug !== profile.certificateType
  ) {
    return {
      ...base,
      status: "negative",
      reason: "هذا المسار مخصص لحاملي شهادة أخرى",
      notes: [],
      scholarshipInfo: null,
    };
  }

  // Evaluate with V3 engine (diagnostic mode for comparison)
  const engineResult = evaluateRulesV3(entry.rules, profile, {
    mode: "diagnostic",
  });

  const notes: string[] = [];
  let scholarshipInfo: string | null = null;

  // Scholarship post-processing (from old scholarship_tiers table)
  if (
    profile.certificateType === "arabic" &&
    profile.gpa.state === "present" &&
    entry.scholarshipTiers.length > 0
  ) {
    const sorted = [...entry.scholarshipTiers].sort(
      (a, b) => a.sort_order - b.sort_order
    );
    const tier = sorted.find(
      (t) =>
        profile.gpa.state === "present" &&
        profile.gpa.percentage >= t.min_gpa &&
        profile.gpa.percentage <= t.max_gpa
    );
    if (tier) {
      scholarshipInfo = tier.label
        ? `منحة: ${tier.label} (${tier.scholarship_percent}%)`
        : `منحة: ${tier.scholarship_percent}%`;
    }
  }

  // Map decision → ComparisonResult
  switch (engineResult.finalDecision) {
    case "pass":
      return {
        ...base,
        status: "positive",
        reason: "الطالب مؤهل للقبول في هذا البرنامج",
        notes,
        scholarshipInfo,
      };

    case "conditional":
    case "review": {
      // Collect all condition messages + review reasons
      const messages: string[] = [];
      for (const cond of engineResult.conditions) {
        messages.push(cond.message);
      }
      if (engineResult.reviewItems) {
        for (const item of engineResult.reviewItems) {
          messages.push(item.reason);
        }
      }
      return {
        ...base,
        status: "conditional",
        reason: messages.join(" — ") || "مشروط",
        notes,
        scholarshipInfo,
      };
    }

    case "block": {
      // Extract block reason from first block rule's note action
      const blockRule = engineResult.ruleResults.find(
        (rr) => rr.result.decision === "block"
      );
      const blockNote = blockRule?.result.actions.find(
        (a) => a.type === "note"
      );
      const reason =
        blockNote?.type === "note" ? blockNote.message : "غير مؤهل";
      return {
        ...base,
        status: "negative",
        reason,
        notes,
        scholarshipInfo: null,
      };
    }

    case "redirect": {
      const redirectMsg =
        engineResult.redirect?.message || "يُنصح بالتقديم على برنامج آخر";
      if (engineResult.redirect) {
        notes.push(
          `💡 يُنصح بالتقديم على: ${engineResult.redirect.category}`
        );
      }
      return {
        ...base,
        status: "negative",
        reason: redirectMsg,
        notes,
        scholarshipInfo: null,
      };
    }

    default:
      return {
        ...base,
        status: "negative",
        reason: "غير مؤهل",
        notes,
        scholarshipInfo: null,
      };
  }
}
