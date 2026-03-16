import { z } from "zod";
import type { RuleEvaluatorV3, EvaluatorRawResult } from "../types";

const EntranceExamConfigV3 = z.object({}).strict();

export const entranceExamEvaluatorV3: RuleEvaluatorV3 = {
  ruleType: "entrance_exam",

  validateConfig(config: unknown) {
    return EntranceExamConfigV3.parse(config);
  },

  evaluate(): EvaluatorRawResult {
    return { outcomeKey: "required", facts: {} };
  },
};
