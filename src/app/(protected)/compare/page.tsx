"use client";

import { useState, useCallback } from "react";
import { useTranslations } from "next-intl";
import { createSupabaseBrowserClient } from "@/lib/supabase-browser";
import { useAuth } from "@/lib/auth-context";
import {
  isMedicalProgram,
  type ComparisonResult,
} from "@/lib/comparison-engine";
import type {
  CustomRequirement,
  ScholarshipTier,
} from "@/lib/evaluation-engine";
import type { RequirementRule } from "@/lib/rules/types";
import {
  compareAllProgramsWithRules,
  type RuleProgramEntry,
} from "@/lib/rules/compare-student";
import { ProfileForm, type ProfileFormResult, type DynamicField } from "./_components/profile-form";
import { ResultsList } from "./_components/results-list";

type FilterKey = "foundation" | "bachelor" | "master" | "phd" | "medical";

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
    setRelevantRuleTypes(null); // show loading
    setResults(null); // clear previous results

    // Find the certificate_type_id for this slug
    const { data: certTypeRow } = await supabase
      .from("certificate_types")
      .select("id")
      .eq("slug", certType)
      .single();

    const certTypeId = certTypeRow?.id || null;

    // Load all enabled rules for active programs that match this cert type (or universal)
    let rulesQuery = supabase
      .from("requirement_rules")
      .select("rule_type, certificate_type_id")
      .eq("is_enabled", true)
      .eq("tenant_id", user.tenantId);

    if (certTypeId) {
      // Match cert-specific OR universal (null)
      rulesQuery = rulesQuery.or(`certificate_type_id.eq.${certTypeId},certificate_type_id.is.null`);
    }

    const { data: rules } = await rulesQuery;

    // Extract distinct rule types
    const types = new Set<string>();
    if (rules) {
      for (const r of rules) {
        types.add(r.rule_type);
      }
    }
    setRelevantRuleTypes(types);

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

  async function handleEvaluate({ profile, selectedCategories }: ProfileFormResult) {
    setLoading(true);

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
        // No rules at all — include as universal with empty rules
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

      // Check if there are cert-specific rule rows
      const certSpecificKeys = programRuleKeys.filter(
        (k) => !k.endsWith("|null")
      );
      const universalKey = `${p.id}|null`;
      const hasUniversalRules = rulesByKey.has(universalKey);

      if (certSpecificKeys.length > 0) {
        // Program has cert-specific rules — create one entry per cert type
        for (const key of certSpecificKeys) {
          const certRules = rulesByKey.get(key) || [];
          const certSlug =
            (certRules[0]?.certificate_types as { slug: string } | null)
              ?.slug || null;

          // Merge with universal rules
          const universalRules = rulesByKey.get(universalKey) || [];
          const allRules = [...universalRules, ...certRules];

          // Get customs: cert-specific + universal
          const certCustoms = customsByProgramCert.get(key) || [];
          const universalCustoms =
            customsByProgramCert.get(universalKey) || [];
          const allCustoms = [...universalCustoms, ...certCustoms];

          // Get tiers: cert-specific + universal
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
        // Only universal rules
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

    // Evaluate ALL programs first (so cross-program suggestions work)
    const allResults = compareAllProgramsWithRules(profile, entries);

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
