"use client";

import { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { useAuth } from "@/lib/auth-context";
import { canManageUsers } from "@/lib/permissions";
import { createSupabaseBrowserClient } from "@/lib/supabase-browser";
import Link from "next/link";

export default function EditUserPage() {
  const t = useTranslations();
  const router = useRouter();
  const params = useParams();
  const currentUser = useAuth();
  const userId = params.userId as string;

  const [fullName, setFullName] = useState("");
  const [role, setRole] = useState("");
  const [isActive, setIsActive] = useState(true);
  const [originalRole, setOriginalRole] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  if (!canManageUsers(currentUser.role)) {
    router.replace("/evaluate");
    return null;
  }

  const isSelf = userId === currentUser.id;

  // eslint-disable-next-line react-hooks/rules-of-hooks
  useEffect(() => {
    async function load() {
      const supabase = createSupabaseBrowserClient();
      const { data } = await supabase
        .from("users")
        .select("id, email, full_name, role, is_active")
        .eq("id", userId)
        .eq("tenant_id", currentUser.tenantId)
        .single();

      if (!data) {
        router.replace("/users");
        return;
      }

      setFullName(data.full_name || "");
      setRole(data.role);
      setOriginalRole(data.role);
      setIsActive(data.is_active);
      setLoading(false);
    }
    load();
  }, [userId, currentUser.tenantId, router]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError("");
    setSuccess(false);

    const body: Record<string, unknown> = { full_name: fullName };

    // Only send role if changed and not editing self
    if (!isSelf && role !== originalRole) {
      body.role = role;
    }

    // Send is_active
    body.is_active = isActive;

    const res = await fetch(`/api/users/${userId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const data = await res.json();
      setError(data.error || t("admin.saveError"));
      setSaving(false);
      return;
    }

    setSuccess(true);
    setSaving(false);
    setTimeout(() => setSuccess(false), 3000);
  }

  if (loading) {
    return <p className="text-slate-400">{t("common.loading")}</p>;
  }

  // Admin can't edit non-advisors
  if (currentUser.role === "admin" && originalRole !== "advisor") {
    return (
      <div className="max-w-2xl">
        <Link
          href="/users"
          className="inline-flex items-center gap-2 text-sm text-slate-400 transition hover:text-white mb-6"
        >
          <span>←</span>
          {t("users.backToUsers")}
        </Link>
        <p className="text-slate-400">{t("users.cannotEditOwner")}</p>
      </div>
    );
  }

  return (
    <div className="max-w-2xl">
      <Link
        href="/users"
        className="inline-flex items-center gap-2 text-sm text-slate-400 transition hover:text-white mb-6"
      >
        <span>←</span>
        {t("users.backToUsers")}
      </Link>

      <h1 className="text-2xl font-bold text-white mb-8">
        {t("users.editUser")}
      </h1>

      <form onSubmit={handleSubmit} className="space-y-6">
        <div>
          <label className="block text-sm font-medium text-slate-300 mb-2">
            {t("users.fullName")}
          </label>
          <input
            type="text"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            required
            className="w-full rounded-lg border border-white/10 bg-white/5 px-4 py-2.5 text-white placeholder-slate-500 focus:border-blue-500 focus:outline-none"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-300 mb-2">
            {t("users.role")}
          </label>
          {isSelf || originalRole === "owner" ? (
            <div className="flex items-center gap-2">
              <span className="rounded-full bg-slate-600/20 px-3 py-1 text-sm text-slate-300">
                {t(`users.role${originalRole.charAt(0).toUpperCase() + originalRole.slice(1)}`)}
              </span>
              {isSelf && (
                <span className="text-xs text-slate-500">
                  {t("users.cannotEditOwner")}
                </span>
              )}
            </div>
          ) : (
            <select
              value={role}
              onChange={(e) => setRole(e.target.value)}
              className="w-full rounded-lg border border-white/10 bg-[#0f1c2e] px-4 py-2.5 text-white focus:border-blue-500 focus:outline-none"
            >
              <option value="advisor" className="bg-[#0f1c2e] text-white">
                {t("users.roleAdvisor")}
              </option>
              {currentUser.role === "owner" && (
                <option value="admin" className="bg-[#0f1c2e] text-white">
                  {t("users.roleAdmin")}
                </option>
              )}
            </select>
          )}
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-300 mb-2">
            {t("users.status")}
          </label>
          <button
            type="button"
            onClick={() => {
              if (!isActive || confirm(t("users.confirmDeactivate"))) {
                setIsActive(!isActive);
              }
            }}
            className={`rounded-lg border px-4 py-2 text-sm font-medium transition ${
              isActive
                ? "border-green-500/30 bg-green-500/10 text-green-400 hover:bg-green-500/20"
                : "border-red-500/30 bg-red-500/10 text-red-400 hover:bg-red-500/20"
            }`}
          >
            {isActive ? t("users.active") : t("users.inactive")}
          </button>
        </div>

        {error && <p className="text-sm text-red-400">{error}</p>}
        {success && (
          <p className="text-sm text-green-400">{t("users.saved")}</p>
        )}

        <button
          type="submit"
          disabled={saving}
          className="rounded-lg bg-blue-600 px-6 py-2.5 text-sm font-medium text-white transition hover:bg-blue-700 disabled:opacity-50"
        >
          {saving ? t("users.saving") : t("users.saveChanges")}
        </button>
      </form>
    </div>
  );
}
