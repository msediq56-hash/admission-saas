"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useAuth } from "@/lib/auth-context";
import { canEditUniversities } from "@/lib/permissions";
import { createSupabaseBrowserClient } from "@/lib/supabase-browser";
import Link from "next/link";
import { use } from "react";

interface CustomRequirement {
  id?: string;
  question_text: string;
  question_type: "yes_no" | "select";
  effect: "blocks_admission" | "makes_conditional";
  negative_message: string;
  positive_message: string;
  sort_order: number;
}

interface Requirements {
  requires_hs: boolean;
  requires_12_years: boolean;
  requires_bachelor: boolean;
  requires_ielts: boolean;
  ielts_min: number | null;
  ielts_effect: string | null;
  requires_sat: boolean;
  sat_min: number | null;
  sat_effect: string | null;
  requires_gpa: boolean;
  gpa_min: number | null;
  requires_entrance_exam: boolean;
  requires_portfolio: boolean;
  requires_research_plan: boolean;
  result_notes: string | null;
}

interface CertificateType {
  id: string;
  slug: string;
  name_ar: string;
}

const defaultReqs: Requirements = {
  requires_hs: false,
  requires_12_years: false,
  requires_bachelor: false,
  requires_ielts: false,
  ielts_min: null,
  ielts_effect: null,
  requires_sat: false,
  sat_min: null,
  sat_effect: null,
  requires_gpa: false,
  gpa_min: null,
  requires_entrance_exam: false,
  requires_portfolio: false,
  requires_research_plan: false,
  result_notes: null,
};

