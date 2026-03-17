// ============================================================
// Rule-based Comparison Engine — evaluates a student profile
// against requirement_rules for all programs.
// Replaces the old evaluateProfileAgainstProgram() from
// comparison-engine.ts (which stays for reference / tests).
// ============================================================

import type { RequirementRule } from "./types";
import type { ScholarshipTier, CustomRequirement } from "../evaluation-engine";
import type { StudentProfile, ComparisonResult } from "../comparison-engine";

// -----------------------------------------------------------
// Program entry for rule-based comparison
// -----------------------------------------------------------

export interface RuleProgramEntry {
  programId: string;
  programName: string;
  universityName: string;
  country: string;
  universityType: string;
  category: string;
  certificateTypeSlug: string | null;
  rules: RequirementRule[];
  scholarshipTiers: ScholarshipTier[];
  /** Custom requirements still loaded from old table for comparison dynamic fields */
  customRequirements: CustomRequirement[];
}

// -----------------------------------------------------------
// Helpers
// -----------------------------------------------------------

function makeNegative(
  entry: RuleProgramEntry,
  reason: string,
  notes: string[] = []
): ComparisonResult {
  return {
    programId: entry.programId,
    programName: entry.programName,
    universityName: entry.universityName,
    country: entry.country,
    universityType: entry.universityType,
    category: entry.category,
    status: "negative",
    reason,
    notes,
    scholarshipInfo: null,
  };
}

/**
 * Extract accepted certs from language_cert config.
 * Handles both formats:
 *   1. { accepted: [{ type, min_score }] }   (admin UI)
 *   2. { cert_type, min_score, alternatives } (migration)
 */
function getAcceptedCerts(
  config: Record<string, unknown>
): Array<{ type: string; min_score: number }> {
  if (Array.isArray(config.accepted) && config.accepted.length > 0) {
    return config.accepted as Array<{ type: string; min_score: number }>;
  }
  const certs: Array<{ type: string; min_score: number }> = [];
  if (config.min_score !== undefined && config.min_score !== null) {
    certs.push({
      type: String(config.cert_type || "IELTS").toUpperCase(),
      min_score: Number(config.min_score),
    });
  }
  if (config.alternatives && typeof config.alternatives === "object") {
    for (const [type, min] of Object.entries(
      config.alternatives as Record<string, number>
    )) {
      certs.push({ type: type.toUpperCase(), min_score: min });
    }
  }
  return certs;
}

// -----------------------------------------------------------
// Evaluate a student profile against ONE program's rules
// -----------------------------------------------------------

