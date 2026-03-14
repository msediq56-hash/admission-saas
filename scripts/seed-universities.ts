import { createClient } from "@supabase/supabase-js";
import { config } from "dotenv";

config({ path: ".env.local" });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!supabaseUrl || !serviceRoleKey) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

async function main() {
  // 1. Get tenant
  console.log("Fetching tenant 'United Education'...");
  const { data: tenant, error: tenantErr } = await supabase
    .from("tenants")
    .select("id")
    .eq("slug", "united-education")
    .single();

  if (tenantErr || !tenant) {
    console.error("Tenant not found:", tenantErr?.message);
    process.exit(1);
  }
  const tid = tenant.id;
  console.log(`Tenant ID: ${tid}\n`);

  // Helper to insert university
  async function insertUniversity(
    name: string,
    country: string,
    type: string,
    sortOrder: number
  ): Promise<string> {
    console.log(`--- Creating university: ${name} ---`);
    const { data, error } = await supabase
      .from("universities")
      .insert({ tenant_id: tid, name, country, type, sort_order: sortOrder })
      .select("id")
      .single();
    if (error) {
      console.error(`Error creating university ${name}:`, error.message);
      process.exit(1);
    }
    console.log(`University ID: ${data.id}`);
    return data.id;
  }

  // Helper to insert program + requirements + custom_requirements + scholarship_tiers
  async function insertProgram(
    universityId: string,
    program: {
      name: string;
      category: string;
      complexity: string;
      sortOrder: number;
      requirements: Record<string, unknown>;
      customRequirements?: Array<{
        question_text: string;
        question_type: string;
        options?: unknown;
        effect: string;
        negative_message?: string;
        positive_message?: string;
        sort_order: number;
      }>;
      scholarshipTiers?: Array<{
        min_gpa: number;
        max_gpa: number;
        scholarship_percent: number;
        label: string;
        sort_order: number;
      }>;
    }
  ) {
    console.log(`  Program: ${program.name}`);
    const { data: prog, error: progErr } = await supabase
      .from("programs")
      .insert({
        university_id: universityId,
        tenant_id: tid,
        name: program.name,
        category: program.category,
        complexity_level: program.complexity,
        sort_order: program.sortOrder,
      })
      .select("id")
      .single();
    if (progErr) {
      console.error(`  Error creating program:`, progErr.message);
      process.exit(1);
    }
    const pid = prog.id;

    // Requirements
    const { error: reqErr } = await supabase.from("requirements").insert({
      program_id: pid,
      tenant_id: tid,
      ...program.requirements,
    });
    if (reqErr) {
      console.error(`  Error creating requirements:`, reqErr.message);
      process.exit(1);
    }
    console.log(`    Requirements created`);

    // Custom requirements
    if (program.customRequirements?.length) {
      const rows = program.customRequirements.map((cr) => ({
        program_id: pid,
        tenant_id: tid,
        ...cr,
      }));
      const { error: crErr } = await supabase
        .from("custom_requirements")
        .insert(rows);
      if (crErr) {
        console.error(`  Error creating custom requirements:`, crErr.message);
        process.exit(1);
      }
      console.log(
        `    Custom requirements created (${program.customRequirements.length})`
      );
    }

    // Scholarship tiers
    if (program.scholarshipTiers?.length) {
      const rows = program.scholarshipTiers.map((st) => ({
        program_id: pid,
        tenant_id: tid,
        ...st,
      }));
      const { error: stErr } = await supabase
        .from("scholarship_tiers")
        .insert(rows);
      if (stErr) {
        console.error(`  Error creating scholarship tiers:`, stErr.message);
        process.exit(1);
      }
      console.log(
        `    Scholarship tiers created (${program.scholarshipTiers.length})`
      );
    }
  }

  // =============================================
  // UNIVERSITY 1: Constructor University
  // =============================================
  const constructorId = await insertUniversity(
    "جامعة كونستركتر",
    "ألمانيا",
    "private",
    1
  );

  // 1.1 Bachelor — Arabic certificates
  await insertProgram(constructorId, {
    name: "بكالوريوس — شهادات عربية",
    category: "bachelor",
    complexity: "simple",
    sortOrder: 1,
    requirements: {
      requires_hs: true,
      requires_sat: true,
      sat_min: 1200,
      sat_effect:
        "conditional: يحتاج تقديم SAT بدرجة 1200+ قبل 31 ديسمبر",
      requires_ielts: true,
      ielts_min: 6.5,
      ielts_effect: "interview: سيتم ترتيب مقابلة لتقييم اللغة",
      requires_gpa: true,
      gpa_min: 80,
      gpa_effect: "scholarship",
      ielts_alternatives: { duolingo: 110 },
      result_notes: "الرسوم: 20,000 يورو/سنة",
    },
    scholarshipTiers: [
      {
        min_gpa: 95,
        max_gpa: 100,
        scholarship_percent: 35,
        label: "7000 يورو",
        sort_order: 1,
      },
      {
        min_gpa: 90,
        max_gpa: 94.99,
        scholarship_percent: 25,
        label: "5000 يورو",
        sort_order: 2,
      },
      {
        min_gpa: 85,
        max_gpa: 89.99,
        scholarship_percent: 15,
        label: "3000-5000 يورو",
        sort_order: 3,
      },
      {
        min_gpa: 80,
        max_gpa: 84.99,
        scholarship_percent: 15,
        label: "3000 يورو",
        sort_order: 4,
      },
      {
        min_gpa: 0,
        max_gpa: 79.99,
        scholarship_percent: 15,
        label: "3000 يورو محتملة",
        sort_order: 5,
      },
    ],
  });

  // 1.2 Bachelor — British certificate
  await insertProgram(constructorId, {
    name: "بكالوريوس — شهادة بريطانية",
    category: "bachelor",
    complexity: "complex",
    sortOrder: 2,
    requirements: {
      requires_hs: true,
      requires_sat: true,
      sat_min: 1200,
      sat_effect:
        "conditional: يحتاج تقديم SAT بدرجة 1200+ قبل 31 ديسمبر",
      requires_ielts: true,
      ielts_min: 6.5,
      ielts_effect: "interview: سيتم ترتيب مقابلة لتقييم اللغة",
      ielts_alternatives: { duolingo: 110 },
      result_notes: "الرسوم: 20,000 يورو/سنة",
    },
    customRequirements: [
      {
        question_text: "هل لدى الطالب 3 مواد A Level؟",
        question_type: "yes_no",
        effect: "blocks_admission",
        negative_message:
          "غير مؤهل — يحتاج 3 مواد A Level. جرّب السنة التأسيسية IFY",
        sort_order: 1,
      },
      {
        question_text: "هل جميع المواد الثلاثة بدرجة C أو أعلى؟",
        question_type: "yes_no",
        effect: "blocks_admission",
        negative_message:
          "درجات أقل من C — جرّب مسار السنة التأسيسية IFY",
        sort_order: 2,
      },
      {
        question_text:
          "هل لدى الطالب مادتان من المواد الأساسية المعترف بها؟",
        question_type: "yes_no",
        effect: "blocks_admission",
        negative_message: "لا يستوفي شرط المواد الأساسية",
        sort_order: 3,
      },
    ],
  });

  // 1.3 Foundation — Arabic certificates
  await insertProgram(constructorId, {
    name: "سنة تأسيسية — شهادات عربية",
    category: "foundation",
    complexity: "simple",
    sortOrder: 3,
    requirements: {
      requires_hs: true,
      result_notes: "الرسوم: 13,000 يورو",
    },
  });

  // 1.4 Foundation — British certificate
  await insertProgram(constructorId, {
    name: "سنة تأسيسية — شهادة بريطانية",
    category: "foundation",
    complexity: "simple",
    sortOrder: 4,
    requirements: {
      requires_hs: true,
      result_notes: "الرسوم: 13,000 يورو",
    },
    customRequirements: [
      {
        question_text: "هل لدى الطالب 3 مواد A Level؟",
        question_type: "yes_no",
        effect: "blocks_admission",
        negative_message:
          "يحتاج 3 مواد A Level — قد يحتاج مسار بديل",
        sort_order: 1,
      },
    ],
  });

  // 1.5 Master
  await insertProgram(constructorId, {
    name: "ماجستير",
    category: "master",
    complexity: "simple",
    sortOrder: 5,
    requirements: {
      requires_hs: false,
      requires_bachelor: true,
      requires_ielts: true,
      ielts_min: 6.5,
      ielts_effect: "interview: سيتم ترتيب مقابلة لتقييم اللغة",
      ielts_alternatives: { duolingo: 110 },
      result_notes: "يحتاج اختيار البرنامج في التقييم التفصيلي",
    },
  });

  // =============================================
  // UNIVERSITY 2: SRH
  // =============================================
  const srhId = await insertUniversity(
    "جامعة SRH",
    "ألمانيا",
    "private",
    2
  );

  // 2.1 IEF
  await insertProgram(srhId, {
    name: "برنامج اللغة الإنجليزية التأسيسي المكثف (IEF)",
    category: "foundation",
    complexity: "hybrid",
    sortOrder: 1,
    requirements: {
      requires_hs: true,
      requires_ielts: true,
      ielts_min: 4.0,
      ielts_effect: "blocks_if_below",
      result_notes:
        "الرسوم: 15,150 يورو (شاملة فصل اللغة + فصلين فاونديشن)",
    },
    customRequirements: [
      {
        question_text: "هل مستوى اللغة أعلى من IELTS 5.0؟",
        question_type: "yes_no",
        effect: "makes_conditional",
        positive_message:
          "مستوى اللغة أعلى — جرّب الفاونديشن العادي",
        sort_order: 1,
      },
      {
        question_text: "هل مستوى اللغة IELTS 6.5 أو أعلى؟",
        question_type: "yes_no",
        effect: "makes_conditional",
        positive_message: "مؤهل للبكالوريوس المباشر",
        sort_order: 2,
      },
    ],
  });

  // 2.2 Foundation Business
  await insertProgram(srhId, {
    name: "فاونديشن في البزنس",
    category: "foundation",
    complexity: "simple",
    sortOrder: 2,
    requirements: {
      requires_hs: true,
      requires_ielts: true,
      ielts_min: 5.0,
      ielts_effect: "blocks_if_below",
      result_notes: "الموقع: Berlin | القبول: أكتوبر ويناير",
    },
  });

  // 2.3 Foundation Creative Studies
  await insertProgram(srhId, {
    name: "فاونديشن في الدراسات الإبداعية",
    category: "foundation",
    complexity: "simple",
    sortOrder: 3,
    requirements: {
      requires_hs: true,
      requires_ielts: true,
      ielts_min: 5.0,
      ielts_effect: "blocks_if_below",
      result_notes: "الموقع: Berlin | القبول: أكتوبر ويناير",
    },
  });

  // 2.4 Foundation Engineering & IT
  await insertProgram(srhId, {
    name: "فاونديشن الهندسة وتكنولوجيا المعلومات",
    category: "foundation",
    complexity: "simple",
    sortOrder: 4,
    requirements: {
      requires_hs: true,
      requires_ielts: true,
      ielts_min: 5.0,
      ielts_effect: "blocks_if_below",
      result_notes: "الموقع: Berlin | القبول: أكتوبر ويناير",
    },
  });

  // 2.5 Pre-Master
  await insertProgram(srhId, {
    name: "بري ماستر (ما قبل الماجستير)",
    category: "foundation",
    complexity: "simple",
    sortOrder: 5,
    requirements: {
      requires_hs: false,
      requires_bachelor: true,
      requires_ielts: true,
      ielts_min: 5.5,
      ielts_effect: "blocks_if_below",
      result_notes:
        "الموقع: برلين | الرسوم: 5,950 يورو | المدة: فصل واحد",
    },
  });

  // 2.6 Bachelor
  await insertProgram(srhId, {
    name: "بكالوريوس",
    category: "bachelor",
    complexity: "simple",
    sortOrder: 6,
    requirements: {
      requires_hs: true,
      requires_ielts: true,
      ielts_min: 6.5,
      ielts_effect: "blocks_if_below",
      result_notes:
        "بعض البرامج تتطلب بورتفوليو أو أوديشن (يُحدد في التقييم التفصيلي)",
    },
  });

  // 2.7 Master
  await insertProgram(srhId, {
    name: "ماجستير",
    category: "master",
    complexity: "simple",
    sortOrder: 7,
    requirements: {
      requires_hs: false,
      requires_bachelor: true,
      requires_ielts: true,
      ielts_min: 6.5,
      ielts_effect: "blocks_if_below",
      result_notes:
        "بعض البرامج تتطلب خبرة عملية أو بورتفوليو",
    },
    customRequirements: [
      {
        question_text: "هل مستوى اللغة بين IELTS 5.5 و 6.4؟",
        question_type: "yes_no",
        effect: "makes_conditional",
        positive_message:
          "مؤهل للبري ماستر (فصل تحضيري ثم ماجستير)",
        sort_order: 1,
      },
    ],
  });

  // =============================================
  // UNIVERSITY 3: Debrecen
  // =============================================
  const debrecenId = await insertUniversity(
    "جامعة ديبريسن",
    "هنغاريا",
    "public",
    3
  );

  // 3.1 Foundation
  await insertProgram(debrecenId, {
    name: "فاونديشن",
    category: "foundation",
    complexity: "simple",
    sortOrder: 1,
    requirements: {
      requires_hs: true,
      requires_12_years: true,
      result_notes:
        "رسوم تقديم: 150$ + رسوم امتحان: 350$ | 7 برامج تحضيرية متاحة",
    },
  });

  // 3.2 Bachelor
  await insertProgram(debrecenId, {
    name: "بكالوريوس",
    category: "bachelor",
    complexity: "simple",
    sortOrder: 2,
    requirements: {
      requires_hs: true,
      requires_12_years: true,
      requires_entrance_exam: true,
      result_notes:
        "رسوم تقديم: 150$ + رسوم امتحان: 350$ | الرسوم: 6,000-10,000$/سنة | 34 تخصصاً — مشروط بامتحان القبول",
    },
  });

  // 3.3 Master
  await insertProgram(debrecenId, {
    name: "ماجستير",
    category: "master",
    complexity: "simple",
    sortOrder: 3,
    requirements: {
      requires_hs: false,
      requires_bachelor: true,
      requires_ielts: true,
      ielts_min: 6.0,
      ielts_effect: "blocks_if_below",
      result_notes:
        "رسوم تقديم: 150$ + رسوم امتحان: 350$ | الرسوم: 5,500-10,000$/سنة | 43 تخصصاً",
    },
  });

  // 3.4 PhD
  await insertProgram(debrecenId, {
    name: "دكتوراة",
    category: "phd",
    complexity: "simple",
    sortOrder: 4,
    requirements: {
      requires_hs: false,
      requires_bachelor: true,
      requires_ielts: true,
      ielts_min: 6.0,
      ielts_effect: "blocks_if_below",
      requires_research_plan: true,
      result_notes:
        "رسوم تقديم: 150$ + رسوم امتحان: 350$ | 26 تخصصاً",
    },
  });

  // 3.5 Medical / Pharmacy
  await insertProgram(debrecenId, {
    name: "طبيات / صيدلة",
    category: "bachelor",
    complexity: "simple",
    sortOrder: 5,
    requirements: {
      requires_hs: true,
      requires_12_years: true,
      requires_entrance_exam: true,
      result_notes:
        "رسوم تقديم: 150$ + رسوم امتحان: 350$ | الرسوم: 8,000-17,500$/سنة | 3 برامج: طب، أسنان، صيدلة",
    },
    customRequirements: [
      {
        question_text: "ما هو اختيار مواد امتحان القبول؟",
        question_type: "select",
        options: ["أحياء + فيزياء", "أحياء + كيمياء"],
        effect: "makes_conditional",
        positive_message:
          "مشروط بدخول واجتياز امتحان القبول",
        sort_order: 1,
      },
    ],
  });

  console.log("\n========================================");
  console.log("Seed completed successfully!");
  console.log("3 universities, 17 programs seeded.");
  console.log("========================================");
}

main();
