#!/usr/bin/env npx tsx
// ============================================================
// Offline Parity Check — compares old engine vs new rule engine
// Runs BOTH engines against the same inputs and reports differences
//
// Usage: npx tsx scripts/parity-check.ts
// No database needed — uses hardcoded test data
// ============================================================

import {
  evaluateProfileAgainstProgram,
  type StudentProfile,
  type ProgramEntry,
} from "../src/lib/comparison-engine";
import type { Requirement, CustomRequirement, ScholarshipTier } from "../src/lib/evaluation-engine";
import { evaluateRules, convertLegacyToRules } from "../src/lib/rules/engine";
import "../src/lib/rules/registry";
import type { RuleStudentInput } from "../src/lib/rules/types";

// ============================================================
// Helper: convert StudentProfile → RuleStudentInput
// ============================================================

function profileToRuleInput(profile: StudentProfile): RuleStudentInput {
  return {
    hasHighSchool: profile.hasHighSchool,
    has12Years: profile.has12Years,
    hasBachelor: profile.hasBachelor,
    certificateType: profile.certificateType,
    ielts: profile.ielts,
    hasSAT: profile.hasSAT,
    satScore: profile.satScore,
    gpa: profile.gpa,
    aLevelCount: profile.aLevelCount,
    aLevelCCount: profile.aLevelCCount,
    asLevelCount: profile.asLevelCount ?? null,
    oLevelCount: profile.oLevelCount ?? null,
    hasResearchPlan: profile.hasResearchPlan,
    dynamicAnswers: profile.dynamicAnswers,
    hasLanguageCert: profile.hasLanguageCert,
    languageCertType: profile.languageCertType,
    languageCertScore: profile.languageCertScore,
  };
}

// ============================================================
// Test data — same as v2-parity.test.ts
// ============================================================

function makeEntry(
  partial: Partial<ProgramEntry> & {
    programName: string;
    category: string;
    requirements: Requirement;
  }
): ProgramEntry {
  return {
    programId: partial.programId || crypto.randomUUID(),
    programName: partial.programName,
    universityName: partial.universityName || "جامعة تجريبية",
    country: partial.country || "ألمانيا",
    universityType: partial.universityType || "private",
    category: partial.category,
    certificateTypeSlug: partial.certificateTypeSlug ?? null,
    requirements: partial.requirements,
    customRequirements: partial.customRequirements || [],
    scholarshipTiers: partial.scholarshipTiers || [],
  };
}

const TENANT_ID = "00000000-0000-0000-0000-000000000001";

interface TestCase {
  name: string;
  entry: ProgramEntry;
  profile: StudentProfile;
}

const BASE_ARABIC: StudentProfile = {
  hasHighSchool: true,
  hasBachelor: false,
  has12Years: true,
  ielts: null,
  hasSAT: false,
  satScore: null,
  gpa: null,
  hasResearchPlan: false,
  certificateType: "arabic",
  aLevelCount: null,
  aLevelCCount: null,
};

const BASE_BRITISH: StudentProfile = {
  hasHighSchool: true,
  hasBachelor: false,
  has12Years: true,
  ielts: null,
  hasSAT: false,
  satScore: null,
  gpa: null,
  hasResearchPlan: false,
  certificateType: "british",
  aLevelCount: 3,
  aLevelCCount: 3,
};

// Constructor Bachelor Arabic
const CONSTRUCTOR_BACHELOR_ARABIC = makeEntry({
  programName: "بكالوريوس",
  universityName: "جامعة كونستركتر",
  category: "bachelor",
  certificateTypeSlug: "arabic",
  requirements: {
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
  },
  scholarshipTiers: [
    { id: "s1", min_gpa: 95, max_gpa: 100, scholarship_percent: 35, label: "7000 يورو", sort_order: 1 },
    { id: "s2", min_gpa: 90, max_gpa: 94.99, scholarship_percent: 25, label: "5000 يورو", sort_order: 2 },
    { id: "s3", min_gpa: 80, max_gpa: 89.99, scholarship_percent: 15, label: "3000 يورو", sort_order: 3 },
  ],
});

// SRH IEF
const SRH_IEF = makeEntry({
  programName: "IEF",
  universityName: "جامعة SRH",
  category: "foundation",
  certificateTypeSlug: null,
  requirements: {
    requires_hs: true,
    requires_ielts: true,
    ielts_min: 4.0,
    ielts_effect: "blocks_if_below",
  },
});