export default function EditProgramPage({
  params,
}: {
  params: Promise<{ id: string; programId: string }>;
}) {
  const { id: universityId, programId } = use(params);
  const t = useTranslations();
  const router = useRouter();
  const user = useAuth();
  const supabase = createSupabaseBrowserClient();

  const [programName, setProgramName] = useState("");
  const [category, setCategory] = useState("bachelor");
  const [certificateTypeId, setCertificateTypeId] = useState<string | null>(null);
  const [originalComplexity, setOriginalComplexity] = useState("simple");
  const [reqs, setReqs] = useState<Requirements>(defaultReqs);
  const [customReqs, setCustomReqs] = useState<CustomRequirement[]>([]);
  const [certTypes, setCertTypes] = useState<CertificateType[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");

  if (!canEditUniversities(user.role)) {
    router.replace(`/universities/${universityId}`);
    return null;
  }

  const loadData = useCallback(async () => {
    const [programRes, reqRes, customRes, certRes] = await Promise.all([
      supabase
        .from("programs")
        .select("name, category, certificate_type_id, complexity_level")
        .eq("id", programId)
        .single(),
      supabase
        .from("requirements")
        .select("*")
        .eq("program_id", programId)
        .single(),
      supabase
        .from("custom_requirements")
        .select("*")
        .eq("program_id", programId)
        .order("sort_order"),
      supabase
        .from("certificate_types")
        .select("id, slug, name_ar")
        .order("sort_order"),
    ]);

    if (programRes.data) {
      setProgramName(programRes.data.name);
      setCategory(programRes.data.category);
      setCertificateTypeId(programRes.data.certificate_type_id);
      setOriginalComplexity(programRes.data.complexity_level || "simple");
    }

    if (reqRes.data) {
      setReqs({
        requires_hs: reqRes.data.requires_hs ?? false,
        requires_12_years: reqRes.data.requires_12_years ?? false,
        requires_bachelor: reqRes.data.requires_bachelor ?? false,
        requires_ielts: reqRes.data.requires_ielts ?? false,
        ielts_min: reqRes.data.ielts_min,
        ielts_effect: reqRes.data.ielts_effect,
        requires_sat: reqRes.data.requires_sat ?? false,
        sat_min: reqRes.data.sat_min,
        sat_effect: reqRes.data.sat_effect,
        requires_gpa: reqRes.data.requires_gpa ?? false,
        gpa_min: reqRes.data.gpa_min,
        requires_entrance_exam: reqRes.data.requires_entrance_exam ?? false,
        requires_portfolio: reqRes.data.requires_portfolio ?? false,
        requires_research_plan: reqRes.data.requires_research_plan ?? false,
        result_notes: reqRes.data.result_notes,
      });
    }

    if (customRes.data) {
      setCustomReqs(
        customRes.data.map((cr) => ({
          id: cr.id,
          question_text: cr.question_text,
          question_type: cr.question_type,
          effect: cr.effect,
          negative_message: cr.negative_message || "",
          positive_message: cr.positive_message || "",
          sort_order: cr.sort_order,
        }))
      );
    }

    if (certRes.data) {
      setCertTypes(certRes.data);
    }

    setLoading(false);
  }, [programId, supabase]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  function updateReq<K extends keyof Requirements>(key: K, value: Requirements[K]) {
    setReqs((prev) => ({ ...prev, [key]: value }));
  }

  function addCustomReq() {
    setCustomReqs((prev) => [
      ...prev,
      {
        question_text: "",
        question_type: "yes_no",
        effect: "blocks_admission",
        negative_message: "",
        positive_message: "",
        sort_order: prev.length,
      },
    ]);
  }

  function removeCustomReq(index: number) {
    setCustomReqs((prev) => prev.filter((_, i) => i !== index));
  }

  function updateCustomReq(index: number, field: keyof CustomRequirement, value: string | number) {
    setCustomReqs((prev) =>
      prev.map((cr, i) => (i === index ? { ...cr, [field]: value } : cr))
    );
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError("");
    setSaved(false);

    // Auto-calculate complexity: keep 'complex' if already set, else hybrid if custom reqs exist
    let computedComplexity = "simple";
    if (originalComplexity === "complex") {
      computedComplexity = "complex";
    } else if (customReqs.length > 0) {
      computedComplexity = "hybrid";
    }

    const res = await fetch(`/api/programs/${programId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        program: {
          name: programName,
          category,
          certificate_type_id: certificateTypeId,
          complexity_level: computedComplexity,
        },
        requirements: reqs,
        custom_requirements: customReqs,
      }),
    });

    if (!res.ok) {
      const data = await res.json();
      setError(data.error || t("admin.saveError"));
      setSaving(false);
      return;
    }

    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  if (loading) {
    return <p className="text-slate-400">{t("common.loading")}</p>;
  }

  return (
    <div className="max-w-3xl">
      <Link
        href={`/universities/${universityId}`}
        className="inline-flex items-center gap-2 text-sm text-slate-400 transition hover:text-white mb-6"
      >
        <span>←</span>
        {t("admin.backToUniversity")}
      </Link>

      <h1 className="text-2xl font-bold text-white mb-8">
        {t("admin.editProgram")}
      </h1>

      <form onSubmit={handleSubmit} className="space-y-8">
        {/* Program Info */}
        <section className="rounded-xl border border-white/10 bg-white/5 p-6 space-y-4">
          <h2 className="text-lg font-semibold text-white">
            {t("admin.programInfo")}
          </h2>

          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">
              {t("admin.programName")}
            </label>
            <input
              type="text"
              value={programName}
              onChange={(e) => setProgramName(e.target.value)}
              required
              className="w-full rounded-lg border border-white/10 bg-white/5 px-4 py-2.5 text-white focus:border-blue-500 focus:outline-none"
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">
                {t("admin.programCategory")}
              </label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full rounded-lg border border-white/10 bg-white/5 px-4 py-2.5 text-white focus:border-blue-500 focus:outline-none"
              >
                {["foundation", "bachelor", "master", "phd", "language"].map((cat) => (
                  <option key={cat} value={cat}>
                    {t(`categories.${cat}` as Parameters<typeof t>[0])}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">
                {t("admin.certificateType")}
              </label>
              <select
                value={certificateTypeId || ""}
                onChange={(e) => setCertificateTypeId(e.target.value || null)}
                className="w-full rounded-lg border border-white/10 bg-white/5 px-4 py-2.5 text-white focus:border-blue-500 focus:outline-none"
              >
                <option value="">—</option>
                {certTypes.map((ct) => (
                  <option key={ct.id} value={ct.id}>
                    {ct.name_ar}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </section>

        {/* Requirements */}
        <section className="rounded-xl border border-white/10 bg-white/5 p-6 space-y-4">
          <h2 className="text-lg font-semibold text-white">
            {t("admin.requirements")}
          </h2>

          <div className="space-y-3">
            <Toggle
              label={t("admin.requiresHS")}
              checked={reqs.requires_hs}
              onChange={(v) => updateReq("requires_hs", v)}
            />
            <Toggle
              label={t("admin.requires12Years")}
              checked={reqs.requires_12_years}
              onChange={(v) => updateReq("requires_12_years", v)}
            />
            <Toggle
              label={t("admin.requiresBachelor")}
              checked={reqs.requires_bachelor}
              onChange={(v) => updateReq("requires_bachelor", v)}
            />

            <Toggle
              label={t("admin.requiresIELTS")}
              checked={reqs.requires_ielts}
              onChange={(v) => updateReq("requires_ielts", v)}
            />
            {reqs.requires_ielts && (
              <div className="mr-8 grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="block text-xs text-slate-400 mb-1">
                    {t("admin.ieltsMin")}
                  </label>
                  <input
                    type="number"
                    step="0.5"
                    value={reqs.ielts_min ?? ""}
                    onChange={(e) =>
                      updateReq("ielts_min", e.target.value ? Number(e.target.value) : null)
                    }
                    className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white focus:border-blue-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs text-slate-400 mb-1">
                    {t("admin.ieltsEffect")}
                  </label>
                  <select
                    value={reqs.ielts_effect || "blocks_if_below"}
                    onChange={(e) => updateReq("ielts_effect", e.target.value)}
                    className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white focus:border-blue-500 focus:outline-none"
                  >
                    <option value="blocks_if_below">{t("admin.blocks")}</option>
                    <option value="conditional">{t("admin.conditional")}</option>
                  </select>
                </div>
              </div>
            )}

            <Toggle
              label={t("admin.requiresSAT")}
              checked={reqs.requires_sat}
              onChange={(v) => updateReq("requires_sat", v)}
            />
            {reqs.requires_sat && (
              <div className="mr-8 grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="block text-xs text-slate-400 mb-1">
                    {t("admin.satMin")}
                  </label>
                  <input
                    type="number"
                    value={reqs.sat_min ?? ""}
                    onChange={(e) =>
                      updateReq("sat_min", e.target.value ? Number(e.target.value) : null)
                    }
                    className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white focus:border-blue-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs text-slate-400 mb-1">
                    {t("admin.satEffect")}
                  </label>
                  <select
                    value={reqs.sat_effect || "blocks_if_below"}
                    onChange={(e) => updateReq("sat_effect", e.target.value)}
                    className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white focus:border-blue-500 focus:outline-none"
                  >
                    <option value="blocks_if_below">{t("admin.blocks")}</option>
                    <option value="conditional">{t("admin.conditional")}</option>
                  </select>
                </div>
              </div>
            )}

            <Toggle
              label={t("admin.requiresGPA")}
              checked={reqs.requires_gpa}
              onChange={(v) => updateReq("requires_gpa", v)}
            />
            {reqs.requires_gpa && (
              <div className="mr-8">
                <label className="block text-xs text-slate-400 mb-1">
                  {t("admin.gpaMin")}
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={reqs.gpa_min ?? ""}
                  onChange={(e) =>
                    updateReq("gpa_min", e.target.value ? Number(e.target.value) : null)
                  }
                  className="w-48 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white focus:border-blue-500 focus:outline-none"
                />
              </div>
            )}

            <Toggle
              label={t("admin.requiresEntranceExam")}
              checked={reqs.requires_entrance_exam}
              onChange={(v) => updateReq("requires_entrance_exam", v)}
            />
            <Toggle
              label={t("admin.requiresPortfolio")}
              checked={reqs.requires_portfolio}
              onChange={(v) => updateReq("requires_portfolio", v)}
            />
            <Toggle
              label={t("admin.requiresResearchPlan")}
              checked={reqs.requires_research_plan}
              onChange={(v) => updateReq("requires_research_plan", v)}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">
              {t("admin.resultNotes")}
            </label>
            <textarea
              value={reqs.result_notes || ""}
              onChange={(e) => updateReq("result_notes", e.target.value || null)}
              rows={3}
              className="w-full rounded-lg border border-white/10 bg-white/5 px-4 py-2.5 text-white focus:border-blue-500 focus:outline-none"
            />
          </div>
        </section>

        {/* Custom Requirements */}
        <section className="rounded-xl border border-white/10 bg-white/5 p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-white">
              {t("admin.customRequirements")}
            </h2>
            <button
              type="button"
              onClick={addCustomReq}
              className="rounded-lg bg-white/10 px-4 py-2 text-sm text-white transition hover:bg-white/20"
            >
              {t("admin.addCustomRequirement")}
            </button>
          </div>

          {customReqs.map((cr, index) => (
            <div
              key={cr.id || `new-${index}`}
              className="rounded-lg border border-white/5 bg-white/[0.02] p-4 space-y-3"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1">
                  <label className="block text-xs text-slate-400 mb-1">
                    {t("admin.questionText")}
                  </label>
                  <input
                    type="text"
                    value={cr.question_text}
                    onChange={(e) => updateCustomReq(index, "question_text", e.target.value)}
                    className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white focus:border-blue-500 focus:outline-none"
                  />
                </div>
                <button
                  type="button"
                  onClick={() => removeCustomReq(index)}
                  className="mt-5 text-sm text-red-400 hover:text-red-300"
                >
                  {t("admin.removeCustomRequirement")}
                </button>
              </div>

              <div className="grid gap-3 sm:grid-cols-3">
                <div>
                  <label className="block text-xs text-slate-400 mb-1">
                    {t("admin.questionType")}
                  </label>
                  <select
                    value={cr.question_type}
                    onChange={(e) => updateCustomReq(index, "question_type", e.target.value)}
                    className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white focus:border-blue-500 focus:outline-none"
                  >
                    <option value="yes_no">نعم / لا</option>
                    <option value="select">اختيار</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-slate-400 mb-1">
                    {t("admin.effect")}
                  </label>
                  <select
                    value={cr.effect}
                    onChange={(e) => updateCustomReq(index, "effect", e.target.value)}
                    className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white focus:border-blue-500 focus:outline-none"
                  >
                    <option value="blocks_admission">{t("admin.blocks")}</option>
                    <option value="makes_conditional">{t("admin.conditional")}</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-slate-400 mb-1">
                    sort_order
                  </label>
                  <input
                    type="number"
                    value={cr.sort_order}
                    onChange={(e) => updateCustomReq(index, "sort_order", Number(e.target.value))}
                    className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white focus:border-blue-500 focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label className="block text-xs text-slate-400 mb-1">
                    {t("admin.negativeMessage")}
                  </label>
                  <input
                    type="text"
                    value={cr.negative_message}
                    onChange={(e) => updateCustomReq(index, "negative_message", e.target.value)}
                    className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white focus:border-blue-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs text-slate-400 mb-1">
                    {t("admin.positiveMessage")}
                  </label>
                  <input
                    type="text"
                    value={cr.positive_message}
                    onChange={(e) => updateCustomReq(index, "positive_message", e.target.value)}
                    className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white focus:border-blue-500 focus:outline-none"
                  />
                </div>
              </div>
            </div>
          ))}

          {customReqs.length === 0 && (
            <p className="text-sm text-slate-500">—</p>
          )}
        </section>

        {error && <p className="text-sm text-red-400">{error}</p>}

        <div className="flex items-center gap-4">
          <button
            type="submit"
            disabled={saving}
            className="rounded-lg bg-blue-600 px-6 py-2.5 text-sm font-medium text-white transition hover:bg-blue-700 disabled:opacity-50"
          >
            {saving ? t("admin.saving") : t("admin.saveChanges")}
          </button>
          {saved && (
            <span className="text-sm text-green-400">{t("admin.saved")}</span>
          )}
        </div>
      </form>
    </div>
  );
}

function Toggle({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <div className="flex items-center gap-3">
      <button
        type="button"
        onClick={() => onChange(!checked)}
        className={`relative inline-flex h-6 w-11 items-center rounded-full transition ${checked ? "bg-blue-600" : "bg-slate-600"}`}
      >
        <span
          className={`inline-block h-4 w-4 rounded-full bg-white transition ${checked ? "translate-x-1.5" : "translate-x-6"}`}
        />
      </button>
      <span className="text-sm text-slate-300">{label}</span>
    </div>
  );
}
