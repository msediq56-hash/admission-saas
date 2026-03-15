"use client";

import { useTranslations } from "next-intl";
import { categoryColors } from "@/lib/ui-constants";

interface University {
  id: string;
  name: string;
  country: string;
  type: string;
}

interface Program {
  id: string;
  name: string;
  category: string;
  complexity_level: string;
}

export function CountryStep({
  countries,
  onSelect,
}: {
  countries: string[];
  onSelect: (country: string) => void;
}) {
  const t = useTranslations();
  return (
    <div>
      <h2 className="text-lg font-semibold text-slate-300 mb-4">
        {t("evaluation.selectCountry")}
      </h2>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {countries.map((country) => (
          <button
            key={country}
            onClick={() => onSelect(country)}
            className="rounded-xl border border-white/10 bg-white/5 p-5 text-right text-lg font-semibold text-white transition hover:border-blue-500/50 hover:bg-white/10"
          >
            {country}
          </button>
        ))}
      </div>
    </div>
  );
}

export function TypeStep({
  types,
  onSelect,
}: {
  types: string[];
  onSelect: (type: string) => void;
}) {
  const t = useTranslations();
  return (
    <div>
      <h2 className="text-lg font-semibold text-slate-300 mb-4">
        {t("evaluation.selectType")}
      </h2>
      <div className="grid gap-3 sm:grid-cols-2">
        {types.map((type) => (
          <button
            key={type}
            onClick={() => onSelect(type)}
            className="rounded-xl border border-white/10 bg-white/5 p-5 text-right text-lg font-semibold text-white transition hover:border-blue-500/50 hover:bg-white/10"
          >
            {type === "public"
              ? t("universities.public")
              : t("universities.private")}
          </button>
        ))}
      </div>
    </div>
  );
}

export function UniversityStep({
  universities,
  onSelect,
}: {
  universities: University[];
  onSelect: (uni: University) => void;
}) {
  const t = useTranslations();
  return (
    <div>
      <h2 className="text-lg font-semibold text-slate-300 mb-4">
        {t("evaluation.selectUniversity")}
      </h2>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {universities.map((uni) => (
          <button
            key={uni.id}
            onClick={() => onSelect(uni)}
            className="rounded-xl border border-white/10 bg-white/5 p-6 text-right transition hover:border-blue-500/50 hover:bg-white/10"
          >
            <h3 className="text-lg font-bold text-white">{uni.name}</h3>
            <p className="mt-1 text-sm text-slate-400">
              {uni.country}
              {" — "}
              {uni.type === "public"
                ? t("universities.public")
                : t("universities.private")}
            </p>
          </button>
        ))}
      </div>
    </div>
  );
}

export function CategoryStep({
  categories,
  loading,
  onSelect,
}: {
  categories: string[];
  loading: boolean;
  onSelect: (cat: string) => void;
}) {
  const t = useTranslations();
  return (
    <div>
      <h2 className="text-lg font-semibold text-slate-300 mb-4">
        {t("evaluation.selectCategory")}
      </h2>
      {loading ? (
        <p className="text-slate-400">{t("common.loading")}</p>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => onSelect(cat)}
              className="rounded-xl border border-white/10 bg-white/5 p-5 text-right transition hover:border-blue-500/50 hover:bg-white/10"
            >
              <span
                className={`inline-block rounded-full px-3 py-1 text-sm font-medium ${categoryColors[cat] || "bg-slate-500/15 text-slate-400"}`}
              >
                {t(`categories.${cat}` as Parameters<typeof t>[0])}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

interface CertificateTypeOption {
  id: string;
  slug: string;
  name_ar: string;
}

export function CertificateTypeStep({
  certTypes,
  loading,
  onSelect,
}: {
  certTypes: CertificateTypeOption[];
  loading: boolean;
  onSelect: (ct: CertificateTypeOption) => void;
}) {
  const t = useTranslations();
  return (
    <div>
      <h2 className="text-lg font-semibold text-slate-300 mb-4">
        {t("evaluation.selectCertificate")}
      </h2>
      {loading ? (
        <p className="text-slate-400">{t("common.loading")}</p>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {certTypes.map((ct) => (
            <button
              key={ct.id}
              onClick={() => onSelect(ct)}
              className="rounded-xl border border-white/10 bg-white/5 p-5 text-right transition hover:border-blue-500/50 hover:bg-white/10"
            >
              <h3 className="text-base font-semibold text-white">
                {ct.name_ar}
              </h3>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export function ProgramStep({
  programs,
  loading,
  onSelect,
}: {
  programs: Program[];
  loading: boolean;
  onSelect: (prog: Program) => void;
}) {
  const t = useTranslations();
  return (
    <div>
      <h2 className="text-lg font-semibold text-slate-300 mb-4">
        {t("evaluation.selectCertificate")}
      </h2>
      {loading ? (
        <p className="text-slate-400">{t("common.loading")}</p>
      ) : programs.length === 0 ? (
        <p className="text-slate-400">{t("evaluation.noPrograms")}</p>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {programs.map((prog) => (
            <button
              key={prog.id}
              onClick={() => onSelect(prog)}
              className="rounded-xl border border-white/10 bg-white/5 p-5 text-right transition hover:border-blue-500/50 hover:bg-white/10"
            >
              <h3 className="text-base font-semibold text-white">
                {prog.name}
              </h3>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
