"use client";

import { useState } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { createSupabaseBrowserClient } from "@/lib/supabase-browser";
import { useAuth } from "@/lib/auth-context";
import {
  compareAllPrograms,
  type StudentProfile,
  type ComparisonResult,
} from "@/lib/comparison-engine";
import type {
  Requirement,
  CustomRequirement,
  ScholarshipTier,
} from "@/lib/evaluation-engine";

const categoryColors: Record<string, string> = {
  foundation: "bg-amber-500/15 text-amber-400",
  bachelor: "bg-blue-500/15 text-blue-400",
  master: "bg-purple-500/15 text-purple-400",
  phd: "bg-emerald-500/15 text-emerald-400",
  language: "bg-cyan-500/15 text-cyan-400",
};

const statusStyles: Record<
  string,
  { bg: string; text: string; border: string; label: string }
> = {
  positive: {
    bg: "bg-green-500/10",
    text: "text-green-400",
    border: "border-green-500/30",
    label: "مؤهل",
  },
  conditional: {
    bg: "bg-yellow-500/10",
    text: "text-yellow-400",
    border: "border-yellow-500/30",
    label: "مشروط",
  },
  negative: {
    bg: "bg-red-500/10",
    text: "text-red-400",
    border: "border-red-500/30",
    label: "غير مؤهل",
  },
};

type CategoryKey = "foundation" | "bachelor" | "master" | "phd";

