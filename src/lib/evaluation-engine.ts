// ============================================================
// Evaluation Engine — data-driven evaluation of student eligibility
// All questions are generated from requirements + custom_requirements
// ============================================================

export interface EvaluationQuestion {
  id: string;
  text: string;
  type: "yes_no" | "select";
  options?: { label: string; value: string }[];
  /** If true, a "no" answer immediately produces a negative result */
  isBlocking?: boolean;
  /** The field this question checks (e.g. "requires_hs") */
  sourceField?: string;
  /** For custom_requirements — the effect and messages */
  customEffect?: "blocks_admission" | "makes_conditional";
  negativeMessage?: string;
  positiveMessage?: string;
  /** Per-option effects for select questions */
  optionEffects?: Record<string, { effect: string; message: string | null }>;
}

export interface EvaluationAnswer {
  questionId: string;
  value: string;
}

export interface EvaluationCondition {
  category: string;
  description: string;
}

export interface EvaluationResult {
  status: "positive" | "conditional" | "negative";
  title: string;
  message: string;
  notes: string[];
  conditions: EvaluationCondition[];
  scholarshipInfo?: string;
}

export interface Requirement {
  requires_hs?: boolean;
  requires_12_years?: boolean;
  requires_bachelor?: boolean;
  requires_ielts?: boolean;
  ielts_min?: number;
  ielts_effect?: string;
  requires_sat?: boolean;
  sat_min?: number;
  sat_effect?: string;
  requires_gpa?: boolean;
  gpa_min?: number;
  gpa_effect?: string;
  requires_entrance_exam?: boolean;
  requires_portfolio?: boolean;
  requires_audition?: boolean;
  requires_work_experience?: boolean;
  requires_research_plan?: boolean;
  ielts_alternatives?: Record<string, number> | null;
  result_notes?: string;
  // A Level fields (British certificates)
  requires_a_levels?: boolean;
  a_level_subjects_min?: number;
  a_level_min_grade?: string;
  a_level_requires_core?: boolean;
  a_level_effect?: string;
  // IB fields (International Baccalaureate)
  requires_ib?: boolean;
  ib_min_points?: number;
  ib_effect?: string;
}

export interface CustomRequirement {
  id: string;
  question_text: string;
  question_type: "yes_no" | "select";
  options?: string[] | null;
  effect: "blocks_admission" | "makes_conditional";
  negative_message?: string;
  positive_message?: string;
  sort_order: number;
  option_effects?: Record<string, { effect: string; message: string | null }> | null;
  // Dynamic comparison fields
  show_in_comparison?: boolean;
  comparison_input_type?: "toggle" | "number" | "select" | null;
  comparison_key?: string | null;
}

export interface ScholarshipTier {
  id: string;
  min_gpa: number;
  max_gpa: number;
  scholarship_percent: number;
  label?: string;
  sort_order: number;
}

export interface Major {
  id: string;
  name_ar: string;
  name_en?: string;
  group_code: string;
}

export interface MajorSubjectRequirement {
  id: string;
  major_id: string;
  certificate_type_id: string;
  question_text: string;
  question_type: "yes_no" | "select";
  options?: string[] | null;
  effect: "blocks_admission" | "makes_conditional";
  negative_message?: string;
  positive_message?: string;
  sort_order: number;
}

// -----------------------------------------------------------
// Build IELTS alternatives text
// -----------------------------------------------------------
function buildIeltsAlternativesText(
  alternatives: Record<string, number> | null | undefined
): string {
  if (!alternatives) return "";
  const parts: string[] = [];
  if (alternatives.duolingo)
    parts.push(`دولينجو ${alternatives.duolingo}+`);
  if (alternatives.toefl) parts.push(`TOEFL ${alternatives.toefl}+`);
  if (alternatives.pte) parts.push(`PTE ${alternatives.pte}+`);
  return parts.length ? ` (أو ${parts.join(" أو ")})` : "";
}

