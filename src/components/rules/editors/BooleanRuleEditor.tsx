"use client";

import type { RuleEditorProps } from "../shared";
import EffectSelector from "../EffectSelector";

// Used for: high_school, twelve_years, bachelor, entrance_exam, portfolio, research_plan
// No config fields needed — just the effect selector
export default function BooleanRuleEditor({ effect, effectMessage, onEffectChange, onEffectMessageChange }: RuleEditorProps) {
  return (
    <EffectSelector
      value={effect}
      onChange={onEffectChange}
      effectMessage={effectMessage}
      onEffectMessageChange={onEffectMessageChange}
    />
  );
}
