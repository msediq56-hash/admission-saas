#!/usr/bin/env npx tsx
// ============================================================
// V3 Compatibility Report — checks which programs are V3-ready
// vs which need old engine fallback.
//
// Usage: npx tsx scripts/v3-compatibility-report.ts
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
// Types
// -----------------------------------------------------------

interface ProgramEntry {
  programId: string;
  programName: string;
  universityName: string;
  category: string;
  certTypeName: string | null;
  certTypeSlug: string | null;
  rules: RuleRow[];
  customReqs: CustomReqRow[];
}

interface RuleRow {
  id: string;
  rule_type: string;
  config: Record<string, unknown>;
  outcomes: Record<string, unknown>;
  effect: string;
  is_enabled: boolean;
}

interface CustomReqRow {
  id: string;
  question_text: string;
  comparison_key: string | null;
  show_in_comparison: boolean;
  question_type: string;
}

// -----------------------------------------------------------
// Compatibility check
// -----------------------------------------------------------

function isSimpleBritishPathway(config: Record<string, unknown>): boolean {
  const pathways = (config as { pathways?: Array<{ requirements?: Array<{ level?: string; min_grade?: string }> }> }).pathways;
  if (!pathways || pathways.length !== 1) return false;
  const reqs = pathways[0].requirements || [];
  if (reqs.length !== 1) return false;
  return reqs[0].level === "a_level" && reqs[0].min_grade === "C";
}

interface CompatResult {
  compatible: boolean;
  reason?: string;
  ruleCount: number;
}

function checkCompatibility(entry: ProgramEntry): CompatResult {
  const enabledRules = entry.rules.filter((r) => r.is_enabled);

  // No rules
  if (enabledRules.length === 0) {
    return { compatible: false, reason: "zero requirement_rules", ruleCount: 0 };
  }

  // All rules must have non-empty outcomes
  const emptyOutcomes = enabledRules.filter(
    (r) => !r.outcomes || Object.keys(r.outcomes).length === 0
  );
  if (emptyOutcomes.length > 0) {
    const types = emptyOutcomes.map((r) => r.rule_type).join(", ");
    return {
      compatible: false,
      reason: `has rules with empty outcomes (${types})`,
      ruleCount: enabledRules.length,
    };
  }

  // Bachelor / research_plan → master profile inputs not in compare form
  const masterRuleTypes = ["bachelor", "research_plan"];
  const hasMasterRules = enabledRules.some((r) => masterRuleTypes.includes(r.rule_type));
  if (hasMasterRules) {
    return {
      compatible: false,
      reason: "has bachelor/research_plan rules (compare form unsupported)",
      ruleCount: enabledRules.length,
    };
  }

  // British pathway check
  if (entry.certTypeSlug === "british") {
    const britishRules = enabledRules.filter((r) => r.rule_type === "british_qualifications");
    for (const rule of britishRules) {
      if (!isSimpleBritishPathway(rule.config)) {
        return {
          compatible: false,
          reason: "british pathway too complex for current form",
          ruleCount: enabledRules.length,
        };
      }
    }
  }

  // Unresolved custom requirements (per-row matching)
  const comparisonCustomReqs = entry.customReqs.filter((cr) => cr.show_in_comparison);
  for (const cr of comparisonCustomReqs) {
    if (!cr.comparison_key) {
      return {
        compatible: false,
        reason: `custom requirement without comparison_key: ${cr.question_text}`,
        ruleCount: enabledRules.length,
      };
    }

    const matched = enabledRules.find((rule) => {
      if (rule.rule_type !== "custom_yes_no") return false;
      if (!rule.outcomes || Object.keys(rule.outcomes).length === 0) return false;
      const cfg = rule.config as Record<string, unknown>;
      if (cfg.question_text !== cr.question_text) return false;
      if (!cfg.comparison_key) return false;
      if (cfg.comparison_key !== cr.comparison_key) return false;
      return true;
    });

    if (!matched) {
      return {
        compatible: false,
        reason: `unresolved custom requirement: ${cr.question_text}`,
        ruleCount: enabledRules.length,
      };
    }
  }

  return { compatible: true, ruleCount: enabledRules.length };
}

