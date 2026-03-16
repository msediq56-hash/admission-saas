import { z } from "zod";
import type { RuleEvaluatorV3, AssessmentProfileV3, EvaluatorRawResult } from "../types";

const HighSchoolConfigV3 = z.object({}).strict();

export const highSchoolEvaluatorV3: RuleEvaluatorV3 = {
  ruleType: "high_school",

  validateConfig(config: unknown) {
    return HighSchoolConfigV3.parse(config);
  },

  evaluate(_config: unknown, profile: AssessmentProfileV3): EvaluatorRawResult {
    if (profile.certificateType !== "arabic") {
      return { outcomeKey: "not_applicable", facts: {} };
    }
    if (profile.hasHighSchool === "unknown") {
      return { outcomeKey: "unknown", facts: {} };
    }
    if (profile.hasHighSchool) {
      return { outcomeKey: "pass", facts: { hasHighSchool: true } };
    }
    return { outcomeKey: "not_available", facts: { hasHighSchool: false } };
  },
};