// -----------------------------------------------------------
// Build questions from requirements
// -----------------------------------------------------------
export function buildQuestionsFromRequirements(
  req: Requirement,
  customReqs: CustomRequirement[],
  scholarshipTiers: ScholarshipTier[],
  majors?: Major[]
): EvaluationQuestion[] {
  const questions: EvaluationQuestion[] = [];
  let qIndex = 0;

  // 1. High school
  if (req.requires_hs) {
    questions.push({
      id: `q_${qIndex++}`,
      text: "هل لدى الطالب شهادة ثانوية؟",
      type: "yes_no",
      isBlocking: true,
      sourceField: "requires_hs",
    });
  }

  // 2. 12 years
  if (req.requires_12_years) {
    questions.push({
      id: `q_${qIndex++}`,
      text: "هل أكمل الطالب 12 سنة دراسة متواصلة؟",
      type: "yes_no",
      isBlocking: true,
      sourceField: "requires_12_years",
    });
  }

  // 3. Bachelor
  if (req.requires_bachelor) {
    questions.push({
      id: `q_${qIndex++}`,
      text: "هل لدى الطالب شهادة بكالوريوس؟",
      type: "yes_no",
      isBlocking: true,
      sourceField: "requires_bachelor",
    });
  }

  // 4. IELTS
  if (req.requires_ielts) {
    const altText = buildIeltsAlternativesText(req.ielts_alternatives);
    questions.push({
      id: `q_${qIndex++}`,
      text: `هل لدى الطالب شهادة IELTS بدرجة ${req.ielts_min} أو أعلى؟${altText}`,
      type: "yes_no",
      isBlocking: req.ielts_effect === "blocks_if_below",
      sourceField: "requires_ielts",
    });
  }

  // 5. SAT
  if (req.requires_sat) {
    questions.push({
      id: `q_${qIndex++}`,
      text: `هل لدى الطالب SAT بدرجة ${req.sat_min} أو أعلى؟`,
      type: "yes_no",
      isBlocking: false,
      sourceField: "requires_sat",
    });
  }

  // 6. GPA + scholarship tiers
  if (req.requires_gpa && scholarshipTiers.length > 0) {
    const sorted = [...scholarshipTiers].sort(
      (a, b) => a.sort_order - b.sort_order
    );
    const options = sorted.map((tier) => ({
      label: `${tier.min_gpa}% - ${tier.max_gpa}%${tier.label ? ` (${tier.label})` : ""}`,
      value: `${tier.min_gpa}-${tier.max_gpa}`,
    }));
    questions.push({
      id: `q_${qIndex++}`,
      text: "ما هو معدل الطالب في الثانوية؟",
      type: "select",
      options,
      sourceField: "requires_gpa",
    });
  }

  // 7. Entrance exam
  if (req.requires_entrance_exam) {
    questions.push({
      id: `q_${qIndex++}`,
      text: "هل الطالب مستعد لدخول امتحان القبول؟",
      type: "yes_no",
      isBlocking: false,
      sourceField: "requires_entrance_exam",
    });
  }

  // 8. Portfolio
  if (req.requires_portfolio) {
    questions.push({
      id: `q_${qIndex++}`,
      text: "هل لدى الطالب بورتفوليو جاهز؟",
      type: "yes_no",
      isBlocking: false,
      sourceField: "requires_portfolio",
    });
  }

  // 9. Research plan
  if (req.requires_research_plan) {
    questions.push({
      id: `q_${qIndex++}`,
      text: "هل لدى الطالب خطة بحث جاهزة؟",
      type: "yes_no",
      isBlocking: false,
      sourceField: "requires_research_plan",
    });
  }

  // 10. A Level requirements (British certificates)
  if (req.requires_a_levels) {
    const minSubjects = req.a_level_subjects_min || 3;
    questions.push({
      id: `q_${qIndex++}`,
      text: `هل لدى الطالب ${minSubjects} مواد A Level؟`,
      type: "yes_no",
      isBlocking: true,
      sourceField: "requires_a_levels_count",
    });

    if (req.a_level_min_grade) {
      questions.push({
        id: `q_${qIndex++}`,
        text: `هل جميع المواد الثلاثة بدرجة ${req.a_level_min_grade} أو أعلى؟`,
        type: "yes_no",
        isBlocking: req.a_level_effect === "blocks_admission",
        sourceField: "requires_a_levels_grade",
      });
    }

    if (req.a_level_requires_core) {
      questions.push({
        id: `q_${qIndex++}`,
        text: "هل لدى الطالب مادتان من المواد الأساسية المعترف بها؟",
        type: "yes_no",
        isBlocking: true,
        sourceField: "requires_a_levels_core",
      });
    }
  }

  // 11. IB requirements (International Baccalaureate)
  if (req.requires_ib) {
    questions.push({
      id: `q_${qIndex++}`,
      text: `هل لدى الطالب ${req.ib_min_points} نقطة IB أو أعلى؟`,
      type: "yes_no",
      isBlocking: req.ib_effect === "blocks_admission",
      sourceField: "requires_ib",
    });
  }

  // 12. Custom requirements (sorted by sort_order) — before major select
  const sortedCustom = [...customReqs].sort(
    (a, b) => a.sort_order - b.sort_order
  );
  for (const cr of sortedCustom) {
    const q: EvaluationQuestion = {
      id: `custom_${cr.id}`,
      text: cr.question_text,
      type: cr.question_type,
      customEffect: cr.effect,
      negativeMessage: cr.negative_message || undefined,
      positiveMessage: cr.positive_message || undefined,
      isBlocking: cr.effect === "blocks_admission",
    };
    if (cr.question_type === "select" && cr.options) {
      q.options = (cr.options as string[]).map((opt) => ({
        label: opt,
        value: opt,
      }));
    }
    if (cr.option_effects) {
      q.optionEffects = cr.option_effects as Record<string, { effect: string; message: string | null }>;
    }
    questions.push(q);
  }

  // 13. Major select (if program has majors)
  if (majors && majors.length > 0) {
    questions.push({
      id: `q_${qIndex++}`,
      text: "اختر التخصص",
      type: "select",
      sourceField: "major_select",
      options: majors.map((m) => ({
        label: m.name_ar,
        value: m.id,
      })),
    });
  }

  return questions;
}

