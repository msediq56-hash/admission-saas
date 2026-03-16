"use client";

import type { RuleEditorProps } from "./shared";
import BooleanRuleEditor from "./editors/BooleanRuleEditor";
import LanguageCertEditor from "./editors/LanguageCertEditor";
import SatEditor from "./editors/SatEditor";
import GpaEditor from "./editors/GpaEditor";
import ALevelEditor from "./editors/ALevelEditor";
import ASLevelEditor from "./editors/ASLevelEditor";
import OLevelEditor from "./editors/OLevelEditor";
import CustomQuestionEditor from "./editors/CustomQuestionEditor";

type EditorComponent = React.ComponentType<RuleEditorProps>;

const RULE_EDITORS: Record<string, EditorComponent> = {
  high_school: BooleanRuleEditor,
  twelve_years: BooleanRuleEditor,
  language_cert: LanguageCertEditor,
  sat: SatEditor,
  gpa: GpaEditor,
  a_levels: ALevelEditor,
  as_levels: ASLevelEditor,
  o_levels: OLevelEditor,
  bachelor: BooleanRuleEditor,
  entrance_exam: BooleanRuleEditor,
  portfolio: BooleanRuleEditor,
  research_plan: BooleanRuleEditor,
  custom_yes_no: CustomQuestionEditor,
  custom_select: CustomQuestionEditor,
};

export function getRuleEditor(ruleType: string): EditorComponent | null {
  return RULE_EDITORS[ruleType] || null;
}
