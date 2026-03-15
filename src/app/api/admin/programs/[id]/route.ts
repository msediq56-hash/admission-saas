import { NextResponse } from "next/server";
import { getAuthenticatedAdmin } from "../../../_helpers";

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { error, supabase } = await getAuthenticatedAdmin();
  if (error) return error;

  const { id: programId } = await params;

  // Verify the program exists and belongs to the user's tenant (RLS handles tenant scoping)
  const { data: program } = await supabase
    .from("programs")
    .select("id, university_id")
    .eq("id", programId)
    .single();

  if (!program) {
    return NextResponse.json({ error: "Program not found" }, { status: 404 });
  }

  // Cascade delete related data (order matters for FK constraints)
  // 1. major_subject_requirements (depends on majors)
  const { data: majors } = await supabase
    .from("majors")
    .select("id")
    .eq("program_id", programId);

  if (majors && majors.length > 0) {
    const majorIds = majors.map((m) => m.id);
    await supabase
      .from("major_subject_requirements")
      .delete()
      .in("major_id", majorIds);
  }

  // 2. majors
  await supabase.from("majors").delete().eq("program_id", programId);

  // 3. scholarship_tiers
  await supabase.from("scholarship_tiers").delete().eq("program_id", programId);

  // 4. custom_requirements
  await supabase.from("custom_requirements").delete().eq("program_id", programId);

  // 5. requirements
  await supabase.from("requirements").delete().eq("program_id", programId);

  // 6. Delete the program itself
  const { error: deleteError } = await supabase
    .from("programs")
    .delete()
    .eq("id", programId);

  if (deleteError) {
    return NextResponse.json(
      { error: deleteError.message },
      { status: 500 }
    );
  }

  return NextResponse.json({ ok: true, university_id: program.university_id });
}
