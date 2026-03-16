"use client";

import { RULE_TYPE_LABELS, EFFECT_LABELS, EFFECT_COLORS } from "./shared";
import { getRuleEditor } from "./RuleEditorRegistry";

export interface RuleData {
  id?: string;
  rule_type: string;
  config: Record<string, unknown>;
  effect: string;
  effect_message: string | null;
  sort_order: number;
  is_enabled: boolean;
}

interface RuleCardProps {
  rule: RuleData;
  onChange: (updated: RuleData) => void;
  onRemove: () => void;
}

export default function RuleCard({ rule, onChange, onRemove }: RuleCardProps) {
  const Editor = getRuleEditor(rule.rule_type);
  const typeLabel = RULE_TYPE_LABELS[rule.rule_type] || rule.rule_type;
  const effectLabel = EFFECT_LABELS[rule.effect] || rule.effect;
  const effectColor = EFFECT_COLORS[rule.effect] || EFFECT_COLORS.none;

  return (
    <div className="rounded-lg border border-white/10 bg-white/[0.03] p-4 space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h3 className="text-sm font-medium text-white">{typeLabel}</h3>
          <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-medium ${effectColor}`}>
            {effectLabel}
          </span>
        </div>
        <button
          type="button"
          onClick={onRemove}
          className="text-xs text-red-400/60 hover:text-red-400 transition px-2 py-1"
          title="حذف الشرط"
        >
          ✕
        </button>
      </div>

      {/* Editor */}
      {Editor && (
        <Editor
          config={rule.config}
          effect={rule.effect}
          effectMessage={rule.effect_message}
          onChange={(config) => onChange({ ...rule, config })}
          onEffectChange={(effect) => onChange({ ...rule, effect })}
          onEffectMessageChange={(effect_message) => onChange({ ...rule, effect_message })}
        />
      )}
    </div>
  );
}
