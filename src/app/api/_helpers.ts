import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import type { UserRole } from "@/lib/permissions";

export async function getAuthenticatedAdmin() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user: authUser },
  } = await supabase.auth.getUser();

  if (!authUser) {
    return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }), supabase: null as never, user: null as never };
  }

  const { data: dbUser } = await supabase
    .from("users")
    .select("id, role, tenant_id")
    .eq("id", authUser.id)
    .eq("is_active", true)
    .single();

  if (!dbUser) {
    return { error: NextResponse.json({ error: "User not found" }, { status: 401 }), supabase: null as never, user: null as never };
  }

  const role = dbUser.role as UserRole;
  if (role !== "admin" && role !== "owner") {
    return { error: NextResponse.json({ error: "Forbidden" }, { status: 403 }), supabase: null as never, user: null as never };
  }

  return { error: null, supabase, user: { ...dbUser, role } };
}