// -----------------------------------------------------------
// Main
// -----------------------------------------------------------

async function main() {
  console.log("\n=== V3 Compatibility Report ===\n");

  // Fetch programs with university info
  const { data: programs, error: progErr } = await supabase
    .from("programs")
    .select(`
      id, name, category, is_active,
      university:universities!inner(id, name),
      certificate_type:certificate_types(id, name_ar, slug)
    `)
    .eq("is_active", true)
    .order("name");

  if (progErr || !programs) {
    console.error("❌ Error fetching programs:", progErr?.message);
    process.exit(1);
  }

  // Fetch all requirement_rules
  const { data: allRules, error: rulesErr } = await supabase
    .from("requirement_rules")
    .select("id, program_id, rule_type, config, outcomes, effect, is_enabled");

  if (rulesErr) {
    console.error("❌ Error fetching rules:", rulesErr.message);
    process.exit(1);
  }

  // Fetch all custom_requirements
  const { data: allCustomReqs, error: crErr } = await supabase
    .from("custom_requirements")
    .select("id, program_id, question_text, comparison_key, show_in_comparison, question_type");

  if (crErr) {
    console.error("❌ Error fetching custom_requirements:", crErr.message);
    process.exit(1);
  }

  // Build entries
  const entries: ProgramEntry[] = programs.map((p: any) => {
    const rules = (allRules || []).filter((r: any) => r.program_id === p.id);
    const customReqs = (allCustomReqs || []).filter((cr: any) => cr.program_id === p.id);
    const uni = Array.isArray(p.university) ? p.university[0] : p.university;
    const cert = Array.isArray(p.certificate_type) ? p.certificate_type[0] : p.certificate_type;

    return {
      programId: p.id,
      programName: p.name,
      universityName: uni?.name || "Unknown",
      category: p.category,
      certTypeName: cert?.name_ar || null,
      certTypeSlug: cert?.slug || null,
      rules: rules as RuleRow[],
      customReqs: customReqs as CustomReqRow[],
    };
  });

  // Check each
  const compatible: Array<{ entry: ProgramEntry; result: CompatResult }> = [];
  const fallback: Array<{ entry: ProgramEntry; result: CompatResult }> = [];

  for (const entry of entries) {
    const result = checkCompatibility(entry);
    if (result.compatible) {
      compatible.push({ entry, result });
    } else {
      fallback.push({ entry, result });
    }
  }

  // Output
  console.log("✅ V3-Compatible Programs:");
  if (compatible.length === 0) {
    console.log("  (none)");
  }
  for (const { entry, result } of compatible) {
    const cert = entry.certTypeName ? ` (${entry.certTypeName})` : "";
    const britishNote =
      entry.certTypeSlug === "british"
        ? `, simple A Level pathway`
        : "";
    console.log(
      `  ${entry.universityName} — ${entry.programName}${cert} — all ${result.ruleCount} rules have outcomes${britishNote}`
    );
  }

  console.log("\n⚠️ Fallback Programs (will use old engine):");
  if (fallback.length === 0) {
    console.log("  (none)");
  }
  for (const { entry, result } of fallback) {
    const cert = entry.certTypeName ? ` (${entry.certTypeName})` : "";
    console.log(
      `  ${entry.universityName} — ${entry.programName}${cert} — ${result.reason}`
    );
  }

  const total = entries.length;
  console.log(`\nSummary:`);
  console.log(`  V3-ready: ${compatible.length}/${total}`);
  console.log(`  Fallback: ${fallback.length}/${total}`);
  console.log("");
}

main().catch((err) => {
  console.error("❌ Unexpected error:", err);
  process.exit(1);
});
