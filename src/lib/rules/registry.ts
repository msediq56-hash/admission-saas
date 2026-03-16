// ============================================================
// Rule Registry — pluggable evaluator registration
// Maps rule_type strings to their evaluator implementations
// ============================================================

import type { RuleEvaluator, RuleType } from "./types";
import { highSchoolEvaluator, twelveYearsEvaluator } from "./evaluators/high-school";
import { languageCertEvaluator } from "./evaluators/language-cert";
import { satEvaluator } from "./evaluators/sat";
import { gpaEvaluator } from "./evaluators/gpa";
import {
  bachelorEvaluator,
  entranceExamEvaluator,
  portfolioEvaluator,
  researchPlanEvaluator,
} from "./evaluators/simple-boolean";
import {
  aLevelsEvaluator,
  asLevelsEvaluator,
  oLevelsEvaluator,
} from "./evaluators/british-certs";
import { customYesNoEvaluator, customSelectEvaluator } from "./evaluators/custom";

// -----------------------------------------------------------
// Registry singleton
// -----------------------------------------------------------

const registry = new Map<RuleType, RuleEvaluator<unknown>>();

/**
 * Register an evaluator for a rule type.
 * Overwrites any existing evaluator for that type.
 */
export function registerEvaluator(evaluator: RuleEvaluator<unknown>): void {
  registry.set(evaluator.ruleType, evaluator);
}

/**
 * Get the evaluator for a given rule type.
 * Returns undefined if no evaluator is registered.
 */
export function getEvaluator(ruleType: RuleType): RuleEvaluator<unknown> | undefined {
  return registry.get(ruleType);
}

/**
 * Check if an evaluator is registered for a rule type.
 */
export function hasEvaluator(ruleType: RuleType): boolean {
  return registry.has(ruleType);
}

/**
 * Get all registered rule types.
 */
export function getRegisteredTypes(): RuleType[] {
  return Array.from(registry.keys());
}

// -----------------------------------------------------------
// Register all built-in evaluators
// -----------------------------------------------------------

function registerBuiltins(): void {
  registerEvaluator(highSchoolEvaluator as RuleEvaluator<unknown>);
  registerEvaluator(twelveYearsEvaluator as RuleEvaluator<unknown>);
  registerEvaluator(languageCertEvaluator as RuleEvaluator<unknown>);
  registerEvaluator(satEvaluator as RuleEvaluator<unknown>);
  registerEvaluator(gpaEvaluator as RuleEvaluator<unknown>);
  registerEvaluator(bachelorEvaluator as RuleEvaluator<unknown>);
  registerEvaluator(entranceExamEvaluator as RuleEvaluator<unknown>);
  registerEvaluator(portfolioEvaluator as RuleEvaluator<unknown>);
  registerEvaluator(researchPlanEvaluator as RuleEvaluator<unknown>);
  registerEvaluator(aLevelsEvaluator as RuleEvaluator<unknown>);
  registerEvaluator(asLevelsEvaluator as RuleEvaluator<unknown>);
  registerEvaluator(oLevelsEvaluator as RuleEvaluator<unknown>);
  registerEvaluator(customYesNoEvaluator as RuleEvaluator<unknown>);
  registerEvaluator(customSelectEvaluator as RuleEvaluator<unknown>);
}

// Auto-register on import
registerBuiltins();