// -----------------------------------------------------------
// Build subject requirement questions for a selected major
// -----------------------------------------------------------
export function buildMajorSubjectQuestions(
  subjectReqs: MajorSubjectRequirement[]
): EvaluationQuestion[] {
  const questions: EvaluationQuestion[] = [];
  const sorted = [...subjectReqs].sort((a, b) => a.sort_order - b.sort_order);

  for (const sr of sorted) {
    const q: EvaluationQuestion = {
      id: `subject_${sr.id}`,
      text: sr.question_text,
      type: sr.question_type,
      customEffect: sr.effect,
      negativeMessage: sr.negative_message || undefined,
      positiveMessage: sr.positive_message || undefined,
      isBlocking: sr.effect === "blocks_admission",
    };
    if (sr.question_type === "select" && sr.options) {
      q.options = (sr.options as string[]).map((opt) => ({
        label: opt,
        value: opt,
      }));
    }
    questions.push(q);
  }

  return questions;
}

// -----------------------------------------------------------
// Evaluate answers and produce a result
// -----------------------------------------------------------
export function evaluateAnswers(
  answers: EvaluationAnswer[],
  req: Requirement,
  customReqs: CustomRequirement[],
  scholarshipTiers: ScholarshipTier[],
  questions: EvaluationQuestion[]
): EvaluationResult {
  const answerMap = new Map<string, string>();
  for (const a of answers) {
    answerMap.set(a.questionId, a.value);
  }

  const negatives: string[] = [];
  const conditions: EvaluationCondition[] = [];
  const notes: string[] = [];
  let scholarshipInfo: string | undefined;

  for (const q of questions) {
    const answer = answerMap.get(q.id);
    if (!answer) continue;

    // --- Standard requirement questions ---
    if (q.sourceField) {
      switch (q.sourceField) {
        case "requires_hs":
          if (answer === "no")
            negatives.push("الطالب لا يملك شهادة ثانوية");
          break;

        case "requires_12_years":
          if (answer === "no")
            negatives.push("الطالب لم يكمل 12 سنة دراسة متواصلة");
          break;

        case "requires_bachelor":
          if (answer === "no")
            negatives.push("الطالب لا يملك شهادة بكالوريوس");
          break;

        case "requires_ielts":
          if (answer === "no") {
            const effect = req.ielts_effect || "";
            if (effect === "blocks_if_below") {
              negatives.push(
                `يحتاج IELTS بدرجة ${req.ielts_min} أو أعلى`
              );
            } else if (effect.startsWith("interview")) {
              conditions.push({
                category: "IELTS",
                description:
                  effect.split(": ")[1] ||
                  "سيتم ترتيب مقابلة لتقييم اللغة",
              });
            } else if (effect.startsWith("conditional")) {
              conditions.push({
                category: "IELTS",
                description: effect.split(": ")[1] || effect,
              });
            } else {
              conditions.push({
                category: "IELTS",
                description: `يحتاج IELTS بدرجة ${req.ielts_min} أو أعلى`,
              });
            }
          }
          break;

        case "requires_sat":
          if (answer === "no") {
            const satEffect = req.sat_effect || "";
            if (satEffect === "blocks_if_below") {
              negatives.push(
                `يحتاج SAT بدرجة ${req.sat_min} أو أعلى`
              );
            } else if (satEffect.startsWith("conditional")) {
              conditions.push({
                category: "SAT",
                description: satEffect.split(": ")[1] || satEffect,
              });
            } else {
              conditions.push({
                category: "SAT",
                description: `يحتاج تقديم SAT بدرجة ${req.sat_min}+`,
              });
            }
          }
          break;

        case "requires_gpa":
          // Match answer to scholarship tiers
          if (scholarshipTiers.length > 0) {
            const [minStr] = answer.split("-");
            const selectedMin = parseFloat(minStr);
            const tier = scholarshipTiers.find(
              (t) => selectedMin >= t.min_gpa && selectedMin <= t.max_gpa
            );
            if (tier) {
              scholarshipInfo = tier.label
                ? `منحة: ${tier.label} (${tier.scholarship_percent}%)`
                : `منحة: ${tier.scholarship_percent}%`;
            }
          }
          break;

        case "requires_entrance_exam":
          if (answer === "no") {
            conditions.push({
              category: "امتحان قبول",
              description: "يحتاج الاستعداد لامتحان القبول",
            });
          }
          break;

        case "requires_portfolio":
          if (answer === "no") {
            conditions.push({
              category: "بورتفوليو",
              description: "يحتاج تجهيز بورتفوليو",
            });
          }
          break;

        case "requires_research_plan":
          if (answer === "no") {
            conditions.push({
              category: "خطة بحث",
              description: "يحتاج تجهيز خطة بحث",
            });
          }
          break;

        case "requires_a_levels_count":
          if (answer === "no") {
            const minSubjects = req.a_level_subjects_min || 3;
            negatives.push(
              `غير مؤهل — يحتاج ${minSubjects} مواد A Level`
            );
          }
          break;

        case "requires_a_levels_grade":
          if (answer === "no") {
            const effect = req.a_level_effect || "blocks_admission";
            if (effect === "blocks_admission") {
              negatives.push(
                `درجات أقل من ${req.a_level_min_grade}`
              );
            } else {
              conditions.push({
                category: "A Level",
                description: `درجات أقل من ${req.a_level_min_grade}`,
              });
            }
          }
          break;

        case "requires_a_levels_core":
          if (answer === "no") {
            negatives.push("لا يستوفي شرط المواد الأساسية");
          }
          break;

        case "requires_ib":
          if (answer === "no") {
            const ibEffect = req.ib_effect || "blocks_admission";
            if (ibEffect === "blocks_admission") {
              negatives.push(
                `يحتاج ${req.ib_min_points} نقطة IB أو أعلى`
              );
            } else {
              conditions.push({
                category: "IB",
                description: `يحتاج ${req.ib_min_points} نقطة IB أو أعلى`,
              });
            }
          }
          break;

        case "major_select":
          // Major selection — no evaluation logic, used for UI routing
          break;
      }
      continue;
    }

    // --- Custom requirement questions ---
    if (q.customEffect) {
      // For select questions with per-option effects, use the specific option's effect
      if (q.type === "select" && q.optionEffects) {
        const selectedEffect = q.optionEffects[answer];
        if (selectedEffect) {
          if (selectedEffect.effect === "blocks_admission") {
            if (selectedEffect.message) negatives.push(selectedEffect.message);
          } else if (selectedEffect.effect === "makes_conditional") {
            if (selectedEffect.message) {
              conditions.push({
                category: "شرط إضافي",
                description: selectedEffect.message,
              });
            }
          }
          // "none" = no effect, skip
        }
        continue; // Skip the default effect handling
      }

      if (q.customEffect === "blocks_admission") {
        if (answer === "no" && q.negativeMessage) {
          negatives.push(q.negativeMessage);
        }
      } else if (q.customEffect === "makes_conditional") {
        // For yes_no: "yes" triggers the conditional message
        // For select: any selection triggers it
        if (
          (q.type === "yes_no" && answer === "yes" && q.positiveMessage) ||
          (q.type === "select" && q.positiveMessage)
        ) {
          conditions.push({
            category: "شرط إضافي",
            description: q.positiveMessage!,
          });
        }
      }
    }
  }

  // Always include result_notes
  if (req.result_notes) {
    notes.push(req.result_notes);
  }

  // Build final result
  if (negatives.length > 0) {
    return {
      status: "negative",
      title: "غير مؤهل",
      message: negatives[0],
      notes,
      conditions: [],
    };
  }

  if (conditions.length > 0) {
    return {
      status: "conditional",
      title: "مؤهل مشروط",
      message: "الطالب مؤهل بشروط — يرجى مراجعة التفاصيل أدناه",
      notes,
      conditions,
      scholarshipInfo,
    };
  }

  return {
    status: "positive",
    title: "مؤهل",
    message: "الطالب مؤهل للقبول في هذا البرنامج",
    notes,
    conditions: [],
    scholarshipInfo,
  };
}
