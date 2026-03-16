import { z } from "zod";
import type { RuleEvaluatorV3, AssessmentProfileV3, EvaluatorRawResult } from "../types";

const TwelveYearsConfigV3 = z.object({}).strict();

export const twelveYearsEvaluatorV3: RuleEvaluatorV3 = {
  ruleType: "twelve_years",

  validateConfig(config: unknown) {
    return TwelveYearsConfigV3.parse(config);
  },

  evaluate(_config: unknown, profile: AssessmentProfileV3): EvaluatorRawResult {
    if (profile.certificateType !== "arabic") {
      return { outcomeKey: "not_applicable", facts: {} };
    }
    if (profile.has12Years === "unknown") {
      return { outcomeKey: "unknown", facts: {} };
    }
    if (profile.has12Years) {
      return { outcomeKey: "pass", facts: { has12Years: true } };
    }
    return { outcomeKey: "not_available", facts: { has12Years: false } };
  },
};
