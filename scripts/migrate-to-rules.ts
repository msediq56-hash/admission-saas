#!/usr/bin/env npx tsx
// ============================================================
// Migration Script: Convert old requirements → requirement_rules
// Reads from requirements + custom_requirements tables,
// creates corresponding rows in requirement_rules.
//
// Usage: npx tsx scripts/migrate-to-rules.ts
// Requires: NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY env vars
// ============================================================

import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error("❌ يجب تعيين متغيرات البيئة:");
  console.error("   NEXT_PUBLIC_SUPABASE_URL");
  console.error("   SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

interface RequirementRow {
  id: string;
  program_id: string;
  certificate_type_id: string | null;
  requires_hs: boolean;
  requires_12_years: boolean;
  requires_bachelor: boolean;
  requires_ielts: boolean;
  ielts_min: number | null;
  ielts_effect: string | null;
  ielts_alternatives: Record<string, number> | null;
  requires_sat: boolean;
  sat_min: number | null;
  sat_effect: string | null;
  requires_gpa: boolean;
  gpa_min: number | null;
  gpa_effect: string | null;
  requires_entrance_exam: boolean;
  requires_portfolio: boolean;
  requires_research_plan: boolean;
  requires_a_levels: boolean;
  a_level_subjects_min: number | null;
  a_level_min_grade: string | null;
  a_level_requires_core: boolean;
  a_level_effect: string | null;
  requires_as_levels: boolean;
  as_level_subjects_min: number | null;
  as_level_min_grade: string | null;
  as_level_effect: string | null;
  requires_o_levels: boolean;
  o_level_subjects_min: number | null;
  o_level_min_grade: string | null;
  o_level_effect: string | null;
}

interface CustomRequirementRow {
  id: string;
  program_id: string;
  certificate_type_id: string | null;
  question_text: string;
  question_type: string;
  effect: string;
  positive_message: string | null;
  negative_message: string | null;
  sort_order: number;
  option_effects: Record<string, { effect: string; message: string | null }> | null;
}

async function migrate() {
  console.log("🔄 بدء تحويل المتطلبات إلى قواعد...\n");

  // 1. Get tenant ID (for now, single tenant)
  const { data: tenants, error: tenantErr } = await supabase
    .from("tenants")
    .select("id, name")
    .limit(1);

  if (tenantErr || !tenants?.length) {
    console.error("❌ لم يتم العثور على مستأجر:", tenantErr?.message);
    process.exit(1);
  }
  const tenantId = tenants[0].id;
  console.log(`📋 المستأجر: ${tenants[0].name} (${tenantId})`);

  // 2. Read all requirements
  const { data: requirements, error: reqErr } = await supabase
    .from("requirements")
    .select("*") as { data: RequirementRow[] | null; error: typeof reqErr };

  if (reqErr || !requirements) {
    console.error("❌ خطأ في قراءة المتطلبات:", reqErr?.message);
    process.exit(1);
  }
  console.log(`📋 عدد المتطلبات: ${requirements.length}`);

  // 3. Read all custom requirements
  const { data: customReqs, error: crErr } = await supabase
    .from("custom_requirements")
    .select("*") as { data: CustomRequirementRow[] | null; error: typeof crErr };

  if (crErr) {
    console.error("❌ خطأ في قراءة المتطلبات المخصصة:", crErr.message);
    process.exit(1);
  }
  console.log(`📋 عدد المتطلبات المخصصة: ${customReqs?.length || 0}\n`);

  let totalRules = 0;

  for (const req of requirements) {
    const rules: Array<{
      program_id: string;
      certificate_type_id: string | null;
      rule_type: string;
      config: Record<string, unknown>;
      effect: string;
      effect_message: string | null;
      sort_order: number;
      is_enabled: boolean;
      tenant_id: string;
    }> = [];
    let sortOrder = 0;

    function addRule(
      ruleType: string,
      config: Record<string, unknown>,
      effect: string,
      effectMessage?: string | null
    ) {
      rules.push({
        program_id: req.program_id,
        certificate_type_id: req.certificate_type_id,
        rule_type: ruleType,
        config,
        effect,
        effect_message: effectMessage ?? null,
        sort_order: sortOrder++,
        is_enabled: true,
        tenant_id: tenantId,
      });
    }

    // Convert structured fields
    if (req.requires_hs) addRule("high_school", {}, "blocks_admission");
    if (req.requires_12_years) addRule("twelve_years", {}, "blocks_admission");
    if (req.requires_bachelor) addRule("bachelor", {}, "blocks_admission");

    if (req.requires_ielts && req.ielts_min) {
      let effect = "blocks_admission";
      let msg: string | null = null;
      if (req.ielts_effect?.startsWith("interview:")) {
        effect = "makes_conditional";
        msg = req.ielts_effect.replace(/^interview:\s*/, "");
      } else if (req.ielts_effect === "blocks_if_below") {
        effect = "blocks_admission";
      } else if (req.ielts_effect?.startsWith("conditional:")) {
        effect = "makes_conditional";
        msg = req.ielts_effect.replace(/^conditional:\s*/, "");
      }
      addRule("language_cert", {
        cert_type: "ielts",
        min_score: req.ielts_min,
        alternatives: req.ielts_alternatives || {},
      }, effect, msg);
    }

    if (req.requires_sat && req.sat_min) {
      let effect = "blocks_admission";
      let msg: string | null = null;
      if (req.sat_effect?.startsWith("conditional:")) {
        effect = "makes_conditional";
        msg = req.sat_effect.replace(/^conditional:\s*/, "");
      }
      addRule("sat", { min_score: req.sat_min }, effect, msg);
    }

    if (req.requires_gpa && req.gpa_min) {
      let effect = "blocks_admission";
      if (req.gpa_effect === "scholarship") effect = "scholarship";
      else if (req.gpa_effect === "makes_conditional") effect = "makes_conditional";
      addRule("gpa", { min_gpa: req.gpa_min }, effect);
    }

    if (req.requires_entrance_exam) {
      addRule("entrance_exam", {}, "makes_conditional", "مشروط بدخول واجتياز امتحان القبول");
    }
    if (req.requires_portfolio) addRule("portfolio", {}, "blocks_admission");
    if (req.requires_research_plan) addRule("research_plan", {}, "blocks_admission");

    if (req.requires_a_levels) {
      addRule("a_levels", {
        subjects_min: req.a_level_subjects_min,
        min_grade: req.a_level_min_grade,
        requires_core: req.a_level_requires_core || false,
      }, req.a_level_effect || "blocks_admission");
    }

    if (req.requires_as_levels) {
      addRule("as_levels", {
        subjects_min: req.as_level_subjects_min,
        min_grade: req.as_level_min_grade,
      }, req.as_level_effect || "blocks_admission");
    }

    if (req.requires_o_levels) {
      addRule("o_levels", {
        subjects_min: req.o_level_subjects_min,
        min_grade: req.o_level_min_grade,
      }, req.o_level_effect || "blocks_admission");
    }

    // Custom requirements for this program + cert type
    const matchingCustom = (customReqs || []).filter(
      (cr) =>
        cr.program_id === req.program_id &&
        cr.certificate_type_id === req.certificate_type_id
    );

    for (const cr of matchingCustom) {
      if (cr.question_type === "yes_no") {
        addRule("custom_yes_no", {
          question_text: cr.question_text,
          positive_message: cr.positive_message,
          negative_message: cr.negative_message,
        }, cr.effect, cr.negative_message);
      } else if (cr.question_type === "select") {
        addRule("custom_select", {
          question_text: cr.question_text,
          options: [],
          option_effects: cr.option_effects || {},
        }, cr.effect);
      }
    }

    if (rules.length > 0) {
      const { error: insertErr } = await supabase
        .from("requirement_rules")
        .insert(rules);

      if (insertErr) {
        console.error(`❌ خطأ في إدخال قواعد البرنامج ${req.program_id}:`, insertErr.message);
      } else {
        totalRules += rules.length;
        console.log(`  ✓ البرنامج ${req.program_id} → ${rules.length} قاعدة`);
      }
    }
  }

  console.log(`\n✅ تم تحويل ${totalRules} قاعدة بنجاح`);
}

migrate().catch(console.error);
