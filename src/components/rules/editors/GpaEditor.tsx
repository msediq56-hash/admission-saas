"use client";

import type { RuleEditorProps } from "../shared";
import EffectSelector from "../EffectSelector";

export default function GpaEditor({ config, effect, effectMessage, onChange, onEffectChange, onEffectMessageChange }: RuleEditorProps) {
  return (
    <div className="space-y-3">
      <div>
        <label className="block text-xs text-slate-400 mb-1">الحد الأدنى للمعدل</label>
        <input
          type="number"
          step="0.01"
          value={(config.min_gpa as number) ?? ""}
          onChange={(e) => onChange({ ...config, min_gpa: e.target.value ? Number(e.target.value) : null })}
          className="w-40 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white focus:border-blue-500 focus:outline-none"
        />
      </div>
      <EffectSelector
        value={effect}
        onChange={onEffectChange}
        effectMessage={effectMessage}
        onEffectMessageChange={onEffectMessageChange}
      />
    </div>
  );
}
