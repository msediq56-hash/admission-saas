"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useAuth } from "@/lib/auth-context";
import { canAddUniversities } from "@/lib/permissions";
import Link from "next/link";

export default function AddUniversityPage() {
  const t = useTranslations();
  const router = useRouter();
  const user = useAuth();

  const [name, setName] = useState("");
  const [country, setCountry] = useState("");
  const [type, setType] = useState<"public" | "private">("public");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  if (!canAddUniversities(user.role)) {
    router.replace("/universities");
    return null;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError("");

    const res = await fetch("/api/universities", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, country, type }),
    });

    if (!res.ok) {
      const data = await res.json();
      setError(data.error || t("admin.saveError"));
      setSaving(false);
      return;
    }

    const { id } = await res.json();
    router.push(`/universities/${id}`);
  }

  return (
    <div className="max-w-2xl">
      <Link
        href="/universities"
        className="inline-flex items-center gap-2 text-sm text-slate-400 transition hover:text-white mb-6"
      >
        <span>←</span>
        {t("universities.backToList")}
      </Link>

      <h1 className="text-2xl font-bold text-white mb-8">
        {t("admin.addUniversity")}
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

        {error && (
          <p className="text-sm text-red-400">{error}</p>
        )}

        <button
          type="submit"
          disabled={saving}
          className="rounded-lg bg-blue-600 px-6 py-2.5 text-sm font-medium text-white transition hover:bg-blue-700 disabled:opacity-50"
        >
          {saving ? t("admin.saving") : t("admin.addUniversity")}
        </button>
      </form>
    </div>
  );
}
