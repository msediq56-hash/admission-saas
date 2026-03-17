"use client";

import { useState, useCallback } from "react";
import { useTranslations } from "next-intl";
import { createSupabaseBrowserClient } from "@/lib/supabase-browser";
import { useAuth } from "@/lib/auth-context";
import {
  isMedicalProgram,
  type ComparisonResult,
  type StudentProfile,
} from "@/lib/comparison-engine";
import type {
  CustomRequirement,
  ScholarshipTier,
} from "@/lib/evaluation-engine";
import type { RequirementRule } from "@/lib/rules/types";
import {
  compareProgramsRaw,
  postProcessComparisonResults,
  type RuleProgramEntry,
} from "@/lib/rules/compare-student";
import { buildAssessmentProfile, type ComparisonFormData } from "@/lib/rules/v3/profile-adapter";
import { analyzeV3EligibilityForEntry, compareOneProgram, type V3ComparisonEntry } from "@/lib/rules/v3/compare";
import { ProfileForm, type ProfileFormResult, type DynamicField } from "./_components/profile-form";
import { ResultsList } from "./_components/results-list";

type FilterKey = "foundation" | "bachelor" | "master" | "phd" | "medical";

// Hardcoded mapping: cert type → which form fields to show for Arabic
// British A Level fields now shown based on certificateType === "british" in profile-form.tsx
const CERT_FORM_FIELDS: Record<string, Set<string>> = {
  arabic: new Set(["high_school", "twelve_years", "gpa", "language_cert", "sat"]),
  british: new Set(["language_cert"]),
};

/**
 * Build old StudentProfile from ComparisonFormData (for fallback programs).
 */
function buildOldStudentProfile(formData: ComparisonFormData): StudentProfile {
  return {
    hasHighSchool: formData.hasHighSchool ?? true,
    has12Years: formData.has12Years ?? true,
    hasBachelor: false,
    ielts: formData.hasIelts && formData.ieltsScore ? formData.ieltsScore : null,
    hasSAT: formData.hasSAT ?? false,
    satScore: formData.hasSAT && formData.satScore ? formData.satScore : null,
    gpa: formData.gpa ?? null,
    hasResearchPlan: false,
    certificateType: formData.certificateType,
    aLevelCount: formData.certificateType === "british" ? (formData.aLevelCount ?? null) : null,
    aLevelCCount: formData.certificateType === "british" ? (formData.aLevelCCount ?? null) : null,
    dynamicAnswers: formData.dynamicAnswers ?? {},
  };
}

