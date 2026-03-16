// ============================================================
// Rule-based Evaluation — loads rules from requirement_rules
// and builds questions / evaluates answers for the evaluate page.
// Replaces the old buildQuestionsFromRequirements + evaluateAnswers
// from evaluation-engine.ts (which stays for reference / tests).
// ============================================================

import type { SupabaseClient } from "@supabase/supabase-js";
import type { RequirementRule } from "./types";
import type {
  EvaluationQuestion,
  EvaluationAnswer,
  EvaluationResult,
  EvaluationCondition,
  ScholarshipTier,
  Major,
} from "../evaluation-engine";

// -----------------------------------------------------------
// Load rules from requirement_rules table
// -----------------------------------------------------------

export async function loadProgramRules(
  supabase: SupabaseClient,
  programId: string,
  certificateTypeId: string | null
): Promise<RequirementRule[]> {
  let query = supabase
    .from("requirement_rules")
    .select("*")
    .eq("program_id", programId)
    .eq("is_enabled", true)
    .order("sort_order");

  if (certificateTypeId) {
    query = query.or(
      `certificate_type_id.eq.${certificateTypeId},certificate_type_id.is.null`
    );
  } else {
    query = query.is("certificate_type_id", null);
  }

  const { data } = await query;
  return (data as RequirementRule[]) || [];
}

// -----------------------------------------------------------
// Load distinct cert types from requirement_rules for a program
// -----------------------------------------------------------

export async function loadCertTypesFromRules(
  supabase: SupabaseClient,
  programId: string
): Promise<{ id: string; slug: string; name_ar: string }[]> {
  const { data } = await supabase
    .from("requirement_rules")
    .select("certificate_type_id, certificate_types(id, slug, name_ar)")
    .eq("program_id", programId)
    .eq("is_enabled", true);

  const certTypes: { id: string; slug: string; name_ar: string }[] = [];
  const seen = new Set<string>();
  for (const r of data || []) {
    if (
      r.certificate_type_id &&
      r.certificate_types &&
      !seen.has(r.certificate_type_id)
    ) {
      seen.add(r.certificate_type_id);
      const ct = r.certificate_types as unknown as {
        id: string;
        slug: string;
        name_ar: string;
      };
      certTypes.push(ct);
    }
  }
  return certTypes;
}

// -----------------------------------------------------------
// Helper: extract accepted certs from language_cert config
// Handles both formats:
//   1. { accepted: [{ type, min_score }] }   (admin UI)
//   2. { cert_type, min_score, alternatives } (migration)
// -----------------------------------------------------------

function getAcceptedCerts(
  config: Record<string, unknown>
): Array<{ type: string; min_score: number }> {
  // Format 1: accepted array
  if (Array.isArray(config.accepted) && config.accepted.length > 0) {
    return config.accepted as Array<{ type: string; min_score: number }>;
  }

  // Format 2: cert_type + min_score + alternatives
  const certs: Array<{ type: string; min_score: number }> = [];
  if (config.min_score !== undefined && config.min_score !== null) {
    certs.push({
      type: String(config.cert_type || "IELTS").toUpperCase(),
      min_score: Number(config.min_score),
    });
  }
  if (config.alternatives && typeof config.alternatives === "object") {
    for (const [type, min] of Object.entries(
      config.alternatives as Record<string, number>
    )) {
      certs.push({ type: type.toUpperCase(), min_score: min });
    }
  }
  return certs;
}

// -----------------------------------------------------------
// Build questions from rules
// Same output format as buildQuestionsFromRequirements
// -----------------------------------------------------------

