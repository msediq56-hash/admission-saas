import { z } from "zod";
import type { RuleEvaluatorV3, AssessmentProfileV3, EvaluatorRawResult } from "../types";

const LanguageCertConfigV3 = z.object({
  cert_type: z.string(),
  min_score: z.number(),
  alternatives: z.record(z.string(), z.number()).optional().default({}),
});
type LanguageCertConfig = z.infer<typeof LanguageCertConfigV3>;

export const languageCertEvaluatorV3: RuleEvaluatorV3<LanguageCertConfig> = {
  ruleType: "language_cert",

  validateConfig(config: unknown): LanguageCertConfig {
    return LanguageCertConfigV3.parse(config);
  },

  evaluate(config: LanguageCertConfig, profile: AssessmentProfileV3): EvaluatorRawResult {
    const lc = profile.languageCert;

    if (lc.state === "not_provided") {
      return {
        outcomeKey: "not_available",
        facts: { required_type: config.cert_type, min_score: config.min_score },
      };
    }
    if (lc.state === "unknown") {
      return { outcomeKey: "unknown", facts: {} };
    }

    // present — check type match
    const providedType = lc.type.toLowerCase();
    const requiredType = config.cert_type.toLowerCase();

    // Direct match
    if (providedType === requiredType) {
      if (lc.score >= config.min_score) {
        return {
          outcomeKey: "pass",
          facts: { type: lc.type, score: lc.score, min_score: config.min_score, met: true },
        };
      }
      return {
        outcomeKey: "score_below",
        facts: { type: lc.type, score: lc.score, min_score: config.min_score, met: false },
      };
    }

    // Check alternatives
    for (const [altType, altMin] of Object.entries(config.alternatives)) {
      if (providedType === altType.toLowerCase()) {
        if (lc.score >= altMin) {
          return {
            outcomeKey: "pass",
            facts: { type: lc.type, score: lc.score, min_score: altMin, met: true },
          };
        }
        return {
          outcomeKey: "score_below",
          facts: { type: lc.type, score: lc.score, min_score: altMin, met: false },
        };
      }
    }

    // No type match
    return {
      outcomeKey: "wrong_type",
      facts: { provided_type: lc.type, required_type: config.cert_type },
    };
  },
};
