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

  // Helper to insert a program (no requirements — those are inserted separately)
  async function insertProgram(
    universityId: string,
    program: {
      name: string;
      category: string;
      complexity: string;
      sortOrder: number;
      certificateTypeId?: string | null;
    }
  ): Promise<string> {
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
    return prog.id;
  }

  // Helper to insert a requirement row (now with certificate_type_id)
  async function insertRequirement(
    programId: string,
    certificateTypeId: string | null,
    requirements: Record<string, unknown>
  ) {
    const { error: reqErr } = await supabase.from("requirements").insert({
      program_id: programId,
      tenant_id: tid,
      certificate_type_id: certificateTypeId,
      ...requirements,
    });
    if (reqErr) {
      console.error(`  Error creating requirements:`, reqErr.message);
      process.exit(1);
    }
    const label = certificateTypeId ? `(cert: ${certificateTypeId.slice(0, 8)}...)` : "(all certs)";
    console.log(`    Requirements created ${label}`);
  }

  // Helper to insert custom requirements (now with certificate_type_id)
  async function insertCustomRequirements(
    programId: string,
    certificateTypeId: string | null,
    customReqs: Array<{
      question_text: string;
      question_type: string;
      options?: unknown;
      effect: string;
      negative_message?: string;
      positive_message?: string;
      sort_order: number;
      option_effects?: unknown;
    }>
  ) {
    const rows = customReqs.map((cr) => ({
      program_id: programId,
      tenant_id: tid,
      certificate_type_id: certificateTypeId,
      ...cr,
    }));
    const { error: crErr } = await supabase
      .from("custom_requirements")
      .insert(rows);
    if (crErr) {
      console.error(`  Error creating custom requirements:`, crErr.message);
      process.exit(1);
    }
    console.log(`    Custom requirements created (${customReqs.length})`);
  }

  // Helper to insert scholarship tiers (now with certificate_type_id)
  async function insertScholarshipTiers(
    programId: string,
    certificateTypeId: string | null,
    tiers: Array<{
      min_gpa: number;
      max_gpa: number;
      scholarship_percent: number;
      label: string;
      sort_order: number;
    }>
  ) {
    const rows = tiers.map((st) => ({
      program_id: programId,
      tenant_id: tid,
      certificate_type_id: certificateTypeId,
      ...st,
    }));
    const { error: stErr } = await supabase
      .from("scholarship_tiers")
      .insert(rows);
    if (stErr) {
      console.error(`  Error creating scholarship tiers:`, stErr.message);
      process.exit(1);
    }
    console.log(`    Scholarship tiers created (${tiers.length})`);
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

  // Shared scholarship tiers for Constructor bachelor (Arabic cert path)
  const constructorScholarshipTiers = [
    { min_gpa: 95, max_gpa: 100, scholarship_percent: 35, label: "7000 يورو", sort_order: 1 },
    { min_gpa: 90, max_gpa: 94.99, scholarship_percent: 25, label: "5000 يورو", sort_order: 2 },
    { min_gpa: 85, max_gpa: 89.99, scholarship_percent: 15, label: "3000-5000 يورو", sort_order: 3 },
    { min_gpa: 80, max_gpa: 84.99, scholarship_percent: 15, label: "3000 يورو", sort_order: 4 },
    { min_gpa: 0, max_gpa: 79.99, scholarship_percent: 15, label: "3000 يورو محتملة", sort_order: 5 },
  ];

  // -----------------------------------------------
  // 1.1 Bachelor (ONE program, TWO requirement rows)
  // -----------------------------------------------
  const constructorBachelorId = await insertProgram(constructorId, {
    name: "بكالوريوس",
    category: "bachelor",
    complexity: "complex",
    sortOrder: 1,
    certificateTypeId: null, // no longer on program — moved to requirements
  });

  // Bachelor — Arabic certificate requirements
  await insertRequirement(constructorBachelorId, arabicCertId, {
    requires_hs: true,
    requires_sat: true,
    sat_min: 1200,
    sat_effect: "conditional: يحتاج تقديم SAT بدرجة 1200+ قبل 31 ديسمبر",
    requires_ielts: true,
    ielts_min: 6.5,
    ielts_effect: "interview: سيتم ترتيب مقابلة لتقييم اللغة",
    requires_gpa: true,
    gpa_min: 80,
    gpa_effect: "scholarship",
    ielts_alternatives: { duolingo: 110 },
    result_notes: "الرسوم: 20,000 يورو/سنة",
  });

  // Bachelor — Arabic certificate scholarship tiers
  await insertScholarshipTiers(constructorBachelorId, arabicCertId, constructorScholarshipTiers);

  // Bachelor — British certificate requirements
  await insertRequirement(constructorBachelorId, britishCertId, {
    requires_hs: true,
    requires_sat: true,
    sat_min: 1200,
    sat_effect: "conditional: يحتاج تقديم SAT بدرجة 1200+ قبل 31 ديسمبر",
    requires_ielts: true,
    ielts_min: 6.5,
    ielts_effect: "interview: سيتم ترتيب مقابلة لتقييم اللغة",
    ielts_alternatives: { duolingo: 110 },
    result_notes: "الرسوم: 20,000 يورو/سنة",
    a_level_subjects_min: 3,
    a_level_min_grade: "C",
    a_level_requires_core: true,
  });

  // Bachelor — British certificate custom requirements (A Level questions)
  await insertCustomRequirements(constructorBachelorId, britishCertId, [
    {
      question_text: "هل لدى الطالب 3 مواد A Level؟",
      question_type: "yes_no",
      effect: "blocks_admission",
      negative_message: "غير مؤهل — يحتاج 3 مواد A Level. جرّب السنة التأسيسية IFY",
      sort_order: 1,
    },
    {
      question_text: "هل جميع المواد الثلاثة بدرجة C أو أعلى؟",
      question_type: "yes_no",
      effect: "blocks_admission",
      negative_message: "درجات أقل من C — جرّب مسار السنة التأسيسية IFY",
      sort_order: 2,
    },
    {
      question_text: "هل لدى الطالب مادتان من المواد الأساسية المعترف بها؟",
      question_type: "yes_no",
      effect: "blocks_admission",
      negative_message: "لا يستوفي شرط المواد الأساسية",
      sort_order: 3,
    },
  ]);

  // Majors — shared by both cert paths, subject reqs apply to British only
  await insertMajors(constructorBachelorId, constructorMajors, britishSubjectReqs);

  // -----------------------------------------------
  // 1.2 Foundation (ONE program, TWO requirement rows)
  // -----------------------------------------------
  const constructorFoundationId = await insertProgram(constructorId, {
    name: "سنة تأسيسية",
    category: "foundation",
    complexity: "simple",
    sortOrder: 2,
    certificateTypeId: null,
  });

  // Foundation — Arabic certificate requirements
  await insertRequirement(constructorFoundationId, arabicCertId, {
    requires_hs: true,
    result_notes: "الرسوم: 13,000 يورو",
  });

  // Foundation — British certificate requirements
  await insertRequirement(constructorFoundationId, britishCertId, {
    requires_hs: true,
    result_notes: "الرسوم: 13,000 يورو",
  });

  // Foundation — British certificate custom requirements
  await insertCustomRequirements(constructorFoundationId, britishCertId, [
    {
      question_text: "هل لدى الطالب 3 مواد A Level؟",
      question_type: "yes_no",
      effect: "blocks_admission",
      negative_message: "يحتاج 3 مواد A Level — قد يحتاج مسار بديل",
      sort_order: 1,
    },
  ]);

  // -----------------------------------------------
  // 1.3 Master (ONE program, ONE requirement row — all certs)
  // -----------------------------------------------
  await insertProgram(constructorId, {
    name: "ماجستير",
    category: "master",
    complexity: "simple",
    sortOrder: 3,
    certificateTypeId: null,
  }).then(async (pid) => {
    await insertRequirement(pid, null, {
      requires_hs: false,
      requires_bachelor: true,
      requires_ielts: true,
      ielts_min: 6.5,
      ielts_effect: "interview: سيتم ترتيب مقابلة لتقييم اللغة",
      ielts_alternatives: { duolingo: 110 },
      result_notes: "يحتاج اختيار البرنامج في التقييم التفصيلي",
    });
  });

  // =============================================
  // UNIVERSITY 2: SRH
  // (Keep existing structure, requirements get certificate_type_id = null)
  // =============================================
  const srhId = await insertUniversity(
    "جامعة SRH",
    "ألمانيا",
    "private",
    2
  );

  // 2.1 IEF
  const srhIefId = await insertProgram(srhId, {
    name: "برنامج اللغة الإنجليزية التأسيسي المكثف (IEF)",
    category: "foundation",
    complexity: "hybrid",
    sortOrder: 1,
    certificateTypeId: arabicCertId,
  });
  await insertRequirement(srhIefId, null, {
    requires_hs: true,
    requires_ielts: true,
    ielts_min: 4.0,
    ielts_effect: "blocks_if_below",
    result_notes: "الرسوم: 15,150 يورو (شاملة فصل اللغة + فصلين فاونديشن)",
  });
  await insertCustomRequirements(srhIefId, null, [
    {
      question_text: "هل مستوى اللغة أعلى من IELTS 5.0؟",
      question_type: "yes_no",
      effect: "makes_conditional",
      positive_message: "مستوى اللغة أعلى — جرّب الفاونديشن العادي",
      sort_order: 1,
    },
    {
      question_text: "هل مستوى اللغة IELTS 6.5 أو أعلى؟",
      question_type: "yes_no",
      effect: "makes_conditional",
      positive_message: "مؤهل للبكالوريوس المباشر",
      sort_order: 2,
    },
  ]);

  // 2.2 Foundation Business
  const srhFoundBizId = await insertProgram(srhId, {
    name: "فاونديشن في البزنس",
    category: "foundation",
    complexity: "simple",
    sortOrder: 2,
    certificateTypeId: arabicCertId,
  });
  await insertRequirement(srhFoundBizId, null, {
    requires_hs: true,
    requires_ielts: true,
    ielts_min: 5.0,
    ielts_effect: "blocks_if_below",
    result_notes: "الموقع: Berlin | القبول: أكتوبر ويناير",
  });

  // 2.3 Foundation Creative Studies
  const srhFoundCreativeId = await insertProgram(srhId, {
    name: "فاونديشن في الدراسات الإبداعية",
    category: "foundation",
    complexity: "simple",
    sortOrder: 3,
    certificateTypeId: arabicCertId,
  });
  await insertRequirement(srhFoundCreativeId, null, {
    requires_hs: true,
    requires_ielts: true,
    ielts_min: 5.0,
    ielts_effect: "blocks_if_below",
    result_notes: "الموقع: Berlin | القبول: أكتوبر ويناير",
  });

  // 2.4 Foundation Engineering & IT
  const srhFoundEngId = await insertProgram(srhId, {
    name: "فاونديشن الهندسة وتكنولوجيا المعلومات",
    category: "foundation",
    complexity: "simple",
    sortOrder: 4,
    certificateTypeId: arabicCertId,
  });
  await insertRequirement(srhFoundEngId, null, {
    requires_hs: true,
    requires_ielts: true,
    ielts_min: 5.0,
    ielts_effect: "blocks_if_below",
    result_notes: "الموقع: Berlin | القبول: أكتوبر ويناير",
  });

  // 2.5 Pre-Master
  const srhPreMasterId = await insertProgram(srhId, {
    name: "بري ماستر (ما قبل الماجستير)",
    category: "foundation",
    complexity: "simple",
    sortOrder: 5,
    certificateTypeId: arabicCertId,
  });
  await insertRequirement(srhPreMasterId, null, {
    requires_hs: false,
    requires_bachelor: true,
    requires_ielts: true,
    ielts_min: 5.5,
    ielts_effect: "blocks_if_below",
    result_notes: "الموقع: برلين | الرسوم: 5,950 يورو | المدة: فصل واحد",
  });

  // 2.6 Bachelor
  const srhBachelorId = await insertProgram(srhId, {
    name: "بكالوريوس",
    category: "bachelor",
    complexity: "simple",
    sortOrder: 6,
    certificateTypeId: arabicCertId,
  });
  await insertRequirement(srhBachelorId, null, {
    requires_hs: true,
    requires_ielts: true,
    ielts_min: 6.5,
    ielts_effect: "blocks_if_below",
    result_notes: "بعض البرامج تتطلب بورتفوليو أو أوديشن (يُحدد في التقييم التفصيلي)",
  });

  // 2.7 Master
  const srhMasterId = await insertProgram(srhId, {
    name: "ماجستير",
    category: "master",
    complexity: "simple",
    sortOrder: 7,
    certificateTypeId: arabicCertId,
  });
  await insertRequirement(srhMasterId, null, {
    requires_hs: false,
    requires_bachelor: true,
    requires_ielts: true,
    ielts_min: 6.5,
    ielts_effect: "blocks_if_below",
    result_notes: "بعض البرامج تتطلب خبرة عملية أو بورتفوليو",
  });
  await insertCustomRequirements(srhMasterId, null, [
    {
      question_text: "هل مستوى اللغة بين IELTS 5.5 و 6.4؟",
      question_type: "yes_no",
      effect: "makes_conditional",
      positive_message: "مؤهل للبري ماستر (فصل تحضيري ثم ماجستير)",
      sort_order: 1,
    },
  ]);

  // =============================================
  // UNIVERSITY 3: Debrecen
  // (Keep existing structure, requirements get certificate_type_id = null)
  // =============================================
  const debrecenId = await insertUniversity(
    "جامعة ديبريسن",
    "هنغاريا",
    "public",
    3
  );

  // 3.1 Foundation
  const debFoundId = await insertProgram(debrecenId, {
    name: "فاونديشن",
    category: "foundation",
    complexity: "simple",
    sortOrder: 1,
    certificateTypeId: arabicCertId,
  });
  await insertRequirement(debFoundId, null, {
    requires_hs: true,
    requires_12_years: true,
    result_notes: "رسوم تقديم: 150$ + رسوم امتحان: 350$ | 7 برامج تحضيرية متاحة",
  });

  // 3.2 Bachelor
  const debBachelorId = await insertProgram(debrecenId, {
    name: "بكالوريوس",
    category: "bachelor",
    complexity: "simple",
    sortOrder: 2,
    certificateTypeId: arabicCertId,
  });
  await insertRequirement(debBachelorId, null, {
    requires_hs: true,
    requires_12_years: true,
    requires_entrance_exam: true,
    result_notes: "رسوم تقديم: 150$ + رسوم امتحان: 350$ | الرسوم: 6,000-10,000$/سنة | 34 تخصصاً — مشروط بامتحان القبول",
  });

  // 3.3 Master
  const debMasterId = await insertProgram(debrecenId, {
    name: "ماجستير",
    category: "master",
    complexity: "simple",
    sortOrder: 3,
    certificateTypeId: arabicCertId,
  });
  await insertRequirement(debMasterId, null, {
    requires_hs: false,
    requires_bachelor: true,
    requires_ielts: true,
    ielts_min: 6.0,
    ielts_effect: "blocks_if_below",
    result_notes: "رسوم تقديم: 150$ + رسوم امتحان: 350$ | الرسوم: 5,500-10,000$/سنة | 43 تخصصاً",
  });

  // 3.4 PhD
  const debPhdId = await insertProgram(debrecenId, {
    name: "دكتوراة",
    category: "phd",
    complexity: "simple",
    sortOrder: 4,
    certificateTypeId: arabicCertId,
  });
  await insertRequirement(debPhdId, null, {
    requires_hs: false,
    requires_bachelor: true,
    requires_ielts: true,
    ielts_min: 6.0,
    ielts_effect: "blocks_if_below",
    requires_research_plan: true,
    result_notes: "رسوم تقديم: 150$ + رسوم امتحان: 350$ | 26 تخصصاً",
  });

  // 3.5 Medical / Pharmacy
  const debMedId = await insertProgram(debrecenId, {
    name: "طبيات / صيدلة",
    category: "bachelor",
    complexity: "simple",
    sortOrder: 5,
    certificateTypeId: arabicCertId,
  });
  await insertRequirement(debMedId, null, {
    requires_hs: true,
    requires_12_years: true,
    requires_entrance_exam: true,
    result_notes: "رسوم تقديم: 150$ + رسوم امتحان: 350$ | الرسوم: 8,000-17,500$/سنة | 3 برامج: طب، أسنان، صيدلة",
  });
  await insertCustomRequirements(debMedId, null, [
    {
      question_text: "ما هو اختيار مواد امتحان القبول؟",
      question_type: "select",
      options: ["أحياء + فيزياء", "أحياء + كيمياء"],
      effect: "makes_conditional",
      positive_message: "مشروط بدخول واجتياز امتحان القبول",
      sort_order: 1,
    },
  ]);

  console.log("\n========================================");
  console.log("Seed completed successfully!");
  console.log("3 universities, 15 programs, 18 majors seeded.");
  console.log("Constructor: 3 programs (bachelor, foundation, master)");
  console.log("  - Bachelor: 2 requirement rows (Arabic + British)");
  console.log("  - Foundation: 2 requirement rows (Arabic + British)");
  console.log("  - Master: 1 requirement row (all certs)");
  console.log("SRH: 7 programs (unchanged structure)");
  console.log("Debrecen: 5 programs (unchanged structure)");
  console.log("========================================");
}

main();
