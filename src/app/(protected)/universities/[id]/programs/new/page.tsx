"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useAuth } from "@/lib/auth-context";
import { canAddUniversities } from "@/lib/permissions";
import { createSupabaseBrowserClient } from "@/lib/supabase-browser";
import Link from "next/link";
import { use } from "react";

export default function AddProgramPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id: universityId } = use(params);
  const t = useTranslations();
  const router = useRouter();
  const user = useAuth();
  const supabase = createSupabaseBrowserClient();

  const [name, setName] = useState("");
  const [category, setCategory] = useState("bachelor");
  const [certificateTypeId, setCertificateTypeId] = useState<string | null>(null);
  const [certTypes, setCertTypes] = useState<{ id: string; name_ar: string }[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  if (!canAddUniversities(user.role)) {
    router.replace(`/universities/${universityId}`);
    return null;
  }

  useEffect(() => {
    async function load() {
      const { data } = await supabase
        .from("certificate_types")
        .select("id, name_ar")
        .order("sort_order");
      if (data) setCertTypes(data);
    }
    load();
  }, [supabase]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError("");

    const res = await fetch("/api/programs", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        university_id: universityId,
        name,
        category,
        certificate_type_id: certificateTypeId,
      }),
    });

    if (!res.ok) {
      const data = await res.json();
      setError(data.error || t("admin.saveError"));
      setSaving(false);
      return;
    }

    const { id: programId } = await res.json();
    router.push(`/universities/${universityId}/programs/${programId}/edit`);
  }

  return (
    <div className="max-w-2xl">
      <Link
        href={`/universities/${universityId}`}
        className="inline-flex items-center gap-2 text-sm text-slate-400 transition hover:text-white mb-6"
      >
        <span>←</span>
        {t("admin.backToUniversity")}
      </Link>

      <h1 className="text-2xl font-bold text-white mb-8">
        {t("admin.addProgram")}
      </h1>

      <form onSubmit={handleSubmit} className="space-y-6">
        <div>
          <label className="block text-sm font-medium text-slate-300 mb-2">
            {t("admin.programName")}
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
            {t("admin.programCategory")}
          </label>
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className="w-full rounded-lg border border-white/10 bg-white/5 px-4 py-2.5 text-white focus:border-blue-500 focus:outline-none"
          >
            {["foundation", "bachelor", "master", "phd", "language"].map((cat) => (
              <option key={cat} value={cat}>
                {t(`categories.${cat}` as Parameters<typeof t>[0])}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-300 mb-2">
            {t("admin.certificateType")}
          </label>
          <select
            value={certificateTypeId || ""}
            onChange={(e) => setCertificateTypeId(e.target.value || null)}
            className="w-full rounded-lg border border-white/10 bg-white/5 px-4 py-2.5 text-white focus:border-blue-500 focus:outline-none"
          >
            <option value="">—</option>
            {certTypes.map((ct) => (
              <option key={ct.id} value={ct.id}>
                {ct.name_ar}
              </option>
            ))}
          </select>
        </div>

        {error && <p className="text-sm text-red-400">{error}</p>}

        <button
          type="submit"
          disabled={saving}
          className="rounded-lg bg-blue-600 px-6 py-2.5 text-sm font-medium text-white transition hover:bg-blue-700 disabled:opacity-50"
        >
          {saving ? t("admin.saving") : t("admin.addProgram")}
        </button>
      </form>
    </div>
  );
}
