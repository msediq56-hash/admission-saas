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

interface ProgramEntry {
  programId: string;
  programName: string;
  universityName: string;
  country: string;
  universityType: string;
  category: string;
  requirements: Requirement;
  customRequirements: CustomRequirement[];
  scholarshipTiers: ScholarshipTier[];
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

  // 4 & 5. IELTS
  if (req.requires_ielts) {
    const effect = req.ielts_effect || "";
    if (profile.ielts !== null) {
      // Has IELTS score — check if it meets minimum
      if (
        effect === "blocks_if_below" &&
        req.ielts_min &&
        profile.ielts < req.ielts_min
      ) {
        negatives.push(`يحتاج IELTS بدرجة ${req.ielts_min} أو أعلى (الحالي: ${profile.ielts})`);
      } else if (
        effect.startsWith("conditional") &&
        req.ielts_min &&
        profile.ielts < req.ielts_min
      ) {
        conditions.push(effect.split(": ")[1] || effect);
      }
    } else {
      // No IELTS
      if (effect === "blocks_if_below") {
        negatives.push("لا يملك شهادة IELTS");
      } else if (effect.startsWith("interview")) {
        conditions.push(
          effect.split(": ")[1] || "سيتم ترتيب مقابلة لتقييم اللغة"
        );
      } else if (effect.startsWith("conditional")) {
        conditions.push(effect.split(": ")[1] || effect);
      } else {
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

  // 12. Build final result
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
// Compare profile against ALL programs
// -----------------------------------------------------------
export function compareAllPrograms(
  profile: StudentProfile,
  programs: ProgramEntry[]
): ComparisonResult[] {
  const results = programs.map((entry) =>
    evaluateProfileAgainstProgram(profile, entry)
  );

  // Sort: positive first, then conditional, then negative
  const order: Record<string, number> = {
    positive: 0,
    conditional: 1,
    negative: 2,
  };
  results.sort((a, b) => order[a.status] - order[b.status]);

  return results;
}