export function evaluateProfileWithRules(
  profile: StudentProfile,
  entry: RuleProgramEntry
): ComparisonResult {
  const negatives: string[] = [];
  const conditions: string[] = [];
  const notes: string[] = [];
  let scholarshipInfo: string | null = null;

  const slug = entry.certificateTypeSlug;
  const isFoundation = entry.category === "foundation";

  // --- Certificate type filtering ---
  if (slug !== null && slug !== profile.certificateType) {
    return makeNegative(entry, "هذا المسار مخصص لحاملي شهادة أخرى");
  }

  // Sort rules by sort_order
  const activeRules = entry.rules
    .filter((r) => r.is_enabled)
    .sort((a, b) => a.sort_order - b.sort_order);

  for (const rule of activeRules) {
    const cfg = rule.config;

    switch (rule.rule_type) {
      // --- A Levels (process before high school for British) ---
      case "a_levels": {
        if (profile.certificateType !== "british") break;
        const aCount = profile.aLevelCount ?? 0;
        const aCCount = profile.aLevelCCount ?? 0;

        // Count check — only if subjects_min is specified
        const needed = cfg.subjects_min as number | undefined;
        if (needed && aCount < needed) {
          if (rule.effect === "blocks_admission") {
            return makeNegative(
              entry,
              rule.effect_message ||
                `غير مؤهل — يحتاج ${needed} مواد A Level`
            );
          } else {
            negatives.push(
              rule.effect_message ||
                `يحتاج ${needed} مواد A Level`
            );
          }
        }
        // Grade check — only if min_grade is specified, skip for foundation
        if (cfg.min_grade && !isFoundation) {
          const requiredGradeCount = needed || (aCount || 3);
          if (aCCount < requiredGradeCount) {
            if (rule.effect === "blocks_admission") {
              return makeNegative(
                entry,
                rule.effect_message ||
                  `درجات أقل من ${cfg.min_grade}`
              );
            } else {
              negatives.push(
                rule.effect_message ||
                  `درجات أقل من ${cfg.min_grade} — جرّب السنة التأسيسية`
              );
            }
          }
        }
        break;
      }

      case "as_levels": {
        if (profile.certificateType !== "british") break;
        const needed = (cfg.subjects_min as number) || 3;
        const asCount = profile.asLevelCount ?? 0;
        if (asCount < needed) {
          negatives.push(
            rule.effect_message ||
              `غير مؤهل — يحتاج ${needed} مواد AS Level`
          );
        }
        break;
      }

      case "o_levels": {
        if (profile.certificateType !== "british") break;
        const needed = (cfg.subjects_min as number) || 5;
        const oCount = profile.oLevelCount ?? 0;
        if (oCount < needed) {
          negatives.push(
            rule.effect_message ||
              `غير مؤهل — يحتاج ${needed} مواد O Level / GCSE`
          );
        }
        break;
      }

      // --- High school (skip for British cert programs) ---
      case "high_school": {
        if (!profile.hasHighSchool) {
          const isBritishPath =
            profile.certificateType === "british" && slug === "british";
          if (!isBritishPath) {
            if (rule.effect === "blocks_admission") {
              negatives.push(
                rule.effect_message || "لا يملك شهادة ثانوية"
              );
            } else {
              conditions.push(
                rule.effect_message || "لا يملك شهادة ثانوية"
              );
            }
          }
        }
        break;
      }

      case "twelve_years": {
        if (!profile.has12Years) {
          if (rule.effect === "blocks_admission") {
            negatives.push(
              rule.effect_message || "لم يكمل 12 سنة دراسة"
            );
          } else {
            conditions.push(
              rule.effect_message || "لم يكمل 12 سنة دراسة"
            );
          }
        }
        break;
      }

      case "bachelor": {
        if (!profile.hasBachelor) {
          if (rule.effect === "blocks_admission") {
            negatives.push(
              rule.effect_message || "لا يملك شهادة بكالوريوس"
            );
          } else {
            conditions.push(
              rule.effect_message || "لا يملك شهادة بكالوريوس"
            );
          }
        }
        break;
      }

      // --- Language certificate ---
      case "language_cert": {
        const accepted = getAcceptedCerts(cfg);
        const isInterview =
          rule.effect === "makes_conditional" &&
          rule.effect_message?.includes("مقابلة");
        const isBlocking = rule.effect === "blocks_admission";

        // Find the student's cert match
        let studentMeetsCert = false;

        // Check IELTS (most common — mapped from profile.ielts)
        if (profile.ielts !== null) {
          const ieltsCert = accepted.find(
            (c) =>
              c.type === "IELTS" ||
              c.type === "ielts" ||
              c.type.toLowerCase() === "ielts"
          );
          if (ieltsCert && profile.ielts >= ieltsCert.min_score) {
            studentMeetsCert = true;
          }
        }

        // Check specific language cert type
        if (
          !studentMeetsCert &&
          profile.hasLanguageCert &&
          profile.languageCertType &&
          profile.languageCertScore !== null &&
          profile.languageCertScore !== undefined
        ) {
          const matchedCert = accepted.find(
            (c) =>
              c.type.toLowerCase() === profile.languageCertType!.toLowerCase()
          );
          if (matchedCert && profile.languageCertScore >= matchedCert.min_score) {
            studentMeetsCert = true;
          }
        }

        if (studentMeetsCert) {
          // Passed — no action needed
        } else if (isInterview) {
          // Interview: never blocks
          if (profile.ielts === null && !profile.hasLanguageCert) {
            notes.push(
              rule.effect_message ||
                "سيتم ترتيب مقابلة لتقييم اللغة"
            );
          } else {
            notes.push(
              rule.effect_message ||
                "يرجى عدم رفع شهادة اللغة مع ملف الطالب — سيتم ترتيب مقابلة لتقييم اللغة"
            );
          }
        } else if (isBlocking) {
          if (profile.ielts === null && !profile.hasLanguageCert) {
            negatives.push(
              rule.effect_message || "لا يملك شهادة لغة إنجليزية"
            );
          } else {
            // Has cert but doesn't meet minimum
            const certInfo = accepted[0];
            if (certInfo) {
              const currentScore =
                profile.ielts ??
                profile.languageCertScore ??
                0;
              negatives.push(
                rule.effect_message ||
                  `يحتاج ${certInfo.type} بدرجة ${certInfo.min_score} أو أعلى (الحالي: ${currentScore})`
              );
            } else {
              negatives.push(
                rule.effect_message || "لا يملك شهادة لغة إنجليزية"
              );
            }
          }
        } else {
          // Conditional
          conditions.push(
            rule.effect_message || "يحتاج شهادة لغة إنجليزية"
          );
        }
        break;
      }

      // --- SAT ---
      case "sat": {
        const satMin = (cfg.min_score as number) || 0;
        const defaultMsg = `يحتاج SAT بدرجة ${satMin} أو أعلى`;

        if (!profile.hasSAT || profile.satScore === null) {
          if (rule.effect === "blocks_admission") {
            negatives.push(rule.effect_message || defaultMsg);
          } else {
            conditions.push(rule.effect_message || defaultMsg);
          }
        } else if (profile.satScore < satMin) {
          if (rule.effect === "blocks_admission") {
            negatives.push(
              rule.effect_message ||
                `يحتاج SAT بدرجة ${satMin} أو أعلى (الحالي: ${profile.satScore})`
            );
          } else {
            conditions.push(rule.effect_message || defaultMsg);
          }
        }
        break;
      }

      // --- GPA + scholarship ---
      case "gpa": {
        if (
          profile.gpa !== null &&
          entry.scholarshipTiers.length > 0
        ) {
          const sorted = [...entry.scholarshipTiers].sort(
            (a, b) => a.sort_order - b.sort_order
          );
          const tier = sorted.find(
            (t) => profile.gpa! >= t.min_gpa && profile.gpa! <= t.max_gpa
          );
          if (tier) {
            scholarshipInfo = tier.label
              ? `منحة: ${tier.label} (${tier.scholarship_percent}%)`
              : `منحة: ${tier.scholarship_percent}%`;
          }
        }
        break;
      }

      // --- Entrance exam ---
      case "entrance_exam":
        conditions.push(
          rule.effect_message || "مشروط بامتحان القبول"
        );
        break;

      // --- Portfolio ---
      case "portfolio":
        conditions.push(rule.effect_message || "يحتاج تجهيز بورتفوليو");
        break;

      // --- Research plan ---
      case "research_plan": {
        if (!profile.hasResearchPlan) {
          if (rule.effect === "blocks_admission") {
            negatives.push(
              rule.effect_message || "يحتاج تجهيز خطة بحث"
            );
          } else {
            conditions.push(
              rule.effect_message || "يحتاج تجهيز خطة بحث"
            );
          }
        }
        break;
      }

      // --- IB ---
      case "ib": {
        // IB evaluation — check dynamicAnswers or treat as conditional
        // since profile doesn't have explicit IB fields
        const minPoints = (cfg.min_points as number) || 0;
        if (rule.effect === "blocks_admission") {
          // Without IB score in profile, treat as needing info
          conditions.push(
            rule.effect_message ||
              `يحتاج ${minPoints} نقطة IB أو أعلى`
          );
        } else {
          conditions.push(
            rule.effect_message ||
              `يحتاج ${minPoints} نقطة IB أو أعلى`
          );
        }
        break;
      }

      // --- Custom yes/no ---
      case "custom_yes_no": {
        const cr = entry.customRequirements.find(
          (c) =>
            c.question_text === (cfg.question_text as string) &&
            c.show_in_comparison &&
            c.comparison_key
        );
        if (cr && profile.dynamicAnswers) {
          const answer = profile.dynamicAnswers[cr.comparison_key!];
          if (cr.comparison_input_type === "toggle") {
            const isYes = answer === true;
            if (!isYes) {
              if (rule.effect === "blocks_admission") {
                negatives.push(
                  (cfg.negative_message as string) ||
                    rule.effect_message ||
                    (cfg.question_text as string)
                );
              } else {
                conditions.push(
                  (cfg.negative_message as string) ||
                    rule.effect_message ||
                    (cfg.question_text as string)
                );
              }
            }
          } else if (cr.comparison_input_type === "number") {
            const hasValue =
              answer !== undefined &&
              answer !== null &&
              answer !== "" &&
              answer !== 0;
            if (!hasValue) {
              if (rule.effect === "blocks_admission") {
                negatives.push(
                  (cfg.negative_message as string) ||
                    rule.effect_message ||
                    (cfg.question_text as string)
                );
              } else {
                conditions.push(
                  (cfg.negative_message as string) ||
                    rule.effect_message ||
                    (cfg.question_text as string)
                );
              }
            }
          }
        }
        break;
      }

      // --- Custom select ---
      case "custom_select": {
        const crSelect = entry.customRequirements.find(
          (c) =>
            c.question_text === (cfg.question_text as string) &&
            c.show_in_comparison &&
            c.comparison_key
        );
        if (crSelect && profile.dynamicAnswers) {
          const answer = profile.dynamicAnswers[crSelect.comparison_key!];
          const selectedOption =
            typeof answer === "string" ? answer : "";
          const optionEffects = cfg.option_effects as Record<
            string,
            { effect: string; message: string | null }
          > | null;

          if (
            optionEffects &&
            selectedOption &&
            optionEffects[selectedOption]
          ) {
            const oe = optionEffects[selectedOption];
            if (oe.effect === "blocks_admission") {
              negatives.push(
                oe.message ||
                  (cfg.negative_message as string) ||
                  (cfg.question_text as string)
              );
            } else if (oe.effect === "makes_conditional") {
              conditions.push(
                oe.message ||
                  (cfg.negative_message as string) ||
                  (cfg.question_text as string)
              );
            }
            // "none" → no effect
          } else if (!selectedOption) {
            if (rule.effect === "blocks_admission") {
              negatives.push(
                (cfg.negative_message as string) ||
                  rule.effect_message ||
                  (cfg.question_text as string)
              );
            } else {
              conditions.push(
                (cfg.negative_message as string) ||
                  rule.effect_message ||
                  (cfg.question_text as string)
              );
            }
          }
        }
        break;
      }
    }
  }

  // Build final result
  const base = {
    programId: entry.programId,
    programName: entry.programName,
    universityName: entry.universityName,
    country: entry.country,
    universityType: entry.universityType,
    category: entry.category,
    notes,
    scholarshipInfo,
  };

  if (negatives.length > 0) {
    return { ...base, status: "negative", reason: negatives[0] };
  }

  if (conditions.length > 0) {
    return {
      ...base,
      status: "conditional",
      reason: conditions.join(" — "),
    };
  }

  return {
    ...base,
    status: "positive",
    reason: "الطالب مؤهل للقبول في هذا البرنامج",
  };
}