export function buildQuestionsFromRules(
  rules: RequirementRule[],
  scholarshipTiers: ScholarshipTier[],
  majors?: Major[]
): EvaluationQuestion[] {
  const questions: EvaluationQuestion[] = [];
  let qIndex = 0;

  const activeRules = rules
    .filter((r) => r.is_enabled)
    .sort((a, b) => a.sort_order - b.sort_order);

  for (const rule of activeRules) {
    const cfg = rule.config;

    switch (rule.rule_type) {
      case "high_school":
        questions.push({
          id: `rule_${rule.id}`,
          text: "هل لدى الطالب شهادة ثانوية؟",
          type: "yes_no",
          isBlocking: rule.effect === "blocks_admission",
          sourceField: "rule_high_school",
        });
        break;

      case "twelve_years":
        questions.push({
          id: `rule_${rule.id}`,
          text: "هل أكمل الطالب 12 سنة دراسة متواصلة؟",
          type: "yes_no",
          isBlocking: rule.effect === "blocks_admission",
          sourceField: "rule_twelve_years",
        });
        break;

      case "bachelor":
        questions.push({
          id: `rule_${rule.id}`,
          text: "هل لدى الطالب شهادة بكالوريوس؟",
          type: "yes_no",
          isBlocking: rule.effect === "blocks_admission",
          sourceField: "rule_bachelor",
        });
        break;

      case "language_cert": {
        const accepted = getAcceptedCerts(cfg);
        const lcBlocks = rule.effect === "blocks_admission";

        // Q1: Has language cert?
        questions.push({
          id: `rule_${rule.id}_has`,
          text: "هل لدى الطالب شهادة لغة إنجليزية؟",
          type: "yes_no",
          isBlocking: lcBlocks,
          sourceField: "rule_has_language_cert",
        });

        // Q2: Select cert type + score (combined)
        if (accepted.length > 0) {
          const certOptions: { label: string; value: string }[] = [];
          for (const c of accepted) {
            certOptions.push({
              label: `${c.type} - ${c.min_score} أو أعلى`,
              value: `${c.type}|meets`,
            });
            certOptions.push({
              label: `${c.type} - أقل من ${c.min_score}`,
              value: `${c.type}|below`,
            });
          }
          questions.push({
            id: `rule_${rule.id}_select`,
            text: "اختر نوع الشهادة والدرجة",
            type: "select",
            options: certOptions,
            sourceField: "rule_language_cert_type_score",
          });
        }
        break;
      }

      case "sat":
        questions.push({
          id: `rule_${rule.id}`,
          text: `هل لدى الطالب SAT بدرجة ${cfg.min_score} أو أعلى؟`,
          type: "yes_no",
          isBlocking: false,
          sourceField: "rule_sat",
        });
        break;

      case "gpa":
        if (scholarshipTiers.length > 0) {
          const sorted = [...scholarshipTiers].sort(
            (a, b) => a.sort_order - b.sort_order
          );
          questions.push({
            id: `rule_${rule.id}`,
            text: "ما هو معدل الطالب في الثانوية؟",
            type: "select",
            options: sorted.map((tier) => ({
              label: `${tier.min_gpa}% - ${tier.max_gpa}%${tier.label ? ` (${tier.label})` : ""}`,
              value: `${tier.min_gpa}-${tier.max_gpa}`,
            })),
            sourceField: "rule_gpa",
          });
        }
        break;

      case "entrance_exam":
        questions.push({
          id: `rule_${rule.id}`,
          text: "هل الطالب مستعد لدخول امتحان القبول؟",
          type: "yes_no",
          isBlocking: false,
          sourceField: "rule_entrance_exam",
        });
        break;

      case "portfolio":
        questions.push({
          id: `rule_${rule.id}`,
          text: "هل لدى الطالب بورتفوليو جاهز؟",
          type: "yes_no",
          isBlocking: false,
          sourceField: "rule_portfolio",
        });
        break;

      case "research_plan":
        questions.push({
          id: `rule_${rule.id}`,
          text: "هل لدى الطالب خطة بحث جاهزة؟",
          type: "yes_no",
          isBlocking: false,
          sourceField: "rule_research_plan",
        });
        break;

      case "a_levels": {
        const minSubjects = (cfg.subjects_min as number) || 3;
        questions.push({
          id: `rule_${rule.id}_count`,
          text: `هل لدى الطالب ${minSubjects} مواد A Level؟`,
          type: "yes_no",
          isBlocking: true,
          sourceField: "rule_a_levels_count",
        });
        if (cfg.min_grade) {
          questions.push({
            id: `rule_${rule.id}_grade`,
            text: `هل جميع المواد الثلاثة بدرجة ${cfg.min_grade} أو أعلى؟`,
            type: "yes_no",
            isBlocking: rule.effect === "blocks_admission",
            sourceField: "rule_a_levels_grade",
          });
        }
        if (cfg.requires_core) {
          questions.push({
            id: `rule_${rule.id}_core`,
            text: "هل لدى الطالب مادتان من المواد الأساسية المعترف بها؟",
            type: "yes_no",
            isBlocking: true,
            sourceField: "rule_a_levels_core",
          });
        }
        break;
      }

      case "as_levels": {
        const asMin = (cfg.subjects_min as number) || 3;
        questions.push({
          id: `rule_${rule.id}_count`,
          text: `هل لدى الطالب ${asMin} مواد AS Level؟`,
          type: "yes_no",
          isBlocking: true,
          sourceField: "rule_as_levels_count",
        });
        if (cfg.min_grade) {
          questions.push({
            id: `rule_${rule.id}_grade`,
            text: `هل جميع مواد AS Level بدرجة ${cfg.min_grade} أو أعلى؟`,
            type: "yes_no",
            isBlocking: rule.effect === "blocks_admission",
            sourceField: "rule_as_levels_grade",
          });
        }
        break;
      }

      case "o_levels": {
        const oMin = (cfg.subjects_min as number) || 5;
        questions.push({
          id: `rule_${rule.id}_count`,
          text: `هل لدى الطالب ${oMin} مواد O Level / GCSE؟`,
          type: "yes_no",
          isBlocking: true,
          sourceField: "rule_o_levels_count",
        });
        if (cfg.min_grade) {
          questions.push({
            id: `rule_${rule.id}_grade`,
            text: `هل جميع مواد O Level / GCSE بدرجة ${cfg.min_grade} أو أعلى؟`,
            type: "yes_no",
            isBlocking: rule.effect === "blocks_admission",
            sourceField: "rule_o_levels_grade",
          });
        }
        break;
      }

      case "ib":
        questions.push({
          id: `rule_${rule.id}`,
          text: `هل لدى الطالب ${cfg.min_points} نقطة IB أو أعلى؟`,
          type: "yes_no",
          isBlocking: rule.effect === "blocks_admission",
          sourceField: "rule_ib",
        });
        break;

      case "custom_yes_no":
        questions.push({
          id: `rule_${rule.id}`,
          text: (cfg.question_text as string) || "",
          type: "yes_no",
          isBlocking: rule.effect === "blocks_admission",
          customEffect:
            rule.effect === "blocks_admission"
              ? "blocks_admission"
              : "makes_conditional",
          negativeMessage:
            (cfg.negative_message as string) ||
            rule.effect_message ||
            undefined,
          positiveMessage: (cfg.positive_message as string) || undefined,
        });
        break;

      case "custom_select": {
        const opts = (cfg.options as string[]) || [];
        const optEffects =
          (cfg.option_effects as Record<
            string,
            { effect: string; message: string | null }
          >) || null;
        questions.push({
          id: `rule_${rule.id}`,
          text: (cfg.question_text as string) || "",
          type: "select",
          options: opts.map((opt) => ({ label: opt, value: opt })),
          customEffect:
            rule.effect === "blocks_admission"
              ? "blocks_admission"
              : "makes_conditional",
          negativeMessage:
            (cfg.negative_message as string) ||
            rule.effect_message ||
            undefined,
          positiveMessage: (cfg.positive_message as string) || undefined,
          optionEffects: optEffects || undefined,
        });
        break;
      }
    }
  }

  // Major select (majors still loaded from old table)
  if (majors && majors.length > 0) {
    questions.push({
      id: `q_major_${qIndex++}`,
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
// Build a rule lookup from question IDs
// -----------------------------------------------------------

function buildRuleMap(rules: RequirementRule[]): Map<string, RequirementRule> {
  const map = new Map<string, RequirementRule>();
  for (const r of rules) {
    map.set(r.id, r);
  }
  return map;
}

function extractRuleId(questionId: string): string | null {
  // Question IDs are "rule_{ruleId}" or "rule_{ruleId}_{suffix}"
  if (!questionId.startsWith("rule_")) return null;
  const withoutPrefix = questionId.slice(5); // remove "rule_"
  // UUID is 36 chars. Extract the first 36.
  if (withoutPrefix.length >= 36) {
    return withoutPrefix.slice(0, 36);
  }
  return withoutPrefix;
}

// -----------------------------------------------------------
// Evaluate answers from question wizard against rules
// Returns same format as old evaluateAnswers()
// -----------------------------------------------------------

export function evaluateRuleAnswers(
  answers: EvaluationAnswer[],
  rules: RequirementRule[],
  questions: EvaluationQuestion[],
  scholarshipTiers: ScholarshipTier[]
): EvaluationResult {
  const answerMap = new Map<string, string>();
  for (const a of answers) {
    answerMap.set(a.questionId, a.value);
  }

  const ruleMap = buildRuleMap(rules);
  const negatives: string[] = [];
  const conditions: EvaluationCondition[] = [];
  const notes: string[] = [];
  let scholarshipInfo: string | undefined;

  for (const q of questions) {
    const answer = answerMap.get(q.id);
    if (!answer) continue;

    const ruleId = extractRuleId(q.id);
    const rule = ruleId ? ruleMap.get(ruleId) : null;

    // --- Rule-sourced questions ---
    if (q.sourceField?.startsWith("rule_")) {
      const sf = q.sourceField;

      // Simple yes/no blocking rules
      if (
        sf === "rule_high_school" ||
        sf === "rule_twelve_years" ||
        sf === "rule_bachelor"
      ) {
        if (answer === "no" && rule) {
          const defaultMessages: Record<string, string> = {
            rule_high_school: "الطالب لا يملك شهادة ثانوية",
            rule_twelve_years: "الطالب لم يكمل 12 سنة دراسة متواصلة",
            rule_bachelor: "الطالب لا يملك شهادة بكالوريوس",
          };
          if (rule.effect === "blocks_admission") {
            negatives.push(
              rule.effect_message || defaultMessages[sf] || ""
            );
          } else {
            conditions.push({
              category: "شرط أساسي",
              description:
                rule.effect_message || defaultMessages[sf] || "",
            });
          }
        }
        continue;
      }

      // Language cert: has cert?
      if (sf === "rule_has_language_cert") {
        if (answer === "no" && rule) {
          if (rule.effect === "blocks_admission") {
            negatives.push(
              rule.effect_message || "يحتاج شهادة لغة إنجليزية"
            );
          } else if (rule.effect_message?.includes("مقابلة")) {
            conditions.push({
              category: "شهادة لغة",
              description:
                rule.effect_message ||
                "سيتم ترتيب مقابلة لتقييم اللغة",
            });
          } else {
            conditions.push({
              category: "شهادة لغة",
              description:
                rule.effect_message || "يحتاج شهادة لغة إنجليزية",
            });
          }
        }
        continue;
      }

      // Language cert: type + score select
      if (sf === "rule_language_cert_type_score") {
        const meetsMin = answer.endsWith("|meets");
        if (!meetsMin && rule) {
          if (rule.effect === "blocks_admission") {
            negatives.push(
              rule.effect_message ||
                "الدرجة أقل من الحد الأدنى المطلوب"
            );
          } else if (rule.effect_message?.includes("مقابلة")) {
            conditions.push({
              category: "شهادة لغة",
              description:
                rule.effect_message ||
                "سيتم ترتيب مقابلة لتقييم اللغة",
            });
          } else {
            conditions.push({
              category: "شهادة لغة",
              description:
                rule.effect_message ||
                "الدرجة أقل من الحد الأدنى المطلوب",
            });
          }
        }
        continue;
      }

      // SAT
      if (sf === "rule_sat") {
        if (answer === "no" && rule) {
          const defaultMsg = `يحتاج SAT بدرجة ${rule.config.min_score} أو أعلى`;
          if (rule.effect === "blocks_admission") {
            negatives.push(rule.effect_message || defaultMsg);
          } else {
            conditions.push({
              category: "SAT",
              description: rule.effect_message || defaultMsg,
            });
          }
        }
        continue;
      }

      // GPA + scholarship tiers
      if (sf === "rule_gpa") {
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
        continue;
      }

      // Entrance exam
      if (sf === "rule_entrance_exam") {
        if (answer === "no" && rule) {
          conditions.push({
            category: "امتحان قبول",
            description:
              rule.effect_message || "يحتاج الاستعداد لامتحان القبول",
          });
        }
        continue;
      }

      // Portfolio
      if (sf === "rule_portfolio") {
        if (answer === "no" && rule) {
          conditions.push({
            category: "بورتفوليو",
            description: rule.effect_message || "يحتاج تجهيز بورتفوليو",
          });
        }
        continue;
      }

      // Research plan
      if (sf === "rule_research_plan") {
        if (answer === "no" && rule) {
          if (rule.effect === "blocks_admission") {
            negatives.push(
              rule.effect_message || "يحتاج تجهيز خطة بحث"
            );
          } else {
            conditions.push({
              category: "خطة بحث",
              description:
                rule.effect_message || "يحتاج تجهيز خطة بحث",
            });
          }
        }
        continue;
      }

      // A Levels
      if (sf === "rule_a_levels_count") {
        if (answer === "no" && rule) {
          const minSubjects = (rule.config.subjects_min as number) || 3;
          negatives.push(
            rule.effect_message ||
              `غير مؤهل — يحتاج ${minSubjects} مواد A Level`
          );
        }
        continue;
      }
      if (sf === "rule_a_levels_grade") {
        if (answer === "no" && rule) {
          if (rule.effect === "blocks_admission") {
            negatives.push(
              rule.effect_message ||
                `درجات أقل من ${rule.config.min_grade}`
            );
          } else {
            conditions.push({
              category: "A Level",
              description:
                rule.effect_message ||
                `درجات أقل من ${rule.config.min_grade}`,
            });
          }
        }
        continue;
      }
      if (sf === "rule_a_levels_core") {
        if (answer === "no") {
          negatives.push("لا يستوفي شرط المواد الأساسية");
        }
        continue;
      }

      // AS Levels
      if (sf === "rule_as_levels_count") {
        if (answer === "no" && rule) {
          const asMin = (rule.config.subjects_min as number) || 3;
          negatives.push(
            rule.effect_message ||
              `غير مؤهل — يحتاج ${asMin} مواد AS Level`
          );
        }
        continue;
      }
      if (sf === "rule_as_levels_grade") {
        if (answer === "no" && rule) {
          if (rule.effect === "blocks_admission") {
            negatives.push(
              rule.effect_message ||
                `درجات AS Level أقل من ${rule.config.min_grade}`
            );
          } else {
            conditions.push({
              category: "AS Level",
              description:
                rule.effect_message ||
                `درجات AS Level أقل من ${rule.config.min_grade}`,
            });
          }
        }
        continue;
      }

      // O Levels
      if (sf === "rule_o_levels_count") {
        if (answer === "no" && rule) {
          const oMin = (rule.config.subjects_min as number) || 5;
          negatives.push(
            rule.effect_message ||
              `غير مؤهل — يحتاج ${oMin} مواد O Level / GCSE`
          );
        }
        continue;
      }
      if (sf === "rule_o_levels_grade") {
        if (answer === "no" && rule) {
          if (rule.effect === "blocks_admission") {
            negatives.push(
              rule.effect_message ||
                `درجات O Level / GCSE أقل من ${rule.config.min_grade}`
            );
          } else {
            conditions.push({
              category: "O Level / GCSE",
              description:
                rule.effect_message ||
                `درجات O Level / GCSE أقل من ${rule.config.min_grade}`,
            });
          }
        }
        continue;
      }

      // IB
      if (sf === "rule_ib") {
        if (answer === "no" && rule) {
          if (rule.effect === "blocks_admission") {
            negatives.push(
              rule.effect_message ||
                `يحتاج ${rule.config.min_points} نقطة IB أو أعلى`
            );
          } else {
            conditions.push({
              category: "IB",
              description:
                rule.effect_message ||
                `يحتاج ${rule.config.min_points} نقطة IB أو أعلى`,
            });
          }
        }
        continue;
      }

      // Major select — no evaluation logic (UI routing)
      if (sf === "major_select") {
        continue;
      }
    }

    // --- Custom requirement questions (from rules) ---
    if (q.customEffect) {
      // Select with per-option effects
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
          // "none" = no effect
        }
        continue;
      }

      if (q.customEffect === "blocks_admission") {
        if (answer === "no" && q.negativeMessage) {
          negatives.push(q.negativeMessage);
        }
      } else if (q.customEffect === "makes_conditional") {
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
