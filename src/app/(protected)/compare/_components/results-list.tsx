"use client";

import { useTranslations } from "next-intl";
import { statusStyles } from "@/lib/ui-constants";
import { ResultCard } from "@/components/result-card";
import type { ComparisonResult } from "@/lib/comparison-engine";

export function ResultsList({ results }: { results: ComparisonResult[] }) {
  const t = useTranslations();

  const positiveResults = results.filter((r) => r.status === "positive");
  const conditionalResults = results.filter((r) => r.status === "conditional");
  const negativeResults = results.filter((r) => r.status === "negative");

  const medicalLabel = t("comparison.medical");
  const detailedEvalLabel = t("comparison.detailedEval");
  const getCategoryLabel = (cat: string) =>
    t(`categories.${cat}` as Parameters<typeof t>[0]);

  if (results.length === 0) {
    return (
      <p className="text-center text-slate-400 py-8">
        {t("comparison.noResults")}
      </p>
    );
  }

  return (
    <div className="space-y-8">
      {positiveResults.length > 0 && (
        <ResultSection
          label={t("comparison.eligible")}
          count={positiveResults.length}
          results={positiveResults}
          statusKey="positive"
          medicalLabel={medicalLabel}
          getCategoryLabel={getCategoryLabel}
          detailedEvalLabel={detailedEvalLabel}
        />
      )}
      {conditionalResults.length > 0 && (
        <ResultSection
          label={t("comparison.conditional")}
          count={conditionalResults.length}
          results={conditionalResults}
          statusKey="conditional"
          medicalLabel={medicalLabel}
          getCategoryLabel={getCategoryLabel}
          detailedEvalLabel={detailedEvalLabel}
        />
      )}
      {negativeResults.length > 0 && (
        <ResultSection
          label={t("comparison.negative")}
          count={negativeResults.length}
          results={negativeResults}
          statusKey="negative"
          medicalLabel={medicalLabel}
          getCategoryLabel={getCategoryLabel}
          detailedEvalLabel={detailedEvalLabel}
        />
      )}
    </div>
  );
}

function ResultSection({
  label,
  count,
  results,
  statusKey,
  medicalLabel,
  getCategoryLabel,
  detailedEvalLabel,
}: {
  label: string;
  count: number;
  results: ComparisonResult[];
  statusKey: "positive" | "conditional" | "negative";
  medicalLabel: string;
  getCategoryLabel: (cat: string) => string;
  detailedEvalLabel: string;
}) {
  const style = statusStyles[statusKey];
  return (
    <div>
      <div className="flex items-center gap-3 mb-4">
        <h2 className={`text-lg font-bold ${style.text}`}>{label}</h2>
        <span
          className={`inline-flex items-center justify-center rounded-full px-2.5 py-0.5 text-xs font-bold ${style.bg} ${style.text} border ${style.border}`}
        >
          {count}
        </span>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        {results.map((r) => (
          <ResultCard
            key={r.programId}
            result={r}
            medicalLabel={medicalLabel}
            getCategoryLabel={getCategoryLabel}
            detailedEvalLabel={detailedEvalLabel}
          />
        ))}
      </div>
    </div>
  );
}
