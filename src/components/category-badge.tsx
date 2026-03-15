"use client";

import { categoryColors } from "@/lib/ui-constants";
import { isMedicalProgram } from "@/lib/comparison-engine";

export function CategoryBadge({
  category,
  programName,
  medicalLabel,
  getCategoryLabel,
}: {
  category: string;
  programName: string;
  medicalLabel: string;
  getCategoryLabel: (cat: string) => string;
}) {
  const isMedical = isMedicalProgram(programName);
  const displayCategory = isMedical ? "medical" : category;
  return (
    <span
      className={`inline-block rounded-full px-3 py-0.5 text-xs font-medium ${
        categoryColors[displayCategory] || "bg-slate-500/15 text-slate-400"
      }`}
    >
      {isMedical ? medicalLabel : getCategoryLabel(category)}
    </span>
  );
}
