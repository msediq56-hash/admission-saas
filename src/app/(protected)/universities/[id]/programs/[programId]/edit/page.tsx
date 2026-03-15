"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useAuth } from "@/lib/auth-context";
import { canEditUniversities } from "@/lib/permissions";
import { createSupabaseBrowserClient } from "@/lib/supabase-browser";
import Link from "next/link";
import { use } from "react";

/* ------------------------------------------------------------------ */
/*  Interfaces                                                         */
/* ------------------------------------------------------------------ */

interface OptionEffect {
  effect: "none" | "blocks_admission" | "makes_conditional";
  message: string | null;
}

interface CustomRequirement {
  id?: string;
  question_text: string;
  question_type: "yes_no" | "select";
  options?: string[];
  effect: "blocks_admission" | "makes_conditional";
  negative_message: string;
  positive_message: string;
  sort_order: number;
  option_effects?: Record<string, OptionEffect> | null;
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

interface SubjectRequirement {
  id?: string;
  certificate_type_id: string;
  question_text: string;
  question_type: "yes_no" | "select";
  options?: string[];
  effect: "blocks_admission" | "makes_conditional";
  negative_message: string;
  positive_message: string;
  option_effects?: Record<string, OptionEffect> | null;
  sort_order: number;
}

interface MajorData {
  id?: string;
  name_ar: string;
  name_en: string;
  group_code: string;
  sort_order: number;
  subject_requirements: SubjectRequirement[];
  _expanded?: boolean;
}

/* ------------------------------------------------------------------ */
/*  Defaults                                                           */
/* ------------------------------------------------------------------ */

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

/* ------------------------------------------------------------------ */
/*  Page Component                                                     */
/* ------------------------------------------------------------------ */

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
  const [majors, setMajors] = useState<MajorData[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savingMajors, setSavingMajors] = useState(false);
  const [saved, setSaved] = useState(false);
  const [savedMajors, setSavedMajors] = useState(false);
  const [error, setError] = useState("");
  const [majorsExpanded, setMajorsExpanded] = useState(false);

  if (!canEditUniversities(user.role)) {
    router.replace(`/universities/${universityId}`);
    return null;
  }

