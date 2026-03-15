"use client";

import { useState, useEffect, useCallback } from "react";
import { useTranslations } from "next-intl";
import { createSupabaseBrowserClient } from "@/lib/supabase-browser";
import { useAuth } from "@/lib/auth-context";
import {
  buildQuestionsFromRequirements,
  buildMajorSubjectQuestions,
  evaluateAnswers,
  type EvaluationQuestion,
  type EvaluationAnswer,
  type EvaluationResult,
  type Requirement,
  type CustomRequirement,
  type ScholarshipTier,
  type Major,
  type MajorSubjectRequirement,
} from "@/lib/evaluation-engine";
import {
  CountryStep,
  TypeStep,
  UniversityStep,
  ProgramStep,
  CertificateTypeStep,
} from "./_components/step-selector";
import { QuestionWizard } from "./_components/question-wizard";
import { EvaluationResultView } from "./_components/evaluation-result";

type Step =
  | "country"
  | "type"
  | "university"
  | "program"
  | "certType"
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

interface CertificateTypeOption {
  id: string;
  slug: string;
  name_ar: string;
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
  const [selectedProgram, setSelectedProgram] = useState<Program | null>(null);
  const [selectedCertType, setSelectedCertType] =
    useState<CertificateTypeOption | null>(null);
  const [availableCertTypes, setAvailableCertTypes] = useState<
    CertificateTypeOption[]
  >([]);
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
  const [majors, setMajors] = useState<Major[]>([]);
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

  // Fetch available cert types for a program from its requirements
  const fetchCertTypesForProgram = useCallback(
    async (programId: string) => {
      setLoading(true);
      const { data: progReqs } = await supabase
        .from("requirements")
        .select("certificate_type_id, certificate_types(id, slug, name_ar)")
        .eq("program_id", programId);

      const certTypes: CertificateTypeOption[] = [];
      const seen = new Set<string>();
      for (const r of progReqs || []) {
        if (r.certificate_type_id && r.certificate_types) {
          const ct = r.certificate_types as unknown as CertificateTypeOption;
          if (!seen.has(ct.id)) {
            seen.add(ct.id);
            certTypes.push(ct);
          }
        }
      }
      setAvailableCertTypes(certTypes);
      setLoading(false);
      return certTypes;
    },
    [supabase]
  );

