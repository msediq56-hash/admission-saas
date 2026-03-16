import { NextResponse } from "next/server";
import { getAuthenticatedAdmin } from "../../../_helpers";

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { error, supabase } = await getAuthenticatedAdmin();
  if (error) return error;

  const { id: universityId } = await params;

  // Verify the university exists (RLS handles tenant scoping)
  const { data: university } = await supabase
    .from("universities")
    .select("id")
    .eq("id", universityId)
    .single();

  if (!university) {
    return NextResponse.json({ error: "University not found" }, { status: 404 });
  }

  // Get all programs for this university
  const { data: programs } = await supabase
    .from("programs")
    .select("id")
    .eq("university_id", universityId);

  const programIds = (programs || []).map((p) => p.id);

  if (programIds.length > 0) {
    // 1. major_subject_requirements (depends on majors)
    const { data: majors } = await supabase
      .from("majors")
      .select("id")
      .in("program_id", programIds);

    if (majors && majors.length > 0) {
      const majorIds = majors.map((m) => m.id);
      await supabase
        .from("major_subject_requirements")
        .delete()
        .in("major_id", majorIds);
    }

    // 2. majors
    await supabase.from("majors").delete().in("program_id", programIds);

    // 3. scholarship_tiers
    await supabase.from("scholarship_tiers").delete().in("program_id", programIds);

    // 4. custom_requirements
    await supabase.from("custom_requirements").delete().in("program_id", programIds);

    // 5. requirement_rules
    await supabase.from("requirement_rules").delete().in("program_id", programIds);

    // 6. requirements (old table)
    await supabase.from("requirements").delete().in("program_id", programIds);

    // 7. programs
    await supabase.from("programs").delete().eq("university_id", universityId);
  }

  // 8. Delete the university itself
  const { error: deleteError } = await supabase
    .from("universities")
    .delete()
    .eq("id", universityId);

  if (deleteError) {
    return NextResponse.json(
      { error: deleteError.message },
      { status: 500 }
    );
  }

  return NextResponse.json({ ok: true });
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { error, supabase } = await getAuthenticatedAdmin();
  if (error) return error;

  const { id: universityId } = await params;
  const body = await request.json();

  // Only allow updating is_active
  const updates: Record<string, unknown> = {};
  if (typeof body.is_active === "boolean") {
    updates.is_active = body.is_active;
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: "No valid fields" }, { status: 400 });
  }

  const { error: updateError } = await supabase
    .from("universities")
    .update(updates)
    .eq("id", universityId);

  if (updateError) {
    return NextResponse.json(
      { error: updateError.message },
      { status: 500 }
    );
  }

  return NextResponse.json({ ok: true });
}
