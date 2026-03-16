"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useAuth } from "@/lib/auth-context";
import { canEditUniversities } from "@/lib/permissions";
import { createSupabaseBrowserClient } from "@/lib/supabase-browser";
import Link from "next/link";
import { use } from "react";
import RuleCard from "@/components/rules/RuleCard";
import type { RuleData } from "@/components/rules/RuleCard";
import AddRuleMenu from "@/components/rules/AddRuleMenu";

/* ------------------------------------------------------------------ */
/*  Interfaces                                                         */
/* ------------------------------------------------------------------ */

interface OptionEffect {
  effect: "none" | "blocks_admission" | "makes_conditional";
  message: string | null;
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
  _expanded: boolean;
}

interface RuleTab {
  certTypeId: string | null;
  certTypeName: string;
  reqRowId: string | null;  // old requirements row id (for dual-write)
  rules: RuleData[];
}

/* ------------------------------------------------------------------ */
/*  Default config for new rules                                       */
/* ------------------------------------------------------------------ */

function defaultConfigForType(ruleType: string): Record<string, unknown> {
  switch (ruleType) {
    case "language_cert":
      return { accepted: [] };
    case "sat":
      return { min_score: null };
    case "gpa":
      return { min_gpa: null };
    case "a_levels":
      return { subjects_min: null, min_grade: null, requires_core: false };
    case "as_levels":
    case "o_levels":
      return { subjects_min: null, min_grade: null };
    case "custom_yes_no":
      return { question_text: "", question_type: "yes_no", negative_message: "", positive_message: "" };
    case "custom_select":
      return { question_text: "", question_type: "select", options: [], option_effects: {}, negative_message: "", positive_message: "" };
    default:
      return {};
  }
}

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
  const [isActive, setIsActive] = useState(true);

  // ─── Rule-based tabs ───
  const [tabs, setTabs] = useState<RuleTab[]>([]);
  const [activeTabIndex, setActiveTabIndex] = useState(0);
  const [showCertTypePicker, setShowCertTypePicker] = useState(false);

  const [certTypes, setCertTypes] = useState<CertificateType[]>([]);
  const [majors, setMajors] = useState<MajorData[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savingMajors, setSavingMajors] = useState(false);
  const [saved, setSaved] = useState(false);
  const [savedMajors, setSavedMajors] = useState(false);
  const [error, setError] = useState("");
  const [majorsExpanded, setMajorsExpanded] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [toast, setToast] = useState("");

  if (!canEditUniversities(user.role)) {
    router.replace(`/universities/${universityId}`);
    return null;
  }

  // Derived state: active tab
  const activeTab = tabs[activeTabIndex] || null;
  const rules = activeTab?.rules || [];

  // Get cert type slug for AddRuleMenu filtering
  const activeCertSlug = activeTab?.certTypeId
    ? certTypes.find((ct) => ct.id === activeTab.certTypeId)?.slug || null
    : null;

  const loadData = useCallback(async () => {
    const [programRes, certRes, majorsRes] = await Promise.all([
      supabase
        .from("programs")
        .select("name, category, complexity_level, is_active")
        .eq("id", programId)
        .single(),
      supabase
        .from("certificate_types")
        .select("id, slug, name_ar, sort_order")
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
      setIsActive(programRes.data.is_active ?? true);
    }

    const allCertTypes = certRes.data || [];
    if (allCertTypes.length > 0) {
      setCertTypes(allCertTypes);
    }

    // Load rules from requirement_rules via API
    const rulesRes = await fetch(`/api/rules/${programId}`);
    const rulesData = await rulesRes.json();
    const allRules: Array<{
      id: string;
      certificate_type_id: string | null;
      rule_type: string;
      config: Record<string, unknown>;
      effect: string;
      effect_message: string | null;
      sort_order: number;
      is_enabled: boolean;
    }> = rulesData.rules || [];
    const reqRowMap: Record<string, string> = rulesData.req_row_map || {};

    // Group rules by certificate_type_id
    const rulesByCert = new Map<string | null, typeof allRules>();
    for (const rule of allRules) {
      const key = rule.certificate_type_id;
      if (!rulesByCert.has(key)) rulesByCert.set(key, []);
      rulesByCert.get(key)!.push(rule);
    }

    const certTypeMap = new Map(
      allCertTypes.map((ct: { id: string; slug: string; name_ar: string; sort_order: number }) => [ct.id, ct])
    );

    const newTabs: RuleTab[] = [];

    // Legacy: if there are universal rules (certificate_type_id = null), show in special tab
    const universalRules = rulesByCert.get(null) || [];
    if (universalRules.length > 0) {
      newTabs.push({
        certTypeId: null,
        certTypeName: "غير مصنف",
        reqRowId: reqRowMap["__universal__"] || null,
        rules: universalRules.map((r) => ({
          id: r.id,
          rule_type: r.rule_type,
          config: r.config,
          effect: r.effect,
          effect_message: r.effect_message,
          sort_order: r.sort_order,
          is_enabled: r.is_enabled,
        })),
      });
    }

    // Cert-specific tabs
    const certTypeIds = Array.from(new Set(allRules.filter((r) => r.certificate_type_id).map((r) => r.certificate_type_id!)));
    certTypeIds.sort((a, b) => {
      const aSort = certTypeMap.get(a)?.sort_order ?? 999;
      const bSort = certTypeMap.get(b)?.sort_order ?? 999;
      return aSort - bSort;
    });

    for (const ctId of certTypeIds) {
      const certRules = rulesByCert.get(ctId) || [];
      newTabs.push({
        certTypeId: ctId,
        certTypeName: certTypeMap.get(ctId)?.name_ar || "—",
        reqRowId: reqRowMap[ctId] || null,
        rules: certRules.map((r) => ({
          id: r.id,
          rule_type: r.rule_type,
          config: r.config,
          effect: r.effect,
          effect_message: r.effect_message,
          sort_order: r.sort_order,
          is_enabled: r.is_enabled,
        })),
      });
    }

    // If no rules at all → empty tabs array (empty state)
    setTabs(newTabs);
    setActiveTabIndex(0);

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
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [programId, supabase]);

  // eslint-disable-next-line react-hooks/rules-of-hooks
  useEffect(() => {
    loadData();
  }, [loadData]);

  /* ---------------------------------------------------------------- */
  /*  Rule helpers (operate on active tab)                             */
  /* ---------------------------------------------------------------- */

  function addRule(ruleType: string) {
    setTabs((prev) =>
      prev.map((tab, i) => {
        if (i !== activeTabIndex) return tab;
        const newRule: RuleData = {
          rule_type: ruleType,
          config: defaultConfigForType(ruleType),
          effect: "blocks_admission",
          effect_message: null,
          sort_order: tab.rules.length,
          is_enabled: true,
        };
        return { ...tab, rules: [...tab.rules, newRule] };
      })
    );
  }

  function updateRule(ruleIndex: number, updated: RuleData) {
    setTabs((prev) =>
      prev.map((tab, i) => {
        if (i !== activeTabIndex) return tab;
        return {
          ...tab,
          rules: tab.rules.map((r, j) => (j === ruleIndex ? updated : r)),
        };
      })
    );
  }

  function removeRule(ruleIndex: number) {
    setTabs((prev) =>
      prev.map((tab, i) => {
        if (i !== activeTabIndex) return tab;
        return { ...tab, rules: tab.rules.filter((_, j) => j !== ruleIndex) };
      })
    );
  }

  /* ---------------------------------------------------------------- */
  /*  Cert type tab management                                         */
  /* ---------------------------------------------------------------- */

  function handleAddCertType(certTypeId: string) {
    const ct = certTypes.find((c) => c.id === certTypeId);
    if (!ct) return;

    const newTab: RuleTab = {
      certTypeId: ct.id,
      certTypeName: ct.name_ar,
      reqRowId: null,
      rules: [],
    };
    setTabs((prev) => [...prev, newTab]);
    setActiveTabIndex(tabs.length);
    setShowCertTypePicker(false);
    setToast(`تم إضافة تبويب ${ct.name_ar}`);
    setTimeout(() => setToast(""), 3000);
  }

  async function handleRemoveCertType(tabIndex: number) {
    const tab = tabs[tabIndex];
    if (!confirm(t("admin.confirmRemoveCertType"))) return;

    // Delete rules from DB
    setSaving(true);
    await fetch(`/api/rules/${programId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        certificate_type_id: tab.certTypeId,
        rules: [],
        req_row_id: tab.reqRowId,
      }),
    });

    // Also delete the old requirements row
    if (tab.reqRowId) {
      await fetch(`/api/programs/${programId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ delete_requirement_row_id: tab.reqRowId }),
      });
    }
    setSaving(false);

    setTabs((prev) => prev.filter((_, i) => i !== tabIndex));
    setActiveTabIndex((prev) => Math.min(prev, tabs.length - 2));
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
  /*  Delete handler                                                   */
  /* ---------------------------------------------------------------- */

  async function handleDeleteProgram() {
    setDeleting(true);
    setError("");
    try {
      const res = await fetch(`/api/admin/programs/${programId}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const data = await res.json();
        setError(data.error || "Delete failed");
        setDeleting(false);
        return;
      }
      router.replace(`/universities/${universityId}`);
    } catch {
      setError("Delete failed");
      setDeleting(false);
    }
  }

  /* ---------------------------------------------------------------- */
  /*  Save handlers                                                    */
  /* ---------------------------------------------------------------- */

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError("");
    setSaved(false);

    // Update program info
    await fetch(`/api/programs/${programId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        program: {
          name: programName,
          category,
          is_active: isActive,
        },
      }),
    });

    // Save rules for the active tab via rules API (includes dual-write)
    if (activeTab) {
      const res = await fetch(`/api/rules/${programId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          certificate_type_id: activeTab.certTypeId,
          rules: activeTab.rules.map((r, i) => ({
            ...r,
            sort_order: i,
          })),
          req_row_id: activeTab.reqRowId,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        setError(data.error || t("admin.saveError"));
        setSaving(false);
        return;
      }

      // Update reqRowId if a new one was created
      const data = await res.json();
      if (data.req_row_id) {
        setTabs((prev) =>
          prev.map((tab, i) =>
            i === activeTabIndex ? { ...tab, reqRowId: data.req_row_id } : tab
          )
        );
      }
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

  // Cert types not yet used in any tab (for the picker)
  const usedCertTypeIds = new Set(tabs.map((t) => t.certTypeId).filter(Boolean));
  const availableCertTypes = certTypes.filter((ct) => !usedCertTypeIds.has(ct.id));

  return (
    <div>
      <Link
        href={`/universities/${universityId}`}
        className="inline-flex items-center gap-2 text-sm text-slate-400 transition hover:text-white mb-6"
      >
        <span>←</span>
        {t("universities.backToList")}
      </Link>

      <div className="flex items-center gap-4 mb-8">
        <h1 className="text-2xl font-bold text-white">
          {t("admin.editProgram")}
        </h1>
        {!isActive && (
          <span className="rounded-full bg-red-500/15 px-3 py-1 text-sm font-medium text-red-400">
            {t("admin.programInactive")}
          </span>
        )}
      </div>

      <form onSubmit={handleSubmit} className="space-y-8">
        {/* ============ Program Info ============ */}
        <section className="rounded-xl border border-white/10 bg-white/5 p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-white">
              {t("admin.programInfo")}
            </h2>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setIsActive(!isActive)}
                className={`rounded-lg px-4 py-2 text-sm font-medium transition ${
                  isActive
                    ? "bg-red-500/15 text-red-400 hover:bg-red-500/25"
                    : "bg-green-500/15 text-green-400 hover:bg-green-500/25"
                }`}
              >
                {isActive ? t("admin.deactivateProgram") : t("admin.activateProgram")}
              </button>
              <button
                type="button"
                onClick={() => setShowDeleteConfirm(true)}
                className="rounded-lg bg-red-600/20 px-4 py-2 text-sm font-medium text-red-400 transition hover:bg-red-600/30 border border-red-500/20"
              >
                {t("admin.deleteProgramButton")}
              </button>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">
                {t("admin.programName")}
              </label>
              <input
                type="text"
                value={programName}
                onChange={(e) => setProgramName(e.target.value)}
                className="w-full rounded-lg border border-white/10 bg-white/5 px-4 py-2.5 text-white focus:border-blue-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">
                {t("admin.category")}
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
          </div>
        </section>

        {/* ============ Certificate Type Tabs + Add Cert Type ============ */}
        <div className="flex flex-wrap items-center gap-1 border-b border-white/10 pb-0">
          {tabs.map((tab, idx) => (
            <div key={tab.certTypeId || "__legacy__"} className="flex items-center">
              <button
                type="button"
                onClick={() => setActiveTabIndex(idx)}
                className={`px-4 py-2.5 text-sm font-medium rounded-t-lg transition ${
                  idx === activeTabIndex
                    ? "bg-white/10 text-white border-b-2 border-blue-500"
                    : "text-slate-400 hover:text-white hover:bg-white/5"
                }`}
              >
                {tab.certTypeName}
              </button>
              <button
                type="button"
                onClick={() => handleRemoveCertType(idx)}
                className="px-1.5 py-1 text-xs text-red-400/60 hover:text-red-400 transition"
                title={t("admin.removeCertType")}
              >
                ✕
              </button>
            </div>
          ))}

          {/* Add cert type dropdown */}
          {availableCertTypes.length > 0 && (
            showCertTypePicker ? (
              <div className="flex items-center gap-2 px-2">
                <select
                  onChange={(e) => {
                    if (e.target.value) handleAddCertType(e.target.value);
                  }}
                  defaultValue=""
                  className="rounded-lg border border-white/10 bg-[#0f1c2e] px-3 py-1.5 text-sm text-white focus:border-blue-500 focus:outline-none"
                >
                  <option value="" className="bg-[#0f1c2e] text-white">
                    {t("admin.selectCertTypeToAdd")}
                  </option>
                  {availableCertTypes.map((ct) => (
                    <option key={ct.id} value={ct.id} className="bg-[#0f1c2e] text-white">
                      {ct.name_ar}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={() => setShowCertTypePicker(false)}
                  className="text-xs text-slate-400 hover:text-white"
                >
                  ✕
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setShowCertTypePicker(true)}
                className="px-3 py-2.5 text-sm text-blue-400 hover:text-blue-300 transition"
              >
                + {t("admin.addCertType")}
              </button>
            )
          )}
        </div>

        {/* ============ Empty state: no tabs at all ============ */}
        {tabs.length === 0 && (
          <section className="rounded-xl border border-dashed border-white/20 bg-white/[0.02] p-8 text-center space-y-4">
            <p className="text-base text-slate-400">لا توجد شروط بعد</p>
            <p className="text-sm text-slate-500">أضف نوع شهادة لبدء تحديد شروط القبول</p>
            {availableCertTypes.length > 0 && (
              <div className="flex justify-center">
                <select
                  onChange={(e) => {
                    if (e.target.value) handleAddCertType(e.target.value);
                  }}
                  defaultValue=""
                  className="rounded-lg border border-blue-500/30 bg-blue-600/10 px-5 py-2.5 text-sm font-medium text-blue-400 focus:border-blue-500 focus:outline-none"
                >
                  <option value="" className="bg-[#0f1c2e] text-white">
                    + إضافة نوع شهادة
                  </option>
                  {availableCertTypes.map((ct) => (
                    <option key={ct.id} value={ct.id} className="bg-[#0f1c2e] text-white">
                      {ct.name_ar}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </section>
        )}

        {/* ============ Requirements Rules (active tab) ============ */}
        {activeTab && (
          <section className="rounded-xl border border-white/10 bg-white/5 p-6 space-y-4">
            {/* Legacy warning for unclassified (null cert type) tab */}
            {activeTab.certTypeId === null && (
              <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-300">
                هذه شروط قديمة بدون نوع شهادة محدد. يرجى نقلها إلى تبويب شهادة.
              </div>
            )}

            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-white">{t("admin.requirements")}</h2>
              <AddRuleMenu
                certSlug={activeCertSlug}
                existingRuleTypes={rules.map((r) => r.rule_type)}
                onAdd={addRule}
              />
            </div>

            <div className="space-y-3">
              {rules.map((rule, index) => (
                <RuleCard
                  key={rule.id || `new-${index}-${rule.rule_type}`}
                  rule={rule}
                  onChange={(updated) => updateRule(index, updated)}
                  onRemove={() => removeRule(index)}
                />
              ))}

              {rules.length === 0 && (
                <div className="text-center py-8">
                  <p className="text-sm text-slate-500 mb-2">لا توجد شروط بعد</p>
                  <p className="text-xs text-slate-600">اضغط &quot;+ إضافة شرط&quot; لإضافة شروط القبول</p>
                </div>
              )}
            </div>
          </section>
        )}

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

      {/* ============ Toast ============ */}
      {toast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 rounded-lg bg-blue-600 px-6 py-3 text-sm font-medium text-white shadow-lg">
          {toast}
        </div>
      )}

      {/* ============ Delete Confirmation Dialog ============ */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
          <div className="w-full max-w-md rounded-xl border border-white/10 bg-[#0f1c2e] p-6 shadow-xl">
            <h3 className="text-lg font-bold text-white mb-3">
              {t("admin.deleteProgramButton")}
            </h3>
            <p className="text-sm text-slate-300 mb-6">
              {t("admin.confirmDeleteProgram")}
            </p>
            <div className="flex items-center gap-3 justify-end">
              <button
                type="button"
                onClick={() => setShowDeleteConfirm(false)}
                disabled={deleting}
                className="rounded-lg bg-white/10 px-4 py-2 text-sm text-white transition hover:bg-white/20 disabled:opacity-50"
              >
                {t("common.cancel")}
              </button>
              <button
                type="button"
                onClick={handleDeleteProgram}
                disabled={deleting}
                className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-red-700 disabled:opacity-50"
              >
                {deleting ? t("admin.deleting") : t("admin.confirmDelete")}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
