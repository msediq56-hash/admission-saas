"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { createSupabaseBrowserClient } from "@/lib/supabase-browser";
import { useAuth } from "@/lib/auth-context";
import { canEditUniversities } from "@/lib/permissions";

function buildRequirementsSummary(req: Record<string, unknown>): string {
  const parts: string[] = [];
  if (req.requires_hs) parts.push("ثانوية");
  if (req.requires_12_years) parts.push("12 سنة دراسية");
  if (req.requires_bachelor) parts.push("بكالوريوس");
  if (req.requires_ielts && req.ielts_min)
    parts.push(`IELTS ${req.ielts_min}`);
  if (req.requires_sat && req.sat_min) parts.push(`SAT ${req.sat_min}`);
  if (req.requires_gpa && req.gpa_min) parts.push(`GPA ${req.gpa_min}+`);
  if (req.requires_entrance_exam) parts.push("امتحان قبول");
  if (req.requires_portfolio) parts.push("بورتفوليو");
  if (req.requires_research_plan) parts.push("خطة بحث");
  return parts.join(" + ") || "—";
}

const categoryColors: Record<string, string> = {
  foundation: "bg-amber-500/15 text-amber-400",
  bachelor: "bg-blue-500/15 text-blue-400",
  master: "bg-purple-500/15 text-purple-400",
  phd: "bg-emerald-500/15 text-emerald-400",
  language: "bg-cyan-500/15 text-cyan-400",
};

const complexityColors: Record<string, string> = {
  simple: "bg-green-500/15 text-green-400",
  hybrid: "bg-yellow-500/15 text-yellow-400",
  complex: "bg-red-500/15 text-red-400",
};

interface ProgramRow {
  id: string;
  name: string;
  category: string;
  complexity_level: string | null;
  sort_order: number;
  is_active: boolean;
  requirements: Record<string, unknown>[];
}

interface University {
  id: string;
  name: string;
  country: string;
  type: string;
  is_active: boolean;
}

