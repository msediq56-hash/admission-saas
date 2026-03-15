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

  // 2. Get certificate type IDs
  console.log("Fetching certificate types...");
  const { data: certTypes, error: certErr } = await supabase
    .from("certificate_types")
    .select("id, slug")
    .eq("is_system", true);

  if (certErr || !certTypes) {
    console.error("Certificate types not found:", certErr?.message);
    console.error("Did you run migration 003_certificate_types.sql?");
    process.exit(1);
  }

  const certTypeMap = new Map(certTypes.map((ct) => [ct.slug, ct.id]));
  const arabicCertId = certTypeMap.get("arabic");
  const britishCertId = certTypeMap.get("british");

  if (!arabicCertId || !britishCertId) {
    console.error("Missing arabic or british certificate types");
    process.exit(1);
  }
  console.log(`Arabic cert ID: ${arabicCertId}`);
  console.log(`British cert ID: ${britishCertId}\n`);

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

  // Helper to insert majors for a program
  async function insertMajors(
    programId: string,
    majors: Array<{
      name_ar: string;
      name_en?: string;
      group_code: string;
      sort_order: number;
    }>,
    subjectRequirements?: Record<
      string, // group_code
      Array<{
        certificate_type_id: string;
        question_text: string;
        question_type: string;
        effect: string;
        negative_message?: string;
        positive_message?: string;
        sort_order: number;
      }>
    >
  ) {
    for (const major of majors) {
      const { data: majorRow, error: majorErr } = await supabase
        .from("majors")
        .insert({
          program_id: programId,
          tenant_id: tid,
          name_ar: major.name_ar,
          name_en: major.name_en || null,
          group_code: major.group_code,
          sort_order: major.sort_order,
        })
        .select("id")
        .single();
      if (majorErr) {
        console.error(`  Error creating major ${major.name_ar}:`, majorErr.message);
        process.exit(1);
      }

      // Insert subject requirements for this major's group
      const groupReqs = subjectRequirements?.[major.group_code];
      if (groupReqs?.length) {
        const rows = groupReqs.map((sr) => ({
          major_id: majorRow.id,
          tenant_id: tid,
          certificate_type_id: sr.certificate_type_id,
          question_text: sr.question_text,
          question_type: sr.question_type,
          effect: sr.effect,
          negative_message: sr.negative_message || null,
          positive_message: sr.positive_message || null,
          sort_order: sr.sort_order,
        }));
        const { error: srErr } = await supabase
          .from("major_subject_requirements")
          .insert(rows);
        if (srErr) {
          console.error(`  Error creating subject reqs for ${major.name_ar}:`, srErr.message);
          process.exit(1);
        }
      }
    }
    console.log(`    Majors created (${majors.length})`);
  }

  // Helper to insert program + requirements + custom_requirements + scholarship_tiers
  async function insertProgram(
    universityId: string,
    program: {
      name: string;
      category: string;
      complexity: string;
      sortOrder: number;
      certificateTypeId?: string;
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
        certificate_type_id: program.certificateTypeId || null,
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

    return pid;
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

  // Constructor majors data (18 majors, 4 groups)
  const constructorMajors = [
    { name_ar: "الكيمياء الحيوية وبيولوجيا الخلية", name_en: "biochem_cell_bio", group_code: "G1", sort_order: 1 },
    { name_ar: "الكيمياء والتكنولوجيا الحيوية", name_en: "chem_biotech", group_code: "G1", sort_order: 2 },
    { name_ar: "الكيمياء الدوائية والبيولوجيا الكيميائية", name_en: "pharma_chem_bio", group_code: "G1", sort_order: 3 },
    { name_ar: "علوم الأرض والإدارة المستدامة", name_en: "earth_sci_sustainability", group_code: "G1", sort_order: 4 },
    { name_ar: "الرياضيات والنمذجة", name_en: "math_modeling", group_code: "G2", sort_order: 5 },
    { name_ar: "الفيزياء وعلوم البيانات", name_en: "physics_data_sci", group_code: "G2", sort_order: 6 },
    { name_ar: "علوم الحاسوب (المسار الأول)", name_en: "cs_1", group_code: "G2", sort_order: 7 },
    { name_ar: "علوم الحاسوب (المسار الثاني)", name_en: "cs_2", group_code: "G2", sort_order: 8 },
    { name_ar: "علوم الحاسوب (المسار الثالث)", name_en: "cs_3", group_code: "G2", sort_order: 9 },
    { name_ar: "البرمجيات والبيانات", name_en: "software_data", group_code: "G2", sort_order: 10 },
    { name_ar: "الهندسة الكهربائية", name_en: "electrical_eng", group_code: "G2", sort_order: 11 },
    { name_ar: "الروبوتات", name_en: "robotics", group_code: "G2", sort_order: 12 },
    { name_ar: "الهندسة الصناعية", name_en: "industrial_eng", group_code: "G2", sort_order: 13 },
    { name_ar: "الإدارة واتخاذ القرار", name_en: "mgmt_decision", group_code: "G2", sort_order: 14 },
    { name_ar: "الاقتصاد العالمي والإدارة", name_en: "global_econ_mgmt", group_code: "G3", sort_order: 15 },
    { name_ar: "علم النفس الاجتماعي والمعرفي المتكامل", name_en: "social_cog_psych", group_code: "G3", sort_order: 16 },
    { name_ar: "إدارة الأعمال الدولية", name_en: "intl_business", group_code: "G3", sort_order: 17 },
    { name_ar: "العلاقات الدولية: السياسة والتاريخ", name_en: "intl_relations", group_code: "G4", sort_order: 18 },
  ];

  // British certificate subject requirements per group
  const britishSubjectReqs: Record<string, Array<{
    certificate_type_id: string;
    question_text: string;
    question_type: string;
    effect: string;
    negative_message: string;
    sort_order: number;
  }>> = {
    G1: [
      {
        certificate_type_id: britishCertId,
        question_text: "هل لدى الطالب مادتان من: رياضيات / أحياء / كيمياء / فيزياء / حاسب؟",
        question_type: "yes_no",
        effect: "blocks_admission",
        negative_message: "لا يستوفي شروط المواد المطلوبة للتخصص",
        sort_order: 1,
      },
    ],
    G2: [
      {
        certificate_type_id: britishCertId,
        question_text: "هل لدى الطالب A Level رياضيات بدرجة C أو أعلى؟",
        question_type: "yes_no",
        effect: "blocks_admission",
        negative_message: "لا يستوفي شروط المواد المطلوبة للتخصص",
        sort_order: 1,
      },
      {
        certificate_type_id: britishCertId,
        question_text: "هل لدى الطالب مادة من: أحياء / كيمياء / فيزياء / حاسب؟",
        question_type: "yes_no",
        effect: "blocks_admission",
        negative_message: "لا يستوفي شروط المواد المطلوبة للتخصص",
        sort_order: 2,
      },
    ],
    G3: [
      {
        certificate_type_id: britishCertId,
        question_text: "هل لدى الطالب مادة من: تاريخ / جغرافيا / سياسة / اقتصاد؟",
        question_type: "yes_no",
        effect: "blocks_admission",
        negative_message: "لا يستوفي شروط المواد المطلوبة للتخصص",
        sort_order: 1,
      },
      {
        certificate_type_id: britishCertId,
        question_text: "هل لدى الطالب مادة من: رياضيات / أحياء / كيمياء / فيزياء / حاسب؟",
        question_type: "yes_no",
        effect: "blocks_admission",
        negative_message: "لا يستوفي شروط المواد المطلوبة للتخصص",
        sort_order: 2,
      },
    ],
    G4: [
      {
        certificate_type_id: britishCertId,
        question_text: "هل لدى الطالب مادة من: لغة / تاريخ / جغرافيا / سياسة / اقتصاد؟",
        question_type: "yes_no",
        effect: "blocks_admission",
        negative_message: "لا يستوفي شروط المواد المطلوبة للتخصص",
        sort_order: 1,
      },
    ],
  };

  // 1.1 Bachelor — Arabic certificates
  const constructorBachelorArabicId = await insertProgram(constructorId, {
    name: "بكالوريوس — شهادات عربية",
    category: "bachelor",
    complexity: "simple",
    sortOrder: 1,
    certificateTypeId: arabicCertId,
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

  // Majors for Arabic bachelor — no subject requirements
  await insertMajors(constructorBachelorArabicId, constructorMajors);

  // 1.2 Bachelor — British certificate
  const constructorBachelorBritishId = await insertProgram(constructorId, {
    name: "بكالوريوس — شهادة بريطانية",
    category: "bachelor",
    complexity: "complex",
    sortOrder: 2,
    certificateTypeId: britishCertId,
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
      a_level_subjects_min: 3,
      a_level_min_grade: "C",
      a_level_requires_core: true,
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

  // Majors for British bachelor — WITH subject requirements per group
  await insertMajors(constructorBachelorBritishId, constructorMajors, britishSubjectReqs);

  // 1.3 Foundation — Arabic certificates
  await insertProgram(constructorId, {
    name: "سنة تأسيسية — شهادات عربية",
    category: "foundation",
    complexity: "simple",
    sortOrder: 3,
    certificateTypeId: arabicCertId,
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
    certificateTypeId: britishCertId,
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
    certificateTypeId: arabicCertId,
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
    certificateTypeId: arabicCertId,
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
    certificateTypeId: arabicCertId,
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
    certificateTypeId: arabicCertId,
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
    certificateTypeId: arabicCertId,
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
    certificateTypeId: arabicCertId,
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
    certificateTypeId: arabicCertId,
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
    certificateTypeId: arabicCertId,
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
    certificateTypeId: arabicCertId,
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
    certificateTypeId: arabicCertId,
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
    certificateTypeId: arabicCertId,
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
    certificateTypeId: arabicCertId,
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
  console.log("3 universities, 17 programs, 36 majors seeded.");
  console.log("========================================");
}

main();
