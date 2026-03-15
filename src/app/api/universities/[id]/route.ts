import { NextResponse } from "next/server";
import { getAuthenticatedAdmin } from "../../_helpers";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { error, supabase } = await getAuthenticatedAdmin();
  if (error) return error;

  const { id } = await params;
  const body = await request.json();
  const { name, country, type, is_active } = body;

  const updates: Record<string, unknown> = {};
  if (name !== undefined) updates.name = name;
  if (country !== undefined) updates.country = country;
  if (type !== undefined) updates.type = type;
  if (is_active !== undefined) updates.is_active = is_active;

  const { error: dbError } = await supabase
    .from("universities")
    .update(updates)
    .eq("id", id);

  if (dbError) {
    return NextResponse.json({ error: dbError.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
