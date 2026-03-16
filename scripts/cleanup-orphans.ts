#!/usr/bin/env npx tsx
// ============================================================
// Cleanup Script: Remove orphaned data and bad programs
//
// 1. Deletes requirement_rules where program_id not in programs
// 2. Deletes requirements where program_id not in programs
// 3. Deletes custom_requirements where program_id not in programs
// 4. Lists programs with empty/single-char names
//
// Usage: npx tsx scripts/cleanup-orphans.ts
// Requires: NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY
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

async function main() {
  console.log("🔍 جاري البحث عن البيانات اليتيمة...\n");

  // Get all valid program IDs
  const { data: programs, error: progError } = await supabase
    .from("programs")
    .select("id, name");

  if (progError) {
    console.error("❌ خطأ في تحميل البرامج:", progError.message);
    process.exit(1);
  }

  const validIds = new Set(programs.map((p) => p.id));
  console.log(`✅ عدد البرامج الموجودة: ${validIds.size}\n`);

  // 1. Clean orphaned requirement_rules
  {
    const { data: rules } = await supabase
      .from("requirement_rules")
      .select("id, program_id");

    if (rules) {
      const orphaned = rules.filter((r) => !validIds.has(r.program_id));
      if (orphaned.length > 0) {
        console.log(`🗑️  حذف ${orphaned.length} قاعدة يتيمة (requirement_rules)...`);
        for (const r of orphaned) {
          await supabase.from("requirement_rules").delete().eq("id", r.id);
        }
        console.log("   ✅ تم الحذف");
      } else {
        console.log("✅ لا توجد قواعد يتيمة (requirement_rules)");
      }
    }
  }

  // 2. Clean orphaned requirements
  {
    const { data: reqs } = await supabase
      .from("requirements")
      .select("id, program_id");

    if (reqs) {
      const orphaned = reqs.filter((r) => !validIds.has(r.program_id));
      if (orphaned.length > 0) {
        console.log(`🗑️  حذف ${orphaned.length} متطلب يتيم (requirements)...`);
        for (const r of orphaned) {
          await supabase.from("requirements").delete().eq("id", r.id);
        }
        console.log("   ✅ تم الحذف");
      } else {
        console.log("✅ لا توجد متطلبات يتيمة (requirements)");
      }
    }
  }

  // 3. Clean orphaned custom_requirements
  {
    const { data: customs } = await supabase
      .from("custom_requirements")
      .select("id, program_id");

    if (customs) {
      const orphaned = customs.filter((r) => !validIds.has(r.program_id));
      if (orphaned.length > 0) {
        console.log(`🗑️  حذف ${orphaned.length} شرط مخصص يتيم (custom_requirements)...`);
        for (const r of orphaned) {
          await supabase.from("custom_requirements").delete().eq("id", r.id);
        }
        console.log("   ✅ تم الحذف");
      } else {
        console.log("✅ لا توجد شروط مخصصة يتيمة (custom_requirements)");
      }
    }
  }

  // 4. List programs with bad names (empty or single-char)
  {
    const badPrograms = programs.filter(
      (p) => !p.name || p.name.trim().length < 2
    );
    if (badPrograms.length > 0) {
      console.log(`\n⚠️  برامج بأسماء غير صالحة (حرف واحد أو فارغة):`);
      for (const p of badPrograms) {
        console.log(`   - ID: ${p.id}, الاسم: "${p.name}"`);
      }
      console.log(`\n   لتعطيل هذه البرامج، قم بتشغيل:`);
      console.log(`   UPDATE programs SET is_active = false WHERE name IS NULL OR LENGTH(TRIM(name)) < 2;`);

      // Auto-deactivate bad programs
      console.log(`\n🔧 جاري تعطيل البرامج ذات الأسماء غير الصالحة...`);
      for (const p of badPrograms) {
        await supabase
          .from("programs")
          .update({ is_active: false })
          .eq("id", p.id);
      }
      console.log("   ✅ تم تعطيل البرامج");
    } else {
      console.log("\n✅ جميع البرامج لها أسماء صالحة");
    }
  }

  console.log("\n✅ اكتملت عملية التنظيف");
}

main().catch((err) => {
  console.error("❌ خطأ غير متوقع:", err);
  process.exit(1);
});