export default function UniversityDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const t = useTranslations();
  const router = useRouter();
  const user = useAuth();
  const supabase = createSupabaseBrowserClient();
  const isAdmin = canEditUniversities(user.role);

  const [universityId, setUniversityId] = useState<string | null>(null);
  const [university, setUniversity] = useState<University | null>(null);
  const [programs, setPrograms] = useState<ProgramRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [deletingUni, setDeletingUni] = useState(false);
  const [togglingUni, setTogglingUni] = useState(false);
  const [deletingProgram, setDeletingProgram] = useState<string | null>(null);
  const [togglingProgram, setTogglingProgram] = useState<string | null>(null);

  // Resolve params
  useEffect(() => {
    params.then(({ id }) => setUniversityId(id));
  }, [params]);

  const loadData = useCallback(async () => {
    if (!universityId) return;
    setLoading(true);

    const { data: uni } = await supabase
      .from("universities")
      .select("id, name, country, type, is_active")
      .eq("id", universityId)
      .single();

    if (!uni) {
      router.push("/universities");
      return;
    }
    setUniversity(uni);

    let query = supabase
      .from("programs")
      .select("id, name, category, complexity_level, sort_order, is_active, requirements(*)")
      .eq("university_id", universityId);

    // Advisors only see active programs
    if (!isAdmin) {
      query = query.eq("is_active", true);
    }

    const { data: progs } = await query.order("sort_order");
    setPrograms((progs || []) as unknown as ProgramRow[]);
    setLoading(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [universityId, isAdmin]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // --- University actions ---
  async function handleDeleteUniversity() {
    if (!university) return;
    const confirmed = window.confirm(
      "هل أنت متأكد من حذف هذه الجامعة وجميع برامجها نهائياً؟ لا يمكن التراجع."
    );
    if (!confirmed) return;

    setDeletingUni(true);
    const res = await fetch(`/api/admin/universities/${university.id}`, {
      method: "DELETE",
    });
    if (res.ok) {
      router.push("/universities");
    } else {
      setDeletingUni(false);
      alert("حدث خطأ أثناء الحذف");
    }
  }

  async function handleToggleUniversity() {
    if (!university) return;
    setTogglingUni(true);
    const res = await fetch(`/api/admin/universities/${university.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ is_active: !university.is_active }),
    });
    if (res.ok) {
      setUniversity({ ...university, is_active: !university.is_active });
    }
    setTogglingUni(false);
  }

  // --- Program actions ---
  async function handleDeleteProgram(programId: string) {
    const confirmed = window.confirm(
      "هل أنت متأكد من حذف هذا البرنامج نهائياً؟"
    );
    if (!confirmed) return;

    setDeletingProgram(programId);
    const res = await fetch(`/api/admin/programs/${programId}`, {
      method: "DELETE",
    });
    if (res.ok) {
      setPrograms((prev) => prev.filter((p) => p.id !== programId));
    } else {
      alert("حدث خطأ أثناء الحذف");
    }
    setDeletingProgram(null);
  }

  async function handleToggleProgram(programId: string, currentActive: boolean) {
    setTogglingProgram(programId);
    const res = await fetch(`/api/admin/programs/${programId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ is_active: !currentActive }),
    });
    if (res.ok) {
      setPrograms((prev) =>
        prev.map((p) =>
          p.id === programId ? { ...p, is_active: !currentActive } : p
        )
      );
    }
    setTogglingProgram(null);
  }

  if (loading || !university) {
    return (
      <div className="text-slate-400">{t("common.loading")}</div>
    );
  }

  return (
    <div>
      <Link
        href="/universities"
        className="inline-flex items-center gap-2 text-sm text-slate-400 transition hover:text-white mb-6"
      >
        <span>←</span>
        {t("universities.backToList")}
      </Link>

      <div className="mb-8">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-white">{university.name}</h1>
            {!university.is_active && (
              <span className="inline-block rounded-full bg-red-500/15 px-3 py-0.5 text-xs font-medium text-red-400 border border-red-500/30">
                {t("admin.inactive")}
              </span>
            )}
          </div>
          <div className="flex items-center gap-3">
            {isAdmin && (
              <>
                <button
                  onClick={handleToggleUniversity}
                  disabled={togglingUni}
                  className={`rounded-lg border px-4 py-2 text-sm transition ${
                    university.is_active
                      ? "border-yellow-500/30 text-yellow-400 hover:bg-yellow-500/10"
                      : "border-green-500/30 text-green-400 hover:bg-green-500/10"
                  }`}
                >
                  {university.is_active
                    ? t("admin.deactivateUniversity")
                    : t("admin.activateUniversity")}
                </button>
                <button
                  onClick={handleDeleteUniversity}
                  disabled={deletingUni}
                  className="rounded-lg border border-red-500/30 px-4 py-2 text-sm text-red-400 transition hover:bg-red-500/10"
                >
                  {deletingUni
                    ? t("admin.deleting")
                    : t("admin.deleteUniversityButton")}
                </button>
              </>
            )}
            {isAdmin && (
              <>
                <Link
                  href={`/universities/${university.id}/edit`}
                  className="rounded-lg bg-white/10 px-4 py-2 text-sm text-white transition hover:bg-white/20"
                >
                  {t("common.edit")}
                </Link>
                <Link
                  href={`/universities/${university.id}/programs/new`}
                  className="rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-blue-700"
                >
                  {t("admin.addProgram")}
                </Link>
              </>
            )}
          </div>
        </div>
        <p className="mt-2 text-slate-400">
          {university.country}
          {" — "}
          {university.type === "public"
            ? t("universities.public")
            : t("universities.private")}
        </p>
      </div>

      <div className="space-y-4">
        {programs.map((program) => {
          const req = (program.requirements as Record<string, unknown>[])?.[0];
          const isInactive = program.is_active === false;
          return (
            <div
              key={program.id}
              className={`rounded-xl border border-white/10 bg-white/5 p-5 ${
                isInactive ? "opacity-50" : ""
              }`}
            >
              <div className="flex flex-wrap items-start gap-3">
                <h3 className="text-lg font-semibold text-white flex-1">
                  {program.name}
                  {isInactive && (
                    <span className="mr-2 inline-block rounded-full bg-red-500/15 px-2 py-0.5 text-xs font-medium text-red-400">
                      {t("admin.programInactive")}
                    </span>
                  )}
                </h3>

                {isAdmin && (
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() =>
                        handleToggleProgram(program.id, program.is_active)
                      }
                      disabled={togglingProgram === program.id}
                      className={`rounded-lg border px-3 py-1 text-xs transition ${
                        program.is_active
                          ? "border-yellow-500/30 text-yellow-400 hover:bg-yellow-500/10"
                          : "border-green-500/30 text-green-400 hover:bg-green-500/10"
                      }`}
                    >
                      {program.is_active
                        ? t("admin.deactivateProgram")
                        : t("admin.activateProgram")}
                    </button>
                    <button
                      onClick={() => handleDeleteProgram(program.id)}
                      disabled={deletingProgram === program.id}
                      className="rounded-lg border border-red-500/30 px-3 py-1 text-xs text-red-400 transition hover:bg-red-500/10"
                    >
                      {deletingProgram === program.id
                        ? t("admin.deleting")
                        : t("common.delete")}
                    </button>
                  </div>
                )}

                {isAdmin && (
                  <Link
                    href={`/universities/${university.id}/programs/${program.id}/edit`}
                    className="rounded-lg bg-white/10 px-4 py-2 text-sm text-white transition hover:bg-white/20"
                  >
                    {t("common.edit")}
                  </Link>
                )}
                <span
                  className={`inline-block rounded-full px-3 py-0.5 text-xs font-medium ${categoryColors[program.category] || "bg-slate-500/15 text-slate-400"}`}
                >
                  {t(`categories.${program.category}` as Parameters<typeof t>[0])}
                </span>
                {program.complexity_level && program.complexity_level !== "simple" && (
                  <span
                    className={`inline-block rounded-full px-3 py-0.5 text-xs font-medium ${complexityColors[program.complexity_level] || ""}`}
                  >
                    {t(`universities.${program.complexity_level}` as Parameters<typeof t>[0])}
                  </span>
                )}
              </div>

              {req && (
                <div className="mt-3 space-y-2">
                  <p className="text-sm text-slate-300">
                    <span className="text-slate-500">
                      {t("universities.requirements")}:{" "}
                    </span>
                    {buildRequirementsSummary(req)}
                  </p>
                  {typeof req.result_notes === "string" && req.result_notes && (
                    <p className="text-sm text-slate-400">
                      <span className="text-slate-500">
                        {t("universities.notes")}:{" "}
                      </span>
                      {req.result_notes}
                    </p>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
