// ============================================================
// Dual-write: Convert requirement_rules → old requirements table
// This keeps the old evaluation/comparison engines working
// while we transition to the rule-based system.
// ============================================================

import type { SupabaseClient } from "@supabase/supabase-js";

interface RuleRow {
  rule_type: string;
  config: Record<string, unknown>;
  effect: string;
  effect_message: string | null;
}

/**
 * Given an array of rules for one (program, certificate_type) combination,
 * build the corresponding old-style requirements fields and upsert them.
 */
export async function dualWriteRequirements(
  supabase: SupabaseClient,
  programId: string,
  certificateTypeId: string | null,
  tenantId: string,
  rules: RuleRow[],
  existingReqRowId: string | null
) {
  // Build the old requirements object from rules
  const req: Record<string, unknown> = {
    requires_hs: false,
    requires_12_years: false,
    requires_bachelor: false,
    requires_ielts: false,
    ielts_min: null,
    ielts_effect: null,
    requires_sat: false,
    sat_min: null,
    sat_effect: null,
    requires_gpa: false,
    gpa_min: null,
    requires_entrance_exam: false,
    requires_portfolio: false,
    requires_research_plan: false,
    requires_a_levels: false,
    a_level_subjects_min: null,
    a_level_min_grade: null,
    a_level_requires_core: false,
    a_level_effect: null,
    requires_as_levels: false,
    as_level_subjects_min: null,
    as_level_min_grade: null,
    as_level_effect: null,
    requires_o_levels: false,
    o_level_subjects_min: null,
    o_level_min_grade: null,
    o_level_effect: null,
    requires_ib: false,
    ib_min_points: null,
    ib_effect: null,
    requires_language_cert: false,
    accepted_language_certs: null,
    language_cert_effect: null,
  };

  // Custom requirements to sync
  const customReqs: Array<{
    question_text: string;
    question_type: string;
    effect: string;
    negative_message: string;
    positive_message: string;
    sort_order: number;
    options: string[] | null;
    option_effects: Record<string, unknown> | null;
  }> = [];

  let customSortOrder = 0;

  for (const rule of rules) {
    const cfg = rule.config;
    const eff = rule.effect;

    switch (rule.rule_type) {
      case "high_school":
        req.requires_hs = true;
        break;

      case "twelve_years":
        req.requires_12_years = true;
        break;

      case "bachelor":
        req.requires_bachelor = true;
        break;

      case "language_cert": {
        req.requires_language_cert = true;
        const accepted = (cfg.accepted as Array<{ type: string; min_score: number }>) || [];
        if (accepted.length > 0) {
          req.accepted_language_certs = accepted;
          // Also set legacy IELTS if there's an IELTS entry
          const ieltsEntry = accepted.find((a) => a.type === "IELTS");
          if (ieltsEntry) {
            req.requires_ielts = true;
            req.ielts_min = ieltsEntry.min_score;
            req.ielts_effect = eff === "blocks_admission" ? "blocks_if_below" : "conditional";
          }
        }
        req.language_cert_effect = eff === "blocks_admission" ? "blocks_if_below" : "conditional";
        break;
      }

      case "sat":
        req.requires_sat = true;
        req.sat_min = (cfg.min_score as number) ?? null;
        req.sat_effect = eff === "blocks_admission" ? "blocks_if_below" : "conditional";
        break;

      case "gpa":
        req.requires_gpa = true;
        req.gpa_min = (cfg.min_gpa as number) ?? null;
        break;

      case "a_levels":
        req.requires_a_levels = true;
        req.a_level_subjects_min = (cfg.subjects_min as number) ?? null;
        req.a_level_min_grade = (cfg.min_grade as string) ?? null;
        req.a_level_requires_core = (cfg.requires_core as boolean) ?? false;
        req.a_level_effect = eff;
        break;

      case "as_levels":
        req.requires_as_levels = true;
        req.as_level_subjects_min = (cfg.subjects_min as number) ?? null;
        req.as_level_min_grade = (cfg.min_grade as string) ?? null;
        req.as_level_effect = eff;
        break;

      case "o_levels":
        req.requires_o_levels = true;
        req.o_level_subjects_min = (cfg.subjects_min as number) ?? null;
        req.o_level_min_grade = (cfg.min_grade as string) ?? null;
        req.o_level_effect = eff;
        break;

      case "entrance_exam":
        req.requires_entrance_exam = true;
        break;

      case "portfolio":
        req.requires_portfolio = true;
        break;

      case "research_plan":
        req.requires_research_plan = true;
        break;

      case "custom_yes_no":
        customSortOrder++;
        customReqs.push({
          question_text: (cfg.question_text as string) || "",
          question_type: "yes_no",
          effect: eff === "blocks_admission" ? "blocks_admission" : "makes_conditional",
          negative_message: (cfg.negative_message as string) || "",
          positive_message: (cfg.positive_message as string) || "",
          sort_order: customSortOrder,
          options: null,
          option_effects: null,
        });
        break;

      case "custom_select":
        customSortOrder++;
        customReqs.push({
          question_text: (cfg.question_text as string) || "",
          question_type: "select",
          effect: eff === "blocks_admission" ? "blocks_admission" : "makes_conditional",
          negative_message: (cfg.negative_message as string) || "",
          positive_message: (cfg.positive_message as string) || "",
          sort_order: customSortOrder,
          options: (cfg.options as string[]) || null,
          option_effects: (cfg.option_effects as Record<string, unknown>) || null,
        });
        break;
    }
  }

  // Upsert requirements row
  if (existingReqRowId) {
    await supabase
      .from("requirements")
      .update(req)
      .eq("id", existingReqRowId);
  } else {
    const { data: newRow } = await supabase
      .from("requirements")
      .insert({
        program_id: programId,
        tenant_id: tenantId,
        certificate_type_id: certificateTypeId,
        ...req,
      })
      .select("id")
      .single();

    existingReqRowId = newRow?.id || null;
  }

  // Sync custom_requirements: delete existing for this cert type, then re-insert
  let deleteQuery = supabase
    .from("custom_requirements")
    .delete()
    .eq("program_id", programId);

  if (certificateTypeId) {
    deleteQuery = deleteQuery.eq("certificate_type_id", certificateTypeId);
  } else {
    deleteQuery = deleteQuery.is("certificate_type_id", null);
  }
  await deleteQuery;

  // Insert custom requirements
  for (const cr of customReqs) {
    await supabase.from("custom_requirements").insert({
      program_id: programId,
      tenant_id: tenantId,
      certificate_type_id: certificateTypeId,
      ...cr,
    });
  }

  return existingReqRowId;
}
