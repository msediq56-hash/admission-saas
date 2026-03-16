// ============================================================
// British Qualifications Evaluator — checks pathway requirements
// (subject count + grades per level, NOT specific subject names)
// ============================================================

import type {
  AssessmentProfileV3,
  BritishQualificationsConfig,
  EvaluatorRawResult,
  RuleEvaluatorV3,
} from "../../types";
import { BritishQualificationsConfigSchema } from "../../schemas";
import { matchPathways } from "./pathway-matcher";

export const britishQualificationsEvaluatorV3: RuleEvaluatorV3<BritishQualificationsConfig> =
  {
    ruleType: "british_qualifications",

    validateConfig(config: unknown): BritishQualificationsConfig {
      return BritishQualificationsConfigSchema.parse(config);
    },

    evaluate(
      config: BritishQualificationsConfig,
      profile: AssessmentProfileV3
    ): EvaluatorRawResult {
      // Not applicable for non-british profiles
      if (profile.certificateType !== "british") {
        return {
          outcomeKey: "not_applicable",
          facts: { reason: "not british certificate" },
        };
      }

      // Empty subjects = count failure
      if (profile.subjects.length === 0) {
        return {
          outcomeKey: "count_fail",
          facts: { reason: "no subjects provided", subjectCount: 0 },
        };
      }

      // Match against pathways
      const result = matchPathways(profile.subjects, config.pathways);

      return {
        outcomeKey: result.outcomeKey,
        facts: {
          subjectCount: profile.subjects.length,
          pathwaysTried: config.pathways.length,
          matchedPathway: result.matchedPathway || null,
          failedPathways: result.failedPathways,
        },
      };
    },
  };
