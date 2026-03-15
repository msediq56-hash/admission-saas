"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { createSupabaseBrowserClient } from "@/lib/supabase-browser";
import { useAuth } from "@/lib/auth-context";
import {
  compareAllPrograms,
  isMedicalProgram,
  type ComparisonResult,
  type ProgramEntry,
} from "@/lib/comparison-engine";
import type {
  Requirement,
  CustomRequirement,
  ScholarshipTier,
} from "@/lib/evaluation-engine";
import { ProfileForm, type ProfileFormResult } from "./_components/profile-form";
import { ResultsList } from "./_components/results-list";

type FilterKey = "foundation" | "bachelor" | "master" | "phd" | "medical";

export default function ComparePage() {
  const t = useTranslations();
  const user = useAuth();
  const supabase = createSupabaseBrowserClient();

  const [results, setResults] = useState<ComparisonResult[] | null>(null);
  const [loading, setLoading] = useState(false);

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

    // Fetch ALL programs with certificate_types join (no category filter yet)
    const { data: programs } = await supabase
      .from("programs")
      .select("id, name, category, university_id, certificate_types(slug)")
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

    // Fetch requirements, custom_requirements, scholarship_tiers for ALL programs
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
    for (const st of (tierRes.data || []) as (ScholarshipTier & {
      program_id: string;
    })[]) {
      const arr = tierMap.get(st.program_id) || [];
      arr.push(st);
      tierMap.set(st.program_id, arr);
    }

    // Build entries for ALL programs (including certificateTypeSlug)
    const entries: ProgramEntry[] = programs.map((p) => {
      const uni = uniMap.get(p.university_id)!;
      const certTypes = p.certificate_types as unknown as
        | { slug: string }
        | { slug: string }[]
        | null;
      const certSlug = Array.isArray(certTypes)
        ? certTypes[0]?.slug || null
        : certTypes?.slug || null;
      return {
        programId: p.id,
        programName: p.name,
        universityName: uni.name,
        country: uni.country,
        universityType: uni.type,
        category: p.category,
        certificateTypeSlug: certSlug,
        requirements: reqMap.get(p.id) || ({} as Requirement),
        customRequirements: customMap.get(p.id) || [],
        scholarshipTiers: tierMap.get(p.id) || [],
      };
    });

    // Evaluate ALL programs first (so cross-program suggestions work)
    const allResults = compareAllPrograms(profile, entries);

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

      <ProfileForm onSubmit={handleEvaluate} loading={loading} />

      {results !== null && <ResultsList results={results} />}
    </div>
  );
}
