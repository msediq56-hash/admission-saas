"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { createSupabaseBrowserClient } from "@/lib/supabase-browser";

export default function LoginPage() {
  const t = useTranslations();
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const supabase = createSupabaseBrowserClient();

      const { error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (signInError) {
        setError(t("auth.invalidCredentials"));
        setLoading(false);
        return;
      }

      // Fetch user role to determine redirect
      const {
        data: { user: authUser },
      } = await supabase.auth.getUser();

      if (!authUser) {
        setError(t("auth.genericError"));
        setLoading(false);
        return;
      }

      const { data: userData, error: userError } = await supabase
        .from("users")
        .select("role, is_active")
        .eq("id", authUser.id)
        .single();

      if (userError || !userData) {
        setError(t("auth.userNotFound"));
        await supabase.auth.signOut();
        setLoading(false);
        return;
      }

      if (!userData.is_active) {
        setError(t("auth.accountDisabled"));
        await supabase.auth.signOut();
        setLoading(false);
        return;
      }

      if (userData.role === "advisor") {
        router.push("/evaluate");
      } else {
        router.push("/dashboard");
      }
    } catch {
      setError(t("auth.genericError"));
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-[#0f1c2e] to-[#1a2d47] px-4">
      <div className="w-full max-w-md rounded-2xl border border-white/10 bg-white/5 p-8 backdrop-blur-sm">
        <div className="mb-8 text-center">
          <h1 className="text-2xl font-bold text-white">
            {t("auth.loginTitle")}
          </h1>
          <p className="mt-2 text-sm text-slate-400">
            {t("auth.loginSubtitle")}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label
              htmlFor="email"
              className="mb-1.5 block text-sm font-medium text-slate-300"
            >
              {t("auth.email")}
            </label>
            <input
              id="email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder={t("auth.emailPlaceholder")}
              className="w-full rounded-lg border border-white/10 bg-white/5 px-4 py-2.5 text-white placeholder:text-slate-500 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              dir="ltr"
            />
          </div>

          <div>
            <label
              htmlFor="password"
              className="mb-1.5 block text-sm font-medium text-slate-300"
            >
              {t("auth.password")}
            </label>
            <input
              id="password"
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder={t("auth.passwordPlaceholder")}
              className="w-full rounded-lg border border-white/10 bg-white/5 px-4 py-2.5 text-white placeholder:text-slate-500 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              dir="ltr"
            />
          </div>

          {error && (
            <div className="rounded-lg bg-red-500/10 border border-red-500/20 px-4 py-3 text-sm text-red-400">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? t("auth.loggingIn") : t("auth.loginButton")}
          </button>
        </form>
      </div>
    </div>
  );
}
