// ============================================================
// V3.2 Profile Type Exports — Convenience re-exports + helpers
// NO Zod schemas defined here. All schemas are in schemas.ts.
// ============================================================

// Re-export profile-related TypeScript types from types.ts
export type {
  AssessmentProfileV3,
  BritishAssessmentProfile,
  ArabicAssessmentProfile,
  MasterAssessmentProfile,
  BritishSubject,
  SatField,
  LanguageCertField,
  GpaField,
  StudyTrack,
  PathwayRequirement,
  Pathway,
  BritishQualificationsConfig,
} from "./types";

// Re-export profile schemas from schemas.ts for validation
export {
  AssessmentProfileV3Schema,
  BritishAssessmentProfileSchema,
  ArabicAssessmentProfileSchema,
  MasterAssessmentProfileSchema,
  BritishSubjectSchema,
  SatFieldSchema,
  LanguageCertFieldSchema,
  GpaFieldSchema,
  StudyTrackSchema,
} from "./schemas";

// -----------------------------------------------------------
// Type guards
// -----------------------------------------------------------

import type {
  AssessmentProfileV3,
  BritishAssessmentProfile,
  ArabicAssessmentProfile,
  MasterAssessmentProfile,
} from "./types";

/** Type guard: is the profile a British certificate profile? */
export function isBritishProfile(
  profile: AssessmentProfileV3
): profile is BritishAssessmentProfile {
  return profile.certificateType === "british";
}

/** Type guard: is the profile an Arabic certificate profile? */
export function isArabicProfile(
  profile: AssessmentProfileV3
): profile is ArabicAssessmentProfile {
  return profile.certificateType === "arabic";
}

/** Type guard: is the profile a Master's / postgraduate profile? */
export function isMasterProfile(
  profile: AssessmentProfileV3
): profile is MasterAssessmentProfile {
  return profile.certificateType === "master";
}
