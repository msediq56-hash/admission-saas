"use client";

import type { RuleEditorProps } from "../shared";
import EffectSelector from "../EffectSelector";
import { EFFECT_LABELS } from "../shared";

interface OptionEffect {
  effect: string;
  message: string | null;
}

export default function CustomQuestionEditor({ config, effect, effectMessage, onChange, onEffectChange, onEffectMessageChange }: RuleEditorProps) {
  const questionText = (config.question_text as string) || "";
  const questionType = (config.question_type as string) || "yes_no";
  const options = (config.options as string[]) || [];
  const optionEffects = (config.option_effects as Record<string, OptionEffect>) || {};
  const negativeMessage = (config.negative_message as string) || "";
  const positiveMessage = (config.positive_message as string) || "";

  function update(patch: Record<string, unknown>) {
    onChange({ ...config, ...patch });
  }

  function addOption() {
    update({ options: [...options, ""] });
  }

  function removeOption(idx: number) {
    const removed = options[idx];
    const newOpts = options.filter((_, i) => i !== idx);
    const newOe = { ...optionEffects };
    if (removed && removed in newOe) delete newOe[removed];
    update({ options: newOpts, option_effects: Object.keys(newOe).length > 0 ? newOe : {} });
  }

  function updateOption(idx: number, value: string) {
    const oldLabel = options[idx];
    const newOpts = [...options];
    newOpts[idx] = value;
    const newOe = { ...optionEffects };
    if (oldLabel && oldLabel in newOe) {
      newOe[value] = newOe[oldLabel];
      delete newOe[oldLabel];
    }
    update({ options: newOpts, option_effects: newOe });
  }

  function updateOptionEffect(optLabel: string, field: "effect" | "message", value: string) {
    const newOe = { ...optionEffects };
    const current = newOe[optLabel] || { effect: "none", message: null };
    if (field === "effect") {
      newOe[optLabel] = { ...current, effect: value, message: value === "none" ? null : current.message };
    } else {
      newOe[optLabel] = { ...current, message: value || null };
    }
    update({ option_effects: newOe });
  }

  return (
    <div className="space-y-3">
      <div>
        <label className="block text-xs text-slate-400 mb-1">نص السؤال</label>
        <input
          type="text"
          value={questionText}
          onChange={(e) => update({ question_text: e.target.value })}
          className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white focus:border-blue-500 focus:outline-none"
        />
      </div>

      {questionType === "select" && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <label className="text-xs font-medium text-slate-400">الخيارات</label>
            <button type="button" onClick={addOption} className="text-xs text-blue-400 hover:text-blue-300">
              + إضافة خيار
            </button>
          </div>
          {options.map((opt, idx) => (
            <div key={idx} className="flex items-center gap-2">
              <input
                type="text"
                value={opt}
                onChange={(e) => updateOption(idx, e.target.value)}
                placeholder={`خيار ${idx + 1}`}
                className="flex-1 rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-sm text-white focus:border-blue-500 focus:outline-none"
              />
              <button type="button" onClick={() => removeOption(idx)} className="text-xs text-red-400 hover:text-red-300">
                حذف
              </button>
            </div>
          ))}

          {/* Per-option effects */}
          {options.length > 0 && options.some((o) => o) && (
            <div className="rounded-lg border border-white/5 bg-white/[0.02] p-3 space-y-2">
              <label className="text-xs font-medium text-slate-400">تأثيرات مخصصة لكل خيار</label>
              {options.map((opt) => {
                if (!opt) return null;
                const oe = optionEffects[opt] || { effect: "none", message: null };
                return (
                  <div key={opt} className="flex items-start gap-2">
                    <span className="mt-1.5 min-w-[100px] text-xs text-slate-300 truncate">{opt}</span>
                    <select
                      value={oe.effect}
                      onChange={(e) => updateOptionEffect(opt, "effect", e.target.value)}
                      className="w-36 rounded-lg border border-white/10 bg-[#0f1c2e] px-2 py-1.5 text-xs text-white focus:border-blue-500 focus:outline-none"
                    >
                      <option value="none" className="bg-[#0f1c2e] text-white">{EFFECT_LABELS.none}</option>
                      <option value="blocks_admission" className="bg-[#0f1c2e] text-white">{EFFECT_LABELS.blocks_admission}</option>
                      <option value="makes_conditional" className="bg-[#0f1c2e] text-white">{EFFECT_LABELS.makes_conditional}</option>
                    </select>
                    {oe.effect !== "none" && (
                      <input
                        type="text"
                        value={oe.message || ""}
                        onChange={(e) => updateOptionEffect(opt, "message", e.target.value)}
                        placeholder="الرسالة"
                        className="flex-1 rounded-lg border border-white/10 bg-white/5 px-2 py-1.5 text-xs text-white placeholder-slate-500 focus:border-blue-500 focus:outline-none"
                      />
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label className="block text-xs text-slate-400 mb-1">رسالة الرفض</label>
          <input
            type="text"
            value={negativeMessage}
            onChange={(e) => update({ negative_message: e.target.value })}
            className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white focus:border-blue-500 focus:outline-none"
          />
        </div>
        <div>
          <label className="block text-xs text-slate-400 mb-1">رسالة القبول</label>
          <input
            type="text"
            value={positiveMessage}
            onChange={(e) => update({ positive_message: e.target.value })}
            className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white focus:border-blue-500 focus:outline-none"
          />
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
