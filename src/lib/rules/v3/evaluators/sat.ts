import { z } from "zod";
import type { RuleEvaluatorV3, AssessmentProfileV3, EvaluatorRawResult } from "../types";

const SatConfigV3 = z.object({
  min_score: z.number(),
});
type SatConfig = z.infer<typeof SatConfigV3>;

export const satEvaluatorV3: RuleEvaluatorV3<SatConfig> = {
  ruleType: "sat",

  validateConfig(config: unknown): SatConfig {
    return SatConfigV3.parse(config);
  },

  evaluate(config: SatConfig, profile: AssessmentProfileV3): EvaluatorRawResult {
    if (profile.certificateType === "master") {
      return { outcomeKey: "not_applicable", facts: {} };
    }

    const sat = profile.sat;
    if (sat.state === "not_provided") {
      return {
        outcomeKey: "not_available",
        facts: { min_score: config.min_score },
      };
    }
    if (sat.state === "unknown") {
      return { outcomeKey: "unknown", facts: {} };
    }

    // present
    if (sat.score >= config.min_score) {
      return {
        outcomeKey: "pass",
        facts: { score: sat.score, min_score: config.min_score },
      };
    }
    return {
      outcomeKey: "score_below",
      facts: { score: sat.score, min_score: config.min_score },
    };
  },
};
