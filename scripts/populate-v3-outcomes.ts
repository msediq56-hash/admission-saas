#!/usr/bin/env npx tsx
// ============================================================
// Populate V3 Outcomes — reads requirement_rules with empty outcomes
// and builds proper outcome maps based on rule_type + effect + effect_message.
//
// SAFE to re-run: only updates rules where outcomes = '{}'.
//
// Usage: npx tsx scripts/populate-v3-outcomes.ts
// ============================================================

import { createClient } from "@supabase/supabase-js";
import { config } from "dotenv";

config({ path: ".env.local" });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error("❌ Missing env vars: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// -----------------------------------------------------------
// Effect mapping
// -----------------------------------------------------------

function effectToDecision(effect: string): "block" | "conditional" | "pass" {
  switch (effect) {
    case "blocks_admission":
      return "block";
    case "makes_conditional":
      return "conditional";
    case "scholarship":
    case "none":
    case "info_only":
      return "pass";
    default:
      return "block"; // conservative default
  }
}

interface OutcomeDef {
  decision: string;
  message?: string;
  condition_code?: string;
  redirect?: { category: string; scope: string };
  deadline?: string;
}

// Helper: build outcome with conditional condition_code
function makeOutcome(
  decision: "block" | "conditional" | "pass" | "review",
  message: string,
  conditionCode?: string
): OutcomeDef {
  const out: OutcomeDef = { decision, message };
  // condition_code ONLY for conditional decisions
  if (decision === "conditional" && conditionCode) {
    out.condition_code = conditionCode;
  }
  return out;
}

// -----------------------------------------------------------
// Outcome builders by rule type
// -----------------------------------------------------------

function buildOutcomes(
  ruleType: string,
  effect: string,
  effectMessage: string | null,
  ruleConfig: Record<string, unknown>
): Record<string, OutcomeDef> | null {
  const decision = effectToDecision(effect);

  switch (ruleType) {
    case "high_school":
      return {
        pass: { decision: "pass" },
        not_available: makeOutcome(
          decision,
          effectMessage || "لا يملك شهادة ثانوية",
          "high_school_required"
        ),
        unknown: { decision: "review", message: "يحتاج مراجعة — معلومات الثانوية غير متوفرة" },
      };

    case "twelve_years":
      return {
        pass: { decision: "pass" },
        not_available: makeOutcome(
          decision,
          effectMessage || "لم يكمل 12 سنة دراسة",
          "twelve_years_required"
        ),
        unknown: { decision: "review", message: "يحتاج مراجعة — معلومات سنوات الدراسة غير متوفرة" },
      };

    case "bachelor":
      return {
        pass: { decision: "pass" },
        not_available: makeOutcome(
          decision,
          effectMessage || "لا يملك شهادة بكالوريوس",
          "bachelor_required"
        ),
        unknown: { decision: "review", message: "يحتاج مراجعة — معلومات البكالوريوس غير متوفرة" },
      };

    case "language_cert":
      return {
        pass: { decision: "pass" },
        not_available: makeOutcome(
          decision,
          effectMessage || "لا يملك شهادة لغة",
          "language_cert_required"
        ),
        score_below: makeOutcome(
          decision,
          effectMessage || "درجة شهادة اللغة أقل من المطلوب"
        ),
        wrong_type: makeOutcome(
          decision,
          "نوع شهادة اللغة غير مقبول"
        ),
        unknown: { decision: "review", message: "يحتاج مراجعة — معلومات شهادة اللغة غير متوفرة" },
      };

    case "sat":
      return {
        pass: { decision: "pass" },
        not_available: makeOutcome(
          decision,
          effectMessage || "لا يملك SAT",
          "sat_required"
        ),
        score_below: makeOutcome(
          decision,
          effectMessage || "درجة SAT أقل من المطلوب"
        ),
        unknown: { decision: "review", message: "يحتاج مراجعة — معلومات SAT غير متوفرة" },
      };

    case "gpa":
      return {
        pass: { decision: "pass" },
        not_available: { decision: "review", message: "لم يُحدد المعدل" },
        below_minimum: makeOutcome(
          decision,
          effectMessage || "المعدل أقل من الحد الأدنى"
        ),
        unknown: { decision: "review", message: "يحتاج مراجعة — المعدل غير متوفر" },
      };

    case "entrance_exam":
      return {
        required: makeOutcome(
          decision,
          effectMessage || "مطلوب امتحان قبول"
        ),
      };

    case "portfolio":
      return {
        required: makeOutcome(
          decision,
          effectMessage || "مطلوب تقديم بورتفوليو"
        ),
      };

    case "research_plan":
      return {
        pass: { decision: "pass" },
        not_available: makeOutcome(
          decision,
          effectMessage || "يحتاج تجهيز خطة بحث",
          "research_plan_required"
        ),
        unknown: { decision: "review", message: "يحتاج مراجعة — معلومات خطة البحث غير متوفرة" },
      };

    case "study_track":
      return {
        pass: { decision: "pass" },
        not_available: { decision: "review", message: "لم يُحدد المسار الدراسي" },
        wrong_track: makeOutcome(
          decision,
          effectMessage || "المسار الدراسي غير مقبول"
        ),
        unknown: { decision: "review", message: "يحتاج مراجعة" },
      };

    case "british_qualifications":
      return {
        pass: { decision: "pass" },
        count_fail: { decision: "block", message: effectMessage || "عدد مواد A Level غير كافٍ" },
        grade_fail: makeOutcome(
          decision,
          effectMessage || "درجات A Level أقل من المطلوب"
        ),
      };

    case "custom_yes_no":
      return {
        yes: { decision: "pass" },
        no: makeOutcome(
          decision,
          effectMessage || (ruleConfig.negative_message as string) || (ruleConfig.question_text as string) || "غير مؤهل"
        ),
        unknown: { decision: "review", message: "يحتاج مراجعة — لم يُجب على السؤال" },
      };

    case "custom_select":
      // DO NOT populate — handled by fallback
      return null;

    default:
      console.warn(`  ⚠️ Unknown rule_type: ${ruleType} — skipping`);
      return null;
  }
}

// -----------------------------------------------------------
// Main
// -----------------------------------------------------------

interface CustomReqRow {
  id: string;
  program_id: string;
  certificate_type_id: string | null;
  question_text: string;
  comparison_key: string | null;
  show_in_comparison: boolean;
}

async function main() {
  console.log("🔧 Populating V3 outcomes...\n");

  // 1. Read all requirement_rules with empty outcomes
  const { data: rules, error: rulesErr } = await supabase
    .from("requirement_rules")
    .select("*")
    .eq("outcomes", "{}");

  if (rulesErr) {
    console.error("❌ Error reading requirement_rules:", rulesErr.message);
    process.exit(1);
  }

  if (!rules || rules.length === 0) {
    console.log("✅ No rules with empty outcomes. Nothing to do.");
    return;
  }

  console.log(`📋 Found ${rules.length} rules with empty outcomes\n`);

  // 2. Read all custom_requirements for cross-referencing
  const { data: customReqs, error: crErr } = await supabase
    .from("custom_requirements")
    .select("id, program_id, certificate_type_id, question_text, comparison_key, show_in_comparison");

  if (crErr) {
    console.error("❌ Error reading custom_requirements:", crErr.message);
    process.exit(1);
  }

  const allCustomReqs = (customReqs || []) as CustomReqRow[];

  // 3. Process each rule
  let updated = 0;
  let skippedSelect = 0;
  let skippedAmbiguous = 0;
  let errors = 0;

  for (const rule of rules) {
    const ruleType = rule.rule_type;
    const ruleConfig = (rule.config || {}) as Record<string, unknown>;

    // custom_select — skip by design
    if (ruleType === "custom_select") {
      skippedSelect++;
      console.log(`  ⏭️  [${rule.id}] custom_select — skipped (by design)`);
      continue;
    }

    // For custom_yes_no: find matching custom_requirement for comparison_key
    let updatedConfig = ruleConfig;
    if (ruleType === "custom_yes_no") {
      const questionText = ruleConfig.question_text as string;
      const matches = allCustomReqs.filter(
        (cr) =>
          cr.program_id === rule.program_id &&
          cr.question_text === questionText
      );

      if (matches.length === 0) {
        skippedAmbiguous++;
        console.log(`  ⚠️  [${rule.id}] custom_yes_no — 0 matches for "${questionText}" — skipped`);
        continue;
      }

      if (matches.length > 1) {
        skippedAmbiguous++;
        console.log(`  ⚠️  [${rule.id}] custom_yes_no — ${matches.length} matches for "${questionText}" — ambiguous, skipped`);
        continue;
      }

      // Exactly 1 match — attach comparison_key
      const match = matches[0];
      if (match.comparison_key) {
        updatedConfig = { ...ruleConfig, comparison_key: match.comparison_key };
      } else {
        skippedAmbiguous++;
        console.log(`  ⚠️  [${rule.id}] custom_yes_no — matched but no comparison_key — skipped`);
        continue;
      }
    }

    // Build outcomes
    const outcomes = buildOutcomes(
      ruleType,
      rule.effect || "blocks_admission",
      rule.effect_message,
      updatedConfig
    );

    if (!outcomes) {
      continue; // already logged if unknown type
    }

    // Update the rule
    const updatePayload: Record<string, unknown> = { outcomes };
    if (ruleType === "custom_yes_no" && updatedConfig !== ruleConfig) {
      updatePayload.config = updatedConfig;
    }

    const { error: updateErr } = await supabase
      .from("requirement_rules")
      .update(updatePayload)
      .eq("id", rule.id);

    if (updateErr) {
      errors++;
      console.error(`  ❌ [${rule.id}] ${ruleType} — update failed: ${updateErr.message}`);
    } else {
      updated++;
      console.log(`  ✅ [${rule.id}] ${ruleType} — outcomes populated`);
    }
  }

  // 4. Summary
  console.log("\n========================================");
  console.log("📊 Summary:");
  console.log(`  ✅ Rules updated with outcomes: ${updated}`);
  console.log(`  ⏭️  custom_select skipped (by design): ${skippedSelect}`);
  console.log(`  ⚠️  custom_yes_no skipped (ambiguous/no key): ${skippedAmbiguous}`);
  console.log(`  ❌ Errors: ${errors}`);
  console.log("========================================\n");
}

main().catch((err) => {
  console.error("❌ Unexpected error:", err);
  process.exit(1);
});
