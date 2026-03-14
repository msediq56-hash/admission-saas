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

// Steps: country → type → university → category → program → questions → result
type Step =
  | "country"
  | "type"
  | "university"
  | "category"
  | "program"
  | "questions"
  | "result";

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

  const [step, setStep] = useState<Step>("country");

  // All universities (fetched once)
  const [allUniversities, setAllUniversities] = useState<University[]>([]);

  // Selection state
  const [selectedCountry, setSelectedCountry] = useState<string | null>(null);
  const [selectedType, setSelectedType] = useState<string | null>(null);
  const [selectedUniversity, setSelectedUniversity] =
    useState<University | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [selectedProgram, setSelectedProgram] = useState<Program | null>(null);

  // Programs for selected university
  const [programs, setPrograms] = useState<Program[]>([]);

  // Questions
  const [questions, setQuestions] = useState<EvaluationQuestion[]>([]);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [answers, setAnswers] = useState<EvaluationAnswer[]>([]);
  const [requirementData, setRequirementData] = useState<{
    req: Requirement;
    customReqs: CustomRequirement[];
    scholarshipTiers: ScholarshipTier[];
  } | null>(null);

  // Track which question caused early exit to negative result
  const [blockedAtQuestionIndex, setBlockedAtQuestionIndex] = useState<
    number | null
  >(null);

  // Result
  const [result, setResult] = useState<EvaluationResult | null>(null);

  const [loading, setLoading] = useState(false);

  // Fetch all universities once
  useEffect(() => {
    async function fetch() {
      const { data } = await supabase
        .from("universities")
        .select("id, name, country, type")
        .eq("tenant_id", user.tenantId)
        .eq("is_active", true)
        .order("sort_order");
      if (data) setAllUniversities(data);
    }
    fetch();
  }, [user.tenantId]); // eslint-disable-line react-hooks/exhaustive-deps

  // Derived data
  const countries = [...new Set(allUniversities.map((u) => u.country))];

  const typesForCountry = selectedCountry
    ? [
        ...new Set(
          allUniversities
            .filter((u) => u.country === selectedCountry)
            .map((u) => u.type)
        ),
      ]
    : [];

  const universitiesForSelection = allUniversities.filter(
    (u) =>
      u.country === selectedCountry &&
      (selectedType ? u.type === selectedType : true)
  );

  const categoriesForUniversity = selectedUniversity
    ? [...new Set(programs.map((p) => p.category))]
    : [];

  const programsForCategory = selectedCategory
    ? programs.filter((p) => p.category === selectedCategory)
    : [];

  // Fetch programs when university selected
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
      return data || [];
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
      setBlockedAtQuestionIndex(null);
      setLoading(false);

      if (built.length === 0) {
        const evalResult = evaluateAnswers([], req, customReqs, tiers, built);
        setResult(evalResult);
        setStep("result");
      }
    },
    [supabase]
  );

  // --- Handlers ---

  function handleSelectCountry(country: string) {
    setSelectedCountry(country);
    // Check if only one type for this country — skip type step
    const types = [
      ...new Set(
        allUniversities
          .filter((u) => u.country === country)
          .map((u) => u.type)
      ),
    ];
    if (types.length === 1) {
      setSelectedType(types[0]);
      // Check if only one university for this country+type
      const unis = allUniversities.filter(
        (u) => u.country === country && u.type === types[0]
      );
      if (unis.length === 1) {
        handleSelectUniversity(unis[0]);
      } else {
        setStep("university");
      }
    } else {
      setStep("type");
    }
  }

  function handleSelectType(type: string) {
    setSelectedType(type);
    const unis = allUniversities.filter(
      (u) => u.country === selectedCountry && u.type === type
    );
    if (unis.length === 1) {
      handleSelectUniversity(unis[0]);
    } else {
      setStep("university");
    }
  }

  async function handleSelectUniversity(uni: University) {
    setSelectedUniversity(uni);
    setSelectedCountry(uni.country);
    setSelectedType(uni.type);
    const fetchedPrograms = await fetchPrograms(uni.id);

    // Get unique categories
    const cats = [...new Set(fetchedPrograms.map((p: Program) => p.category))];
    if (cats.length === 1) {
      // Only one category — skip category selection
      const progsInCat = fetchedPrograms.filter(
        (p: Program) => p.category === cats[0]
      );
      setSelectedCategory(cats[0]);
      if (progsInCat.length === 1) {
        // Only one program — select it directly
        setSelectedProgram(progsInCat[0]);
        setStep("questions");
        fetchAndBuildQuestions(progsInCat[0].id);
      } else {
        setStep("program");
      }
    } else {
      setStep("category");
    }
  }

  function handleSelectCategory(category: string) {
    setSelectedCategory(category);
    const progsInCat = programs.filter((p) => p.category === category);
    if (progsInCat.length === 1) {
      handleSelectProgram(progsInCat[0]);
    } else {
      setStep("program");
    }
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
      setBlockedAtQuestionIndex(currentQuestionIndex);
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
      setBlockedAtQuestionIndex(null);
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
      case "type":
        setSelectedCountry(null);
        setSelectedType(null);
        setStep("country");
        break;
      case "university":
        // Go back to type if multiple types, else back to country
        if (typesForCountry.length > 1) {
          setSelectedType(null);
          setStep("type");
        } else {
          setSelectedCountry(null);
          setSelectedType(null);
          setStep("country");
        }
        break;
      case "category":
        setSelectedUniversity(null);
        setSelectedCategory(null);
        // Go back to university if multiple unis, else further back
        if (universitiesForSelection.length > 1) {
          setStep("university");
        } else if (typesForCountry.length > 1) {
          setSelectedType(null);
          setStep("type");
        } else {
          setSelectedCountry(null);
          setSelectedType(null);
          setStep("country");
        }
        break;
      case "program":
        if (categoriesForUniversity.length > 1) {
          setSelectedCategory(null);
          setStep("category");
        } else {
          setSelectedUniversity(null);
          setSelectedCategory(null);
          setStep("university");
        }
        break;
      case "questions":
        if (currentQuestionIndex > 0) {
          setCurrentQuestionIndex(currentQuestionIndex - 1);
        } else {
          // Back to program selection
          setSelectedProgram(null);
          if (programsForCategory.length > 1) {
            setStep("program");
          } else if (categoriesForUniversity.length > 1) {
            setSelectedCategory(null);
            setStep("category");
          } else {
            setSelectedUniversity(null);
            setSelectedCategory(null);
            setStep("university");
          }
        }
        break;
      case "result":
        // Go back to the question that caused blocking (or last question)
        if (questions.length > 0) {
          const goBackTo =
            blockedAtQuestionIndex !== null
              ? blockedAtQuestionIndex
              : questions.length - 1;
          // Remove the answer for the question we're going back to
          const qId = questions[goBackTo].id;
          setAnswers(answers.filter((a) => a.questionId !== qId));
          setCurrentQuestionIndex(goBackTo);
          setResult(null);
          setBlockedAtQuestionIndex(null);
          setStep("questions");
        } else {
          setSelectedProgram(null);
          setResult(null);
          setStep("program");
        }
        break;
    }
  }

  function handleReset() {
    setStep("country");
    setSelectedCountry(null);
    setSelectedType(null);
    setSelectedUniversity(null);
    setSelectedCategory(null);
    setSelectedProgram(null);
    setPrograms([]);
    setQuestions([]);
    setAnswers([]);
    setResult(null);
    setCurrentQuestionIndex(0);
    setBlockedAtQuestionIndex(null);
    setRequirementData(null);
  }

  // Step indicator — simplified to 4 high-level steps
  const stepGroup = (() => {
    if (
      step === "country" ||
      step === "type" ||
      step === "university"
    )
      return 0;
    if (step === "category" || step === "program") return 1;
    if (step === "questions") return 2;
    return 3;
  })();

  const stepLabels = [
    t("evaluation.selectUniversity"),
    t("evaluation.selectProgram"),
    t("evaluation.answerQuestions"),
    t("evaluation.result"),
  ];

  // Breadcrumb
  const breadcrumbParts: string[] = [];
  if (selectedCountry) breadcrumbParts.push(selectedCountry);
  if (selectedType)
    breadcrumbParts.push(
      selectedType === "public"
        ? t("universities.public")
        : t("universities.private")
    );
  if (selectedUniversity) breadcrumbParts.push(selectedUniversity.name);
  if (selectedCategory)
    breadcrumbParts.push(
      t(`categories.${selectedCategory}` as Parameters<typeof t>[0])
    );
  if (selectedProgram) breadcrumbParts.push(selectedProgram.name);

  return (
    <div>
      <h1 className="text-2xl font-bold text-white mb-6">
        {t("evaluation.title")}
      </h1>

      {/* Step indicator */}
      <div className="flex items-center gap-2 mb-6 overflow-x-auto pb-2">
        {stepLabels.map((label, i) => (
          <div key={i} className="flex items-center gap-2">
            <div
              className={`flex items-center gap-2 rounded-full px-4 py-1.5 text-sm font-medium whitespace-nowrap ${
                i === stepGroup
                  ? "bg-blue-600/20 text-blue-400"
                  : i < stepGroup
                    ? "bg-white/10 text-white"
                    : "bg-white/5 text-slate-500"
              }`}
            >
              <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-white/10 text-xs">
                {i + 1}
              </span>
              {label}
            </div>
            {i < stepLabels.length - 1 && (
              <span className="text-slate-600">—</span>
            )}
          </div>
        ))}
      </div>

      {/* Breadcrumb */}
      {breadcrumbParts.length > 0 && step !== "result" && (
        <p className="mb-4 text-sm text-slate-500">
          {breadcrumbParts.join(" › ")}
        </p>
      )}

      {/* Back button */}
      {step !== "country" && step !== "result" && (
        <button
          onClick={handleBack}
          className="mb-4 text-sm text-slate-400 hover:text-white transition"
        >
          ← {t("evaluation.back")}
        </button>
      )}

      {/* STEP: Select Country */}
      {step === "country" && (
        <div>
          <h2 className="text-lg font-semibold text-slate-300 mb-4">
            {t("evaluation.selectCountry")}
          </h2>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {countries.map((country) => (
              <button
                key={country}
                onClick={() => handleSelectCountry(country)}
                className="rounded-xl border border-white/10 bg-white/5 p-5 text-right text-lg font-semibold text-white transition hover:border-blue-500/50 hover:bg-white/10"
              >
                {country}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* STEP: Select Type */}
      {step === "type" && (
        <div>
          <h2 className="text-lg font-semibold text-slate-300 mb-4">
            {t("evaluation.selectType")}
          </h2>
          <div className="grid gap-3 sm:grid-cols-2">
            {typesForCountry.map((type) => (
              <button
                key={type}
                onClick={() => handleSelectType(type)}
                className="rounded-xl border border-white/10 bg-white/5 p-5 text-right text-lg font-semibold text-white transition hover:border-blue-500/50 hover:bg-white/10"
              >
                {type === "public"
                  ? t("universities.public")
                  : t("universities.private")}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* STEP: Select University */}
      {step === "university" && (
        <div>
          <h2 className="text-lg font-semibold text-slate-300 mb-4">
            {t("evaluation.selectUniversity")}
          </h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {universitiesForSelection.map((uni) => (
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
        </div>
      )}

      {/* STEP: Select Category */}
      {step === "category" && (
        <div>
          <h2 className="text-lg font-semibold text-slate-300 mb-4">
            {t("evaluation.selectCategory")}
          </h2>
          {loading ? (
            <p className="text-slate-400">{t("common.loading")}</p>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {categoriesForUniversity.map((cat) => (
                <button
                  key={cat}
                  onClick={() => handleSelectCategory(cat)}
                  className={`rounded-xl border border-white/10 bg-white/5 p-5 text-right transition hover:border-blue-500/50 hover:bg-white/10`}
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
      )}

      {/* STEP: Select Program (specific variant) */}
      {step === "program" && (
        <div>
          <h2 className="text-lg font-semibold text-slate-300 mb-4">
            {t("evaluation.selectCertificate")}
          </h2>
          {loading ? (
            <p className="text-slate-400">{t("common.loading")}</p>
          ) : programsForCategory.length === 0 ? (
            <p className="text-slate-400">{t("evaluation.noPrograms")}</p>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2">
              {programsForCategory.map((prog) => (
                <button
                  key={prog.id}
                  onClick={() => handleSelectProgram(prog)}
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
      )}

      {/* STEP: Answer Questions */}
      {step === "questions" && !loading && questions.length > 0 && (
        <div>
          <div className="mt-4">
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

      {/* STEP: Result */}
      {step === "result" && result && (
        <div>
          <p className="mb-4 text-sm text-slate-500">
            {breadcrumbParts.join(" › ")}
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
