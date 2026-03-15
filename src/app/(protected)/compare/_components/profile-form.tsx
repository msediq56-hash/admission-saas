"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import type { StudentProfile } from "@/lib/comparison-engine";
import { categoryColors } from "@/lib/ui-constants";

type FilterKey = "foundation" | "bachelor" | "master" | "phd" | "medical";

export interface DynamicField {
  comparison_key: string;
  question_text: string;
  comparison_input_type: "toggle" | "number" | "select";
  options?: string[] | null;
}

export interface ProfileFormResult {
  profile: StudentProfile;
  selectedCategories: Record<FilterKey, boolean>;
}

export function ProfileForm({
  onSubmit,
  loading,
  dynamicFields = [],
}: {
  onSubmit: (data: ProfileFormResult) => void;
  loading: boolean;
  dynamicFields?: DynamicField[];
}) {
  const t = useTranslations();

  // Certificate type
  const [certificateType, setCertificateType] = useState<"arabic" | "british">(
    "arabic"
  );
  const [aLevelCount, setALevelCount] = useState<number>(1);
  const [aLevelCCount, setALevelCCount] = useState<number>(0);

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

  // Dynamic answers
  const [dynamicAnswers, setDynamicAnswers] = useState<
    Record<string, string | boolean | number>
  >({});

  function updateDynamic(key: string, value: string | boolean | number) {
    setDynamicAnswers((prev) => ({ ...prev, [key]: value }));
  }

  // Category filter
  const [selectedCategories, setSelectedCategories] = useState<
    Record<FilterKey, boolean>
  >({
    foundation: true,
    bachelor: true,
    master: false,
    phd: false,
    medical: false,
  });

  function toggleCategory(cat: FilterKey) {
    setSelectedCategories((prev) => ({ ...prev, [cat]: !prev[cat] }));
  }

  function handleSubmit() {
    const profile: StudentProfile = {
      hasHighSchool,
      has12Years,
      hasBachelor,
      ielts: hasIelts ? ieltsScore : null,
      hasSAT,
      satScore: hasSAT ? satScore : null,
      gpa: hasGpa ? gpa : null,
      hasResearchPlan,
      certificateType,
      aLevelCount: certificateType === "british" ? aLevelCount : null,
      aLevelCCount: certificateType === "british" ? aLevelCCount : null,
      dynamicAnswers:
        Object.keys(dynamicAnswers).length > 0 ? dynamicAnswers : undefined,
    };
    onSubmit({ profile, selectedCategories });
  }

  const filterKeys: FilterKey[] = [
    "foundation",
    "bachelor",
    "medical",
    "master",
    "phd",
  ];

  const filterLabels: Record<FilterKey, string> = {
    foundation: t(`categories.foundation` as Parameters<typeof t>[0]),
    bachelor: t(`categories.bachelor` as Parameters<typeof t>[0]),
    master: t(`categories.master` as Parameters<typeof t>[0]),
    phd: t(`categories.phd` as Parameters<typeof t>[0]),
    medical: t("comparison.medical"),
  };

  const filterColors: Record<FilterKey, string> = {
    foundation: categoryColors.foundation,
    bachelor: categoryColors.bachelor,
    master: categoryColors.master,
    phd: categoryColors.phd,
    medical: categoryColors.medical,
  };

  const maxCCount = aLevelCount;

  return (
    <div className="rounded-xl border border-white/10 bg-white/5 p-6 mb-8">
      {/* Certificate Type */}
      <div className="mb-6 pb-5 border-b border-white/10">
        <label className="block text-sm font-medium text-slate-300 mb-3">
          {t("comparison.certificateType")}
        </label>
        <div className="flex gap-3">
          <button
            onClick={() => setCertificateType("arabic")}
            className={`rounded-lg px-5 py-2.5 text-sm font-medium transition ${
              certificateType === "arabic"
                ? "bg-blue-600/20 text-blue-400 border border-blue-500/30"
                : "bg-white/5 text-slate-400 border border-white/10 hover:bg-white/10"
            }`}
          >
            {t("comparison.arabicCert")}
          </button>
          <button
            onClick={() => setCertificateType("british")}
            className={`rounded-lg px-5 py-2.5 text-sm font-medium transition ${
              certificateType === "british"
                ? "bg-blue-600/20 text-blue-400 border border-blue-500/30"
                : "bg-white/5 text-slate-400 border border-white/10 hover:bg-white/10"
            }`}
          >
            {t("comparison.britishCert")}
          </button>
        </div>

        {/* British-specific questions */}
        {certificateType === "british" && (
          <div className="mt-4 space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">
                {t("comparison.aLevelCount")}
              </label>
              <div className="flex gap-2">
                {[
                  { value: 1, label: t("comparison.aLevel1") },
                  { value: 2, label: t("comparison.aLevel2") },
                  { value: 3, label: t("comparison.aLevel3") },
                ].map((opt) => (
                  <button
                    key={opt.value}
                    onClick={() => {
                      setALevelCount(opt.value);
                      if (aLevelCCount > opt.value) {
                        setALevelCCount(opt.value);
                      }
                    }}
                    className={`rounded-lg px-4 py-2 text-sm font-medium transition ${
                      aLevelCount === opt.value
                        ? "bg-blue-600/20 text-blue-400 border border-blue-500/30"
                        : "bg-white/5 text-slate-400 border border-white/10 hover:bg-white/10"
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">
                {t("comparison.aLevelCCount")}
              </label>
              <div className="flex gap-2">
                {Array.from({ length: maxCCount + 1 }, (_, i) => i).map(
                  (count) => (
                    <button
                      key={count}
                      onClick={() => setALevelCCount(count)}
                      className={`rounded-lg px-4 py-2 text-sm font-medium transition ${
                        aLevelCCount === count
                          ? "bg-blue-600/20 text-blue-400 border border-blue-500/30"
                          : "bg-white/5 text-slate-400 border border-white/10 hover:bg-white/10"
                      }`}
                    >
                      {count}
                    </button>
                  )
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        <ToggleField
          label={t("comparison.hasHS")}
          value={hasHighSchool}
          onChange={setHasHighSchool}
          yesLabel={t("comparison.yes")}
          noLabel={t("comparison.no")}
        />
        <ToggleField
          label={t("comparison.has12Years")}
          value={has12Years}
          onChange={setHas12Years}
          yesLabel={t("comparison.yes")}
          noLabel={t("comparison.no")}
        />
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
                onChange={(e) =>
                  setIeltsScore(parseFloat(e.target.value) || 0)
                }
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

        <ToggleField
          label={t("comparison.hasResearchPlan")}
          value={hasResearchPlan}
          onChange={setHasResearchPlan}
          yesLabel={t("comparison.yes")}
          noLabel={t("comparison.no")}
        />
      </div>

      {/* Dynamic Fields */}
      {dynamicFields.length > 0 && (
        <div className="mt-6 border-t border-white/10 pt-5">
          <label className="block text-sm font-medium text-slate-300 mb-3">
            {t("admin.dynamicRequirements")}
          </label>
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {dynamicFields.map((field) => {
              const key = field.comparison_key;
              if (field.comparison_input_type === "toggle") {
                return (
                  <ToggleField
                    key={key}
                    label={field.question_text}
                    value={(dynamicAnswers[key] as boolean) || false}
                    onChange={(v) => updateDynamic(key, v)}
                    yesLabel={t("comparison.yes")}
                    noLabel={t("comparison.no")}
                  />
                );
              }
              if (field.comparison_input_type === "number") {
                return (
                  <div key={key}>
                    <label className="block text-sm font-medium text-slate-300 mb-2">
                      {field.question_text}
                    </label>
                    <input
                      type="number"
                      value={(dynamicAnswers[key] as number) || ""}
                      onChange={(e) =>
                        updateDynamic(
                          key,
                          e.target.value ? parseFloat(e.target.value) : 0
                        )
                      }
                      className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white"
                    />
                  </div>
                );
              }
              if (
                field.comparison_input_type === "select" &&
                field.options &&
                field.options.length > 0
              ) {
                return (
                  <div key={key}>
                    <label className="block text-sm font-medium text-slate-300 mb-2">
                      {field.question_text}
                    </label>
                    <select
                      value={(dynamicAnswers[key] as string) || ""}
                      onChange={(e) => updateDynamic(key, e.target.value)}
                      className="w-full rounded-lg border border-white/10 bg-[#0f1c2e] px-3 py-2 text-sm text-white focus:border-blue-500 focus:outline-none"
                    >
                      <option value="" className="bg-[#0f1c2e] text-white">
                        —
                      </option>
                      {field.options.map((opt) => (
                        <option
                          key={opt}
                          value={opt}
                          className="bg-[#0f1c2e] text-white"
                        >
                          {opt}
                        </option>
                      ))}
                    </select>
                  </div>
                );
              }
              return null;
            })}
          </div>
        </div>
      )}

      {/* Category Filter */}
      <div className="mt-6 border-t border-white/10 pt-5">
        <label className="block text-sm font-medium text-slate-300 mb-3">
          {t("comparison.programTypes")}
        </label>
        <div className="flex flex-wrap gap-3">
          {filterKeys.map((cat) => (
            <button
              key={cat}
              onClick={() => toggleCategory(cat)}
              className={`rounded-full px-4 py-1.5 text-sm font-medium transition ${
                selectedCategories[cat]
                  ? filterColors[cat] + " border border-current/30"
                  : "bg-white/5 text-slate-500 border border-white/10 hover:bg-white/10"
              }`}
            >
              {filterLabels[cat]}
            </button>
          ))}
        </div>
      </div>

      {/* Evaluate Button */}
      <button
        onClick={handleSubmit}
        disabled={loading}
        className="mt-6 w-full rounded-xl bg-blue-600 px-6 py-3.5 text-base font-bold text-white transition hover:bg-blue-500 disabled:opacity-50"
      >
        {loading ? t("common.loading") : t("comparison.evaluateAll")}
      </button>
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
