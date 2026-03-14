"use client";

import { useState, useEffect, useCallback } from "react";
import { useTranslations } from "next-intl";
import { createSupabaseBrowserClient } from "@/lib/supabase-browser";
import { useAuth } from "@/lib/auth-context";
import {
  buildQuestionsFromRequirements,
  evaluateAnswers,
  type EvaluationQuestion,
  type EvaluationAnswer,
  type EvaluationResult,
  type Requirement,
  type CustomRequirement,
  type ScholarshipTier,
} from "@/lib/evaluation-engine";

type Step = "university" | "program" | "questions" | "result";

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

const categoryColors: Record<string, string> = {
  foundation: "bg-amber-500/15 text-amber-400",
  bachelor: "bg-blue-500/15 text-blue-400",
  master: "bg-purple-500/15 text-purple-400",
  phd: "bg-emerald-500/15 text-emerald-400",
  language: "bg-cyan-500/15 text-cyan-400",
};

const statusStyles: Record<
  string,
  { bg: string; text: string; border: string }
> = {
  positive: {
    bg: "bg-green-500/10",
    text: "text-green-400",
    border: "border-green-500/30",
  },
  conditional: {
    bg: "bg-yellow-500/10",
    text: "text-yellow-400",
    border: "border-yellow-500/30",
  },
  negative: {
    bg: "bg-red-500/10",
    text: "text-red-400",
    border: "border-red-500/30",
  },
};

