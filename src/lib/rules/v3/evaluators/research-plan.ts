import { z } from "zod";
import type { RuleEvaluatorV3, AssessmentProfileV3, EvaluatorRawResult } from "../types";

const ResearchPlanConfigV3 = z.object({}).strict();

export const researchPlanEvaluatorV3: RuleEvaluatorV3 = {
  ruleType: "research_plan",

  validateConfig(config: unknown) {
    return ResearchPlanConfigV3.parse(config);
  },

  evaluate(_config: unknown, profile: AssessmentProfileV3): EvaluatorRawResult {
    if (profile.certificateType !== "master") {
      return { outcomeKey: "not_applicable", facts: {} };
    }
    if (profile.hasResearchPlan === "unknown") {
      return { outcomeKey: "unknown", facts: {} };
    }
    if (profile.hasResearchPlan) {
      return { outcomeKey: "pass", facts: { hasResearchPlan: true } };
    }
    return { outcomeKey: "not_available", facts: { hasResearchPlan: false } };
  },
};
