// ============================================================
// Profile Adapter — converts comparison form data to AssessmentProfileV3
// ============================================================

import type {
  AssessmentProfileV3,
  ArabicAssessmentProfile,
  BritishAssessmentProfile,
  BritishSubject,
} from "./types";

export interface ComparisonFormData {
  certificateType: "arabic" | "british";
  // Arabic fields
  hasHighSchool?: boolean;
  has12Years?: boolean;
  gpa?: number | null;
  // British fields
  aLevelCount?: number;
  aLevelCCount?: number;
  // Shared
  hasIelts?: boolean;
  ieltsScore?: number;
  hasSAT?: boolean;
  satScore?: number;
  dynamicAnswers?: Record<string, string | boolean | number>;
}

/**
 * Build an AssessmentProfileV3 from comparison form data.
 */
export function buildAssessmentProfile(
  form: ComparisonFormData
): AssessmentProfileV3 {
  if (form.certificateType === "arabic") {
    return buildArabicProfile(form);
  }
  return buildBritishProfile(form);
}

function buildArabicProfile(form: ComparisonFormData): ArabicAssessmentProfile {
  return {
    certificateType: "arabic",
    hasHighSchool: form.hasHighSchool ?? "unknown",
    has12Years: form.has12Years ?? "unknown",
    gpa:
      form.gpa != null
        ? { state: "present", percentage: form.gpa }
        : { state: "not_provided" },
    studyTrack: { state: "not_provided" }, // not collected yet
    sat:
      form.hasSAT && form.satScore
        ? { state: "present", score: form.satScore }
        : { state: "not_provided" },
    languageCert:
      form.hasIelts && form.ieltsScore
        ? { state: "present", type: "IELTS", score: form.ieltsScore }
        : { state: "not_provided" },
    dynamicAnswers: form.dynamicAnswers,
  };
}

/**
 * TEMPORARY British adapter — LOSSY.
 * Only works for the narrow case the form supports: "N A Levels at C".
 * Complex pathways (AS/O levels, multiple grade thresholds, grade B or above)
 * will NOT be correctly evaluated.
 * The isSimpleBritishCompareCompatible check in compare.ts ensures
 * only matching programs reach V3.
 */
function buildBritishProfile(
  form: ComparisonFormData
): BritishAssessmentProfile {
  const totalALevels = form.aLevelCount ?? 0;
  const atGradeC = form.aLevelCCount ?? 0;
  const belowC = totalALevels - atGradeC;

  // Build synthetic subjects: atGradeC at "C", rest at "D"
  const subjects: BritishSubject[] = [];
  for (let i = 0; i < atGradeC; i++) {
    subjects.push({
      name: `Subject${i + 1}`,
      level: "a_level",
      grade: "C",
    });
  }
  for (let i = 0; i < belowC; i++) {
    subjects.push({
      name: `Subject${atGradeC + i + 1}`,
      level: "a_level",
      grade: "D",
    });
  }

  return {
    certificateType: "british",
    subjects,
    sat:
      form.hasSAT && form.satScore
        ? { state: "present", score: form.satScore }
        : { state: "not_provided" },
    languageCert:
      form.hasIelts && form.ieltsScore
        ? { state: "present", type: "IELTS", score: form.ieltsScore }
        : { state: "not_provided" },
    dynamicAnswers: form.dynamicAnswers,
  };
}