export default function ComparePage() {
  const t = useTranslations();
  const user = useAuth();
  const supabase = createSupabaseBrowserClient();

  const [results, setResults] = useState<ComparisonResult[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [dynamicFields, setDynamicFields] = useState<DynamicField[]>([]);
  const [relevantRuleTypes, setRelevantRuleTypes] = useState<Set<string> | null>(null);

  // Load relevant rule types and dynamic fields when cert type changes
  const handleCertificateTypeChange = useCallback(async (certType: "arabic" | "british") => {
    // Use hardcoded mapping for form fields — no DB query needed
    setRelevantRuleTypes(CERT_FORM_FIELDS[certType] || new Set());
    setResults(null); // clear previous results

    // Find the certificate_type_id for this slug (still needed for dynamic fields)
    const { data: certTypeRow } = await supabase
      .from("certificate_types")
      .select("id")
      .eq("slug", certType)
      .single();

    const certTypeId = certTypeRow?.id || null;

    // Load dynamic fields (custom_requirements with show_in_comparison)
    const { data: customData } = await supabase
      .from("custom_requirements")
      .select("comparison_key, question_text, comparison_input_type, options, certificate_type_id")
      .eq("show_in_comparison", true);

    if (!customData || customData.length === 0) {
      setDynamicFields([]);
      return;
    }

    // Filter to matching cert type or universal, then deduplicate by comparison_key
    const seen = new Set<string>();
    const fields: DynamicField[] = [];
    for (const row of customData) {
      if (row.certificate_type_id !== null && row.certificate_type_id !== certTypeId) continue;
      if (!row.comparison_key || seen.has(row.comparison_key)) continue;
      seen.add(row.comparison_key);
      fields.push({
        comparison_key: row.comparison_key,
        question_text: row.question_text,
        comparison_input_type: row.comparison_input_type as DynamicField["comparison_input_type"],
        options: row.options as string[] | null,
      });
    }
    setDynamicFields(fields);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user.tenantId]);

  async function handleEvaluate({ formData, selectedCategories }: ProfileFormResult) {
    setLoading(true);

    // Build BOTH profiles from formData
    const v3Profile = buildAssessmentProfile(formData);
    const oldProfile = buildOldStudentProfile(formData);

    // Fetch all universities for tenant
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

    // Fetch ALL active programs
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

    const programIds = programs.map((p) => p.id);

    // Fetch rules, custom_requirements (for comparison fields), and scholarship tiers
    const [rulesRes, customRes, tierRes] = await Promise.all([
      supabase
        .from("requirement_rules")
        .select("*, certificate_types(slug)")
        .in("program_id", programIds)
        .eq("is_enabled", true)
        .order("sort_order"),
      supabase
        .from("custom_requirements")
        .select("*, certificate_types(slug)")
        .in("program_id", programIds)
        .order("sort_order"),
      supabase
        .from("scholarship_tiers")
        .select("*")
        .in("program_id", programIds)
        .order("sort_order"),
    ]);

    // Group rules by (program_id, certificate_type_id)
    type RuleRow = RequirementRule & {
      certificate_types: { slug: string } | null;
    };
    type CustomRow = CustomRequirement & {
      program_id: string;
      certificate_type_id: string | null;
      certificate_types: { slug: string } | null;
    };
    type TierRow = ScholarshipTier & {
      program_id: string;
      certificate_type_id: string | null;
    };

    // Deduplicate rules by id (multiple migration runs may create duplicates)
    const rulesByKey = new Map<string, RuleRow[]>();
    const seenRuleIds = new Set<string>();
    for (const r of (rulesRes.data || []) as RuleRow[]) {
      if (seenRuleIds.has(r.id)) continue;
      seenRuleIds.add(r.id);
      const key = `${r.program_id}|${r.certificate_type_id || "null"}`;
      const arr = rulesByKey.get(key) || [];
      arr.push(r);
      rulesByKey.set(key, arr);
    }

    const customsByProgramCert = new Map<string, CustomRow[]>();
    for (const c of (customRes.data || []) as CustomRow[]) {
      const key = `${c.program_id}|${c.certificate_type_id || "null"}`;
      const arr = customsByProgramCert.get(key) || [];
      arr.push(c);
      customsByProgramCert.set(key, arr);
    }

    const tiersByProgramCert = new Map<string, TierRow[]>();
    for (const st of (tierRes.data || []) as TierRow[]) {
      const key = `${st.program_id}|${st.certificate_type_id || "null"}`;
      const arr = tiersByProgramCert.get(key) || [];
      arr.push(st);
      tiersByProgramCert.set(key, arr);
    }

    // Build RuleProgramEntry objects — one per (program, certType) combination
    const entries: RuleProgramEntry[] = [];

    for (const p of programs) {
      const uni = uniMap.get(p.university_id)!;

      // Find all distinct cert type keys for this program's rules
      const programRuleKeys = [...rulesByKey.keys()].filter((k) =>
        k.startsWith(`${p.id}|`)
      );

      if (programRuleKeys.length === 0) {
        entries.push({
          programId: p.id,
          programName: p.name,
          universityName: uni.name,
          country: uni.country,
          universityType: uni.type,
          category: p.category,
          certificateTypeSlug: null,
          rules: [],
          customRequirements: [],
          scholarshipTiers: [],
        });
        continue;
      }

      const certSpecificKeys = programRuleKeys.filter(
        (k) => !k.endsWith("|null")
      );
      const universalKey = `${p.id}|null`;
      const hasUniversalRules = rulesByKey.has(universalKey);

      if (certSpecificKeys.length > 0) {
        for (const key of certSpecificKeys) {
          const certRules = rulesByKey.get(key) || [];
          const certSlug =
            (certRules[0]?.certificate_types as { slug: string } | null)
              ?.slug || null;

          const universalRules = rulesByKey.get(universalKey) || [];
          const allRules = [...universalRules, ...certRules];

          const certCustoms = customsByProgramCert.get(key) || [];
          const universalCustoms =
            customsByProgramCert.get(universalKey) || [];
          const allCustoms = [...universalCustoms, ...certCustoms];

          const certTiers = tiersByProgramCert.get(key) || [];
          const universalTiers =
            tiersByProgramCert.get(universalKey) || [];
          const allTiers = [...universalTiers, ...certTiers];

          entries.push({
            programId: p.id,
            programName: p.name,
            universityName: uni.name,
            country: uni.country,
            universityType: uni.type,
            category: p.category,
            certificateTypeSlug: certSlug,
            rules: allRules,
            customRequirements: allCustoms,
            scholarshipTiers: allTiers,
          });
        }
      } else if (hasUniversalRules) {
        const rules = rulesByKey.get(universalKey) || [];
        const customs = customsByProgramCert.get(universalKey) || [];
        const tiers = tiersByProgramCert.get(universalKey) || [];

        entries.push({
          programId: p.id,
          programName: p.name,
          universityName: uni.name,
          country: uni.country,
          universityType: uni.type,
          category: p.category,
          certificateTypeSlug: null,
          rules,
          customRequirements: customs,
          scholarshipTiers: tiers,
        });
      }
    }

    // --- HYBRID ENGINE: Per-program V3/fallback routing ---
    const v3Entries: Array<{ entry: RuleProgramEntry; parsedRules: import("@/lib/rules/v3/types").RequirementRuleV3[] }> = [];
    const fallbackEntries: RuleProgramEntry[] = [];

    for (const entry of entries) {
      const eligibility = analyzeV3EligibilityForEntry(
        entry.rules,
        entry.certificateTypeSlug,
        entry.customRequirements
      );
      if (eligibility.mode === "v3") {
        v3Entries.push({ entry, parsedRules: eligibility.rules });
      } else {
        fallbackEntries.push(entry);
      }
    }

    // Evaluate V3 programs
    const v3Results: ComparisonResult[] = v3Entries.map(({ entry, parsedRules }) =>
      compareOneProgram(v3Profile, {
        programId: entry.programId,
        programName: entry.programName,
        universityName: entry.universityName,
        country: entry.country,
        universityType: entry.universityType,
        category: entry.category,
        certificateTypeSlug: entry.certificateTypeSlug,
        rules: parsedRules,
        scholarshipTiers: entry.scholarshipTiers,
      })
    );

    // Evaluate fallback programs with OLD engine — RAW results only
    const fallbackResults = compareProgramsRaw(oldProfile, fallbackEntries);

    // Merge results and apply post-processing ONCE
    const mergedResults = [...v3Results, ...fallbackResults];
    const allResults = postProcessComparisonResults(mergedResults);

    // Filter results AFTER comparison based on selected categories
    const filtered = allResults.filter((r) => {
      const isMedical = isMedicalProgram(r.programName);
      if (isMedical) return selectedCategories.medical;
      const dbCat = r.category as FilterKey;
      return selectedCategories[dbCat] ?? false;
    });

    setResults(filtered);
    setLoading(false);
  }

  return (
    <div>
      <h1 className="text-2xl font-bold text-white mb-2">
        {t("comparison.title")}
      </h1>
      <p className="text-slate-400 mb-6">{t("comparison.subtitle")}</p>

      <ProfileForm
        onSubmit={handleEvaluate}
        loading={loading}
        dynamicFields={dynamicFields}
        relevantRuleTypes={relevantRuleTypes}
        onCertificateTypeChange={handleCertificateTypeChange}
      />

      {results !== null && <ResultsList results={results} />}
    </div>
  );
}
