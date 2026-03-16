#!/usr/bin/env npx tsx
// ============================================================
// Reseed Script: Delete and re-insert requirement_rules
// for SRH University programs.
//
// Usage: npx tsx scripts/reseed-srh.ts
// Requires: NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY
// ============================================================

import { createClient } from "@supabase/supabase-js";
import { config } from "dotenv";

config({ path: ".env.local" });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error("❌ يجب تعيين متغيرات البيئة:");
  console.error("   NEXT_PUBLIC_SUPABASE_URL");
  console.error("   SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function main() {
  console.log("🏫 بدء إعادة تعبئة بيانات جامعة SRH...\n");

  // 1. Find SRH University
  const { data: uni, error: uniErr } = await supabase
    .from("universities")
    .select("id, name, tenant_id")
    .eq("name", "جامعة SRH")
    .single();

  if (uniErr || !uni) {
    console.error("❌ لم يتم العثور على جامعة SRH:", uniErr?.message);
    process.exit(1);
  }
  console.log(`✅ جامعة: ${uni.name} (${uni.id})`);
  const tenantId = uni.tenant_id;

  // 2. Find programs
  const { data: programs, error: progErr } = await supabase
    .from("programs")
    .select("id, name, category")
    .eq("university_id", uni.id)
    .order("sort_order");

  if (progErr || !programs || programs.length === 0) {
    console.error("❌ لم يتم العثور على برامج:", progErr?.message);
    process.exit(1);
  }

  const programIds = programs.map((p) => p.id);
  console.log(`✅ برامج (${programs.length}):`);
  for (const p of programs) {
    console.log(`   - ${p.name} (${p.category}) [${p.id}]`);
  }

  // 3. Find certificate type IDs
  const { data: certTypes } = await supabase
    .from("certificate_types")
    .select("id, slug")
    .eq("slug", "arabic");

  if (!certTypes || certTypes.length === 0) {
    console.error("❌ لم يتم العثور على نوع الشهادة العربية");
    process.exit(1);
  }
  const arabicCertId = certTypes[0].id;
  console.log(`✅ شهادة عربية: ${arabicCertId}\n`);

  // 4. DELETE existing data
  console.log("🗑️  حذف البيانات القديمة...");

  const { count: delRules } = await supabase
    .from("requirement_rules")
    .delete({ count: "exact" })
    .in("program_id", programIds);
  console.log(`   حذف ${delRules ?? 0} requirement_rules`);

  const { count: delReqs } = await supabase
    .from("requirements")
    .delete({ count: "exact" })
    .in("program_id", programIds);
  console.log(`   حذف ${delReqs ?? 0} requirements`);

  const { count: delCustom } = await supabase
    .from("custom_requirements")
    .delete({ count: "exact" })
    .in("program_id", programIds);
  console.log(`   حذف ${delCustom ?? 0} custom_requirements`);

  const { count: delTiers } = await supabase
    .from("scholarship_tiers")
    .delete({ count: "exact" })
    .in("program_id", programIds);
  console.log(`   حذف ${delTiers ?? 0} scholarship_tiers`);
  console.log("");

  // 5. Find programs by name
  function findProgram(name: string): string {
    const p = programs.find((pr) => pr.name === name);
    if (!p) throw new Error(`Program '${name}' not found`);
    return p.id;
  }

  const iefId = findProgram("برنامج اللغة الإنجليزية التأسيسي المكثف (IEF)");
  const bizFoundId = findProgram("فاونديشن في البزنس");
  const creativeFoundId = findProgram("فاونديشن في الدراسات الإبداعية");
  const engFoundId = findProgram("فاونديشن الهندسة وتكنولوجيا المعلومات");
  const preMasterId = findProgram("بري ماستر (ما قبل الماجستير)");
  const bachelorId = findProgram("بكالوريوس");
  const masterId = findProgram("ماجستير");

  // 6. INSERT requirement_rules
  console.log("📝 إدراج القواعد الجديدة...");

  // Helper to make a rule object
  function makeRule(
    programId: string,
    certTypeId: string | null,
    ruleType: string,
    config: Record<string, unknown>,
    effect: string,
    effectMessage: string,
    sortOrder: number
  ) {
    return {
      program_id: programId,
      certificate_type_id: certTypeId,
      rule_type: ruleType,
      config,
      effect,
      effect_message: effectMessage,
      sort_order: sortOrder,
      is_enabled: true,
      tenant_id: tenantId,
    };
  }

  const rules = [
    // === IEF — Arabic ===
    makeRule(iefId, arabicCertId, "high_school", {}, "blocks_admission", "الطالب لا يملك شهادة ثانوية", 1),
    makeRule(iefId, arabicCertId, "language_cert", { cert_type: "ielts", min_score: 4.0 }, "blocks_admission", "يحتاج IELTS 4.0 على الأقل", 2),

    // === فاونديشن في البزنس — Arabic ===
    makeRule(bizFoundId, arabicCertId, "high_school", {}, "blocks_admission", "الطالب لا يملك شهادة ثانوية", 1),
    makeRule(bizFoundId, arabicCertId, "language_cert", { cert_type: "ielts", min_score: 5.0 }, "blocks_admission", "يحتاج IELTS 5.0 على الأقل", 2),

    // === فاونديشن في الدراسات الإبداعية — Arabic ===
    makeRule(creativeFoundId, arabicCertId, "high_school", {}, "blocks_admission", "الطالب لا يملك شهادة ثانوية", 1),
    makeRule(creativeFoundId, arabicCertId, "language_cert", { cert_type: "ielts", min_score: 5.0 }, "blocks_admission", "يحتاج IELTS 5.0 على الأقل", 2),

    // === فاونديشن الهندسة وتكنولوجيا المعلومات — Arabic ===
    makeRule(engFoundId, arabicCertId, "high_school", {}, "blocks_admission", "الطالب لا يملك شهادة ثانوية", 1),
    makeRule(engFoundId, arabicCertId, "language_cert", { cert_type: "ielts", min_score: 5.0 }, "blocks_admission", "يحتاج IELTS 5.0 على الأقل", 2),

    // === بري ماستر — Universal ===
    makeRule(preMasterId, null, "bachelor", {}, "blocks_admission", "الطالب لا يملك شهادة بكالوريوس", 1),
    makeRule(preMasterId, null, "language_cert", { cert_type: "ielts", min_score: 5.5 }, "blocks_admission", "يحتاج IELTS 5.5 على الأقل", 2),

    // === بكالوريوس — Arabic ===
    makeRule(bachelorId, arabicCertId, "high_school", {}, "blocks_admission", "الطالب لا يملك شهادة ثانوية", 1),
    makeRule(bachelorId, arabicCertId, "language_cert", { cert_type: "ielts", min_score: 6.5 }, "blocks_admission", "يحتاج IELTS 6.5 على الأقل", 2),

    // === ماجستير — Universal ===
    makeRule(masterId, null, "bachelor", {}, "blocks_admission", "الطالب لا يملك شهادة بكالوريوس", 1),
    makeRule(masterId, null, "language_cert", { cert_type: "ielts", min_score: 6.5 }, "blocks_admission", "يحتاج IELTS 6.5 على الأقل", 2),
  ];

  const { error: insertErr, count: insertedRules } = await supabase
    .from("requirement_rules")
    .insert(rules, { count: "exact" });

  if (insertErr) {
    console.error("❌ خطأ في إدراج القواعد:", insertErr.message);
    process.exit(1);
  }
  console.log(`   ✅ تم إدراج ${insertedRules} قاعدة`);

  // 7. Summary
  console.log("\n========================================");
  console.log("📊 ملخص:");
  console.log(`   القواعد: ${insertedRules}`);
  console.log("========================================");
  console.log("✅ تمت إعادة التعبئة بنجاح!");
}

main().catch((err) => {
  console.error("❌ خطأ غير متوقع:", err);
  process.exit(1);
});
