"use client";

import Link from "next/link";
import { statusStyles } from "@/lib/ui-constants";
import { CategoryBadge } from "./category-badge";
import type { ComparisonResult } from "@/lib/comparison-engine";

export function ResultCard({
  result,
  medicalLabel,
  getCategoryLabel,
  detailedEvalLabel,
}: {
  result: ComparisonResult;
  medicalLabel: string;
  getCategoryLabel: (cat: string) => string;
  detailedEvalLabel: string;
}) {
  const style = statusStyles[result.status];

  return (
    <div className={`rounded-xl border ${style.border} ${style.bg} p-5`}>
      <div className="flex flex-wrap items-start gap-2 mb-2">
        <h3 className="text-base font-semibold text-white flex-1">
          {result.programName}
        </h3>
        <CategoryBadge
          category={result.category}
          programName={result.programName}
          medicalLabel={medicalLabel}
          getCategoryLabel={getCategoryLabel}
        />
      </div>

      <p className="text-sm text-slate-400 mb-2">
        {result.universityName} — {result.country}
      </p>

      <p className={`text-sm font-medium ${style.text} mb-2`}>
        {result.reason}
      </p>

      {result.scholarshipInfo && (
        <p className="text-sm text-green-400 font-medium mb-1">
          {result.scholarshipInfo}
        </p>
      )}

      {result.notes.length > 0 && (
        <div className="mt-2 border-t border-white/5 pt-2">
          {result.notes.map((note, i) => (
            <p
              key={i}
              className={`text-xs ${
                note.startsWith("💡")
                  ? "text-blue-400 font-medium"
                  : "text-slate-500"
              }`}
            >
              {note}
            </p>
          ))}
        </div>
      )}

      <Link
        href="/evaluate"
        className="mt-3 inline-block text-xs text-blue-400 hover:text-blue-300 transition"
      >
        {detailedEvalLabel} →
      </Link>
    </div>
  );
}
