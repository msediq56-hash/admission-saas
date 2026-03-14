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
  requirements: Requirement;
  customRequirements: CustomRequirement[];
  scholarshipTiers: ScholarshipTier[];
}

// -----------------------------------------------------------
// Check if a program is a "British certificate" program
// -----------------------------------------------------------
function isBritishProgram(programName: string): boolean {
  return programName.includes("بريطانية");
}

// -----------------------------------------------------------
// Check if a program is an "Arabic certificate" program
// (explicitly marked with عربية, or any non-British program)
// -----------------------------------------------------------
function isArabicOnlyProgram(programName: string): boolean {
  return programName.includes("عربية");
}

// -----------------------------------------------------------
// Check if a program is a foundation program
// -----------------------------------------------------------
function isFoundationProgram(category: string, programName: string): boolean {
  return category === "foundation" || programName.includes("تأسيسية");
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

  const programIsBritish = isBritishProgram(entry.programName);
  const programIsArabicOnly = isArabicOnlyProgram(entry.programName);
  const isFoundation = isFoundationProgram(entry.category, entry.programName);

  // --- Certificate type filtering ---
  // Arabic student → skip British-only programs
  if (profile.certificateType === "arabic" && programIsBritish) {
    return makeNegative(entry, "هذا المسار مخصص لحاملي الشهادة البريطانية");
  }
  // British student → skip Arabic-only programs
  if (profile.certificateType === "british" && programIsArabicOnly) {
    return makeNegative(entry, "هذا المسار مخصص لحاملي الشهادات العربية");
  }
  // British student → skip non-British programs (those without بريطانية and not generic)
  if (profile.certificateType === "british" && !programIsBritish) {
    return makeNegative(entry, "هذا المسار مخصص لحاملي الشهادات العربية");
  }

  // --- A Level checks for British certificate programs ---
  if (profile.certificateType === "british" && programIsBritish) {
    const aCount = profile.aLevelCount ?? 0;
    const aCCount = profile.aLevelCCount ?? 0;

    // All British programs require 3 A Levels
    if (aCount < 3) {
      return makeNegative(entry, "غير مؤهل — يحتاج 3 مواد A Level");
    }

    // For bachelor (non-foundation): require 3 C+ grades
    if (!isFoundation) {
      if (aCCount < 3) {
        negatives.push("درجات أقل من C — جرّب السنة التأسيسية");
      }
    }
    // Foundation: 3 A Levels is enough, no C grade requirement
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
// Compare profile against ALL programs, then add suggestions
// -----------------------------------------------------------
export function compareAllPrograms(
  profile: StudentProfile,
  programs: ProgramEntry[]
): ComparisonResult[] {
  const results = programs.map((entry) =>
    evaluateProfileAgainstProgram(profile, entry)
  );

  // For negative results, suggest alternatives from the same university
  // Group positive/conditional results by university
  const eligibleByUni = new Map<string, ComparisonResult[]>();
  for (const r of results) {
    if (r.status === "positive" || r.status === "conditional") {
      const arr = eligibleByUni.get(r.universityName) || [];
      arr.push(r);
      eligibleByUni.set(r.universityName, arr);
    }
  }

  for (const r of results) {
    if (r.status === "negative") {
      const alternatives = eligibleByUni.get(r.universityName);
      if (alternatives && alternatives.length > 0) {
        // Pick up to 2 suggestions, prefer different program from the negative one
        const suggestions = alternatives
          .filter((alt) => alt.programId !== r.programId)
          .slice(0, 2)
          .map((alt) => alt.programName);
        for (const name of suggestions) {
          r.notes.push(`💡 جرّب: ${name}`);
        }
      }
    }
  }

  // Sort: positive first, then conditional, then negative
  const order: Record<string, number> = {
    positive: 0,
    conditional: 1,
    negative: 2,
  };
  results.sort((a, b) => order[a.status] - order[b.status]);

  return results;
}
