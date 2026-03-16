import { z } from "zod";
import type { RuleEvaluatorV3, AssessmentProfileV3, EvaluatorRawResult } from "../types";

const BachelorConfigV3 = z.object({}).strict();

export const bachelorEvaluatorV3: RuleEvaluatorV3 = {
  ruleType: "bachelor",

  validateConfig(config: unknown) {
    return BachelorConfigV3.parse(config);
  },

  evaluate(_config: unknown, profile: AssessmentProfileV3): EvaluatorRawResult {
    if (profile.certificateType !== "master") {
      return { outcomeKey: "not_applicable", facts: {} };
    }
    if (profile.hasBachelor === "unknown") {
      return { outcomeKey: "unknown", facts: {} };
    }
    if (profile.hasBachelor) {
      return { outcomeKey: "pass", facts: { hasBachelor: true } };
    }
    return { outcomeKey: "not_available", facts: { hasBachelor: false } };
  },
};
