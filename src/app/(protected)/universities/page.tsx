import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { AdminAddButton } from "@/components/admin-actions";

export default async function UniversitiesPage() {
  const supabase = await createSupabaseServerClient();
  const t = await getTranslations();

  const { data: universities } = await supabase
    .from("universities")
    .select("id, name, country, type, sort_order, programs(id)")
    .eq("is_active", true)
    .order("sort_order");

  return (
    <div>
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-white">
          {t("universities.title")}
        </h1>
        <AdminAddButton href="/universities/new" label={t("admin.addUniversity")} />
      </div>

      {!universities?.length ? (
        <p className="mt-6 text-slate-400">{t("universities.noUniversities")}</p>
      ) : (
        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {universities.map((uni) => (
            <Link
              key={uni.id}
              href={`/universities/${uni.id}`}
              className="group rounded-xl border border-white/10 bg-white/5 p-6 transition hover:border-blue-500/50 hover:bg-white/10"
            >
              <h2 className="text-lg font-bold text-white group-hover:text-blue-400 transition">
                {uni.name}
              </h2>
              <p className="mt-2 text-sm text-slate-400">
                {uni.country}
                {" — "}
                {uni.type === "public"
                  ? t("universities.public")
                  : t("universities.private")}
              </p>
              <p className="mt-3 text-sm text-slate-300">
                <span className="inline-flex items-center gap-1.5 rounded-full bg-blue-500/10 px-3 py-1 text-blue-400">
                  {(uni.programs as { id: string }[])?.length || 0}{" "}
                  {t("universities.programs")}
                </span>
              </p>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