  const fetchAndBuildQuestions = useCallback(
    async (programId: string, certTypeId: string | null) => {
      setLoading(true);

      // Build filter for cert-type-scoped data
      // Load requirements matching: cert_type = selected OR cert_type IS NULL
      let reqQuery = supabase
        .from("requirements")
        .select("*")
        .eq("program_id", programId);
      let customQuery = supabase
        .from("custom_requirements")
        .select("*")
        .eq("program_id", programId)
        .order("sort_order");
      let tierQuery = supabase
        .from("scholarship_tiers")
        .select("*")
        .eq("program_id", programId)
        .order("sort_order");

      if (certTypeId) {
        reqQuery = reqQuery.or(
          `certificate_type_id.eq.${certTypeId},certificate_type_id.is.null`
        );
        customQuery = customQuery.or(
          `certificate_type_id.eq.${certTypeId},certificate_type_id.is.null`
        );
        tierQuery = tierQuery.or(
          `certificate_type_id.eq.${certTypeId},certificate_type_id.is.null`
        );
      }

      const [reqRes, customRes, scholarshipRes, majorsRes] = await Promise.all([
        reqQuery,
        customQuery,
        tierQuery,
        supabase
          .from("majors")
          .select("id, name_ar, name_en, group_code")
          .eq("program_id", programId)
          .eq("is_active", true)
          .order("sort_order"),
      ]);

      // Merge multiple requirement rows into one (if there are both cert-specific and null rows)
      const reqRows = (reqRes.data || []) as Requirement[];
      const req: Requirement = reqRows.length > 0 ? { ...reqRows[0] } : ({} as Requirement);
      // If multiple rows, merge: cert-specific takes precedence, but also include null-cert fields
      if (reqRows.length > 1) {
        for (const row of reqRows) {
          for (const [key, value] of Object.entries(row)) {
            if (value !== null && value !== undefined && value !== false) {
              (req as Record<string, unknown>)[key] = value;
            }
          }
        }
      }

      const customReqs = (customRes.data as CustomRequirement[]) || [];
      const tiers = (scholarshipRes.data as ScholarshipTier[]) || [];
      const fetchedMajors = (majorsRes.data as Major[]) || [];

      setRequirementData({ req, customReqs, scholarshipTiers: tiers });
      setMajors(fetchedMajors);

      const built = buildQuestionsFromRequirements(req, customReqs, tiers, fetchedMajors);
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
    setStep("program");
  }

  async function handleSelectProgram(prog: Program) {
    setSelectedProgram(prog);

    // Check if this program has multiple cert-type-specific requirement rows
    const certTypes = await fetchCertTypesForProgram(prog.id);

    if (certTypes.length > 1) {
      // Multiple cert types → show cert type selection
      setStep("certType");
    } else if (certTypes.length === 1) {
      // Exactly one cert type → auto-select and go to questions
      setSelectedCertType(certTypes[0]);
      setStep("questions");
      fetchAndBuildQuestions(prog.id, certTypes[0].id);
    } else {
      // No cert-specific requirements → universal, go straight to questions
      setSelectedCertType(null);
      setStep("questions");
      fetchAndBuildQuestions(prog.id, null);
    }
  }

  function handleSelectCertType(ct: CertificateTypeOption) {
    setSelectedCertType(ct);
    setStep("questions");
    fetchAndBuildQuestions(selectedProgram!.id, ct.id);
  }

  async function handleAnswer(value: string) {
    const currentQ = questions[currentQuestionIndex];
    let newAnswers = [
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

    // Two-phase: if this is a major select, fetch subject requirements
    let updatedQuestions = questions;
    if (currentQ.sourceField === "major_select") {
      // Remove previously injected subject questions and their answers
      const withoutSubject = questions.filter((q) => !q.id.startsWith("subject_"));
      newAnswers = newAnswers.filter(
        (a) => !a.questionId.startsWith("subject_")
      );
      setAnswers(newAnswers);

      const selectedMajor = majors.find((m) => m.id === value);
      if (selectedMajor) {
        setLoading(true);
        // Filter by cert type: if selectedCertType exists, only fetch subject reqs for that cert type
        let subjectQuery = supabase
          .from("major_subject_requirements")
          .select("*")
          .eq("major_id", selectedMajor.id)
          .order("sort_order");

        if (selectedCertType) {
          subjectQuery = subjectQuery.eq(
            "certificate_type_id",
            selectedCertType.id
          );
        }

        const { data: subjectReqs } = await subjectQuery;
        setLoading(false);

        if (subjectReqs && subjectReqs.length > 0) {
          const subjectQuestions = buildMajorSubjectQuestions(
            subjectReqs as MajorSubjectRequirement[]
          );
          const majorIdx = withoutSubject.findIndex(
            (q) => q.sourceField === "major_select"
          );
          updatedQuestions = [
            ...withoutSubject.slice(0, majorIdx + 1),
            ...subjectQuestions,
            ...withoutSubject.slice(majorIdx + 1),
          ];
        } else {
          updatedQuestions = withoutSubject;
        }
      } else {
        updatedQuestions = withoutSubject;
      }
      setQuestions(updatedQuestions);
    }

    if (currentQuestionIndex < updatedQuestions.length - 1) {
      setCurrentQuestionIndex(currentQuestionIndex + 1);
    } else {
      setBlockedAtQuestionIndex(null);
      const evalResult = evaluateAnswers(
        newAnswers,
        requirementData!.req,
        requirementData!.customReqs,
        requirementData!.scholarshipTiers,
        updatedQuestions
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
      case "program":
        setSelectedUniversity(null);
        setStep("university");
        break;
      case "certType":
        setSelectedCertType(null);
        setSelectedProgram(null);
        setStep("program");
        break;
      case "questions":
        if (currentQuestionIndex > 0) {
          setCurrentQuestionIndex(currentQuestionIndex - 1);
        } else if (availableCertTypes.length > 1) {
          // Go back to cert type selection
          setSelectedCertType(null);
          setStep("certType");
        } else {
          setSelectedProgram(null);
          setSelectedCertType(null);
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
          setSelectedCertType(null);
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
    setSelectedProgram(null);
    setSelectedCertType(null);
    setAvailableCertTypes([]);
    setPrograms([]);
    setQuestions([]);
    setAnswers([]);
    setResult(null);
    setCurrentQuestionIndex(0);
    setBlockedAtQuestionIndex(null);
    setRequirementData(null);
    setMajors([]);
  }

  // Step indicator
  const stepGroup = (() => {
    if (step === "country" || step === "type" || step === "university")
      return 0;
    if (step === "program" || step === "certType") return 1;
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
  if (selectedProgram) breadcrumbParts.push(selectedProgram.name);
  if (selectedCertType) breadcrumbParts.push(selectedCertType.name_ar);

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
      {step === "program" && (
        <ProgramStep
          programs={programs}
          loading={loading}
          onSelect={handleSelectProgram}
        />
      )}
      {step === "certType" && (
        <CertificateTypeStep
          certTypes={availableCertTypes}
          loading={loading}
          onSelect={handleSelectCertType}
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
