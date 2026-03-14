import Link from "next/link";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { createSupabaseServerClient } from "@/lib/supabase-server";

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

export default async function UniversityDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createSupabaseServerClient();
  const t = await getTranslations();

  const { data: university } = await supabase
    .from("universities")
    .select("id, name, country, type")
    .eq("id", id)
    .single();

  if (!university) {
    notFound();
  }

  const { data: programs } = await supabase
    .from("programs")
    .select("id, name, category, complexity_level, sort_order, requirements(*)")
    .eq("university_id", id)
    .eq("is_active", true)
    .order("sort_order");

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
        <h1 className="text-2xl font-bold text-white">{university.name}</h1>
        <p className="mt-2 text-slate-400">
          {university.country}
          {" — "}
          {university.type === "public"
            ? t("universities.public")
            : t("universities.private")}
        </p>
      </div>

      <div className="space-y-4">
        {programs?.map((program) => {
          const req = (program.requirements as Record<string, unknown>[])?.[0];
          return (
            <div
              key={program.id}
              className="rounded-xl border border-white/10 bg-white/5 p-5"
            >
              <div className="flex flex-wrap items-start gap-3">
                <h3 className="text-lg font-semibold text-white flex-1">
                  {program.name}
                </h3>
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
                  {req.result_notes && (
                    <p className="text-sm text-slate-400">
                      <span className="text-slate-500">
                        {t("universities.notes")}:{" "}
                      </span>
                      {String(req.result_notes)}
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
