"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { useAuth } from "@/lib/auth-context";
import { canEditUniversities } from "@/lib/permissions";
import { createSupabaseBrowserClient } from "@/lib/supabase-browser";

interface University {
  id: string;
  name: string;
  country: string;
  type: string;
  is_active: boolean;
  programs: { id: string }[];
}

export default function UniversitiesPage() {
  const t = useTranslations();
  const user = useAuth();
  const supabase = createSupabaseBrowserClient();
  const isAdmin = canEditUniversities(user.role);

  const [universities, setUniversities] = useState<University[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      let query = supabase
        .from("universities")
        .select("id, name, country, type, is_active, sort_order, programs(id)")
        .order("sort_order");

      if (!isAdmin) {
        query = query.eq("is_active", true);
      }

      const { data } = await query;
      setUniversities((data as unknown as University[]) || []);
      setLoading(false);
    }
    load();
  }, [supabase, isAdmin]);

  if (loading) {
    return <p className="text-slate-400">{t("common.loading")}</p>;
  }

  return (
    <div>
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-white">
          {t("universities.title")}
        </h1>
        {isAdmin && (
          <Link
            href="/universities/new"
            className="rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-blue-700"
          >
            {t("admin.addUniversity")}
          </Link>
        )}
      </div>

      {!universities.length ? (
        <p className="mt-6 text-slate-400">{t("universities.noUniversities")}</p>
      ) : (
        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {universities.map((uni) => (
            <Link
              key={uni.id}
              href={`/universities/${uni.id}`}
              className={`group rounded-xl border bg-white/5 p-6 transition hover:border-blue-500/50 hover:bg-white/10 ${
                uni.is_active ? "border-white/10" : "border-red-500/20 opacity-70"
              }`}
            >
              <div className="flex items-start justify-between gap-2">
                <h2 className="text-lg font-bold text-white group-hover:text-blue-400 transition">
                  {uni.name}
                </h2>
                {!uni.is_active && (
                  <span className="inline-block rounded-full bg-red-500/15 px-2.5 py-0.5 text-xs font-medium text-red-400">
                    {t("admin.inactive")}
                  </span>
                )}
              </div>
              <p className="mt-2 text-sm text-slate-400">
                {uni.country}
                {" — "}
                {uni.type === "public"
                  ? t("universities.public")
                  : t("universities.private")}
              </p>
              <p className="mt-3 text-sm text-slate-300">
                <span className="inline-flex items-center gap-1.5 rounded-full bg-blue-500/10 px-3 py-1 text-blue-400">
                  {uni.programs?.length || 0}{" "}
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
