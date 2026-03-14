import Link from "next/link";
import { getTranslations } from "next-intl/server";

export default async function Home() {
  const t = await getTranslations();

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#0f1c2e] to-[#1a2d47] text-white">
      <nav className="flex items-center justify-between px-8 py-4 border-b border-white/10">
        <span className="text-lg font-bold">{t("common.appName")}</span>
        <Link
          href="/login"
          className="rounded-lg bg-white/10 px-5 py-2 text-sm font-medium transition hover:bg-white/20"
        >
          {t("landing.login")}
        </Link>
      </nav>

      <main className="flex flex-col items-center justify-center px-4 pt-32 pb-20 text-center">
        <h1 className="text-4xl font-bold leading-tight tracking-tight sm:text-5xl md:text-6xl">
          {t("landing.title")}
        </h1>
        <p className="mt-6 max-w-2xl text-lg text-slate-300 sm:text-xl">
          {t("landing.subtitle")}
        </p>

        <div className="mt-10 flex flex-wrap items-center justify-center gap-4">
          <button className="rounded-xl bg-blue-600 px-8 py-3 text-base font-semibold transition hover:bg-blue-500">
            {t("landing.trySystem")}
          </button>
          <Link
            href="/login"
            className="rounded-xl border border-white/20 bg-white/5 px-8 py-3 text-base font-semibold transition hover:bg-white/10"
          >
            {t("landing.login")}
          </Link>
        </div>
      </main>

      <footer className="mt-auto border-t border-white/10 py-6 text-center text-sm text-slate-400">
        &copy; {new Date().getFullYear()} {t("common.appName")}
      </footer>
    </div>
  );
}
