"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useAuth } from "@/lib/auth-context";
import { canEditUniversities } from "@/lib/permissions";
import { createSupabaseBrowserClient } from "@/lib/supabase-browser";
import Link from "next/link";
import { use } from "react";

export default function EditUniversityPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const t = useTranslations();
  const router = useRouter();
  const user = useAuth();
  const supabase = createSupabaseBrowserClient();

  const [name, setName] = useState("");
  const [country, setCountry] = useState("");
  const [type, setType] = useState<"public" | "private">("public");
  const [isActive, setIsActive] = useState(true);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");

  if (!canEditUniversities(user.role)) {
    router.replace(`/universities/${id}`);
    return null;
  }

  useEffect(() => {
    async function load() {
      const { data } = await supabase
        .from("universities")
        .select("name, country, type, is_active")
        .eq("id", id)
        .single();

      if (data) {
        setName(data.name);
        setCountry(data.country);
        setType(data.type as "public" | "private");
        setIsActive(data.is_active);
      }
      setLoading(false);
    }
    load();
  }, [id, supabase]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError("");
    setSaved(false);

    const res = await fetch(`/api/universities/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, country, type, is_active: isActive }),
    });

    if (!res.ok) {
      const data = await res.json();
      setError(data.error || t("admin.saveError"));
      setSaving(false);
      return;
    }

    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  if (loading) {
    return <p className="text-slate-400">{t("common.loading")}</p>;
  }

  return (
    <div className="max-w-2xl">
      <Link
        href={`/universities/${id}`}
        className="inline-flex items-center gap-2 text-sm text-slate-400 transition hover:text-white mb-6"
      >
        <span>←</span>
        {t("admin.backToUniversity")}
      </Link>

      <h1 className="text-2xl font-bold text-white mb-8">
        {t("admin.editUniversity")}
      </h1>

      <form onSubmit={handleSubmit} className="space-y-6">
        <div>
          <label className="block text-sm font-medium text-slate-300 mb-2">
            {t("admin.universityName")}
          </label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            className="w-full rounded-lg border border-white/10 bg-white/5 px-4 py-2.5 text-white placeholder-slate-500 focus:border-blue-500 focus:outline-none"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-300 mb-2">
            {t("admin.universityCountry")}
          </label>
          <input
            type="text"
            value={country}
            onChange={(e) => setCountry(e.target.value)}
            required
            className="w-full rounded-lg border border-white/10 bg-white/5 px-4 py-2.5 text-white placeholder-slate-500 focus:border-blue-500 focus:outline-none"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-300 mb-2">
            {t("admin.universityType")}
          </label>
          <select
            value={type}
            onChange={(e) => setType(e.target.value as "public" | "private")}
            className="w-full rounded-lg border border-white/10 bg-white/5 px-4 py-2.5 text-white focus:border-blue-500 focus:outline-none"
          >
            <option value="public">{t("universities.public")}</option>
            <option value="private">{t("universities.private")}</option>
          </select>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => setIsActive(!isActive)}
            className={`relative inline-flex h-6 w-11 items-center rounded-full transition ${isActive ? "bg-blue-600" : "bg-slate-600"}`}
          >
            <span
              className={`inline-block h-4 w-4 rounded-full bg-white transition ${isActive ? "translate-x-1.5" : "translate-x-6"}`}
            />
          </button>
          <span className="text-sm text-slate-300">
            {isActive ? t("admin.active") : t("admin.inactive")}
          </span>
        </div>

        {error && <p className="text-sm text-red-400">{error}</p>}

        <div className="flex items-center gap-4">
          <button
            type="submit"
            disabled={saving}
            className="rounded-lg bg-blue-600 px-6 py-2.5 text-sm font-medium text-white transition hover:bg-blue-700 disabled:opacity-50"
          >
            {saving ? t("admin.saving") : t("admin.saveChanges")}
          </button>
          {saved && (
            <span className="text-sm text-green-400">{t("admin.saved")}</span>
          )}
        </div>
      </form>
    </div>
  );
}
