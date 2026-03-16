"use client";

import type { RuleEditorProps } from "../shared";
import EffectSelector from "../EffectSelector";

const A_LEVEL_GRADES = ["A*", "A", "B", "C", "D", "E"];

export default function ALevelEditor({ config, effect, effectMessage, onChange, onEffectChange, onEffectMessageChange }: RuleEditorProps) {
  return (
    <div className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-3">
        <div>
          <label className="block text-xs text-slate-400 mb-1">عدد المواد المطلوبة</label>
          <input
            type="number"
            min="1"
            max="10"
            value={(config.subjects_min as number) ?? ""}
            onChange={(e) => onChange({ ...config, subjects_min: e.target.value ? Number(e.target.value) : null })}
            className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white focus:border-blue-500 focus:outline-none"
          />
        </div>
        <div>
          <label className="block text-xs text-slate-400 mb-1">أدنى درجة</label>
          <select
            value={(config.min_grade as string) || ""}
            onChange={(e) => onChange({ ...config, min_grade: e.target.value || null })}
            className="w-full rounded-lg border border-white/10 bg-[#0f1c2e] px-3 py-2 text-sm text-white focus:border-blue-500 focus:outline-none"
          >
            <option value="" className="bg-[#0f1c2e] text-white">—</option>
            {A_LEVEL_GRADES.map((g) => (
              <option key={g} value={g} className="bg-[#0f1c2e] text-white">{g}</option>
            ))}
          </select>
        </div>
        <div className="flex items-end">
          <label className="flex items-center gap-2 text-sm text-slate-300 cursor-pointer">
            <input
              type="checkbox"
              checked={(config.requires_core as boolean) || false}
              onChange={(e) => onChange({ ...config, requires_core: e.target.checked })}
              className="rounded border-white/20 bg-white/5 text-blue-600"
            />
            يحتاج مواد أساسية
          </label>
        </div>
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
