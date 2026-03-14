"use client";

import { useTranslations } from "next-intl";
import { useAuth } from "@/lib/auth-context";

export default function UniversitiesPage() {
  const t = useTranslations();
  const user = useAuth();

  return (
    <div>
      <h1 className="text-2xl font-bold text-white">
        {t("pages.universities")}
      </h1>
      <p className="mt-2 text-slate-400">
        {t("common.welcome")}، {user.fullName || user.email}
      </p>
    </div>
  );
}
