// ============================================================
// Grade Normalizer — level-aware British grade comparison
// ============================================================

type SubjectLevel = "a_level" | "as_level" | "o_level";

// A Level / AS Level grade map (same scale for both)
const A_LEVEL_GRADES: Record<string, number> = {
  "A*": 7,
  A: 6,
  B: 5,
  C: 4,
  D: 3,
  E: 2,
  U: 1,
};

// O Level / GCSE grade map — doubled scale for unique numeric ordering
// Numeric grades (each gets a unique rank):
//   9→18, 8→16, 7→14, 6→12, 5→10, 4→8, 3→6, 2→4, 1→2
// Letter grades (mapped to equivalent numeric positions):
//   A*→17, A→14, B→12, C→8, D→6, E→4, F→2, G→1
const O_LEVEL_GRADES: Record<string, number> = {
  "9": 18,
  "A*": 17,
  "8": 16,
  "7": 14,
  A: 14,
  "6": 12,
  B: 12,
  "5": 10,
  "4": 8,
  C: 8,
  "3": 6,
  D: 6,
  "2": 4,
  E: 4,
  "1": 2,
  F: 2,
  G: 1,
};

/**
 * Normalize a grade string to internal format:
 * - Case-insensitive
 * - Strip internal spaces (e.g. "A *" → "A*")
 */
function cleanGrade(grade: string): string {
  return grade.replace(/\s+/g, "").toUpperCase();
}

/**
 * Convert a grade string to a numeric rank for comparison.
 * Higher rank = better grade. Returns -1 for unrecognized grades.
 *
 * Grade normalization is LEVEL-AWARE:
 * - A/AS Level: letter grades only (A*, A, B, C, D, E, U)
 * - O Level/GCSE: both numeric (1-9) and letter grades
 */
export function normalizeGrade(grade: string, level: SubjectLevel): number {
  const cleaned = cleanGrade(grade);

  if (level === "a_level" || level === "as_level") {
    return A_LEVEL_GRADES[cleaned] ?? -1;
  }

  // o_level
  return O_LEVEL_GRADES[cleaned] ?? -1;
}

/**
 * Check if a student's grade meets or exceeds the required grade.
 * Both grades are compared using level-aware normalization.
 *
 * Returns false (not throws) if either grade is unrecognized —
 * this protects against invalid config data from DB.
 */
export function isGradeAtLeast(
  studentGrade: string,
  requiredGrade: string,
  level: SubjectLevel
): boolean {
  const studentRank = normalizeGrade(studentGrade, level);
  const requiredRank = normalizeGrade(requiredGrade, level);

  // If either grade is unrecognized, comparison fails
  if (studentRank === -1 || requiredRank === -1) return false;

  return studentRank >= requiredRank;
}
