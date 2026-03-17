// ============================================================
// custom_yes_no V3 Evaluator
// Looks up a boolean answer in profile.dynamicAnswers by comparison_key.
// ============================================================

import { z } from "zod";
import type {
  AssessmentProfileV3,
  EvaluatorRawResult,
  RuleEvaluatorV3,
} from "../types";

const CustomYesNoConfigV3 = z.object({
  question_text: z.string(),
  comparison_key: z.string().optional(), // optional for backward compat
  positive_message: z.string().optional(),
  negative_message: z.string().optional(),
});

type CustomYesNoConfig = z.infer<typeof CustomYesNoConfigV3>;

export const customYesNoEvaluatorV3: RuleEvaluatorV3<CustomYesNoConfig> = {
  ruleType: "custom_yes_no",

  validateConfig(config: unknown): CustomYesNoConfig {
    return CustomYesNoConfigV3.parse(config);
  },

  evaluate(config: CustomYesNoConfig, profile: AssessmentProfileV3): EvaluatorRawResult {
    // No comparison_key → can't look up answer
    if (!config.comparison_key) {
      return {
        outcomeKey: "unknown",
        facts: { reason: "no comparison_key in config" },
      };
    }

    // No dynamicAnswers or key not present
    const answers = profile.dynamicAnswers;
    if (!answers || !(config.comparison_key in answers)) {
      return {
        outcomeKey: "unknown",
        facts: { reason: "answer not provided" },
      };
    }

    const answer = answers[config.comparison_key];

    if (answer === true || answer === "yes") {
      return { outcomeKey: "yes", facts: { answer: true } };
    }

    if (answer === false || answer === "no") {
      return { outcomeKey: "no", facts: { answer: false } };
    }

    return {
      outcomeKey: "unknown",
      facts: { reason: "unrecognized answer value", answer },
    };
  },
};