  const loadData = useCallback(async () => {
    const [programRes, reqRes, customRes, certRes, majorsRes] = await Promise.all([
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
      supabase
        .from("majors")
        .select("id, name_ar, name_en, group_code, sort_order")
        .eq("program_id", programId)
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
          options: cr.options || undefined,
          effect: cr.effect,
          negative_message: cr.negative_message || "",
          positive_message: cr.positive_message || "",
          sort_order: cr.sort_order,
          option_effects: cr.option_effects || null,
        }))
      );
    }

    if (certRes.data) {
      setCertTypes(certRes.data);
    }

    // Load majors with their subject requirements
    if (majorsRes.data && majorsRes.data.length > 0) {
      const majorIds = majorsRes.data.map((m) => m.id);
      const { data: subReqs } = await supabase
        .from("major_subject_requirements")
        .select("*")
        .in("major_id", majorIds)
        .order("sort_order");

      const subReqsByMajor = new Map<string, SubjectRequirement[]>();
      for (const sr of subReqs || []) {
        const list = subReqsByMajor.get(sr.major_id) || [];
        list.push({
          id: sr.id,
          certificate_type_id: sr.certificate_type_id,
          question_text: sr.question_text,
          question_type: sr.question_type,
          options: sr.options || undefined,
          effect: sr.effect,
          negative_message: sr.negative_message || "",
          positive_message: sr.positive_message || "",
          option_effects: sr.option_effects || null,
          sort_order: sr.sort_order,
        });
        subReqsByMajor.set(sr.major_id, list);
      }

      setMajors(
        majorsRes.data.map((m) => ({
          id: m.id,
          name_ar: m.name_ar,
          name_en: m.name_en || "",
          group_code: m.group_code || "",
          sort_order: m.sort_order,
          subject_requirements: subReqsByMajor.get(m.id) || [],
          _expanded: false,
        }))
      );
    }

    setLoading(false);
  }, [programId, supabase]);

  // eslint-disable-next-line react-hooks/rules-of-hooks
  useEffect(() => {
    loadData();
  }, [loadData]);

  /* ---------------------------------------------------------------- */
  /*  Requirements helpers                                             */
  /* ---------------------------------------------------------------- */

  function updateReq<K extends keyof Requirements>(key: K, value: Requirements[K]) {
    setReqs((prev) => ({ ...prev, [key]: value }));
  }

  /* ---------------------------------------------------------------- */
  /*  Custom requirements helpers                                      */
  /* ---------------------------------------------------------------- */

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

  function updateCustomReq(index: number, field: string, value: unknown) {
    setCustomReqs((prev) =>
      prev.map((cr, i) => {
        if (i !== index) return cr;
        const updated = { ...cr, [field]: value };
        // When switching from select to yes_no, clear options/option_effects
        if (field === "question_type" && value === "yes_no") {
          updated.options = undefined;
          updated.option_effects = null;
        }
        return updated;
      })
    );
  }

  function addOption(crIndex: number) {
    setCustomReqs((prev) =>
      prev.map((cr, i) => {
        if (i !== crIndex) return cr;
        return { ...cr, options: [...(cr.options || []), ""] };
      })
    );
  }

  function updateOption(crIndex: number, optIndex: number, value: string) {
    setCustomReqs((prev) =>
      prev.map((cr, i) => {
        if (i !== crIndex) return cr;
        const opts = [...(cr.options || [])];
        const oldLabel = opts[optIndex];
        opts[optIndex] = value;
        // Update option_effects key if it changed
        if (cr.option_effects && oldLabel && oldLabel in cr.option_effects) {
          const oe = { ...cr.option_effects };
          oe[value] = oe[oldLabel];
          delete oe[oldLabel];
          return { ...cr, options: opts, option_effects: oe };
        }
        return { ...cr, options: opts };
      })
    );
  }

  function removeOption(crIndex: number, optIndex: number) {
    setCustomReqs((prev) =>
      prev.map((cr, i) => {
        if (i !== crIndex) return cr;
        const opts = [...(cr.options || [])];
        const removed = opts[optIndex];
        opts.splice(optIndex, 1);
        let oe = cr.option_effects ? { ...cr.option_effects } : null;
        if (oe && removed && removed in oe) {
          delete oe[removed];
          if (Object.keys(oe).length === 0) oe = null;
        }
        return { ...cr, options: opts.length > 0 ? opts : undefined, option_effects: oe };
      })
    );
  }

  function updateOptionEffect(crIndex: number, optionLabel: string, field: "effect" | "message", value: string) {
    setCustomReqs((prev) =>
      prev.map((cr, i) => {
        if (i !== crIndex) return cr;
        const oe = { ...(cr.option_effects || {}) };
        const current = oe[optionLabel] || { effect: "none" as const, message: null };
        if (field === "effect") {
          oe[optionLabel] = { ...current, effect: value as OptionEffect["effect"], message: value === "none" ? null : current.message };
        } else {
          oe[optionLabel] = { ...current, message: value || null };
        }
        return { ...cr, option_effects: oe };
      })
    );
  }

  /* ---------------------------------------------------------------- */
  /*  Major helpers                                                    */
  /* ---------------------------------------------------------------- */

  function addMajor() {
    setMajors((prev) => [
      ...prev,
      {
        name_ar: "",
        name_en: "",
        group_code: "",
        sort_order: prev.length,
        subject_requirements: [],
        _expanded: true,
      },
    ]);
    setMajorsExpanded(true);
  }

  function removeMajor(index: number) {
    setMajors((prev) => prev.filter((_, i) => i !== index));
  }

  function updateMajor(index: number, field: string, value: unknown) {
    setMajors((prev) =>
      prev.map((m, i) => (i === index ? { ...m, [field]: value } : m))
    );
  }

  function toggleMajorExpanded(index: number) {
    setMajors((prev) =>
      prev.map((m, i) => (i === index ? { ...m, _expanded: !m._expanded } : m))
    );
  }

  function addSubjectReq(majorIndex: number) {
    setMajors((prev) =>
      prev.map((m, i) => {
        if (i !== majorIndex) return m;
        return {
          ...m,
          subject_requirements: [
            ...m.subject_requirements,
            {
              certificate_type_id: certTypes[0]?.id || "",
              question_text: "",
              question_type: "yes_no" as const,
              effect: "blocks_admission" as const,
              negative_message: "",
              positive_message: "",
              sort_order: m.subject_requirements.length,
            },
          ],
        };
      })
    );
  }

  function removeSubjectReq(majorIndex: number, srIndex: number) {
    setMajors((prev) =>
      prev.map((m, i) => {
        if (i !== majorIndex) return m;
        return {
          ...m,
          subject_requirements: m.subject_requirements.filter((_, j) => j !== srIndex),
        };
      })
    );
  }

  function updateSubjectReq(majorIndex: number, srIndex: number, field: string, value: unknown) {
    setMajors((prev) =>
      prev.map((m, i) => {
        if (i !== majorIndex) return m;
        return {
          ...m,
          subject_requirements: m.subject_requirements.map((sr, j) =>
            j === srIndex ? { ...sr, [field]: value } : sr
          ),
        };
      })
    );
  }

  /* ---------------------------------------------------------------- */
  /*  Save handlers                                                    */
  /* ---------------------------------------------------------------- */

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError("");
    setSaved(false);

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
        custom_requirements: customReqs.map((cr, i) => ({ ...cr, sort_order: i + 1 })),
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

  async function handleSaveMajors() {
    setSavingMajors(true);
    setSavedMajors(false);
    setError("");

    const payload = majors.map((m, mIdx) => ({
      id: m.id,
      name_ar: m.name_ar,
      name_en: m.name_en || undefined,
      group_code: m.group_code || undefined,
      sort_order: mIdx + 1,
      subject_requirements: m.subject_requirements.map((sr, srIdx) => ({
        id: sr.id,
        certificate_type_id: sr.certificate_type_id,
        question_text: sr.question_text,
        question_type: sr.question_type,
        options: sr.options || null,
        effect: sr.effect,
        negative_message: sr.negative_message || null,
        positive_message: sr.positive_message || null,
        option_effects: sr.option_effects || null,
        sort_order: srIdx + 1,
      })),
    }));

    const res = await fetch(`/api/programs/${programId}/majors`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ majors: payload }),
    });

    if (!res.ok) {
      const data = await res.json();
      setError(data.error || t("admin.saveError"));
      setSavingMajors(false);
      return;
    }

    setSavingMajors(false);
    setSavedMajors(true);
    setTimeout(() => setSavedMajors(false), 2000);
  }

  /* ---------------------------------------------------------------- */
  /*  Render                                                           */
  /* ---------------------------------------------------------------- */

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
        {/* ============ Program Info ============ */}
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
                className="w-full rounded-lg border border-white/10 bg-[#0f1c2e] px-4 py-2.5 text-white focus:border-blue-500 focus:outline-none"
              >
                {["foundation", "bachelor", "master", "phd", "language"].map((cat) => (
                  <option key={cat} value={cat} className="bg-[#0f1c2e] text-white">
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
                className="w-full rounded-lg border border-white/10 bg-[#0f1c2e] px-4 py-2.5 text-white focus:border-blue-500 focus:outline-none"
              >
                <option value="" className="bg-[#0f1c2e] text-white">—</option>
                {certTypes.map((ct) => (
                  <option key={ct.id} value={ct.id} className="bg-[#0f1c2e] text-white">
                    {ct.name_ar}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </section>

        {/* ============ Requirements ============ */}
        <section className="rounded-xl border border-white/10 bg-white/5 p-6 space-y-4">
          <h2 className="text-lg font-semibold text-white">{t("admin.requirements")}</h2>

          <div className="space-y-3">
            <Toggle label={t("admin.requiresHS")} checked={reqs.requires_hs} onChange={(v) => updateReq("requires_hs", v)} />
            <Toggle label={t("admin.requires12Years")} checked={reqs.requires_12_years} onChange={(v) => updateReq("requires_12_years", v)} />
            <Toggle label={t("admin.requiresBachelor")} checked={reqs.requires_bachelor} onChange={(v) => updateReq("requires_bachelor", v)} />

            <Toggle label={t("admin.requiresIELTS")} checked={reqs.requires_ielts} onChange={(v) => updateReq("requires_ielts", v)} />
            {reqs.requires_ielts && (
              <div className="mr-8 grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="block text-xs text-slate-400 mb-1">{t("admin.ieltsMin")}</label>
                  <input type="number" step="0.5" value={reqs.ielts_min ?? ""} onChange={(e) => updateReq("ielts_min", e.target.value ? Number(e.target.value) : null)} className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white focus:border-blue-500 focus:outline-none" />
                </div>
                <div>
                  <label className="block text-xs text-slate-400 mb-1">{t("admin.ieltsEffect")}</label>
                  <select value={reqs.ielts_effect || "blocks_if_below"} onChange={(e) => updateReq("ielts_effect", e.target.value)} className="w-full rounded-lg border border-white/10 bg-[#0f1c2e] px-3 py-2 text-sm text-white focus:border-blue-500 focus:outline-none">
                    <option value="blocks_if_below" className="bg-[#0f1c2e] text-white">{t("admin.blocks")}</option>
                    <option value="conditional" className="bg-[#0f1c2e] text-white">{t("admin.conditional")}</option>
                  </select>
                </div>
              </div>
            )}

            <Toggle label={t("admin.requiresSAT")} checked={reqs.requires_sat} onChange={(v) => updateReq("requires_sat", v)} />
            {reqs.requires_sat && (
              <div className="mr-8 grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="block text-xs text-slate-400 mb-1">{t("admin.satMin")}</label>
                  <input type="number" value={reqs.sat_min ?? ""} onChange={(e) => updateReq("sat_min", e.target.value ? Number(e.target.value) : null)} className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white focus:border-blue-500 focus:outline-none" />
                </div>
                <div>
                  <label className="block text-xs text-slate-400 mb-1">{t("admin.satEffect")}</label>
                  <select value={reqs.sat_effect || "blocks_if_below"} onChange={(e) => updateReq("sat_effect", e.target.value)} className="w-full rounded-lg border border-white/10 bg-[#0f1c2e] px-3 py-2 text-sm text-white focus:border-blue-500 focus:outline-none">
                    <option value="blocks_if_below" className="bg-[#0f1c2e] text-white">{t("admin.blocks")}</option>
                    <option value="conditional" className="bg-[#0f1c2e] text-white">{t("admin.conditional")}</option>
                  </select>
                </div>
              </div>
            )}

            <Toggle label={t("admin.requiresGPA")} checked={reqs.requires_gpa} onChange={(v) => updateReq("requires_gpa", v)} />
            {reqs.requires_gpa && (
              <div className="mr-8">
                <label className="block text-xs text-slate-400 mb-1">{t("admin.gpaMin")}</label>
                <input type="number" step="0.01" value={reqs.gpa_min ?? ""} onChange={(e) => updateReq("gpa_min", e.target.value ? Number(e.target.value) : null)} className="w-48 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white focus:border-blue-500 focus:outline-none" />
              </div>
            )}

            <Toggle label={t("admin.requiresEntranceExam")} checked={reqs.requires_entrance_exam} onChange={(v) => updateReq("requires_entrance_exam", v)} />
            <Toggle label={t("admin.requiresPortfolio")} checked={reqs.requires_portfolio} onChange={(v) => updateReq("requires_portfolio", v)} />
            <Toggle label={t("admin.requiresResearchPlan")} checked={reqs.requires_research_plan} onChange={(v) => updateReq("requires_research_plan", v)} />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">{t("admin.resultNotes")}</label>
            <textarea value={reqs.result_notes || ""} onChange={(e) => updateReq("result_notes", e.target.value || null)} rows={3} className="w-full rounded-lg border border-white/10 bg-white/5 px-4 py-2.5 text-white focus:border-blue-500 focus:outline-none" />
          </div>
        </section>

        {/* ============ Custom Requirements ============ */}
        <section className="rounded-xl border border-white/10 bg-white/5 p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-white">{t("admin.customRequirements")}</h2>
            <button type="button" onClick={addCustomReq} className="rounded-lg bg-white/10 px-4 py-2 text-sm text-white transition hover:bg-white/20">
              {t("admin.addCustomRequirement")}
            </button>
          </div>

          {customReqs.map((cr, index) => (
            <div key={cr.id || `new-${index}`} className="rounded-lg border border-white/5 bg-white/[0.02] p-4 space-y-3">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1">
                  <label className="block text-xs text-slate-400 mb-1">{t("admin.questionText")}</label>
                  <input type="text" value={cr.question_text} onChange={(e) => updateCustomReq(index, "question_text", e.target.value)} className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white focus:border-blue-500 focus:outline-none" />
                </div>
                <button type="button" onClick={() => removeCustomReq(index)} className="mt-5 text-sm text-red-400 hover:text-red-300">
                  {t("admin.removeCustomRequirement")}
                </button>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label className="block text-xs text-slate-400 mb-1">{t("admin.questionType")}</label>
                  <select value={cr.question_type} onChange={(e) => updateCustomReq(index, "question_type", e.target.value)} className="w-full rounded-lg border border-white/10 bg-[#0f1c2e] px-3 py-2 text-sm text-white focus:border-blue-500 focus:outline-none">
                    <option value="yes_no" className="bg-[#0f1c2e] text-white">نعم / لا</option>
                    <option value="select" className="bg-[#0f1c2e] text-white">اختيار</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-slate-400 mb-1">{t("admin.effect")}</label>
                  <select value={cr.effect} onChange={(e) => updateCustomReq(index, "effect", e.target.value)} className="w-full rounded-lg border border-white/10 bg-[#0f1c2e] px-3 py-2 text-sm text-white focus:border-blue-500 focus:outline-none">
                    <option value="blocks_admission" className="bg-[#0f1c2e] text-white">{t("admin.blocks")}</option>
                    <option value="makes_conditional" className="bg-[#0f1c2e] text-white">{t("admin.conditional")}</option>
                  </select>
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label className="block text-xs text-slate-400 mb-1">{t("admin.negativeMessage")}</label>
                  <input type="text" value={cr.negative_message} onChange={(e) => updateCustomReq(index, "negative_message", e.target.value)} className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white focus:border-blue-500 focus:outline-none" />
                </div>
                <div>
                  <label className="block text-xs text-slate-400 mb-1">{t("admin.positiveMessage")}</label>
                  <input type="text" value={cr.positive_message} onChange={(e) => updateCustomReq(index, "positive_message", e.target.value)} className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white focus:border-blue-500 focus:outline-none" />
                </div>
              </div>

              {/* Options for select type */}
              {cr.question_type === "select" && (
                <div className="border-t border-white/5 pt-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-medium text-slate-400">{t("admin.options")}</label>
                    <button type="button" onClick={() => addOption(index)} className="text-xs text-blue-400 hover:text-blue-300">
                      + {t("admin.addOption")}
                    </button>
                  </div>
                  {(cr.options || []).map((opt, optIdx) => (
                    <div key={optIdx} className="flex items-center gap-2">
                      <input type="text" value={opt} onChange={(e) => updateOption(index, optIdx, e.target.value)} placeholder={`خيار ${optIdx + 1}`} className="flex-1 rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-sm text-white focus:border-blue-500 focus:outline-none" />
                      <button type="button" onClick={() => removeOption(index, optIdx)} className="text-xs text-red-400 hover:text-red-300">
                        {t("admin.removeOption")}
                      </button>
                    </div>
                  ))}

                  {/* Option Effects */}
                  {cr.options && cr.options.length > 0 && cr.options.some((o) => o) && (
                    <div className="mt-3 rounded-lg border border-white/5 bg-white/[0.02] p-3 space-y-2">
                      <label className="text-xs font-medium text-slate-400">{t("admin.optionEffects")}</label>
                      {cr.options.map((opt) => {
                        if (!opt) return null;
                        const oe = cr.option_effects?.[opt] || { effect: "none", message: null };
                        return (
                          <div key={opt} className="flex items-start gap-2">
                            <span className="mt-1.5 min-w-[100px] text-xs text-slate-300 truncate">{opt}</span>
                            <select
                              value={oe.effect}
                              onChange={(e) => updateOptionEffect(index, opt, "effect", e.target.value)}
                              className="w-36 rounded-lg border border-white/10 bg-[#0f1c2e] px-2 py-1.5 text-xs text-white focus:border-blue-500 focus:outline-none"
                            >
                              <option value="none" className="bg-[#0f1c2e] text-white">{t("admin.effectNone")}</option>
                              <option value="blocks_admission" className="bg-[#0f1c2e] text-white">{t("admin.effectBlocks")}</option>
                              <option value="makes_conditional" className="bg-[#0f1c2e] text-white">{t("admin.effectConditional")}</option>
                            </select>
                            {oe.effect !== "none" && (
                              <input
                                type="text"
                                value={oe.message || ""}
                                onChange={(e) => updateOptionEffect(index, opt, "message", e.target.value)}
                                placeholder={t("admin.effectMessage")}
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
            </div>
          ))}

          {customReqs.length === 0 && (
            <p className="text-sm text-slate-500">—</p>
          )}
        </section>

        {error && <p className="text-sm text-red-400">{error}</p>}

        <div className="flex items-center gap-4">
          <button type="submit" disabled={saving} className="rounded-lg bg-blue-600 px-6 py-2.5 text-sm font-medium text-white transition hover:bg-blue-700 disabled:opacity-50">
            {saving ? t("admin.saving") : t("admin.saveChanges")}
          </button>
          {saved && <span className="text-sm text-green-400">{t("admin.saved")}</span>}
        </div>
      </form>

      {/* ============ Majors Section (separate save) ============ */}
      <section className="mt-8 rounded-xl border border-white/10 bg-white/5">
        <button
          type="button"
          onClick={() => setMajorsExpanded(!majorsExpanded)}
          className="flex w-full items-center justify-between p-6"
        >
          <h2 className="text-lg font-semibold text-white">{t("admin.majors")}</h2>
          <span className="text-slate-400">{majorsExpanded ? "▲" : "▼"}</span>
        </button>

        {majorsExpanded && (
          <div className="border-t border-white/10 p-6 space-y-4">
            {majors.length === 0 && (
              <p className="text-sm text-slate-500">{t("admin.noMajors")}</p>
            )}

            {majors.map((major, mIdx) => (
              <div key={major.id || `new-m-${mIdx}`} className="rounded-lg border border-white/5 bg-white/[0.02]">
                {/* Major header — collapsible */}
                <button
                  type="button"
                  onClick={() => toggleMajorExpanded(mIdx)}
                  className="flex w-full items-center justify-between px-4 py-3"
                >
                  <span className="text-sm font-medium text-white">
                    {major.name_ar || `تخصص ${mIdx + 1}`}
                    {major.group_code && (
                      <span className="mr-2 text-xs text-slate-400">({major.group_code})</span>
                    )}
                  </span>
                  <span className="text-xs text-slate-400">{major._expanded ? "▲" : "▼"}</span>
                </button>

                {major._expanded && (
                  <div className="border-t border-white/5 p-4 space-y-3">
                    <div className="grid gap-3 sm:grid-cols-2">
                      <div>
                        <label className="block text-xs text-slate-400 mb-1">{t("admin.majorName")}</label>
                        <input type="text" value={major.name_ar} onChange={(e) => updateMajor(mIdx, "name_ar", e.target.value)} className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white focus:border-blue-500 focus:outline-none" />
                      </div>
                      <div>
                        <label className="block text-xs text-slate-400 mb-1">{t("admin.majorNameEn")}</label>
                        <input type="text" value={major.name_en} onChange={(e) => updateMajor(mIdx, "name_en", e.target.value)} dir="ltr" className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white focus:border-blue-500 focus:outline-none" />
                      </div>
                    </div>

                    <div className="flex items-end gap-3">
                      <div className="flex-1">
                        <label className="block text-xs text-slate-400 mb-1">{t("admin.groupCode")}</label>
                        <input type="text" value={major.group_code} onChange={(e) => updateMajor(mIdx, "group_code", e.target.value)} dir="ltr" placeholder="G1" className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder-slate-600 focus:border-blue-500 focus:outline-none" />
                        <p className="mt-1 text-[10px] text-slate-500">{t("admin.groupCodeHint")}</p>
                      </div>
                      <div>
                        <button type="button" onClick={() => removeMajor(mIdx)} className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-2 text-sm text-red-400 hover:bg-red-500/20">
                          {t("admin.removeMajor")}
                        </button>
                      </div>
                    </div>

                    {/* Subject Requirements */}
                    <div className="border-t border-white/5 pt-3">
                      <div className="flex items-center justify-between mb-2">
                        <label className="text-xs font-medium text-slate-400">{t("admin.subjectRequirements")}</label>
                        <button type="button" onClick={() => addSubjectReq(mIdx)} className="text-xs text-blue-400 hover:text-blue-300">
                          + {t("admin.addSubjectReq")}
                        </button>
                      </div>

                      {major.subject_requirements.map((sr, srIdx) => (
                        <div key={sr.id || `new-sr-${srIdx}`} className="mb-3 rounded-lg border border-white/5 bg-white/[0.01] p-3 space-y-2">
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex-1 grid gap-2 sm:grid-cols-2">
                              <div>
                                <label className="block text-[10px] text-slate-500 mb-0.5">{t("admin.forCertificate")}</label>
                                <select
                                  value={sr.certificate_type_id}
                                  onChange={(e) => updateSubjectReq(mIdx, srIdx, "certificate_type_id", e.target.value)}
                                  className="w-full rounded-lg border border-white/10 bg-[#0f1c2e] px-2 py-1.5 text-xs text-white focus:border-blue-500 focus:outline-none"
                                >
                                  {certTypes.map((ct) => (
                                    <option key={ct.id} value={ct.id} className="bg-[#0f1c2e] text-white">{ct.name_ar}</option>
                                  ))}
                                </select>
                              </div>
                              <div>
                                <label className="block text-[10px] text-slate-500 mb-0.5">{t("admin.effect")}</label>
                                <select
                                  value={sr.effect}
                                  onChange={(e) => updateSubjectReq(mIdx, srIdx, "effect", e.target.value)}
                                  className="w-full rounded-lg border border-white/10 bg-[#0f1c2e] px-2 py-1.5 text-xs text-white focus:border-blue-500 focus:outline-none"
                                >
                                  <option value="blocks_admission" className="bg-[#0f1c2e] text-white">{t("admin.blocks")}</option>
                                  <option value="makes_conditional" className="bg-[#0f1c2e] text-white">{t("admin.conditional")}</option>
                                </select>
                              </div>
                            </div>
                            <button type="button" onClick={() => removeSubjectReq(mIdx, srIdx)} className="mt-3 text-[10px] text-red-400 hover:text-red-300">
                              {t("admin.removeSubjectReq")}
                            </button>
                          </div>

                          <div>
                            <label className="block text-[10px] text-slate-500 mb-0.5">{t("admin.questionText")}</label>
                            <input type="text" value={sr.question_text} onChange={(e) => updateSubjectReq(mIdx, srIdx, "question_text", e.target.value)} className="w-full rounded-lg border border-white/10 bg-white/5 px-2 py-1.5 text-xs text-white focus:border-blue-500 focus:outline-none" />
                          </div>

                          <div className="grid gap-2 sm:grid-cols-2">
                            <div>
                              <label className="block text-[10px] text-slate-500 mb-0.5">{t("admin.negativeMessage")}</label>
                              <input type="text" value={sr.negative_message} onChange={(e) => updateSubjectReq(mIdx, srIdx, "negative_message", e.target.value)} className="w-full rounded-lg border border-white/10 bg-white/5 px-2 py-1.5 text-xs text-white focus:border-blue-500 focus:outline-none" />
                            </div>
                            <div>
                              <label className="block text-[10px] text-slate-500 mb-0.5">{t("admin.positiveMessage")}</label>
                              <input type="text" value={sr.positive_message} onChange={(e) => updateSubjectReq(mIdx, srIdx, "positive_message", e.target.value)} className="w-full rounded-lg border border-white/10 bg-white/5 px-2 py-1.5 text-xs text-white focus:border-blue-500 focus:outline-none" />
                            </div>
                          </div>
                        </div>
                      ))}

                      {major.subject_requirements.length === 0 && (
                        <p className="text-xs text-slate-500">—</p>
                      )}
                    </div>
                  </div>
                )}
              </div>
            ))}

            <div className="flex items-center gap-4 pt-2">
              <button type="button" onClick={addMajor} className="rounded-lg bg-white/10 px-4 py-2 text-sm text-white transition hover:bg-white/20">
                {t("admin.addMajor")}
              </button>
              <button
                type="button"
                onClick={handleSaveMajors}
                disabled={savingMajors}
                className="rounded-lg bg-blue-600 px-6 py-2 text-sm font-medium text-white transition hover:bg-blue-700 disabled:opacity-50"
              >
                {savingMajors ? t("admin.saving") : t("admin.saveMajors")}
              </button>
              {savedMajors && <span className="text-sm text-green-400">{t("admin.saved")}</span>}
            </div>
          </div>
        )}
      </section>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Toggle component                                                   */
/* ------------------------------------------------------------------ */

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
