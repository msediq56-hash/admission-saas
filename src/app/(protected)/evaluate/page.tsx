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
import {
  CountryStep,
  TypeStep,
  UniversityStep,
  CategoryStep,
  ProgramStep,
} from "./_components/step-selector";
import { QuestionWizard } from "./_components/question-wizard";
import { EvaluationResultView } from "./_components/evaluation-result";

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

export default function EvaluatePage() {
  const t = useTranslations();
  const user = useAuth();
  const supabase = createSupabaseBrowserClient();

  const [step, setStep] = useState<Step>("country");
  const [allUniversities, setAllUniversities] = useState<University[]>([]);
  const [selectedCountry, setSelectedCountry] = useState<string | null>(null);
  const [selectedType, setSelectedType] = useState<string | null>(null);
  const [selectedUniversity, setSelectedUniversity] =
    useState<University | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [selectedProgram, setSelectedProgram] = useState<Program | null>(null);
  const [programs, setPrograms] = useState<Program[]>([]);
  const [questions, setQuestions] = useState<EvaluationQuestion[]>([]);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [answers, setAnswers] = useState<EvaluationAnswer[]>([]);
  const [requirementData, setRequirementData] = useState<{
    req: Requirement;
    customReqs: CustomRequirement[];
    scholarshipTiers: ScholarshipTier[];
  } | null>(null);
  const [blockedAtQuestionIndex, setBlockedAtQuestionIndex] = useState<
    number | null
  >(null);
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
    setStep("type");
  }

  function handleSelectType(type: string) {
    setSelectedType(type);
    setStep("university");
  }

  async function handleSelectUniversity(uni: University) {
    setSelectedUniversity(uni);
    setSelectedCountry(uni.country);
    setSelectedType(uni.type);
    await fetchPrograms(uni.id);
    setStep("category");
  }

  function handleSelectCategory(category: string) {
    setSelectedCategory(category);
    setStep("program");
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
        setSelectedType(null);
        setStep("type");
        break;
      case "category":
        setSelectedUniversity(null);
        setSelectedCategory(null);
        setStep("university");
        break;
      case "program":
        setSelectedCategory(null);
        setStep("category");
        break;
      case "questions":
        if (currentQuestionIndex > 0) {
          setCurrentQuestionIndex(currentQuestionIndex - 1);
        } else {
          setSelectedProgram(null);
          setStep("program");
        }
        break;
      case "result":
        if (questions.length > 0) {
          const goBackTo =
            blockedAtQuestionIndex !== null
              ? blockedAtQuestionIndex
              : questions.length - 1;
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

  // Step indicator
  const stepGroup = (() => {
    if (step === "country" || step === "type" || step === "university")
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

      {step === "country" && (
        <CountryStep countries={countries} onSelect={handleSelectCountry} />
      )}
      {step === "type" && (
        <TypeStep types={typesForCountry} onSelect={handleSelectType} />
      )}
      {step === "university" && (
        <UniversityStep
          universities={universitiesForSelection}
          onSelect={handleSelectUniversity}
        />
      )}
      {step === "category" && (
        <CategoryStep
          categories={categoriesForUniversity}
          loading={loading}
          onSelect={handleSelectCategory}
        />
      )}
      {step === "program" && (
        <ProgramStep
          programs={programsForCategory}
          loading={loading}
          onSelect={handleSelectProgram}
        />
      )}
      {step === "questions" && (
        <QuestionWizard
          questions={questions}
          currentIndex={currentQuestionIndex}
          loading={loading}
          onAnswer={handleAnswer}
        />
      )}
      {step === "result" && result && (
        <EvaluationResultView
          result={result}
          breadcrumb={breadcrumbParts.join(" › ")}
          onReset={handleReset}
          onBack={handleBack}
        />
      )}
    </div>
  );
}