export default function ComparePage() {
  const t = useTranslations();
  const user = useAuth();
  const supabase = createSupabaseBrowserClient();

  // Profile form state
  const [hasHighSchool, setHasHighSchool] = useState(true);
  const [has12Years, setHas12Years] = useState(true);
  const [hasIelts, setHasIelts] = useState(false);
  const [ieltsScore, setIeltsScore] = useState(6.0);
  const [hasSAT, setHasSAT] = useState(false);
  const [satScore, setSatScore] = useState(1200);
  const [hasGpa, setHasGpa] = useState(false);
  const [gpa, setGpa] = useState(85);
  const [hasBachelor, setHasBachelor] = useState(false);
  const [hasResearchPlan, setHasResearchPlan] = useState(false);

  // Category filter
  const [selectedCategories, setSelectedCategories] = useState<
    Record<CategoryKey, boolean>
  >({
    foundation: true,
    bachelor: true,
    master: false,
    phd: false,
  });

  // Results
  const [results, setResults] = useState<ComparisonResult[] | null>(null);
  const [loading, setLoading] = useState(false);

  function toggleCategory(cat: CategoryKey) {
    setSelectedCategories((prev) => ({ ...prev, [cat]: !prev[cat] }));
  }

  async function handleEvaluate() {
    setLoading(true);

    const profile: StudentProfile = {
      hasHighSchool,
      has12Years,
      hasBachelor,
      ielts: hasIelts ? ieltsScore : null,
      hasSAT,
      satScore: hasSAT ? satScore : null,
      gpa: hasGpa ? gpa : null,
      hasResearchPlan,
    };

    // Fetch all programs with requirements for tenant
    const { data: universities } = await supabase
      .from("universities")
      .select("id, name, country, type")
      .eq("tenant_id", user.tenantId)
      .eq("is_active", true);

    if (!universities || universities.length === 0) {
      setResults([]);
      setLoading(false);
      return;
    }

    const uniMap = new Map(universities.map((u) => [u.id, u]));

    const { data: programs } = await supabase
      .from("programs")
      .select("id, name, category, university_id")
      .in(
        "university_id",
        universities.map((u) => u.id)
      )
      .eq("is_active", true);

    if (!programs || programs.length === 0) {
      setResults([]);
      setLoading(false);
      return;
    }

    // Filter by selected categories
    const activeCats = Object.entries(selectedCategories)
      .filter(([, v]) => v)
      .map(([k]) => k);
    const filteredPrograms = programs.filter((p) =>
      activeCats.includes(p.category)
    );

    if (filteredPrograms.length === 0) {
      setResults([]);
      setLoading(false);
      return;
    }

    const programIds = filteredPrograms.map((p) => p.id);

    // Fetch requirements, custom_requirements, scholarship_tiers
    const [reqRes, customRes, tierRes] = await Promise.all([
      supabase.from("requirements").select("*").in("program_id", programIds),
      supabase
        .from("custom_requirements")
        .select("*")
        .in("program_id", programIds)
        .order("sort_order"),
      supabase
        .from("scholarship_tiers")
        .select("*")
        .in("program_id", programIds)
        .order("sort_order"),
    ]);

    const reqMap = new Map<string, Requirement>();
    for (const r of reqRes.data || []) {
      reqMap.set(r.program_id, r as Requirement);
    }

    const customMap = new Map<string, CustomRequirement[]>();
    for (const c of (customRes.data || []) as (CustomRequirement & {
      program_id: string;
    })[]) {
      const arr = customMap.get(c.program_id) || [];
      arr.push(c);
      customMap.set(c.program_id, arr);
    }

    const tierMap = new Map<string, ScholarshipTier[]>();
    for (const t of (tierRes.data || []) as (ScholarshipTier & {
      program_id: string;
    })[]) {
      const arr = tierMap.get(t.program_id) || [];
      arr.push(t);
      tierMap.set(t.program_id, arr);
    }

    // Build program entries
    const entries = filteredPrograms.map((p) => {
      const uni = uniMap.get(p.university_id)!;
      return {
        programId: p.id,
        programName: p.name,
        universityName: uni.name,
        country: uni.country,
        universityType: uni.type,
        category: p.category,
        requirements: reqMap.get(p.id) || ({} as Requirement),
        customRequirements: customMap.get(p.id) || [],
        scholarshipTiers: tierMap.get(p.id) || [],
      };
    });

    const compared = compareAllPrograms(profile, entries);
    setResults(compared);
    setLoading(false);
  }

  // Group results by status
  const positiveResults = results?.filter((r) => r.status === "positive") || [];
  const conditionalResults =
    results?.filter((r) => r.status === "conditional") || [];
  const negativeResults = results?.filter((r) => r.status === "negative") || [];

  const categoryKeys: CategoryKey[] = [
    "foundation",
    "bachelor",
    "master",
    "phd",
  ];

  return (
    <div>
      <h1 className="text-2xl font-bold text-white mb-2">
        {t("comparison.title")}
      </h1>
      <p className="text-slate-400 mb-6">{t("comparison.subtitle")}</p>

      {/* Student Profile Form */}
      <div className="rounded-xl border border-white/10 bg-white/5 p-6 mb-8">
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {/* Has High School */}
          <ToggleField
            label={t("comparison.hasHS")}
            value={hasHighSchool}
            onChange={setHasHighSchool}
            yesLabel={t("comparison.yes")}
            noLabel={t("comparison.no")}
          />

          {/* 12 Years */}
          <ToggleField
            label={t("comparison.has12Years")}
            value={has12Years}
            onChange={setHas12Years}
            yesLabel={t("comparison.yes")}
            noLabel={t("comparison.no")}
          />

          {/* Bachelor */}
          <ToggleField
            label={t("comparison.hasBachelor")}
            value={hasBachelor}
            onChange={setHasBachelor}
            yesLabel={t("comparison.yes")}
            noLabel={t("comparison.no")}
          />

          {/* IELTS */}
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">
              {t("comparison.ieltsLevel")}
            </label>
            <div className="flex gap-2 mb-2">
              <button
                onClick={() => setHasIelts(true)}
                className={`flex-1 rounded-lg px-3 py-2 text-sm font-medium transition ${
                  hasIelts
                    ? "bg-blue-600/20 text-blue-400 border border-blue-500/30"
                    : "bg-white/5 text-slate-400 border border-white/10 hover:bg-white/10"
                }`}
              >
                {t("comparison.hasIelts")}
              </button>
              <button
                onClick={() => setHasIelts(false)}
                className={`flex-1 rounded-lg px-3 py-2 text-sm font-medium transition ${
                  !hasIelts
                    ? "bg-blue-600/20 text-blue-400 border border-blue-500/30"
                    : "bg-white/5 text-slate-400 border border-white/10 hover:bg-white/10"
                }`}
              >
                {t("comparison.noIelts")}
              </button>
            </div>
            {hasIelts && (
              <div className="flex items-center gap-2">
                <span className="text-xs text-slate-500">
                  {t("comparison.ieltsScore")}:
                </span>
                <input
                  type="number"
                  min={0}
                  max={9}
                  step={0.5}
                  value={ieltsScore}
                  onChange={(e) => setIeltsScore(parseFloat(e.target.value) || 0)}
                  className="w-20 rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-sm text-white"
                />
              </div>
            )}
          </div>

          {/* SAT */}
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">
              {t("comparison.hasSAT")}
            </label>
            <div className="flex gap-2 mb-2">
              <button
                onClick={() => setHasSAT(true)}
                className={`flex-1 rounded-lg px-3 py-2 text-sm font-medium transition ${
                  hasSAT
                    ? "bg-blue-600/20 text-blue-400 border border-blue-500/30"
                    : "bg-white/5 text-slate-400 border border-white/10 hover:bg-white/10"
                }`}
              >
                {t("comparison.yes")}
              </button>
              <button
                onClick={() => setHasSAT(false)}
                className={`flex-1 rounded-lg px-3 py-2 text-sm font-medium transition ${
                  !hasSAT
                    ? "bg-blue-600/20 text-blue-400 border border-blue-500/30"
                    : "bg-white/5 text-slate-400 border border-white/10 hover:bg-white/10"
                }`}
              >
                {t("comparison.no")}
              </button>
            </div>
            {hasSAT && (
              <div className="flex items-center gap-2">
                <span className="text-xs text-slate-500">
                  {t("comparison.satScore")}:
                </span>
                <input
                  type="number"
                  min={400}
                  max={1600}
                  step={10}
                  value={satScore}
                  onChange={(e) => setSatScore(parseInt(e.target.value) || 400)}
                  className="w-24 rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-sm text-white"
                />
              </div>
            )}
          </div>

          {/* GPA */}
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">
              {t("comparison.gpa")}
            </label>
            <div className="flex gap-2 mb-2">
              <button
                onClick={() => setHasGpa(true)}
                className={`flex-1 rounded-lg px-3 py-2 text-sm font-medium transition ${
                  hasGpa
                    ? "bg-blue-600/20 text-blue-400 border border-blue-500/30"
                    : "bg-white/5 text-slate-400 border border-white/10 hover:bg-white/10"
                }`}
              >
                {t("comparison.gpaSpecified")}
              </button>
              <button
                onClick={() => setHasGpa(false)}
                className={`flex-1 rounded-lg px-3 py-2 text-sm font-medium transition ${
                  !hasGpa
                    ? "bg-blue-600/20 text-blue-400 border border-blue-500/30"
                    : "bg-white/5 text-slate-400 border border-white/10 hover:bg-white/10"
                }`}
              >
                {t("comparison.gpaNotSpecified")}
              </button>
            </div>
            {hasGpa && (
              <div className="flex items-center gap-2">
                <span className="text-xs text-slate-500">
                  {t("comparison.gpaPercent")}:
                </span>
                <input
                  type="number"
                  min={0}
                  max={100}
                  value={gpa}
                  onChange={(e) => setGpa(parseInt(e.target.value) || 0)}
                  className="w-20 rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-sm text-white"
                />
                <span className="text-xs text-slate-500">%</span>
              </div>
            )}
          </div>

          {/* Research Plan */}
          <ToggleField
            label={t("comparison.hasResearchPlan")}
            value={hasResearchPlan}
            onChange={setHasResearchPlan}
            yesLabel={t("comparison.yes")}
            noLabel={t("comparison.no")}
          />
        </div>

        {/* Category Filter */}
        <div className="mt-6 border-t border-white/10 pt-5">
          <label className="block text-sm font-medium text-slate-300 mb-3">
            {t("comparison.programTypes")}
          </label>
          <div className="flex flex-wrap gap-3">
            {categoryKeys.map((cat) => (
              <button
                key={cat}
                onClick={() => toggleCategory(cat)}
                className={`rounded-full px-4 py-1.5 text-sm font-medium transition ${
                  selectedCategories[cat]
                    ? categoryColors[cat] + " border border-current/30"
                    : "bg-white/5 text-slate-500 border border-white/10 hover:bg-white/10"
                }`}
              >
                {t(`categories.${cat}` as Parameters<typeof t>[0])}
              </button>
            ))}
          </div>
        </div>

        {/* Evaluate Button */}
        <button
          onClick={handleEvaluate}
          disabled={loading}
          className="mt-6 w-full rounded-xl bg-blue-600 px-6 py-3.5 text-base font-bold text-white transition hover:bg-blue-500 disabled:opacity-50"
        >
          {loading ? t("common.loading") : t("comparison.evaluateAll")}
        </button>
      </div>

      {/* Results */}
      {results !== null && (
        <div>
          {results.length === 0 ? (
            <p className="text-center text-slate-400 py-8">
              {t("comparison.noResults")}
            </p>
          ) : (
            <div className="space-y-8">
              {/* Positive */}
              {positiveResults.length > 0 && (
                <ResultSection
                  t={t}
                  label={t("comparison.eligible")}
                  count={positiveResults.length}
                  results={positiveResults}
                  statusKey="positive"
                />
              )}

              {/* Conditional */}
              {conditionalResults.length > 0 && (
                <ResultSection
                  t={t}
                  label={t("comparison.conditional")}
                  count={conditionalResults.length}
                  results={conditionalResults}
                  statusKey="conditional"
                />
              )}

              {/* Negative */}
              {negativeResults.length > 0 && (
                <ResultSection
                  t={t}
                  label={t("comparison.negative")}
                  count={negativeResults.length}
                  results={negativeResults}
                  statusKey="negative"
                />
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// --- Reusable toggle field ---
function ToggleField({
  label,
  value,
  onChange,
  yesLabel,
  noLabel,
}: {
  label: string;
  value: boolean;
  onChange: (v: boolean) => void;
  yesLabel: string;
  noLabel: string;
}) {
  return (
    <div>
      <label className="block text-sm font-medium text-slate-300 mb-2">
        {label}
      </label>
      <div className="flex gap-2">
        <button
          onClick={() => onChange(true)}
          className={`flex-1 rounded-lg px-3 py-2 text-sm font-medium transition ${
            value
              ? "bg-blue-600/20 text-blue-400 border border-blue-500/30"
              : "bg-white/5 text-slate-400 border border-white/10 hover:bg-white/10"
          }`}
        >
          {yesLabel}
        </button>
        <button
          onClick={() => onChange(false)}
          className={`flex-1 rounded-lg px-3 py-2 text-sm font-medium transition ${
            !value
              ? "bg-blue-600/20 text-blue-400 border border-blue-500/30"
              : "bg-white/5 text-slate-400 border border-white/10 hover:bg-white/10"
          }`}
        >
          {noLabel}
        </button>
      </div>
    </div>
  );
}

// --- Result section (positive / conditional / negative) ---
function ResultSection({
  t,
  label,
  count,
  results,
  statusKey,
}: {
  t: ReturnType<typeof useTranslations>;
  label: string;
  count: number;
  results: ComparisonResult[];
  statusKey: "positive" | "conditional" | "negative";
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
          <div
            key={r.programId}
            className={`rounded-xl border ${style.border} ${style.bg} p-5`}
          >
            <div className="flex flex-wrap items-start gap-2 mb-2">
              <h3 className="text-base font-semibold text-white flex-1">
                {r.programName}
              </h3>
              <span
                className={`inline-block rounded-full px-3 py-0.5 text-xs font-medium ${
                  categoryColors[r.category] || "bg-slate-500/15 text-slate-400"
                }`}
              >
                {t(`categories.${r.category}` as Parameters<typeof t>[0])}
              </span>
            </div>

            <p className="text-sm text-slate-400 mb-2">
              {r.universityName} — {r.country}
            </p>

            <p className={`text-sm font-medium ${style.text} mb-2`}>
              {r.reason}
            </p>

            {r.scholarshipInfo && (
              <p className="text-sm text-green-400 font-medium mb-1">
                {r.scholarshipInfo}
              </p>
            )}

            {r.notes.length > 0 && (
              <div className="mt-2 border-t border-white/5 pt-2">
                {r.notes.map((note, i) => (
                  <p key={i} className="text-xs text-slate-500">
                    {note}
                  </p>
                ))}
              </div>
            )}

            <Link
              href="/evaluate"
              className="mt-3 inline-block text-xs text-blue-400 hover:text-blue-300 transition"
            >
              {t("comparison.detailedEval")} →
            </Link>
          </div>
        ))}
      </div>
    </div>
  );
}
