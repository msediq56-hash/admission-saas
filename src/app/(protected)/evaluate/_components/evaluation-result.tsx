"use client";

import { useTranslations } from "next-intl";
import { statusStyles } from "@/lib/ui-constants";
import type { EvaluationResult } from "@/lib/evaluation-engine";

export function EvaluationResultView({
  result,
  breadcrumb,
  onReset,
  onBack,
}: {
  result: EvaluationResult;
  breadcrumb: string;
  onReset: () => void;
  onBack: () => void;
}) {
  const t = useTranslations();
  const style = statusStyles[result.status];

  return (
    <div>
      <p className="mb-4 text-sm text-slate-500">{breadcrumb}</p>

      <div className={`rounded-xl border ${style.border} ${style.bg} p-8`}>
        <div className="mb-4">
          <span
            className={`inline-block rounded-full px-4 py-1.5 text-sm font-bold ${style.text} ${style.bg} border ${style.border}`}
          >
            {result.title}
          </span>
        </div>

        <p className="text-lg text-white font-medium mb-6">
          {result.message}
        </p>

        {result.conditions.length > 0 && (
          <div className="mb-6">
            <h4 className="text-sm font-semibold text-slate-300 mb-3">
              {t("evaluation.conditions")}
            </h4>
            <ul className="space-y-2">
              {result.conditions.map((c, i) => (
                <li
                  key={i}
                  className="flex items-start gap-2 text-sm text-yellow-300/90"
                >
                  <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-yellow-400" />
                  <span>
                    <span className="font-medium">{c.category}:</span>{" "}
                    {c.description}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {result.scholarshipInfo && (
          <div className="mb-6 rounded-lg bg-white/5 border border-white/10 p-4">
            <h4 className="text-sm font-semibold text-slate-300 mb-1">
              {t("evaluation.scholarship")}
            </h4>
            <p className="text-sm text-green-400 font-medium">
              {result.scholarshipInfo}
            </p>
          </div>
        )}

        {result.notes.length > 0 && (
          <div>
            <h4 className="text-sm font-semibold text-slate-300 mb-2">
              {t("evaluation.notes")}
            </h4>
            {result.notes.map((note, i) => (
              <p key={i} className="text-sm text-slate-400">
                {note}
              </p>
            ))}
          </div>
        )}
      </div>

      <div className="mt-6 flex gap-3">
        <button
          onClick={onReset}
          className="rounded-xl bg-blue-600 px-6 py-3 text-sm font-semibold text-white transition hover:bg-blue-500"
        >
          {t("evaluation.newEvaluation")}
        </button>
        <button
          onClick={onBack}
          className="rounded-xl border border-white/10 bg-white/5 px-6 py-3 text-sm font-semibold text-slate-300 transition hover:bg-white/10"
        >
          {t("evaluation.back")}
        </button>
      </div>
    </div>
  );
}