// Debrecen Bachelor
const DEBRECEN_BACHELOR = makeEntry({
  programName: "بكالوريوس",
  universityName: "جامعة ديبريسن",
  country: "هنغاريا",
  category: "bachelor",
  certificateTypeSlug: null,
  requirements: {
    requires_hs: true,
    requires_12_years: true,
    requires_entrance_exam: true,
  },
});

const TEST_CASES: TestCase[] = [
  {
    name: "عربي + ثانوية + SAT 1300 + IELTS 7.0 + GPA 96",
    entry: CONSTRUCTOR_BACHELOR_ARABIC,
    profile: { ...BASE_ARABIC, hasSAT: true, satScore: 1300, ielts: 7.0, gpa: 96 },
  },
  {
    name: "عربي + بدون SAT + IELTS 7.0",
    entry: CONSTRUCTOR_BACHELOR_ARABIC,
    profile: { ...BASE_ARABIC, ielts: 7.0 },
  },
  {
    name: "عربي + بدون ثانوية",
    entry: CONSTRUCTOR_BACHELOR_ARABIC,
    profile: { ...BASE_ARABIC, hasHighSchool: false },
  },
  {
    name: "ثانوية + IELTS 4.5 (SRH IEF)",
    entry: SRH_IEF,
    profile: { ...BASE_ARABIC, ielts: 4.5 },
  },
  {
    name: "ثانوية + IELTS 3.5 (SRH IEF)",
    entry: SRH_IEF,
    profile: { ...BASE_ARABIC, ielts: 3.5 },
  },
  {
    name: "ثانوية + 12 سنة (Debrecen)",
    entry: DEBRECEN_BACHELOR,
    profile: { ...BASE_ARABIC },
  },
];

// ============================================================
// Run parity check
// ============================================================

console.log("═══ فحص التطابق: المحرك القديم vs محرك القواعد ═══\n");

let matches = 0;
let mismatches = 0;
const knownDifferences: string[] = [];

for (const tc of TEST_CASES) {
  // Old engine
  const oldResult = evaluateProfileAgainstProgram(tc.profile, tc.entry);

  // New engine
  const rules = convertLegacyToRules(
    tc.entry.programId,
    TENANT_ID,
    null,
    tc.entry.requirements as Record<string, unknown>,
    tc.entry.customRequirements as Record<string, unknown>[]
  );
  const ruleInput = profileToRuleInput(tc.profile);
  const newResult = evaluateRules(rules, ruleInput);

  const statusMatch = oldResult.status === newResult.status;

  if (statusMatch) {
    matches++;
    console.log(`  ✓ ${tc.name}`);
    console.log(`    المحرك القديم: ${oldResult.status} | محرك القواعد: ${newResult.status}`);
  } else {
    // Check if this is a known acceptable difference
    const isInterviewDiff =
      oldResult.status === "positive" &&
      newResult.status === "conditional" &&
      newResult.notes.some((n) => n.includes("مقابلة"));

    if (isInterviewDiff) {
      matches++;
      knownDifferences.push(tc.name);
      console.log(`  ~ ${tc.name} (فرق معروف: interview → conditional)`);
      console.log(`    المحرك القديم: ${oldResult.status} | محرك القواعد: ${newResult.status}`);
    } else {
      mismatches++;
      console.log(`  ✗ ${tc.name}`);
      console.log(`    المحرك القديم: ${oldResult.status} | محرك القواعد: ${newResult.status}`);
      console.log(`    سبب قديم: ${oldResult.reason}`);
      console.log(`    ملاحظات جديدة: ${newResult.notes.join("; ")}`);
    }
  }
}

console.log("\n════════════════════════════════════════");
console.log(`النتائج: ${matches} متطابق، ${mismatches} مختلف من أصل ${TEST_CASES.length} حالة`);
if (knownDifferences.length > 0) {
  console.log(`\nفروقات معروفة (${knownDifferences.length}):`);
  for (const d of knownDifferences) {
    console.log(`  ~ ${d}`);
  }
}
console.log("════════════════════════════════════════\n");

process.exit(mismatches > 0 ? 1 : 0);
