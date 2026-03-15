"use client";

import { statusStyles } from "@/lib/ui-constants";

export function StatusBadge({ status }: { status: string }) {
  const style = statusStyles[status];
  if (!style) return null;
  return (
    <span
      className={`inline-block rounded-full px-4 py-1.5 text-sm font-bold ${style.text} ${style.bg} border ${style.border}`}
    >
      {style.label}
    </span>
  );
}
