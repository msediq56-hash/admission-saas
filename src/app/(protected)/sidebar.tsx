"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { createSupabaseBrowserClient } from "@/lib/supabase-browser";
import type { AuthUser } from "@/lib/auth-context";
import { canManageUsers, canChangeBranding } from "@/lib/permissions";

interface NavItem {
  href: string;
  label: string;
}

export function Sidebar({ user }: { user: AuthUser }) {
  const t = useTranslations();
  const pathname = usePathname();
  const router = useRouter();

  const navItems: NavItem[] = [
    { href: "/evaluate", label: t("sidebar.evaluate") },
    { href: "/compare", label: t("sidebar.compare") },
    { href: "/universities", label: t("sidebar.universities") },
  ];

  if (canManageUsers(user.role)) {
    navItems.push(
      { href: "/dashboard", label: t("sidebar.dashboard") },
    );
  }

  if (canChangeBranding(user.role)) {
    navItems.push({
      href: "/settings",
      label: t("sidebar.settings"),
    });
  }

  async function handleLogout() {
    const supabase = createSupabaseBrowserClient();
    await supabase.auth.signOut();
    router.push("/login");
  }

  return (
    <aside className="flex w-64 flex-col border-l border-white/10 bg-[#0a1628]">
      <div className="border-b border-white/10 px-5 py-4">
        <span className="text-lg font-bold text-white">
          {t("common.appName")}
        </span>
      </div>

      <nav className="flex-1 space-y-1 px-3 py-4">
        {navItems.map((item) => {
          const isActive = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`block rounded-lg px-4 py-2.5 text-sm font-medium transition ${
                isActive
                  ? "bg-blue-600/20 text-blue-400"
                  : "text-slate-300 hover:bg-white/5 hover:text-white"
              }`}
            >
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="border-t border-white/10 px-5 py-4">
        <div className="mb-3">
          <p className="text-sm font-medium text-white">
            {user.fullName || user.email}
          </p>
          <p className="text-xs text-slate-400">{t(`roles.${user.role}`)}</p>
        </div>
        <button
          onClick={handleLogout}
          className="w-full rounded-lg border border-white/10 bg-white/5 px-4 py-2 text-sm text-slate-300 transition hover:bg-white/10 hover:text-white"
        >
          {t("common.logout")}
        </button>
      </div>
    </aside>
  );
}
