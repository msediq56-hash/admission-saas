#!/usr/bin/env npx tsx
// ============================================================
// Reseed Script: Delete and re-insert requirement_rules and
// scholarship_tiers for Constructor University programs.
// Keeps university, programs, majors, major_subject_requirements.
//
// Usage: npx tsx scripts/reseed-constructor.ts
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
  console.log("🏫 بدء إعادة تعبئة بيانات جامعة كونستركتر...\n");

  // 1. Find Constructor University
  const { data: uni, error: uniErr } = await supabase
    .from("universities")
    .select("id, name, tenant_id")
    .eq("name", "جامعة كونستركتر")
    .single();

  if (uniErr || !uni) {
    console.error("❌ لم يتم العثور على جامعة كونستركتر:", uniErr?.message);
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
    .in("slug", ["arabic", "british"]);

  if (!certTypes || certTypes.length < 2) {
    console.error("❌ لم يتم العثور على أنواع الشهادات");
    process.exit(1);
  }

  const arabicCertId = certTypes.find((c) => c.slug === "arabic")!.id;
  const britishCertId = certTypes.find((c) => c.slug === "british")!.id;
  console.log(`✅ شهادة عربية: ${arabicCertId}`);
  console.log(`✅ شهادة بريطانية: ${britishCertId}\n`);

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

  // 5. Helper to find program by category
  function findProgram(category: string): string {
    const p = programs.find((pr) => pr.category === category);
    if (!p) throw new Error(`Program with category '${category}' not found`);
    return p.id;
  }

  const bachelorId = findProgram("bachelor");
  const foundationId = findProgram("foundation");
  const masterId = findProgram("master");

  // 6. INSERT requirement_rules
  console.log("📝 إدراج القواعد الجديدة...");

  const rules = [
    // === BACHELOR — Arabic ===
    {
      program_id: bachelorId,
      certificate_type_id: arabicCertId,
      rule_type: "high_school",
      config: {},
      effect: "blocks_admission",
      effect_message: "الطالب لا يملك شهادة ثانوية",
      sort_order: 1,
      is_enabled: true,
      tenant_id: tenantId,
    },
    {
      program_id: bachelorId,
      certificate_type_id: arabicCertId,
      rule_type: "sat",
      config: { min_score: 1200 },
      effect: "makes_conditional",
      effect_message: "يحتاج تقديم SAT بدرجة 1200+ قبل 31 ديسمبر",
      sort_order: 2,
      is_enabled: true,
      tenant_id: tenantId,
    },
    {
      program_id: bachelorId,
      certificate_type_id: arabicCertId,
      rule_type: "language_cert",
      config: { cert_type: "ielts", min_score: 6.5, alternatives: { Duolingo: 110 } },
      effect: "makes_conditional",
      effect_message: "سيتم ترتيب مقابلة لتقييم اللغة",
      sort_order: 3,
      is_enabled: true,
      tenant_id: tenantId,
    },
    {
      program_id: bachelorId,
      certificate_type_id: arabicCertId,
      rule_type: "gpa",
      config: { min_gpa: 80 },
      effect: "scholarship",
      effect_message: "المعدل يؤثر على المنحة",
      sort_order: 4,
      is_enabled: true,
      tenant_id: tenantId,
    },

    // === BACHELOR — British ===
    {
      program_id: bachelorId,
      certificate_type_id: britishCertId,
      rule_type: "a_levels",
      config: { subjects_min: 3, min_grade: "C", requires_core: true },
      effect: "blocks_admission",
      effect_message: "يحتاج 3 مواد A Level بدرجة C أو أعلى مع مادتين أساسيتين",
      sort_order: 1,
      is_enabled: true,
      tenant_id: tenantId,
    },
    {
      program_id: bachelorId,
      certificate_type_id: britishCertId,
      rule_type: "sat",
      config: { min_score: 1200 },
      effect: "makes_conditional",
      effect_message: "يحتاج تقديم SAT بدرجة 1200+ قبل 31 ديسمبر",
      sort_order: 2,
      is_enabled: true,
      tenant_id: tenantId,
    },
    {
      program_id: bachelorId,
      certificate_type_id: britishCertId,
      rule_type: "language_cert",
      config: { cert_type: "ielts", min_score: 6.5, alternatives: { Duolingo: 110 } },
      effect: "makes_conditional",
      effect_message: "سيتم ترتيب مقابلة لتقييم اللغة",
      sort_order: 3,
      is_enabled: true,
      tenant_id: tenantId,
    },

    // === FOUNDATION — Arabic ===
    {
      program_id: foundationId,
      certificate_type_id: arabicCertId,
      rule_type: "high_school",
      config: {},
      effect: "blocks_admission",
      effect_message: "الطالب لا يملك شهادة ثانوية",
      sort_order: 1,
      is_enabled: true,
      tenant_id: tenantId,
    },

    // === FOUNDATION — British ===
    {
      program_id: foundationId,
      certificate_type_id: britishCertId,
      rule_type: "a_levels",
      config: { subjects_min: 3 },
      effect: "blocks_admission",
      effect_message: "يحتاج 3 مواد A Level على الأقل",
      sort_order: 1,
      is_enabled: true,
      tenant_id: tenantId,
    },

    // === MASTER — Universal ===
    {
      program_id: masterId,
      certificate_type_id: null,
      rule_type: "bachelor",
      config: {},
      effect: "blocks_admission",
      effect_message: "الطالب لا يملك شهادة بكالوريوس",
      sort_order: 1,
      is_enabled: true,
      tenant_id: tenantId,
    },
    {
      program_id: masterId,
      certificate_type_id: null,
      rule_type: "language_cert",
      config: { cert_type: "ielts", min_score: 6.5, alternatives: { Duolingo: 110 } },
      effect: "makes_conditional",
      effect_message: "سيتم ترتيب مقابلة لتقييم اللغة",
      sort_order: 2,
      is_enabled: true,
      tenant_id: tenantId,
    },
  ];

  const { error: insertRulesErr, count: insertedRules } = await supabase
    .from("requirement_rules")
    .insert(rules, { count: "exact" });

  if (insertRulesErr) {
    console.error("❌ خطأ في إدراج القواعد:", insertRulesErr.message);
    process.exit(1);
  }
  console.log(`   ✅ تم إدراج ${insertedRules} قاعدة`);

  // 7. INSERT scholarship_tiers (Bachelor Arabic only)
  console.log("\n💰 إدراج شرائح المنح...");

  const tiers = [
    {
      program_id: bachelorId,
      certificate_type_id: arabicCertId,
      tenant_id: tenantId,
      min_gpa: 95,
      max_gpa: 100,
      scholarship_percent: 35,
      label: "7000 يورو",
      sort_order: 1,
    },
    {
      program_id: bachelorId,
      certificate_type_id: arabicCertId,
      tenant_id: tenantId,
      min_gpa: 90,
      max_gpa: 94.99,
      scholarship_percent: 25,
      label: "5000 يورو",
      sort_order: 2,
    },
    {
      program_id: bachelorId,
      certificate_type_id: arabicCertId,
      tenant_id: tenantId,
      min_gpa: 85,
      max_gpa: 89.99,
      scholarship_percent: 15,
      label: "3000-5000 يورو",
      sort_order: 3,
    },
    {
      program_id: bachelorId,
      certificate_type_id: arabicCertId,
      tenant_id: tenantId,
      min_gpa: 80,
      max_gpa: 84.99,
      scholarship_percent: 15,
      label: "3000 يورو",
      sort_order: 4,
    },
    {
      program_id: bachelorId,
      certificate_type_id: arabicCertId,
      tenant_id: tenantId,
      min_gpa: 0,
      max_gpa: 79.99,
      scholarship_percent: 15,
      label: "3000 يورو محتملة",
      sort_order: 5,
    },
  ];

  const { error: insertTiersErr, count: insertedTiers } = await supabase
    .from("scholarship_tiers")
    .insert(tiers, { count: "exact" });

  if (insertTiersErr) {
    console.error("❌ خطأ في إدراج شرائح المنح:", insertTiersErr.message);
    process.exit(1);
  }
  console.log(`   ✅ تم إدراج ${insertedTiers} شريحة منحة`);

  // 8. Summary
  console.log("\n========================================");
  console.log("📊 ملخص:");
  console.log(`   القواعد: ${insertedRules}`);
  console.log(`   شرائح المنح: ${insertedTiers}`);
  console.log("========================================");
  console.log("✅ تمت إعادة التعبئة بنجاح!");
}

main().catch((err) => {
  console.error("❌ خطأ غير متوقع:", err);
  process.exit(1);
});
