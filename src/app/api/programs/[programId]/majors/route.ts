import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedAdmin } from "@/app/api/_helpers";

interface SubjectReqPayload {
  id?: string;
  certificate_type_id: string;
  question_text: string;
  question_type: "yes_no" | "select";
  options?: string[] | null;
  effect: "blocks_admission" | "makes_conditional";
  negative_message?: string;
  positive_message?: string;
  option_effects?: Record<string, { effect: string; message: string | null }> | null;
  sort_order: number;
}

interface MajorPayload {
  id?: string;
  name_ar: string;
  name_en?: string;
  group_code?: string;
  sort_order: number;
  subject_requirements: SubjectReqPayload[];
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ programId: string }> }
) {
  const { error, supabase, user } = await getAuthenticatedAdmin();
  if (error) return error;

  const { programId } = await params;
  const body = await req.json();
  const majors: MajorPayload[] = body.majors || [];

  // Verify program belongs to tenant
  const { data: program } = await supabase
    .from("programs")
    .select("id, university_id")
    .eq("id", programId)
    .single();

  if (!program) {
    return NextResponse.json({ error: "Program not found" }, { status: 404 });
  }

  // Get existing major IDs for this program
  const { data: existingMajors } = await supabase
    .from("majors")
    .select("id")
    .eq("program_id", programId);

  const existingMajorIds = (existingMajors || []).map((m) => m.id);
  const keepMajorIds = majors.filter((m) => m.id).map((m) => m.id!);

  // Delete removed majors (their subject reqs cascade or are deleted below)
  const removedMajorIds = existingMajorIds.filter(
    (id) => !keepMajorIds.includes(id)
  );
  if (removedMajorIds.length > 0) {
    // Delete subject requirements for removed majors first
    await supabase
      .from("major_subject_requirements")
      .delete()
      .in("major_id", removedMajorIds);
    // Then delete the majors
    await supabase
      .from("majors")
      .delete()
      .in("id", removedMajorIds);
  }

  // Upsert each major and its subject requirements
  for (const major of majors) {
    let majorId = major.id;

    if (majorId) {
      // Update existing
      await supabase
        .from("majors")
        .update({
          name_ar: major.name_ar,
          name_en: major.name_en || null,
          group_code: major.group_code || null,
          sort_order: major.sort_order,
        })
        .eq("id", majorId);
    } else {
      // Insert new
      const { data: newMajor } = await supabase
        .from("majors")
        .insert({
          program_id: programId,
          tenant_id: user.tenant_id,
          name_ar: major.name_ar,
          name_en: major.name_en || null,
          group_code: major.group_code || null,
          sort_order: major.sort_order,
        })
        .select("id")
        .single();

      if (!newMajor) continue;
      majorId = newMajor.id;
    }

    // Sync subject requirements for this major
    const { data: existingSubReqs } = await supabase
      .from("major_subject_requirements")
      .select("id")
      .eq("major_id", majorId);

    const existingSubReqIds = (existingSubReqs || []).map((sr) => sr.id);
    const keepSubReqIds = major.subject_requirements
      .filter((sr) => sr.id)
      .map((sr) => sr.id!);

    // Delete removed subject requirements
    const removedSubReqIds = existingSubReqIds.filter(
      (id) => !keepSubReqIds.includes(id)
    );
    if (removedSubReqIds.length > 0) {
      await supabase
        .from("major_subject_requirements")
        .delete()
        .in("id", removedSubReqIds);
    }

    // Upsert subject requirements
    for (const sr of major.subject_requirements) {
      const srData = {
        question_text: sr.question_text,
        question_type: sr.question_type || "yes_no",
        options: sr.options || null,
        effect: sr.effect || "blocks_admission",
        negative_message: sr.negative_message || null,
        positive_message: sr.positive_message || null,
        option_effects: sr.option_effects || null,
        sort_order: sr.sort_order || 0,
      };

      if (sr.id) {
        await supabase
          .from("major_subject_requirements")
          .update({ ...srData, certificate_type_id: sr.certificate_type_id })
          .eq("id", sr.id);
      } else {
        await supabase.from("major_subject_requirements").insert({
          ...srData,
          major_id: majorId,
          certificate_type_id: sr.certificate_type_id,
          tenant_id: user.tenant_id,
        });
      }
    }
  }

  return NextResponse.json({ ok: true });
}
