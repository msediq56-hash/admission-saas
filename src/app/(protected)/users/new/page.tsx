"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useAuth } from "@/lib/auth-context";
import { canManageUsers } from "@/lib/permissions";
import Link from "next/link";

export default function AddUserPage() {
  const t = useTranslations();
  const router = useRouter();
  const user = useAuth();

  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState("advisor");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  if (!canManageUsers(user.role)) {
    router.replace("/evaluate");
    return null;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError("");

    const res = await fetch("/api/users", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email,
        password,
        full_name: fullName,
        role,
      }),
    });

    if (!res.ok) {
      const data = await res.json();
      setError(data.error || t("admin.saveError"));
      setSaving(false);
      return;
    }

    setSuccess(true);
    setTimeout(() => {
      router.push("/users");
    }, 1500);
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
        {t("users.addUser")}
      </h1>

      {success ? (
        <div className="rounded-lg border border-green-500/20 bg-green-500/10 p-4 text-green-400">
          {t("users.userCreated")}
        </div>
      ) : (
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
              {t("users.email")}
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              dir="ltr"
              className="w-full rounded-lg border border-white/10 bg-white/5 px-4 py-2.5 text-white placeholder-slate-500 focus:border-blue-500 focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">
              {t("users.password")}
            </label>
            <input
              type="text"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={6}
              dir="ltr"
              className="w-full rounded-lg border border-white/10 bg-white/5 px-4 py-2.5 text-white placeholder-slate-500 focus:border-blue-500 focus:outline-none"
            />
            <p className="mt-1 text-xs text-slate-500">
              {t("users.passwordHint")}
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">
              {t("users.role")}
            </label>
            <select
              value={role}
              onChange={(e) => setRole(e.target.value)}
              className="w-full rounded-lg border border-white/10 bg-[#0f1c2e] px-4 py-2.5 text-white focus:border-blue-500 focus:outline-none"
            >
              <option value="advisor" className="bg-[#0f1c2e] text-white">
                {t("users.roleAdvisor")}
              </option>
              {user.role === "owner" && (
                <option value="admin" className="bg-[#0f1c2e] text-white">
                  {t("users.roleAdmin")}
                </option>
              )}
            </select>
          </div>

          {error && <p className="text-sm text-red-400">{error}</p>}

          <button
            type="submit"
            disabled={saving}
            className="rounded-lg bg-blue-600 px-6 py-2.5 text-sm font-medium text-white transition hover:bg-blue-700 disabled:opacity-50"
          >
            {saving ? t("users.saving") : t("users.addUser")}
          </button>
        </form>
      )}
    </div>
  );
}
