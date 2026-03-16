import { z } from "zod";
import type { RuleEvaluatorV3, EvaluatorRawResult } from "../types";

const PortfolioConfigV3 = z.object({}).strict();

export const portfolioEvaluatorV3: RuleEvaluatorV3 = {
  ruleType: "portfolio",

  validateConfig(config: unknown) {
    return PortfolioConfigV3.parse(config);
  },

  evaluate(): EvaluatorRawResult {
    return { outcomeKey: "required", facts: {} };
  },
};