export default function EvaluatePage() {
  const t = useTranslations();
  const user = useAuth();
  const supabase = createSupabaseBrowserClient();

  const [step, setStep] = useState<Step>("university");

  // Step 1
  const [universities, setUniversities] = useState<University[]>([]);
  const [selectedUniversity, setSelectedUniversity] =
    useState<University | null>(null);

  // Step 2
  const [programs, setPrograms] = useState<Program[]>([]);
  const [selectedProgram, setSelectedProgram] = useState<Program | null>(null);

  // Step 3
  const [questions, setQuestions] = useState<EvaluationQuestion[]>([]);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [answers, setAnswers] = useState<EvaluationAnswer[]>([]);
  const [requirementData, setRequirementData] = useState<{
    req: Requirement;
    customReqs: CustomRequirement[];
    scholarshipTiers: ScholarshipTier[];
  } | null>(null);

  // Step 4
  const [result, setResult] = useState<EvaluationResult | null>(null);

  const [loading, setLoading] = useState(false);

  // Fetch universities on mount
  useEffect(() => {
    async function fetch() {
      const { data } = await supabase
        .from("universities")
        .select("id, name, country, type")
        .eq("tenant_id", user.tenantId)
        .eq("is_active", true)
        .order("sort_order");
      if (data) setUniversities(data);
    }
    fetch();
  }, [user.tenantId]); // eslint-disable-line react-hooks/exhaustive-deps

  const fetchPrograms = useCallback(
    async (universityId: string) => {
      setLoading(true);
      const { data } = await supabase
        .from("programs")
        .select("id, name, category, complexity_level")
        .eq("university_id", universityId)
        .eq("is_active", true)
        .order("sort_order");
      if (data) setPrograms(data);
      setLoading(false);
    },
    [supabase]
  );

  const fetchAndBuildQuestions = useCallback(
    async (programId: string) => {
      setLoading(true);
      const [reqRes, customRes, scholarshipRes] = await Promise.all([
        supabase
          .from("requirements")
          .select("*")
          .eq("program_id", programId)
          .single(),
        supabase
          .from("custom_requirements")
          .select("*")
          .eq("program_id", programId)
          .order("sort_order"),
        supabase
          .from("scholarship_tiers")
          .select("*")
          .eq("program_id", programId)
          .order("sort_order"),
      ]);

      const req = (reqRes.data as Requirement) || {};
      const customReqs = (customRes.data as CustomRequirement[]) || [];
      const tiers = (scholarshipRes.data as ScholarshipTier[]) || [];

      setRequirementData({ req, customReqs, scholarshipTiers: tiers });

      const built = buildQuestionsFromRequirements(req, customReqs, tiers);
      setQuestions(built);
      setCurrentQuestionIndex(0);
      setAnswers([]);
      setLoading(false);

      // If no questions, evaluate immediately
      if (built.length === 0) {
        const evalResult = evaluateAnswers([], req, customReqs, tiers, built);
        setResult(evalResult);
        setStep("result");
      }
    },
    [supabase]
  );

  function handleSelectUniversity(uni: University) {
    setSelectedUniversity(uni);
    setSelectedProgram(null);
    setStep("program");
    fetchPrograms(uni.id);
  }

  function handleSelectProgram(prog: Program) {
    setSelectedProgram(prog);
    setStep("questions");
    fetchAndBuildQuestions(prog.id);
  }

  function handleAnswer(value: string) {
    const currentQ = questions[currentQuestionIndex];
    const newAnswers = [
      ...answers.filter((a) => a.questionId !== currentQ.id),
      { questionId: currentQ.id, value },
    ];
    setAnswers(newAnswers);

    // Immediate blocking check
    if (currentQ.isBlocking && value === "no") {
      const evalResult = evaluateAnswers(
        newAnswers,
        requirementData!.req,
        requirementData!.customReqs,
        requirementData!.scholarshipTiers,
        questions
      );
      setResult(evalResult);
      setStep("result");
      return;
    }

    if (currentQuestionIndex < questions.length - 1) {
      setCurrentQuestionIndex(currentQuestionIndex + 1);
    } else {
      const evalResult = evaluateAnswers(
        newAnswers,
        requirementData!.req,
        requirementData!.customReqs,
        requirementData!.scholarshipTiers,
        questions
      );
      setResult(evalResult);
      setStep("result");
    }
  }

  function handleBack() {
    switch (step) {
      case "program":
        setStep("university");
        setSelectedUniversity(null);
        break;
      case "questions":
        if (currentQuestionIndex > 0) {
          setCurrentQuestionIndex(currentQuestionIndex - 1);
        } else {
          setStep("program");
          setSelectedProgram(null);
        }
        break;
      case "result":
        // Go back to last question (or program if no questions)
        if (questions.length > 0) {
          setStep("questions");
          setCurrentQuestionIndex(questions.length - 1);
        } else {
          setStep("program");
          setSelectedProgram(null);
        }
        break;
    }
  }

  function handleReset() {
    setStep("university");
    setSelectedUniversity(null);
    setSelectedProgram(null);
    setQuestions([]);
    setAnswers([]);
    setResult(null);
    setCurrentQuestionIndex(0);
    setRequirementData(null);
  }

  const steps = [
    { key: "university", label: t("evaluation.selectUniversity") },
    { key: "program", label: t("evaluation.selectProgram") },
    { key: "questions", label: t("evaluation.answerQuestions") },
    { key: "result", label: t("evaluation.result") },
  ];
  const currentStepIndex = steps.findIndex((s) => s.key === step);

  return (
    <div>
      <h1 className="text-2xl font-bold text-white mb-6">
        {t("evaluation.title")}
      </h1>

      {/* Step indicator */}
      <div className="flex items-center gap-2 mb-8 overflow-x-auto pb-2">
        {steps.map((s, i) => (
          <div key={s.key} className="flex items-center gap-2">
            <div
              className={`flex items-center gap-2 rounded-full px-4 py-1.5 text-sm font-medium whitespace-nowrap ${
                i === currentStepIndex
                  ? "bg-blue-600/20 text-blue-400"
                  : i < currentStepIndex
                    ? "bg-white/10 text-white"
                    : "bg-white/5 text-slate-500"
              }`}
            >
              <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-white/10 text-xs">
                {i + 1}
              </span>
              {s.label}
            </div>
            {i < steps.length - 1 && (
              <span className="text-slate-600">—</span>
            )}
          </div>
        ))}
      </div>

      {/* Back button */}
      {step !== "university" && step !== "result" && (
        <button
          onClick={handleBack}
          className="mb-4 text-sm text-slate-400 hover:text-white transition"
        >
          ← {t("evaluation.back")}
        </button>
      )}

      {/* STEP 1: Select University */}
      {step === "university" && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {universities.map((uni) => (
            <button
              key={uni.id}
              onClick={() => handleSelectUniversity(uni)}
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
      )}

      {/* STEP 2: Select Program */}
      {step === "program" && (
        <div>
          <p className="mb-4 text-slate-400">{selectedUniversity?.name}</p>
          {loading ? (
            <p className="text-slate-400">{t("common.loading")}</p>
          ) : programs.length === 0 ? (
            <p className="text-slate-400">{t("evaluation.noPrograms")}</p>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2">
              {programs.map((prog) => (
                <button
                  key={prog.id}
                  onClick={() => handleSelectProgram(prog)}
                  className="rounded-xl border border-white/10 bg-white/5 p-5 text-right transition hover:border-blue-500/50 hover:bg-white/10"
                >
                  <div className="flex items-start justify-between gap-3">
                    <h3 className="text-base font-semibold text-white">
                      {prog.name}
                    </h3>
                    <span
                      className={`shrink-0 rounded-full px-3 py-0.5 text-xs font-medium ${categoryColors[prog.category] || "bg-slate-500/15 text-slate-400"}`}
                    >
                      {t(
                        `categories.${prog.category}` as Parameters<
                          typeof t
                        >[0]
                      )}
                    </span>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* STEP 3: Answer Questions */}
      {step === "questions" && !loading && questions.length > 0 && (
        <div>
          <p className="mb-2 text-slate-400">
            {selectedUniversity?.name} — {selectedProgram?.name}
          </p>

          <div className="mt-4">
            {/* Progress */}
            <div className="mb-6 flex items-center justify-between">
              <span className="text-sm text-slate-400">
                {t("evaluation.questionOf", {
                  current: currentQuestionIndex + 1,
                  total: questions.length,
                })}
              </span>
              <div className="h-1.5 flex-1 mx-4 rounded-full bg-white/10 overflow-hidden">
                <div
                  className="h-full rounded-full bg-blue-500 transition-all duration-300"
                  style={{
                    width: `${((currentQuestionIndex + 1) / questions.length) * 100}%`,
                  }}
                />
              </div>
            </div>

            {/* Current question */}
            <div className="rounded-xl border border-white/10 bg-white/5 p-8">
              <h3 className="text-xl font-semibold text-white mb-8">
                {questions[currentQuestionIndex].text}
              </h3>

              {questions[currentQuestionIndex].type === "yes_no" ? (
                <div className="flex gap-4">
                  <button
                    onClick={() => handleAnswer("yes")}
                    className="flex-1 rounded-xl border-2 border-green-500/30 bg-green-500/10 px-6 py-4 text-lg font-semibold text-green-400 transition hover:bg-green-500/20 hover:border-green-500/50"
                  >
                    {t("evaluation.yes")}
                  </button>
                  <button
                    onClick={() => handleAnswer("no")}
                    className="flex-1 rounded-xl border-2 border-red-500/30 bg-red-500/10 px-6 py-4 text-lg font-semibold text-red-400 transition hover:bg-red-500/20 hover:border-red-500/50"
                  >
                    {t("evaluation.no")}
                  </button>
                </div>
              ) : (
                <div className="space-y-3">
                  {questions[currentQuestionIndex].options?.map((opt) => (
                    <button
                      key={opt.value}
                      onClick={() => handleAnswer(opt.value)}
                      className="w-full rounded-xl border border-white/10 bg-white/5 px-6 py-4 text-right text-base font-medium text-white transition hover:border-blue-500/50 hover:bg-white/10"
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {step === "questions" && loading && (
        <p className="text-slate-400">{t("evaluation.loadingProgram")}</p>
      )}

      {/* STEP 4: Result */}
      {step === "result" && result && (
        <div>
          <p className="mb-4 text-slate-400">
            {selectedUniversity?.name} — {selectedProgram?.name}
          </p>

          <div
            className={`rounded-xl border ${statusStyles[result.status].border} ${statusStyles[result.status].bg} p-8`}
          >
            <div className="mb-4">
              <span
                className={`inline-block rounded-full px-4 py-1.5 text-sm font-bold ${statusStyles[result.status].text} ${statusStyles[result.status].bg} border ${statusStyles[result.status].border}`}
              >
                {result.title}
              </span>
            </div>

            <p className="text-lg text-white font-medium mb-6">
              {result.message}
            </p>

            {/* Conditions */}
            {result.conditions.length > 0 && (
              <div className="mb-6">
                <h4 className="text-sm font-semibold text-slate-300 mb-3">
                  {t("evaluation.conditions")}
                </h4>
                <ul className="space-y-2">
                  {result.conditions.map((c, i) => (
                    <li
                      key={i}
                      className="flex items-start gap-2 text-sm text-yellow-300/90"
                    >
                      <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-yellow-400" />
                      <span>
                        <span className="font-medium">{c.category}:</span>{" "}
                        {c.description}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Scholarship */}
            {result.scholarshipInfo && (
              <div className="mb-6 rounded-lg bg-white/5 border border-white/10 p-4">
                <h4 className="text-sm font-semibold text-slate-300 mb-1">
                  {t("evaluation.scholarship")}
                </h4>
                <p className="text-sm text-green-400 font-medium">
                  {result.scholarshipInfo}
                </p>
              </div>
            )}

            {/* Notes */}
            {result.notes.length > 0 && (
              <div>
                <h4 className="text-sm font-semibold text-slate-300 mb-2">
                  {t("evaluation.notes")}
                </h4>
                {result.notes.map((note, i) => (
                  <p key={i} className="text-sm text-slate-400">
                    {note}
                  </p>
                ))}
              </div>
            )}
          </div>

          <div className="mt-6 flex gap-3">
            <button
              onClick={handleReset}
              className="rounded-xl bg-blue-600 px-6 py-3 text-sm font-semibold text-white transition hover:bg-blue-500"
            >
              {t("evaluation.newEvaluation")}
            </button>
            <button
              onClick={handleBack}
              className="rounded-xl border border-white/10 bg-white/5 px-6 py-3 text-sm font-semibold text-slate-300 transition hover:bg-white/10"
            >
              {t("evaluation.back")}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
