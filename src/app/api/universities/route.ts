import { NextResponse } from "next/server";
import { getAuthenticatedAdmin } from "../_helpers";

export async function POST(request: Request) {
  const { error, supabase, user } = await getAuthenticatedAdmin();
  if (error) return error;

  const body = await request.json();
  const { name, country, type } = body;

  if (!name || !country || !type) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  const { data, error: dbError } = await supabase
    .from("universities")
    .insert({
      name,
      country,
      type,
      tenant_id: user.tenant_id,
      is_active: true,
    })
    .select("id")
    .single();

  if (dbError) {
    return NextResponse.json({ error: dbError.message }, { status: 500 });
  }

  return NextResponse.json({ id: data.id });
}
