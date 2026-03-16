// ============================================================
// Pathway Matcher — tries pathways in order, returns result
// ============================================================

import type { BritishSubject, Pathway } from "../../types";
import { countSubjectsMeeting } from "./counting-logic";

export type PathwayFailureType = "count_fail" | "grade_fail";

export interface PathwayResult {
  passed: boolean;
  pathwayIndex: number;
  pathwayLabel?: string;
  failureType?: PathwayFailureType;
  details: Array<{
    level: string;
    required: number;
    minGrade?: string;
    totalAtLevel: number;
    meetingGrade: number;
    passed: boolean;
  }>;
}

export interface MatchResult {
  outcomeKey: "pass" | "count_fail" | "grade_fail";
  matchedPathway?: { index: number; label?: string };
  failedPathways: PathwayResult[];
}

/**
 * Try each pathway in order. If ANY pathway passes, the student passes.
 *
 * Failure classification:
 * - Within a pathway: mixed (count + grade) failures = count_fail
 * - Across pathways: if ANY pathway was pure grade_fail → overall grade_fail
 * - Otherwise → overall count_fail
 */
export function matchPathways(
  subjects: BritishSubject[],
  pathways: Pathway[]
): MatchResult {
  const failedPathways: PathwayResult[] = [];

  for (let i = 0; i < pathways.length; i++) {
    const pathway = pathways[i];
    const details: PathwayResult["details"] = [];
    let hasCountFail = false;
    let hasGradeFail = false;
    let allPassed = true;

    for (const req of pathway.requirements) {
      const count = countSubjectsMeeting(subjects, req.level, req.min_grade);
      const passed = count.meetingGrade >= req.min_count;

      details.push({
        level: req.level,
        required: req.min_count,
        minGrade: req.min_grade,
        totalAtLevel: count.totalAtLevel,
        meetingGrade: count.meetingGrade,
        passed,
      });

      if (!passed) {
        allPassed = false;
        if (count.totalAtLevel < req.min_count) {
          hasCountFail = true;
        } else {
          // totalAtLevel >= min_count but meetingGrade < min_count → pure grade issue
          hasGradeFail = true;
        }
      }
    }

    if (allPassed) {
      return {
        outcomeKey: "pass",
        matchedPathway: { index: i, label: pathway.label },
        failedPathways,
      };
    }

    // Determine pathway failure type:
    // mixed (count + grade) = count_fail; only grade = grade_fail; only count = count_fail
    let failureType: PathwayFailureType;
    if (hasCountFail) {
      failureType = "count_fail"; // count_fail or mixed = count_fail
    } else {
      failureType = "grade_fail"; // purely grade-based
    }

    failedPathways.push({
      passed: false,
      pathwayIndex: i,
      pathwayLabel: pathway.label,
      failureType,
      details,
    });
  }

  // All pathways failed. Determine overall failure type.
  // If any pathway was pure grade_fail → overall grade_fail
  const hasPureGradeFail = failedPathways.some(
    (p) => p.failureType === "grade_fail"
  );

  return {
    outcomeKey: hasPureGradeFail ? "grade_fail" : "count_fail",
    failedPathways,
  };
}
