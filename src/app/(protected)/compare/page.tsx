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

    // Fetch ALL programs (no certificate_types join needed on programs anymore)
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

    // Fetch requirements with certificate_types join to get slug
    const [reqRes, customRes, tierRes] = await Promise.all([
      supabase
        .from("requirements")
        .select("*, certificate_types(slug)")
        .in("program_id", programIds),
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

    // Group requirements by (program_id, certificate_type_id)
    // Key format: "programId|certTypeId" or "programId|null"
    type ReqRow = Requirement & {
      program_id: string;
      certificate_type_id: string | null;
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

    const reqsByKey = new Map<string, ReqRow[]>();
    for (const r of (reqRes.data || []) as ReqRow[]) {
      const key = `${r.program_id}|${r.certificate_type_id || "null"}`;
      const arr = reqsByKey.get(key) || [];
      arr.push(r);
      reqsByKey.set(key, arr);
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

    // Build ProgramEntry objects — one per (program, certType) combination
    const entries: ProgramEntry[] = [];

    for (const p of programs) {
      const uni = uniMap.get(p.university_id)!;

      // Find all distinct cert type keys for this program's requirements
      const programReqKeys = [...reqsByKey.keys()].filter((k) =>
        k.startsWith(`${p.id}|`)
      );

      if (programReqKeys.length === 0) {
        // No requirements at all — include as universal
        entries.push({
          programId: p.id,
          programName: p.name,
          universityName: uni.name,
          country: uni.country,
          universityType: uni.type,
          category: p.category,
          certificateTypeSlug: null,
          requirements: {} as Requirement,
          customRequirements: [],
          scholarshipTiers: [],
        });
        continue;
      }

      // Check if there are cert-specific requirement rows
      const certSpecificKeys = programReqKeys.filter(
        (k) => !k.endsWith("|null")
      );
      const universalKey = `${p.id}|null`;
      const hasUniversalReqs = reqsByKey.has(universalKey);

      if (certSpecificKeys.length > 0) {
        // Program has cert-specific requirements — create one entry per cert type
        for (const key of certSpecificKeys) {
          const reqs = reqsByKey.get(key) || [];
          const certSlug =
            (reqs[0]?.certificate_types as { slug: string } | null)?.slug ||
            null;

          // Merge with universal requirements if they exist
          const universalReqs = reqsByKey.get(universalKey) || [];
          const mergedReq: Requirement = {} as Requirement;

          // Apply universal first, then cert-specific (cert-specific takes precedence)
          for (const row of [...universalReqs, ...reqs]) {
            for (const [k, v] of Object.entries(row)) {
              if (
                k !== "program_id" &&
                k !== "certificate_type_id" &&
                k !== "certificate_types" &&
                k !== "id" &&
                k !== "tenant_id" &&
                k !== "created_at" &&
                k !== "updated_at" &&
                v !== null &&
                v !== undefined &&
                v !== false
              ) {
                (mergedReq as Record<string, unknown>)[k] = v;
              }
            }
          }

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
            requirements: mergedReq,
            customRequirements: allCustoms,
            scholarshipTiers: allTiers,
          });
        }
      } else if (hasUniversalReqs) {
        // Only universal requirements
        const reqs = reqsByKey.get(universalKey) || [];
        const req = reqs[0] || ({} as Requirement);
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
          requirements: req,
          customRequirements: customs,
          scholarshipTiers: tiers,
        });
      }
    }

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
