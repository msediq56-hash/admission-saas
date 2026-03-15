"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { useAuth } from "@/lib/auth-context";
import { canManageUsers } from "@/lib/permissions";
import { createSupabaseBrowserClient } from "@/lib/supabase-browser";

interface UserRow {
  id: string;
  email: string;
  full_name: string | null;
  role: string;
  is_active: boolean;
  created_at: string;
}

export default function UsersPage() {
  const t = useTranslations();
  const router = useRouter();
  const user = useAuth();
  const [users, setUsers] = useState<UserRow[]>([]);
  const [loading, setLoading] = useState(true);

  if (!canManageUsers(user.role)) {
    router.replace("/evaluate");
    return null;
  }

  // eslint-disable-next-line react-hooks/rules-of-hooks
  useEffect(() => {
    async function load() {
      const supabase = createSupabaseBrowserClient();
      let query = supabase
        .from("users")
        .select("id, email, full_name, role, is_active, created_at")
        .eq("tenant_id", user.tenantId)
        .order("created_at", { ascending: true });

      // Admin sees advisors only, owner sees all
      if (user.role === "admin") {
        query = query.eq("role", "advisor");
      }

      const { data } = await query;
      setUsers(data || []);
      setLoading(false);
    }
    load();
  }, [user.tenantId, user.role]);

  const roleBadge = (role: string) => {
    const colors: Record<string, string> = {
      owner: "bg-purple-600/20 text-purple-400",
      admin: "bg-blue-600/20 text-blue-400",
      advisor: "bg-green-600/20 text-green-400",
    };
    const roleKey = role === "advisor" ? "roleAdvisor" : role === "admin" ? "roleAdmin" : "roleOwner";
    return (
      <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${colors[role] || "bg-slate-600/20 text-slate-400"}`}>
        {t(`users.${roleKey}`)}
      </span>
    );
  };

  const statusBadge = (isActive: boolean) => (
    <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${isActive ? "bg-green-600/20 text-green-400" : "bg-red-600/20 text-red-400"}`}>
      {isActive ? t("users.active") : t("users.inactive")}
    </span>
  );

  return (
    <div>
      <div className="mb-8 flex items-center justify-between">
        <h1 className="text-2xl font-bold text-white">{t("users.title")}</h1>
        <Link
          href="/users/new"
          className="rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-blue-700"
        >
          {t("users.addUser")}
        </Link>
      </div>

      {loading ? (
        <p className="text-slate-400">{t("common.loading")}</p>
      ) : users.length === 0 ? (
        <p className="text-slate-400">{t("users.noUsers")}</p>
      ) : (
        <div className="overflow-hidden rounded-xl border border-white/10">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/10 bg-white/5">
                <th className="px-4 py-3 text-right font-medium text-slate-300">
                  {t("users.fullName")}
                </th>
                <th className="px-4 py-3 text-right font-medium text-slate-300">
                  {t("users.email")}
                </th>
                <th className="px-4 py-3 text-right font-medium text-slate-300">
                  {t("users.role")}
                </th>
                <th className="px-4 py-3 text-right font-medium text-slate-300">
                  {t("users.status")}
                </th>
                <th className="px-4 py-3 text-right font-medium text-slate-300">
                  {t("users.createdAt")}
                </th>
                <th className="px-4 py-3 text-right font-medium text-slate-300" />
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr
                  key={u.id}
                  className="border-b border-white/5 transition hover:bg-white/5"
                >
                  <td className="px-4 py-3 text-white">
                    {u.full_name || "—"}
                  </td>
                  <td className="px-4 py-3 text-slate-300">{u.email}</td>
                  <td className="px-4 py-3">{roleBadge(u.role)}</td>
                  <td className="px-4 py-3">{statusBadge(u.is_active)}</td>
                  <td className="px-4 py-3 text-slate-400">
                    {new Date(u.created_at).toLocaleDateString("ar")}
                  </td>
                  <td className="px-4 py-3">
                    <Link
                      href={`/users/${u.id}/edit`}
                      className="text-sm text-blue-400 transition hover:text-blue-300"
                    >
                      {t("common.edit")}
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
