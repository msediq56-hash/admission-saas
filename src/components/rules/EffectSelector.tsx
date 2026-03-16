"use client";

import { EFFECT_LABELS } from "./shared";

interface EffectSelectorProps {
  value: string;
  onChange: (value: string) => void;
  effectMessage: string | null;
  onEffectMessageChange: (message: string | null) => void;
}

export default function EffectSelector({ value, onChange, effectMessage, onEffectMessageChange }: EffectSelectorProps) {
  return (
    <div className="flex flex-wrap items-end gap-3">
      <div>
        <label className="block text-xs text-slate-400 mb-1">التأثير</label>
        <select
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="w-48 rounded-lg border border-white/10 bg-[#0f1c2e] px-3 py-2 text-sm text-white focus:border-blue-500 focus:outline-none"
        >
          {Object.entries(EFFECT_LABELS).map(([key, label]) => (
            <option key={key} value={key} className="bg-[#0f1c2e] text-white">
              {label}
            </option>
          ))}
        </select>
      </div>
      {value !== "none" && (
        <div className="flex-1 min-w-[200px]">
          <label className="block text-xs text-slate-400 mb-1">رسالة التأثير</label>
          <input
            type="text"
            value={effectMessage || ""}
            onChange={(e) => onEffectMessageChange(e.target.value || null)}
            placeholder="رسالة عند تفعيل هذا الشرط..."
            className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder-slate-500 focus:border-blue-500 focus:outline-none"
          />
        </div>
      )}
    </div>
  );
}
