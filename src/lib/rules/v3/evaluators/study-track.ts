import { z } from "zod";
import type { RuleEvaluatorV3, AssessmentProfileV3, EvaluatorRawResult } from "../types";

const StudyTrackConfigV3 = z.object({
  allowed_tracks: z.array(z.enum(["scientific", "literary", "other"])),
});
type StudyTrackConfig = z.infer<typeof StudyTrackConfigV3>;

export const studyTrackEvaluatorV3: RuleEvaluatorV3<StudyTrackConfig> = {
  ruleType: "study_track",

  validateConfig(config: unknown): StudyTrackConfig {
    return StudyTrackConfigV3.parse(config);
  },

  evaluate(config: StudyTrackConfig, profile: AssessmentProfileV3): EvaluatorRawResult {
    if (profile.certificateType !== "arabic") {
      return { outcomeKey: "not_applicable", facts: {} };
    }

    const st = profile.studyTrack;
    if (st.state === "not_provided") {
      return {
        outcomeKey: "not_available",
        facts: { allowed_tracks: config.allowed_tracks },
      };
    }
    if (st.state === "unknown") {
      return { outcomeKey: "unknown", facts: {} };
    }

    // present
    if (config.allowed_tracks.includes(st.track)) {
      return {
        outcomeKey: "pass",
        facts: { track: st.track, allowed_tracks: config.allowed_tracks },
      };
    }
    return {
      outcomeKey: "wrong_track",
      facts: { track: st.track, allowed_tracks: config.allowed_tracks },
    };
  },
};
