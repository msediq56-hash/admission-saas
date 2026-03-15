// ============================================================
// Comparison Engine — evaluate a student profile against all programs
// ============================================================

import type { Requirement, CustomRequirement, ScholarshipTier } from "./evaluation-engine";

export interface StudentProfile {
  hasHighSchool: boolean;
  hasBachelor: boolean;
  has12Years: boolean;
  ielts: number | null;
  hasSAT: boolean;
  satScore: number | null;
  gpa: number | null;
  hasResearchPlan: boolean;
  certificateType: "arabic" | "british";
  aLevelCount: number | null;
  aLevelCCount: number | null;
  dynamicAnswers?: Record<string, string | boolean | number>;
}

export interface ComparisonResult {
  programId: string;
  programName: string;
  universityName: string;
  country: string;
  universityType: string;
  category: string;
  status: "positive" | "conditional" | "negative";
  reason: string;
  notes: string[];
  scholarshipInfo: string | null;
}

export interface ProgramEntry {
  programId: string;
  programName: string;
  universityName: string;
  country: string;
  universityType: string;
  category: string;
  certificateTypeSlug: string | null;
  requirements: Requirement;
  customRequirements: CustomRequirement[];
  scholarshipTiers: ScholarshipTier[];
}

// -----------------------------------------------------------
// Check if a program is a medical program
// -----------------------------------------------------------
export function isMedicalProgram(programName: string): boolean {
  return programName.includes("طبيات") || programName.includes("صيدلة");
}

