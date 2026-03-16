import { z } from "zod";
import type { RuleEvaluatorV3, AssessmentProfileV3, EvaluatorRawResult } from "../types";

const GpaConfigV3 = z.object({
  min_gpa: z.number(),
});
type GpaConfig = z.infer<typeof GpaConfigV3>;

export const gpaEvaluatorV3: RuleEvaluatorV3<GpaConfig> = {
  ruleType: "gpa",

  validateConfig(config: unknown): GpaConfig {
    return GpaConfigV3.parse(config);
  },

  evaluate(config: GpaConfig, profile: AssessmentProfileV3): EvaluatorRawResult {
    if (profile.certificateType !== "arabic") {
      return { outcomeKey: "not_applicable", facts: {} };
    }

    const gpa = profile.gpa;
    if (gpa.state === "not_provided") {
      return {
        outcomeKey: "not_available",
        facts: { min_gpa: config.min_gpa },
      };
    }
    if (gpa.state === "unknown") {
      return { outcomeKey: "unknown", facts: {} };
    }

    // present — uses percentage
    if (gpa.percentage >= config.min_gpa) {
      return {
        outcomeKey: "pass",
        facts: { gpa: gpa.percentage, min_gpa: config.min_gpa },
      };
    }
    return {
      outcomeKey: "below_minimum",
      facts: { gpa: gpa.percentage, min_gpa: config.min_gpa },
    };
  },
};
