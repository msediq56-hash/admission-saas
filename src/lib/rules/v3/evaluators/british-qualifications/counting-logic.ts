// ============================================================
// Counting Logic — counts subjects meeting level + grade criteria
// ============================================================

import type { BritishSubject } from "../../types";
import { isGradeAtLeast } from "./grade-normalizer";

export interface CountResult {
  /** Total subjects at this level */
  totalAtLevel: number;
  /** Subjects at this level meeting grade requirement */
  meetingGrade: number;
}

/**
 * Count how many of a student's subjects meet a specific requirement.
 *
 * @param subjects - Student's British subjects
 * @param level - Required level (a_level, as_level, o_level)
 * @param minGrade - Optional minimum grade. If omitted, all subjects at level count.
 */
export function countSubjectsMeeting(
  subjects: BritishSubject[],
  level: "a_level" | "as_level" | "o_level",
  minGrade?: string
): CountResult {
  const atLevel = subjects.filter((s) => s.level === level);
  const totalAtLevel = atLevel.length;

  if (!minGrade) {
    return { totalAtLevel, meetingGrade: totalAtLevel };
  }

  const meetingGrade = atLevel.filter((s) =>
    isGradeAtLeast(s.grade, minGrade, level)
  ).length;

  return { totalAtLevel, meetingGrade };
}
