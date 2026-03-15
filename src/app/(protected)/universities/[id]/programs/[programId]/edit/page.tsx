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
  certificate_type_id?: string | null;
  question_text: string;
  question_type: "yes_no" | "select";
  options?: string[];
  effect: "blocks_admission" | "makes_conditional";
  negative_message: string;
  positive_message: string;
  sort_order: number;
  option_effects?: Record<string, OptionEffect> | null;
  show_in_comparison: boolean;
  comparison_input_type: "toggle" | "number" | "select" | null;
  comparison_key: string;
}

interface LanguageCertEntry {
  type: string;
  min_score: number;
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
  // A Level fields (British certificates)
  requires_a_levels: boolean;
  a_level_subjects_min: number | null;
  a_level_min_grade: string | null;
  a_level_requires_core: boolean;
  a_level_effect: string | null;
  // IB fields (International Baccalaureate)
  requires_ib: boolean;
  ib_min_points: number | null;
  ib_effect: string | null;
  // Language certificate fields (multi-cert: IELTS, TOEFL, Duolingo, etc.)
  requires_language_cert: boolean;
  accepted_language_certs: LanguageCertEntry[] | null;
  language_cert_effect: string | null;
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

interface CertTypeTab {
  certTypeId: string | null;
  certTypeName: string;
  reqRowId: string | null;
  reqs: Requirements;
  customReqs: CustomRequirement[];
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
  requires_a_levels: false,
  a_level_subjects_min: null,
  a_level_min_grade: null,
  a_level_requires_core: false,
  a_level_effect: null,
  requires_ib: false,
  ib_min_points: null,
  ib_effect: null,
  requires_language_cert: false,
  accepted_language_certs: null,
  language_cert_effect: null,
};

/* ------------------------------------------------------------------ */
/*  Field visibility per certificate type                              */
/* ------------------------------------------------------------------ */

type FieldGroup = "hs_12years" | "gpa" | "language_cert" | "sat" | "entrance_exam" | "portfolio" | "research_plan" | "bachelor" | "a_levels" | "ib";

function getVisibleFields(certTypeSlug: string | null, programCategory: string): Set<FieldGroup> {
  // Universal (null slug) → show everything
  if (!certTypeSlug) {
    return new Set<FieldGroup>(["hs_12years", "gpa", "language_cert", "sat", "entrance_exam", "portfolio", "research_plan", "bachelor", "a_levels", "ib"]);
  }

  const fields = new Set<FieldGroup>();

  // Common fields
  fields.add("language_cert");
  fields.add("entrance_exam");
  fields.add("portfolio");
  fields.add("research_plan");

  // Master/PhD always need bachelor
  if (programCategory === "master" || programCategory === "phd") {
    fields.add("bachelor");
  }

  switch (certTypeSlug) {
    case "arabic":
      fields.add("hs_12years");
      fields.add("gpa");
      fields.add("sat");
      break;
    case "british":
      fields.add("a_levels");
      fields.add("sat");
      break;
    case "ib":
      fields.add("ib");
      fields.add("sat");
      break;
    case "american":
      fields.add("hs_12years");
      fields.add("gpa");
      fields.add("sat");
      break;
    default:
      // Unknown cert type → show everything
      fields.add("hs_12years");
      fields.add("gpa");
      fields.add("sat");
      fields.add("a_levels");
      fields.add("ib");
      fields.add("bachelor");
      break;
  }

  return fields;
}

const LANGUAGE_CERT_TYPES = ["IELTS", "TOEFL", "Duolingo", "Cambridge", "PTE"];

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function mapRowToReqs(row: Record<string, unknown>): Requirements {
  return {
    requires_hs: (row.requires_hs as boolean) ?? false,
    requires_12_years: (row.requires_12_years as boolean) ?? false,
    requires_bachelor: (row.requires_bachelor as boolean) ?? false,
    requires_ielts: (row.requires_ielts as boolean) ?? false,
    ielts_min: (row.ielts_min as number | null) ?? null,
    ielts_effect: (row.ielts_effect as string | null) ?? null,
    requires_sat: (row.requires_sat as boolean) ?? false,
    sat_min: (row.sat_min as number | null) ?? null,
    sat_effect: (row.sat_effect as string | null) ?? null,
    requires_gpa: (row.requires_gpa as boolean) ?? false,
    gpa_min: (row.gpa_min as number | null) ?? null,
    requires_entrance_exam: (row.requires_entrance_exam as boolean) ?? false,
    requires_portfolio: (row.requires_portfolio as boolean) ?? false,
    requires_research_plan: (row.requires_research_plan as boolean) ?? false,
    result_notes: (row.result_notes as string | null) ?? null,
    requires_a_levels: (row.requires_a_levels as boolean) ?? false,
    a_level_subjects_min: (row.a_level_subjects_min as number | null) ?? null,
    a_level_min_grade: (row.a_level_min_grade as string | null) ?? null,
    a_level_requires_core: (row.a_level_requires_core as boolean) ?? false,
    a_level_effect: (row.a_level_effect as string | null) ?? null,
    requires_ib: (row.requires_ib as boolean) ?? false,
    ib_min_points: (row.ib_min_points as number | null) ?? null,
    ib_effect: (row.ib_effect as string | null) ?? null,
    requires_language_cert: (row.requires_language_cert as boolean) ?? false,
    accepted_language_certs: (row.accepted_language_certs as LanguageCertEntry[] | null) ?? null,
    language_cert_effect: (row.language_cert_effect as string | null) ?? null,
  };
}

function mapCustomRow(cr: Record<string, unknown>): CustomRequirement {
  return {
    id: cr.id as string,
    certificate_type_id: (cr.certificate_type_id as string | null) || null,
    question_text: cr.question_text as string,
    question_type: cr.question_type as "yes_no" | "select",
    options: (cr.options as string[] | null) || undefined,
    effect: cr.effect as "blocks_admission" | "makes_conditional",
    negative_message: (cr.negative_message as string) || "",
    positive_message: (cr.positive_message as string) || "",
    sort_order: cr.sort_order as number,
    option_effects: (cr.option_effects as Record<string, OptionEffect> | null) || null,
    show_in_comparison: (cr.show_in_comparison as boolean) || false,
    comparison_input_type: (cr.comparison_input_type as "toggle" | "number" | "select" | null) || null,
    comparison_key: (cr.comparison_key as string) || "",
  };
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
  const [originalComplexity, setOriginalComplexity] = useState("simple");
  const [isActive, setIsActive] = useState(true);

  // ─── Cert-type tabs ───
  const [tabs, setTabs] = useState<CertTypeTab[]>([]);
  const [activeTabIndex, setActiveTabIndex] = useState(0);
  const [isUniversal, setIsUniversal] = useState(true);
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
  const reqs = activeTab?.reqs || defaultReqs;
  const customReqs = activeTab?.customReqs || [];

  // Get cert type slug for field visibility
  const activeCertSlug = activeTab?.certTypeId
    ? certTypes.find((ct) => ct.id === activeTab.certTypeId)?.slug || null
    : null;
  const visibleFields = getVisibleFields(activeCertSlug, category);

  const loadData = useCallback(async () => {
    const [programRes, reqRes, customRes, certRes, majorsRes] = await Promise.all([
      supabase
        .from("programs")
        .select("name, category, complexity_level, is_active")
        .eq("id", programId)
        .single(),
      supabase
        .from("requirements")
        .select("*")
        .eq("program_id", programId),
      supabase
        .from("custom_requirements")
        .select("*")
        .eq("program_id", programId)
        .order("sort_order"),
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
      setOriginalComplexity(programRes.data.complexity_level || "simple");
      setIsActive(programRes.data.is_active ?? true);
    }

    // ─── Build cert-type tabs ───
    const reqRows = reqRes.data || [];
    const customRows = customRes.data || [];
    const allCertTypes = certRes.data || [];

    if (allCertTypes.length > 0) {
      setCertTypes(allCertTypes);
    }

    const hasSpecificCertTypes = reqRows.some(
      (r: Record<string, unknown>) => r.certificate_type_id !== null
    );

    if (!hasSpecificCertTypes) {
      // Universal mode — single tab, no tab bar
      const row = reqRows[0] || null;
      const tabData: CertTypeTab = {
        certTypeId: null,
        certTypeName: t("admin.universalRequirements"),
        reqRowId: (row?.id as string) || null,
        reqs: row ? mapRowToReqs(row) : { ...defaultReqs },
        customReqs: customRows
          .filter((cr: Record<string, unknown>) => !cr.certificate_type_id)
          .map(mapCustomRow),
      };
      setTabs([tabData]);
      setIsUniversal(true);
    } else {
      // Multi-cert mode — one tab per cert type (no universal tab)
      const certTypeMap = new Map(
        allCertTypes.map((ct: { id: string; slug: string; name_ar: string; sort_order: number }) => [ct.id, ct])
      );

      const certSpecificRows = reqRows
        .filter((r: Record<string, unknown>) => r.certificate_type_id !== null)
        .sort((a: Record<string, unknown>, b: Record<string, unknown>) => {
          const aSort = certTypeMap.get(a.certificate_type_id as string)?.sort_order ?? 999;
          const bSort = certTypeMap.get(b.certificate_type_id as string)?.sort_order ?? 999;
          return aSort - bSort;
        });

      const newTabs: CertTypeTab[] = certSpecificRows.map(
        (row: Record<string, unknown>) => {
          const ctId = row.certificate_type_id as string;
          return {
            certTypeId: ctId,
            certTypeName: certTypeMap.get(ctId)?.name_ar || "—",
            reqRowId: row.id as string,
            reqs: mapRowToReqs(row),
            customReqs: customRows
              .filter((cr: Record<string, unknown>) => cr.certificate_type_id === ctId)
              .map(mapCustomRow),
          };
        }
      );

      setTabs(newTabs);
      setIsUniversal(false);
    }

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
  /*  Requirements helpers (operate on active tab)                     */
  /* ---------------------------------------------------------------- */

  function updateReq<K extends keyof Requirements>(key: K, value: Requirements[K]) {
    setTabs((prev) =>
      prev.map((tab, i) =>
        i === activeTabIndex ? { ...tab, reqs: { ...tab.reqs, [key]: value } } : tab
      )
    );
  }

  /* ---------------------------------------------------------------- */
  /*  Custom requirements helpers (operate on active tab)              */
  /* ---------------------------------------------------------------- */

  function addCustomReq() {
    setTabs((prev) =>
      prev.map((tab, i) => {
        if (i !== activeTabIndex) return tab;
        return {
          ...tab,
          customReqs: [
            ...tab.customReqs,
            {
              certificate_type_id: tab.certTypeId,
              question_text: "",
              question_type: "yes_no",
              effect: "blocks_admission",
              negative_message: "",
              positive_message: "",
              sort_order: tab.customReqs.length,
              show_in_comparison: false,
              comparison_input_type: null,
              comparison_key: "",
            },
          ],
        };
      })
    );
  }

  function removeCustomReq(index: number) {
    setTabs((prev) =>
      prev.map((tab, i) => {
        if (i !== activeTabIndex) return tab;
        return { ...tab, customReqs: tab.customReqs.filter((_, j) => j !== index) };
      })
    );
  }

  function updateCustomReq(index: number, field: string, value: unknown) {
    setTabs((prev) =>
      prev.map((tab, i) => {
        if (i !== activeTabIndex) return tab;
        return {
          ...tab,
          customReqs: tab.customReqs.map((cr, j) => {
            if (j !== index) return cr;
            const updated = { ...cr, [field]: value };
            if (field === "question_type" && value === "yes_no") {
              updated.options = undefined;
              updated.option_effects = null;
            }
            return updated;
          }),
        };
      })
    );
  }

  function addOption(crIndex: number) {
    setTabs((prev) =>
      prev.map((tab, i) => {
        if (i !== activeTabIndex) return tab;
        return {
          ...tab,
          customReqs: tab.customReqs.map((cr, j) => {
            if (j !== crIndex) return cr;
            return { ...cr, options: [...(cr.options || []), ""] };
          }),
        };
      })
    );
  }

  function updateOption(crIndex: number, optIndex: number, value: string) {
    setTabs((prev) =>
      prev.map((tab, i) => {
        if (i !== activeTabIndex) return tab;
        return {
          ...tab,
          customReqs: tab.customReqs.map((cr, j) => {
            if (j !== crIndex) return cr;
            const opts = [...(cr.options || [])];
            const oldLabel = opts[optIndex];
            opts[optIndex] = value;
            if (cr.option_effects && oldLabel && oldLabel in cr.option_effects) {
              const oe = { ...cr.option_effects };
              oe[value] = oe[oldLabel];
              delete oe[oldLabel];
              return { ...cr, options: opts, option_effects: oe };
            }
            return { ...cr, options: opts };
          }),
        };
      })
    );
  }

  function removeOption(crIndex: number, optIndex: number) {
    setTabs((prev) =>
      prev.map((tab, i) => {
        if (i !== activeTabIndex) return tab;
        return {
          ...tab,
          customReqs: tab.customReqs.map((cr, j) => {
            if (j !== crIndex) return cr;
            const opts = [...(cr.options || [])];
            const removed = opts[optIndex];
            opts.splice(optIndex, 1);
            let oe = cr.option_effects ? { ...cr.option_effects } : null;
            if (oe && removed && removed in oe) {
              delete oe[removed];
              if (Object.keys(oe).length === 0) oe = null;
            }
            return { ...cr, options: opts.length > 0 ? opts : undefined, option_effects: oe };
          }),
        };
      })
    );
  }

  function updateOptionEffect(crIndex: number, optionLabel: string, field: "effect" | "message", value: string) {
    setTabs((prev) =>
      prev.map((tab, i) => {
        if (i !== activeTabIndex) return tab;
        return {
          ...tab,
          customReqs: tab.customReqs.map((cr, j) => {
            if (j !== crIndex) return cr;
            const oe = { ...(cr.option_effects || {}) };
            const current = oe[optionLabel] || { effect: "none" as const, message: null };
            if (field === "effect") {
              oe[optionLabel] = { ...current, effect: value as OptionEffect["effect"], message: value === "none" ? null : current.message };
            } else {
              oe[optionLabel] = { ...current, message: value || null };
            }
            return { ...cr, option_effects: oe };
          }),
        };
      })
    );
  }

  /* ---------------------------------------------------------------- */
  /*  Language certificate helpers                                      */
  /* ---------------------------------------------------------------- */

  function addLanguageCert() {
    setTabs((prev) =>
      prev.map((tab, i) => {
        if (i !== activeTabIndex) return tab;
        const current = tab.reqs.accepted_language_certs || [];
        return {
          ...tab,
          reqs: {
            ...tab.reqs,
            accepted_language_certs: [...current, { type: "IELTS", min_score: 0 }],
          },
        };
      })
    );
  }

  function removeLanguageCert(certIndex: number) {
    setTabs((prev) =>
      prev.map((tab, i) => {
        if (i !== activeTabIndex) return tab;
        const current = tab.reqs.accepted_language_certs || [];
        const updated = current.filter((_, j) => j !== certIndex);
        return {
          ...tab,
          reqs: {
            ...tab.reqs,
            accepted_language_certs: updated.length > 0 ? updated : null,
          },
        };
      })
    );
  }

  function updateLanguageCert(certIndex: number, field: "type" | "min_score", value: string | number) {
    setTabs((prev) =>
      prev.map((tab, i) => {
        if (i !== activeTabIndex) return tab;
        const current = [...(tab.reqs.accepted_language_certs || [])];
        current[certIndex] = { ...current[certIndex], [field]: value };
        return {
          ...tab,
          reqs: { ...tab.reqs, accepted_language_certs: current },
        };
      })
    );
  }

  /* ---------------------------------------------------------------- */
  /*  Cert type tab management                                         */
  /* ---------------------------------------------------------------- */

  async function handleAddCertType(certTypeId: string) {
    const ct = certTypes.find((c) => c.id === certTypeId);
    if (!ct) return;

    if (isUniversal && tabs.length === 1 && tabs[0].certTypeId === null) {
      // Converting from universal mode → first cert-specific tab
      // COPY universal requirements into the new cert tab
      const universalTab = tabs[0];

      // Call API to convert the universal row's certificate_type_id
      if (universalTab.reqRowId) {
        setSaving(true);
        await fetch(`/api/programs/${programId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            convert_cert_type: {
              req_row_id: universalTab.reqRowId,
              from_cert_type_id: null,
              to_cert_type_id: certTypeId,
            },
          }),
        });
        setSaving(false);
      }

      // Reload data from DB to ensure state is fully consistent
      // (API handler already migrates custom_requirements + legacy IELTS → language_cert)
      setShowCertTypePicker(false);
      setToast(`تم نسخ الشروط العامة إلى تبويب ${ct.name_ar}`);
      setTimeout(() => setToast(""), 3000);
      await loadData();
      // Find and activate the newly converted tab
      setTabs((prev) => {
        const idx = prev.findIndex((tab) => tab.certTypeId === certTypeId);
        if (idx >= 0) setActiveTabIndex(idx);
        return prev;
      });
    } else {
      // Already in multi-cert mode — add new tab with empty defaults
      const newTab: CertTypeTab = {
        certTypeId: ct.id,
        certTypeName: ct.name_ar,
        reqRowId: null,
        reqs: { ...defaultReqs },
        customReqs: [],
      };

      setTabs((prev) => [...prev, newTab]);
      setActiveTabIndex(tabs.length);
      setShowCertTypePicker(false);
    }
  }

  async function handleRemoveCertType(tabIndex: number) {
    const tab = tabs[tabIndex];

    if (!confirm(t("admin.confirmRemoveCertType"))) return;

    if (tabs.length <= 1) {
      // Removing the LAST cert-specific tab → convert back to universal
      if (tab.reqRowId && tab.certTypeId) {
        setSaving(true);
        await fetch(`/api/programs/${programId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            convert_cert_type: {
              req_row_id: tab.reqRowId,
              from_cert_type_id: tab.certTypeId,
              to_cert_type_id: null,
            },
          }),
        });
        setSaving(false);
      }

      // Convert tab to universal
      setTabs([{
        certTypeId: null,
        certTypeName: t("admin.universalRequirements"),
        reqRowId: tab.reqRowId,
        reqs: { ...tab.reqs },
        customReqs: tab.customReqs.map((cr) => ({
          ...cr,
          certificate_type_id: null,
        })),
      }]);
      setActiveTabIndex(0);
      setIsUniversal(true);
      setToast("تم تحويل الشروط إلى شروط عامة");
      setTimeout(() => setToast(""), 3000);
      return;
    }

    // Removing one of multiple tabs — delete the row from DB
    if (tab.reqRowId) {
      setSaving(true);
      await fetch(`/api/programs/${programId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ delete_requirement_row_id: tab.reqRowId }),
      });
      setSaving(false);
    }

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
    if (!activeTab) return;
    setSaving(true);
    setError("");
    setSaved(false);

    // Compute complexity from ALL tabs
    let computedComplexity = "simple";
    if (originalComplexity === "complex") {
      computedComplexity = "complex";
    } else if (tabs.some((tab) => tab.customReqs.length > 0)) {
      computedComplexity = "hybrid";
    }

    const res = await fetch(`/api/programs/${programId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        program: {
          name: programName,
          category,
          complexity_level: computedComplexity,
          is_active: isActive,
        },
        certificate_type_id: activeTab.certTypeId,
        req_row_id: activeTab.reqRowId,
        requirements: activeTab.reqs,
        custom_requirements: activeTab.customReqs.map((cr, i) => ({
          ...cr,
          certificate_type_id: activeTab.certTypeId,
          sort_order: i + 1,
        })),
      }),
    });

    if (!res.ok) {
      const data = await res.json();
      setError(data.error || t("admin.saveError"));
      setSaving(false);
      return;
    }

    // If a new requirements row was created, update the tab's reqRowId
    const data = await res.json();
    if (data.req_row_id) {
      setTabs((prev) =>
        prev.map((tab, i) =>
          i === activeTabIndex ? { ...tab, reqRowId: data.req_row_id } : tab
        )
      );
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

        {/* ============ Certificate Type Tabs ============ */}
        {!isUniversal && (
          <div className="flex flex-wrap items-center gap-1 border-b border-white/10 pb-0">
            {tabs.map((tab, idx) => (
              <div key={tab.certTypeId || "__universal__"} className="flex items-center">
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

            {/* Add cert type */}
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
        )}

        {/* Universal label */}
        {isUniversal && (
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-slate-300">
              {t("admin.universalRequirements")}
            </h2>
            {availableCertTypes.length > 0 && (
              showCertTypePicker ? (
                <div className="flex items-center gap-2">
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
                  className="text-sm text-blue-400 hover:text-blue-300 transition"
                >
                  + {t("admin.addCertType")}
                </button>
              )
            )}
          </div>
        )}

        {/* ============ Requirements (active tab) ============ */}
        <section className="rounded-xl border border-white/10 bg-white/5 p-6 space-y-4">
          <h2 className="text-lg font-semibold text-white">{t("admin.requirements")}</h2>

          <div className="space-y-3">
            {/* --- HS / 12 years --- */}
            {visibleFields.has("hs_12years") && (
              <>
                <Toggle label={t("admin.requiresHS")} checked={reqs.requires_hs} onChange={(v) => updateReq("requires_hs", v)} />
                <Toggle label={t("admin.requires12Years")} checked={reqs.requires_12_years} onChange={(v) => updateReq("requires_12_years", v)} />
              </>
            )}

            {/* --- Bachelor --- */}
            {visibleFields.has("bachelor") && (
              <Toggle label={t("admin.requiresBachelor")} checked={reqs.requires_bachelor} onChange={(v) => updateReq("requires_bachelor", v)} />
            )}

            {/* --- GPA --- */}
            {visibleFields.has("gpa") && (
              <>
                <Toggle label={t("admin.requiresGPA")} checked={reqs.requires_gpa} onChange={(v) => updateReq("requires_gpa", v)} />
                {reqs.requires_gpa && (
                  <div className="mr-8">
                    <label className="block text-xs text-slate-400 mb-1">{t("admin.gpaMin")}</label>
                    <input type="number" step="0.01" value={reqs.gpa_min ?? ""} onChange={(e) => updateReq("gpa_min", e.target.value ? Number(e.target.value) : null)} className="w-40 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white focus:border-blue-500 focus:outline-none" />
                  </div>
                )}
              </>
            )}

            {/* --- Language Certificate (multi-cert) --- */}
            {visibleFields.has("language_cert") && (
              <div className="border-t border-white/10 pt-3 mt-3">
                <p className="text-xs font-medium text-slate-400 mb-2">{t("admin.languageCertRequirements")}</p>
                <Toggle label={t("admin.requiresLanguageCert")} checked={reqs.requires_language_cert} onChange={(v) => updateReq("requires_language_cert", v)} />
                {reqs.requires_language_cert && (
                  <div className="mr-8 mt-2 space-y-3">
                    <div>
                      <label className="block text-xs text-slate-400 mb-1">{t("admin.languageCertEffect")}</label>
                      <select value={reqs.language_cert_effect || "blocks_if_below"} onChange={(e) => updateReq("language_cert_effect", e.target.value)} className="w-64 rounded-lg border border-white/10 bg-[#0f1c2e] px-3 py-2 text-sm text-white focus:border-blue-500 focus:outline-none">
                        <option value="blocks_if_below" className="bg-[#0f1c2e] text-white">{t("admin.blocksIfBelow")}</option>
                        <option value="conditional" className="bg-[#0f1c2e] text-white">{t("admin.conditional")}</option>
                        <option value="interview" className="bg-[#0f1c2e] text-white">{t("admin.interviewEffect")}</option>
                      </select>
                    </div>

                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <label className="text-xs font-medium text-slate-400">{t("admin.acceptedLanguageCerts")}</label>
                        <button type="button" onClick={addLanguageCert} className="text-xs text-blue-400 hover:text-blue-300">
                          + {t("admin.addLanguageCert")}
                        </button>
                      </div>
                      {(reqs.accepted_language_certs || []).map((cert, cIdx) => (
                        <div key={cIdx} className="flex items-center gap-2">
                          <select
                            value={cert.type}
                            onChange={(e) => updateLanguageCert(cIdx, "type", e.target.value)}
                            className="w-40 rounded-lg border border-white/10 bg-[#0f1c2e] px-3 py-1.5 text-sm text-white focus:border-blue-500 focus:outline-none"
                          >
                            {LANGUAGE_CERT_TYPES.map((t) => (
                              <option key={t} value={t} className="bg-[#0f1c2e] text-white">{t}</option>
                            ))}
                          </select>
                          <input
                            type="number"
                            step="0.5"
                            value={cert.min_score || ""}
                            onChange={(e) => updateLanguageCert(cIdx, "min_score", e.target.value ? Number(e.target.value) : 0)}
                            placeholder={t("admin.minScore")}
                            className="w-24 rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-sm text-white focus:border-blue-500 focus:outline-none"
                          />
                          <button type="button" onClick={() => removeLanguageCert(cIdx)} className="text-xs text-red-400 hover:text-red-300">
                            {t("admin.removeOption")}
                          </button>
                        </div>
                      ))}
                      {(!reqs.accepted_language_certs || reqs.accepted_language_certs.length === 0) && (
                        <p className="text-xs text-slate-500">—</p>
                      )}
                    </div>

                    {/* Legacy IELTS fields — show if they have data */}
                    {reqs.requires_ielts && (
                      <div className="rounded-lg border border-yellow-500/20 bg-yellow-500/5 p-3">
                        <p className="text-xs text-yellow-400 mb-2">{t("admin.legacyIeltsNote")}</p>
                        <div className="grid gap-4 sm:grid-cols-2">
                          <div>
                            <label className="block text-xs text-slate-400 mb-1">{t("admin.ieltsMin")}</label>
                            <input type="number" step="0.5" value={reqs.ielts_min ?? ""} onChange={(e) => updateReq("ielts_min", e.target.value ? Number(e.target.value) : null)} className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white focus:border-blue-500 focus:outline-none" />
                          </div>
                          <div>
                            <label className="block text-xs text-slate-400 mb-1">{t("admin.ieltsEffect")}</label>
                            <select value={reqs.ielts_effect || ""} onChange={(e) => updateReq("ielts_effect", e.target.value || null)} className="w-full rounded-lg border border-white/10 bg-[#0f1c2e] px-3 py-2 text-sm text-white focus:border-blue-500 focus:outline-none">
                              <option value="" className="bg-[#0f1c2e] text-white">—</option>
                              <option value="blocks_if_below" className="bg-[#0f1c2e] text-white">{t("admin.blocksIfBelow")}</option>
                              <option value="conditional" className="bg-[#0f1c2e] text-white">{t("admin.conditional")}</option>
                            </select>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                )}
                {/* Legacy IELTS — shown only when language cert is OFF and old IELTS data exists */}
                {!reqs.requires_language_cert && reqs.requires_ielts && (
                  <div className="rounded-lg border border-yellow-500/20 bg-yellow-500/5 p-3 mt-2">
                    <p className="text-xs text-yellow-400 mb-2">{t("admin.legacyIeltsNote")}</p>
                    <div className="grid gap-4 sm:grid-cols-2">
                      <div>
                        <label className="block text-xs text-slate-400 mb-1">{t("admin.ieltsMin")}</label>
                        <input type="number" step="0.5" value={reqs.ielts_min ?? ""} onChange={(e) => updateReq("ielts_min", e.target.value ? Number(e.target.value) : null)} className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white focus:border-blue-500 focus:outline-none" />
                      </div>
                      <div>
                        <label className="block text-xs text-slate-400 mb-1">{t("admin.ieltsEffect")}</label>
                        <select value={reqs.ielts_effect || ""} onChange={(e) => updateReq("ielts_effect", e.target.value || null)} className="w-full rounded-lg border border-white/10 bg-[#0f1c2e] px-3 py-2 text-sm text-white focus:border-blue-500 focus:outline-none">
                          <option value="" className="bg-[#0f1c2e] text-white">—</option>
                          <option value="blocks_if_below" className="bg-[#0f1c2e] text-white">{t("admin.blocksIfBelow")}</option>
                          <option value="conditional" className="bg-[#0f1c2e] text-white">{t("admin.conditional")}</option>
                        </select>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* --- SAT --- */}
            {visibleFields.has("sat") && (
              <>
                <Toggle label={t("admin.requiresSAT")} checked={reqs.requires_sat} onChange={(v) => updateReq("requires_sat", v)} />
                {reqs.requires_sat && (
                  <div className="mr-8 grid gap-4 sm:grid-cols-2">
                    <div>
                      <label className="block text-xs text-slate-400 mb-1">{t("admin.satMin")}</label>
                      <input type="number" value={reqs.sat_min ?? ""} onChange={(e) => updateReq("sat_min", e.target.value ? Number(e.target.value) : null)} className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white focus:border-blue-500 focus:outline-none" />
                    </div>
                    <div>
                      <label className="block text-xs text-slate-400 mb-1">{t("admin.satEffect")}</label>
                      <select value={reqs.sat_effect || ""} onChange={(e) => updateReq("sat_effect", e.target.value || null)} className="w-full rounded-lg border border-white/10 bg-[#0f1c2e] px-3 py-2 text-sm text-white focus:border-blue-500 focus:outline-none">
                        <option value="" className="bg-[#0f1c2e] text-white">—</option>
                        <option value="blocks_if_below" className="bg-[#0f1c2e] text-white">{t("admin.blocksIfBelow")}</option>
                        <option value="conditional" className="bg-[#0f1c2e] text-white">{t("admin.conditional")}</option>
                      </select>
                    </div>
                  </div>
                )}
              </>
            )}

            {/* --- Entrance exam / Portfolio / Research plan --- */}
            {visibleFields.has("entrance_exam") && (
              <Toggle label={t("admin.requiresEntranceExam")} checked={reqs.requires_entrance_exam} onChange={(v) => updateReq("requires_entrance_exam", v)} />
            )}
            {visibleFields.has("portfolio") && (
              <Toggle label={t("admin.requiresPortfolio")} checked={reqs.requires_portfolio} onChange={(v) => updateReq("requires_portfolio", v)} />
            )}
            {visibleFields.has("research_plan") && (
              <Toggle label={t("admin.requiresResearchPlan")} checked={reqs.requires_research_plan} onChange={(v) => updateReq("requires_research_plan", v)} />
            )}

            {/* --- A Level (British certificates) --- */}
            {visibleFields.has("a_levels") && (
              <div className="border-t border-white/10 pt-3 mt-3">
                <p className="text-xs font-medium text-slate-400 mb-2">{t("admin.britishRequirements")}</p>
                <Toggle label={t("admin.requiresALevels")} checked={reqs.requires_a_levels} onChange={(v) => updateReq("requires_a_levels", v)} />
                {reqs.requires_a_levels && (
                  <div className="mr-8 mt-2 space-y-3">
                    <div className="grid gap-4 sm:grid-cols-3">
                      <div>
                        <label className="block text-xs text-slate-400 mb-1">{t("admin.aLevelSubjectsMin")}</label>
                        <input type="number" min="1" max="10" value={reqs.a_level_subjects_min ?? ""} onChange={(e) => updateReq("a_level_subjects_min", e.target.value ? Number(e.target.value) : null)} className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white focus:border-blue-500 focus:outline-none" />
                      </div>
                      <div>
                        <label className="block text-xs text-slate-400 mb-1">{t("admin.aLevelMinGrade")}</label>
                        <select value={reqs.a_level_min_grade || ""} onChange={(e) => updateReq("a_level_min_grade", e.target.value || null)} className="w-full rounded-lg border border-white/10 bg-[#0f1c2e] px-3 py-2 text-sm text-white focus:border-blue-500 focus:outline-none">
                          <option value="" className="bg-[#0f1c2e] text-white">—</option>
                          {["A*", "A", "B", "C", "D", "E"].map((g) => (
                            <option key={g} value={g} className="bg-[#0f1c2e] text-white">{g}</option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="block text-xs text-slate-400 mb-1">{t("admin.aLevelEffect")}</label>
                        <select value={reqs.a_level_effect || "blocks_admission"} onChange={(e) => updateReq("a_level_effect", e.target.value)} className="w-full rounded-lg border border-white/10 bg-[#0f1c2e] px-3 py-2 text-sm text-white focus:border-blue-500 focus:outline-none">
                          <option value="blocks_admission" className="bg-[#0f1c2e] text-white">{t("admin.blocks")}</option>
                          <option value="makes_conditional" className="bg-[#0f1c2e] text-white">{t("admin.conditional")}</option>
                        </select>
                      </div>
                    </div>
                    <Toggle label={t("admin.aLevelRequiresCore")} checked={reqs.a_level_requires_core} onChange={(v) => updateReq("a_level_requires_core", v)} />
                  </div>
                )}
              </div>
            )}

            {/* --- IB (International Baccalaureate) --- */}
            {visibleFields.has("ib") && (
              <div className="border-t border-white/10 pt-3 mt-3">
                <p className="text-xs font-medium text-slate-400 mb-2">{t("admin.ibRequirements")}</p>
                <Toggle label={t("admin.requiresIB")} checked={reqs.requires_ib} onChange={(v) => updateReq("requires_ib", v)} />
                {reqs.requires_ib && (
                  <div className="mr-8 mt-2 grid gap-4 sm:grid-cols-2">
                    <div>
                      <label className="block text-xs text-slate-400 mb-1">{t("admin.ibMinPoints")}</label>
                      <input type="number" min="0" max="45" value={reqs.ib_min_points ?? ""} onChange={(e) => updateReq("ib_min_points", e.target.value ? Number(e.target.value) : null)} className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white focus:border-blue-500 focus:outline-none" />
                    </div>
                    <div>
                      <label className="block text-xs text-slate-400 mb-1">{t("admin.ibEffect")}</label>
                      <select value={reqs.ib_effect || "blocks_admission"} onChange={(e) => updateReq("ib_effect", e.target.value)} className="w-full rounded-lg border border-white/10 bg-[#0f1c2e] px-3 py-2 text-sm text-white focus:border-blue-500 focus:outline-none">
                        <option value="blocks_admission" className="bg-[#0f1c2e] text-white">{t("admin.blocks")}</option>
                        <option value="makes_conditional" className="bg-[#0f1c2e] text-white">{t("admin.conditional")}</option>
                      </select>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">{t("admin.resultNotes")}</label>
            <textarea value={reqs.result_notes || ""} onChange={(e) => updateReq("result_notes", e.target.value || null)} rows={3} className="w-full rounded-lg border border-white/10 bg-white/5 px-4 py-2.5 text-white focus:border-blue-500 focus:outline-none" />
          </div>
        </section>

        {/* ============ Custom Requirements (active tab) ============ */}
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

              {/* Comparison settings */}
              <div className="border-t border-white/5 pt-3 space-y-3">
                <Toggle
                  label={t("admin.showInComparison")}
                  checked={cr.show_in_comparison}
                  onChange={(v) => updateCustomReq(index, "show_in_comparison", v)}
                />
                {cr.show_in_comparison && (
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div>
                      <label className="block text-xs text-slate-400 mb-1">{t("admin.comparisonInputType")}</label>
                      <select
                        value={cr.comparison_input_type || "toggle"}
                        onChange={(e) => updateCustomReq(index, "comparison_input_type", e.target.value)}
                        className="w-full rounded-lg border border-white/10 bg-[#0f1c2e] px-3 py-2 text-sm text-white focus:border-blue-500 focus:outline-none"
                      >
                        <option value="toggle" className="bg-[#0f1c2e] text-white">{t("admin.comparisonToggle")}</option>
                        <option value="number" className="bg-[#0f1c2e] text-white">{t("admin.comparisonNumber")}</option>
                        <option value="select" className="bg-[#0f1c2e] text-white">{t("admin.comparisonSelect")}</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs text-slate-400 mb-1">{t("admin.comparisonKey")}</label>
                      <input
                        type="text"
                        value={cr.comparison_key}
                        onChange={(e) => updateCustomReq(index, "comparison_key", e.target.value)}
                        placeholder="e.g. has_duolingo_65"
                        className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder-slate-500 focus:border-blue-500 focus:outline-none"
                      />
                    </div>
                  </div>
                )}
              </div>
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

      {/* ============ Delete Confirmation Dialog ============ */}
      {/* Toast notification */}
      {toast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 rounded-lg bg-blue-600 px-6 py-3 text-sm font-medium text-white shadow-lg">
          {toast}
        </div>
      )}

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
