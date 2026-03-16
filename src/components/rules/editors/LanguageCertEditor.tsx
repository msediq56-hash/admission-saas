"use client";

import type { RuleEditorProps } from "../shared";
import EffectSelector from "../EffectSelector";

const LANGUAGE_CERT_TYPES = ["IELTS", "TOEFL", "Duolingo", "Cambridge", "PTE"];

interface AcceptedCert {
  type: string;
  min_score: number;
}

export default function LanguageCertEditor({ config, effect, effectMessage, onChange, onEffectChange, onEffectMessageChange }: RuleEditorProps) {
  const accepted: AcceptedCert[] = (config.accepted as AcceptedCert[]) || [];

  function updateAccepted(newAccepted: AcceptedCert[]) {
    onChange({ ...config, accepted: newAccepted });
  }

  function addCert() {
    updateAccepted([...accepted, { type: "IELTS", min_score: 0 }]);
  }

  function removeCert(index: number) {
    updateAccepted(accepted.filter((_, i) => i !== index));
  }

  function updateCert(index: number, field: "type" | "min_score", value: string | number) {
    const updated = [...accepted];
    updated[index] = { ...updated[index], [field]: value };
    updateAccepted(updated);
  }

  return (
    <div className="space-y-3">
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <label className="text-xs font-medium text-slate-400">الشهادات المقبولة</label>
          <button type="button" onClick={addCert} className="text-xs text-blue-400 hover:text-blue-300">
            + إضافة شهادة لغة مقبولة
          </button>
        </div>
        {accepted.map((cert, idx) => (
          <div key={idx} className="flex items-center gap-2">
            <select
              value={cert.type}
              onChange={(e) => updateCert(idx, "type", e.target.value)}
              className="w-40 rounded-lg border border-white/10 bg-[#0f1c2e] px-3 py-1.5 text-sm text-white focus:border-blue-500 focus:outline-none"
            >
              {LANGUAGE_CERT_TYPES.map((t) => (
                <option key={t} value={t} className="bg-[#0f1c2e] text-white">{t}</option>
              ))}
            </select>
            <input
              type="number"
              step="0.5"
              value={cert.min_score || ""}
              onChange={(e) => updateCert(idx, "min_score", e.target.value ? Number(e.target.value) : 0)}
              placeholder="الحد الأدنى"
              className="w-24 rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-sm text-white focus:border-blue-500 focus:outline-none"
            />
            <button type="button" onClick={() => removeCert(idx)} className="text-xs text-red-400 hover:text-red-300">
              حذف
            </button>
          </div>
        ))}
        {accepted.length === 0 && (
          <p className="text-xs text-slate-500">لم تتم إضافة شهادات لغة بعد</p>
        )}
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
