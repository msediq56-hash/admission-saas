import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedAdmin } from "@/app/api/_helpers";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";

export async function POST(req: NextRequest) {
  const { error, user } = await getAuthenticatedAdmin();
  if (error) return error;

  const body = await req.json();
  const { email, password, full_name, role } = body;

  // Validate required fields
  if (!email || !password || !full_name || !role) {
    return NextResponse.json(
      { error: "Missing required fields" },
      { status: 400 }
    );
  }

  // Validate password length
  if (password.length < 6) {
    return NextResponse.json(
      { error: "Password must be at least 6 characters" },
      { status: 400 }
    );
  }

  // Role restrictions: admin can only create advisors, owner can create advisors and admins
  if (user.role === "admin" && role !== "advisor") {
    return NextResponse.json(
      { error: "Admins can only create advisor accounts" },
      { status: 403 }
    );
  }
  if (user.role === "owner" && role !== "advisor" && role !== "admin") {
    return NextResponse.json(
      { error: "Invalid role" },
      { status: 400 }
    );
  }

  // Create auth user using service role
  const adminClient = createSupabaseAdminClient();
  const { data: authData, error: authError } =
    await adminClient.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    });

  if (authError) {
    if (authError.message?.includes("already been registered")) {
      return NextResponse.json(
        { error: "البريد الإلكتروني مستخدم مسبقاً" },
        { status: 409 }
      );
    }
    return NextResponse.json(
      { error: authError.message },
      { status: 500 }
    );
  }

  // Insert user row in users table
  const { data: newUser, error: dbError } = await adminClient
    .from("users")
    .insert({
      id: authData.user.id,
      email,
      full_name,
      role,
      tenant_id: user.tenant_id,
      is_active: true,
    })
    .select("id, email, full_name, role, is_active, created_at")
    .single();

  if (dbError) {
    // Clean up auth user if DB insert fails
    await adminClient.auth.admin.deleteUser(authData.user.id);
    return NextResponse.json(
      { error: dbError.message },
      { status: 500 }
    );
  }

  return NextResponse.json(newUser, { status: 201 });
}
