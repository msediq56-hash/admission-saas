import { NextResponse } from "next/server";
import { getAuthenticatedAdmin } from "../../_helpers";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ programId: string }> }
) {
  const { error, supabase } = await getAuthenticatedAdmin();
  if (error) return error;

  const { programId } = await params;
  const body = await request.json();
  const { program, requirements, custom_requirements } = body;

  // Update program info
  if (program) {
    const updates: Record<string, unknown> = {};
    if (program.name !== undefined) updates.name = program.name;
    if (program.category !== undefined) updates.category = program.category;
    if (program.certificate_type_id !== undefined)
      updates.certificate_type_id = program.certificate_type_id || null;
    if (program.complexity_level !== undefined)
      updates.complexity_level = program.complexity_level;

    const { error: progError } = await supabase
      .from("programs")
      .update(updates)
      .eq("id", programId);

    if (progError) {
      return NextResponse.json({ error: progError.message }, { status: 500 });
    }
  }

  // Update requirements
  if (requirements) {
    const { error: reqError } = await supabase
      .from("requirements")
      .update(requirements)
      .eq("program_id", programId);

    if (reqError) {
      return NextResponse.json({ error: reqError.message }, { status: 500 });
    }
  }

  // Upsert custom requirements
  if (custom_requirements !== undefined) {
    // Delete removed custom requirements
    const keepIds = custom_requirements
      .filter((cr: { id?: string }) => cr.id)
      .map((cr: { id: string }) => cr.id);

    if (keepIds.length > 0) {
      await supabase
        .from("custom_requirements")
        .delete()
        .eq("program_id", programId)
        .not("id", "in", `(${keepIds.join(",")})`);
    } else {
      await supabase
        .from("custom_requirements")
        .delete()
        .eq("program_id", programId);
    }

    // Upsert each custom requirement
    for (const cr of custom_requirements) {
      if (cr.id) {
        // Update existing
        await supabase
          .from("custom_requirements")
          .update({
            question_text: cr.question_text,
            question_type: cr.question_type,
            effect: cr.effect,
            negative_message: cr.negative_message,
            positive_message: cr.positive_message,
            sort_order: cr.sort_order,
          })
          .eq("id", cr.id);
      } else {
        // Insert new
        await supabase.from("custom_requirements").insert({
          program_id: programId,
          question_text: cr.question_text,
          question_type: cr.question_type || "yes_no",
          effect: cr.effect || "blocks_admission",
          negative_message: cr.negative_message,
          positive_message: cr.positive_message,
          sort_order: cr.sort_order || 0,
        });
      }
    }
  }

  return NextResponse.json({ ok: true });
}
