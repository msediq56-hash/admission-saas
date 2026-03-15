import { NextResponse } from "next/server";
import { getAuthenticatedAdmin } from "../_helpers";

export async function POST(request: Request) {
  const { error, supabase, user } = await getAuthenticatedAdmin();
  if (error) return error;

  const body = await request.json();
  const { university_id, name, category, certificate_type_id } = body;

  if (!university_id || !name || !category) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  const { data: program, error: progError } = await supabase
    .from("programs")
    .insert({
      university_id,
      tenant_id: user.tenant_id,
      name,
      category,
      certificate_type_id: certificate_type_id || null,
      complexity_level: "simple",
      is_active: true,
    })
    .select("id")
    .single();

  if (progError) {
    return NextResponse.json({ error: progError.message }, { status: 500 });
  }

  // Create empty requirements row
  const { error: reqError } = await supabase.from("requirements").insert({
    program_id: program.id,
    tenant_id: user.tenant_id,
  });

  if (reqError) {
    return NextResponse.json({ error: reqError.message }, { status: 500 });
  }

  return NextResponse.json({ id: program.id });
}