// -----------------------------------------------------------
// Build a negative result helper
// -----------------------------------------------------------
function makeNegative(
  entry: ProgramEntry,
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

// -----------------------------------------------------------
// Evaluate a student profile against ONE program
// -----------------------------------------------------------
export function evaluateProfileAgainstProgram(
  profile: StudentProfile,
  entry: ProgramEntry
): ComparisonResult {
  const req = entry.requirements;
  const negatives: string[] = [];
  const conditions: string[] = [];
  const notes: string[] = [];
  let scholarshipInfo: string | null = null;

  const slug = entry.certificateTypeSlug;
  const isFoundation = entry.category === "foundation";

  // --- Certificate type filtering ---
  // null slug = universal requirements (apply to all cert types)
  // If slug is set, it must match the student's cert type
  if (slug !== null) {
    if (profile.certificateType === "arabic" && slug !== "arabic") {
      return makeNegative(entry, "هذا المسار مخصص لحاملي شهادة أخرى");
    }
    if (profile.certificateType === "british" && slug !== "british") {
      return makeNegative(entry, "هذا المسار مخصص لحاملي شهادة أخرى");
    }
  }

  // --- A Level checks (field-driven from requirements) ---
  if (req.requires_a_levels && profile.certificateType === "british") {
    const needed = req.a_level_subjects_min || 3;
    const aCount = profile.aLevelCount ?? 0;
    const aCCount = profile.aLevelCCount ?? 0;

    if (aCount < needed) {
      return makeNegative(entry, `غير مؤهل — يحتاج ${needed} مواد A Level`);
    }

    // Grade check: skip for foundation (foundation accepts any grade)
    if (req.a_level_min_grade && !isFoundation) {
      if (aCCount < needed) {
        negatives.push("درجات أقل من C — جرّب السنة التأسيسية");
      }
    }
  }

  // 1. High school
  if (req.requires_hs && !profile.hasHighSchool) {
    negatives.push("لا يملك شهادة ثانوية");
  }

  // 2. 12 years
  if (req.requires_12_years && !profile.has12Years) {
    negatives.push("لم يكمل 12 سنة دراسة");
  }

  // 3. Bachelor
  if (req.requires_bachelor && !profile.hasBachelor) {
    negatives.push("لا يملك شهادة بكالوريوس");
  }

  // 4 & 5. IELTS — fixed: "interview" effect is NOT blocking
  if (req.requires_ielts) {
    const effect = req.ielts_effect || "";

    if (effect.startsWith("interview")) {
      // Interview-based: NEVER blocks, only adds notes
      if (profile.ielts === null) {
        notes.push("سيتم ترتيب مقابلة لتقييم اللغة");
      } else if (req.ielts_min && profile.ielts < req.ielts_min) {
        notes.push(
          "يرجى عدم رفع شهادة اللغة مع ملف الطالب — سيتم ترتيب مقابلة لتقييم اللغة"
        );
      }
      // If IELTS >= min, no note needed
    } else if (effect === "blocks_if_below") {
      if (profile.ielts !== null) {
        if (req.ielts_min && profile.ielts < req.ielts_min) {
          negatives.push(
            `يحتاج IELTS بدرجة ${req.ielts_min} أو أعلى (الحالي: ${profile.ielts})`
          );
        }
      } else {
        negatives.push("لا يملك شهادة IELTS");
      }
    } else if (effect.startsWith("conditional")) {
      if (profile.ielts !== null) {
        if (req.ielts_min && profile.ielts < req.ielts_min) {
          conditions.push(effect.split(": ")[1] || effect);
        }
      } else {
        conditions.push(effect.split(": ")[1] || effect);
      }
    } else {
      // Unknown effect — treat as conditional
      if (profile.ielts === null || (req.ielts_min && profile.ielts < req.ielts_min)) {
        conditions.push(`يحتاج IELTS بدرجة ${req.ielts_min} أو أعلى`);
      }
    }
  }

  // 6. SAT
  if (req.requires_sat) {
    const satEffect = req.sat_effect || "";
    if (!profile.hasSAT || profile.satScore === null) {
      if (satEffect === "blocks_if_below") {
        negatives.push(`يحتاج SAT بدرجة ${req.sat_min} أو أعلى`);
      } else {
        conditions.push(
          satEffect.startsWith("conditional")
            ? satEffect.split(": ")[1] || satEffect
            : `يحتاج تقديم SAT بدرجة ${req.sat_min}+`
        );
      }
    } else if (req.sat_min && profile.satScore < req.sat_min) {
      if (satEffect === "blocks_if_below") {
        negatives.push(
          `يحتاج SAT بدرجة ${req.sat_min} أو أعلى (الحالي: ${profile.satScore})`
        );
      } else {
        conditions.push(
          satEffect.startsWith("conditional")
            ? satEffect.split(": ")[1] || satEffect
            : `يحتاج تقديم SAT بدرجة ${req.sat_min}+`
        );
      }
    }
  }

  // 7. Entrance exam
  if (req.requires_entrance_exam) {
    conditions.push("مشروط بامتحان القبول");
  }

  // 8. Portfolio
  if (req.requires_portfolio) {
    conditions.push("يحتاج تجهيز بورتفوليو");
  }

  // 9. Research plan
  if (req.requires_research_plan && !profile.hasResearchPlan) {
    conditions.push("يحتاج تجهيز خطة بحث");
  }

  // 10. GPA + scholarship tiers
  if (
    req.requires_gpa &&
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

  // 11. result_notes
  if (req.result_notes) {
    notes.push(req.result_notes);
  }

  // 12. Dynamic custom_requirements (show_in_comparison = true)
  if (entry.customRequirements && profile.dynamicAnswers) {
    for (const cr of entry.customRequirements) {
      if (!cr.show_in_comparison || !cr.comparison_key) continue;

      const answer = profile.dynamicAnswers[cr.comparison_key];

      if (cr.comparison_input_type === "toggle") {
        // Toggle: true = yes, false/undefined = no
        const isYes = answer === true;
        if (!isYes) {
          if (cr.effect === "blocks_admission") {
            negatives.push(cr.negative_message || cr.question_text);
          } else {
            conditions.push(cr.negative_message || cr.question_text);
          }
        }
      } else if (cr.comparison_input_type === "number") {
        // Number: has value = yes, no value = no
        const hasValue = answer !== undefined && answer !== null && answer !== "" && answer !== 0;
        if (!hasValue) {
          if (cr.effect === "blocks_admission") {
            negatives.push(cr.negative_message || cr.question_text);
          } else {
            conditions.push(cr.negative_message || cr.question_text);
          }
        }
      } else if (cr.comparison_input_type === "select") {
        // Select: apply option_effects if available, otherwise default effect
        const selectedOption = typeof answer === "string" ? answer : "";
        if (cr.option_effects && selectedOption && cr.option_effects[selectedOption]) {
          const oe = cr.option_effects[selectedOption];
          if (oe.effect === "blocks_admission") {
            negatives.push(oe.message || cr.negative_message || cr.question_text);
          } else if (oe.effect === "makes_conditional") {
            conditions.push(oe.message || cr.negative_message || cr.question_text);
          }
          // "none" → no effect
        } else if (!selectedOption) {
          // No selection made — apply default effect
          if (cr.effect === "blocks_admission") {
            negatives.push(cr.negative_message || cr.question_text);
          } else {
            conditions.push(cr.negative_message || cr.question_text);
          }
        }
      }
    }
  }

  // 13. Build final result
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
// Category hierarchy: foundation(0) < bachelor(1) < master(2) < phd(3)
// -----------------------------------------------------------
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

// -----------------------------------------------------------
// Smart cross-program suggestions within the same university
// -----------------------------------------------------------
function addCrossProgramSuggestions(results: ComparisonResult[]): void {
  // Group results by university
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

    // Build sets of eligible categories for quick lookup
    const eligibleByCategory = new Map<number, ComparisonResult[]>();
    for (const r of eligible) {
      const rank = getCategoryRank(r.category);
      if (rank < 0) continue;
      const arr = eligibleByCategory.get(rank) || [];
      arr.push(r);
      eligibleByCategory.set(rank, arr);
    }

    // 1. UPGRADE suggestions: eligible for lower tier → also eligible for higher?
    for (const r of eligible) {
      const rank = getCategoryRank(r.category);
      if (rank < 0) continue;

      // Check if eligible for any HIGHER tier in the same university
      for (const [higherRank, higherResults] of eligibleByCategory) {
        if (higherRank > rank && higherResults.length > 0) {
          const higherLabel = CATEGORY_LABELS[
            Object.keys(CATEGORY_RANK).find(
              (k) => CATEGORY_RANK[k] === higherRank
            )!
          ];
          if (higherLabel) {
            r.notes.push(
              `💡 الطالب مؤهل لـ${higherLabel} المباشر — يُنصح بمراجعة المسار`
            );
          }
          break; // Only suggest the next higher tier
        }
      }
    }

    // 2. DOWNGRADE suggestions: negative for a tier → suggest lower tier
    for (const r of negative) {
      const rank = getCategoryRank(r.category);
      if (rank < 0) continue;

      // Find eligible programs at a LOWER tier in the same university
      // Search from rank-1 down to 0
      for (let lowerRank = rank - 1; lowerRank >= 0; lowerRank--) {
        const lowerResults = eligibleByCategory.get(lowerRank);
        if (lowerResults && lowerResults.length > 0) {
          // Suggest up to 2 lower-tier programs
          const suggestions = lowerResults.slice(0, 2);
          for (const alt of suggestions) {
            r.notes.push(`💡 جرّب: ${alt.programName}`);
          }
          break; // Only suggest the nearest lower tier
        }
      }
    }
  }
}

// -----------------------------------------------------------
// Compare profile against ALL programs, then add suggestions
// -----------------------------------------------------------
export function compareAllPrograms(
  profile: StudentProfile,
  programs: ProgramEntry[]
): ComparisonResult[] {
  const results = programs.map((entry) =>
    evaluateProfileAgainstProgram(profile, entry)
  );

  // Add smart cross-program suggestions
  addCrossProgramSuggestions(results);

  // Sort: positive first, then conditional, then negative
  const order: Record<string, number> = {
    positive: 0,
    conditional: 1,
    negative: 2,
  };
  results.sort((a, b) => order[a.status] - order[b.status]);

  return results;
}
