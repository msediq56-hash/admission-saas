// ============================================================
// V3.2 Evaluator Registry
// ============================================================

import type { RuleEvaluatorV3 } from "../types";

const registryV3 = new Map<string, RuleEvaluatorV3>();

export function registerEvaluatorV3(evaluator: RuleEvaluatorV3): void {
  registryV3.set(evaluator.ruleType, evaluator);
}

export function getEvaluatorV3(ruleType: string): RuleEvaluatorV3 | undefined {
  return registryV3.get(ruleType);
}

// --- Register all evaluators ---
import { highSchoolEvaluatorV3 } from "./high-school";
import { twelveYearsEvaluatorV3 } from "./twelve-years";
import { bachelorEvaluatorV3 } from "./bachelor";
import { languageCertEvaluatorV3 } from "./language-cert";
import { satEvaluatorV3 } from "./sat";
import { gpaEvaluatorV3 } from "./gpa";
import { entranceExamEvaluatorV3 } from "./entrance-exam";
import { portfolioEvaluatorV3 } from "./portfolio";
import { researchPlanEvaluatorV3 } from "./research-plan";
import { studyTrackEvaluatorV3 } from "./study-track";

registerEvaluatorV3(highSchoolEvaluatorV3);
registerEvaluatorV3(twelveYearsEvaluatorV3);
registerEvaluatorV3(bachelorEvaluatorV3);
registerEvaluatorV3(languageCertEvaluatorV3);
registerEvaluatorV3(satEvaluatorV3);
registerEvaluatorV3(gpaEvaluatorV3);
registerEvaluatorV3(entranceExamEvaluatorV3);
registerEvaluatorV3(portfolioEvaluatorV3);
registerEvaluatorV3(researchPlanEvaluatorV3);
registerEvaluatorV3(studyTrackEvaluatorV3);