// -----------------------------------------------------------
// Compare profile against ALL programs (rule-based)
// -----------------------------------------------------------

// Re-use cross-program suggestion logic from old engine
const CATEGORY_RANK: Record<string, number> = {
  foundation: 0,
  bachelor: 1,
  master: 2,
  phd: 3,
};

function getCategoryRank(category: string): number {
  return CATEGORY_RANK[category] ?? -1;
}

const CATEGORY_LABELS: Record<string, string> = {
  foundation: "الفاونديشن",
  bachelor: "البكالوريوس",
  master: "الماجستير",
  phd: "الدكتوراة",
};

function addCrossProgramSuggestions(results: ComparisonResult[]): void {
  const byUni = new Map<string, ComparisonResult[]>();
  for (const r of results) {
    const arr = byUni.get(r.universityName) || [];
    arr.push(r);
    byUni.set(r.universityName, arr);
  }

  for (const [, uniResults] of byUni) {
    const eligible = uniResults.filter(
      (r) => r.status === "positive" || r.status === "conditional"
    );
    const negative = uniResults.filter((r) => r.status === "negative");

    const eligibleByCategory = new Map<number, ComparisonResult[]>();
    for (const r of eligible) {
      const rank = getCategoryRank(r.category);
      if (rank < 0) continue;
      const arr = eligibleByCategory.get(rank) || [];
      arr.push(r);
      eligibleByCategory.set(rank, arr);
    }

    // Upgrade suggestions
    for (const r of eligible) {
      const rank = getCategoryRank(r.category);
      if (rank < 0) continue;
      for (const [higherRank, higherResults] of eligibleByCategory) {
        if (higherRank > rank && higherResults.length > 0) {
          const higherLabel =
            CATEGORY_LABELS[
              Object.keys(CATEGORY_RANK).find(
                (k) => CATEGORY_RANK[k] === higherRank
              )!
            ];
          if (higherLabel) {
            r.notes.push(
              `💡 الطالب مؤهل لـ${higherLabel} المباشر — يُنصح بمراجعة المسار`
            );
          }
          break;
        }
      }
    }

    // Downgrade suggestions
    for (const r of negative) {
      const rank = getCategoryRank(r.category);
      if (rank < 0) continue;
      for (let lowerRank = rank - 1; lowerRank >= 0; lowerRank--) {
        const lowerResults = eligibleByCategory.get(lowerRank);
        if (lowerResults && lowerResults.length > 0) {
          const suggestions = lowerResults.slice(0, 2);
          for (const alt of suggestions) {
            r.notes.push(`💡 جرّب: ${alt.programName}`);
          }
          break;
        }
      }
    }
  }
}

/**
 * Evaluate all programs and return raw results WITHOUT post-processing.
 * Use this when you need to merge with V3 results before applying
 * cross-program suggestions and sorting.
 */
export function compareProgramsRaw(
  profile: StudentProfile,
  programs: RuleProgramEntry[]
): ComparisonResult[] {
  return programs.map((entry) => evaluateProfileWithRules(profile, entry));
}

/**
 * Apply cross-program suggestions and sort results.
 * Run this ONCE on the full merged list (V3 + fallback).
 */
export function postProcessComparisonResults(
  results: ComparisonResult[]
): ComparisonResult[] {
  addCrossProgramSuggestions(results);

  const order: Record<string, number> = {
    positive: 0,
    conditional: 1,
    negative: 2,
  };
  results.sort((a, b) => order[a.status] - order[b.status]);

  return results;
}

export function compareAllProgramsWithRules(
  profile: StudentProfile,
  programs: RuleProgramEntry[]
): ComparisonResult[] {
  const results = compareProgramsRaw(profile, programs);
  return postProcessComparisonResults(results);
}
