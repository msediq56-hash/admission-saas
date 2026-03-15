import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedAdmin } from "@/app/api/_helpers";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  const { error, supabase, user } = await getAuthenticatedAdmin();
  if (error) return error;

  const { userId } = await params;
  const body = await req.json();
  const { full_name, role, is_active } = body;

  // Fetch target user to check permissions
  const { data: targetUser } = await supabase
    .from("users")
    .select("id, role, tenant_id")
    .eq("id", userId)
    .eq("tenant_id", user.tenant_id)
    .single();

  if (!targetUser) {
    return NextResponse.json(
      { error: "User not found" },
      { status: 404 }
    );
  }

  // Admin cannot edit another admin or owner
  if (user.role === "admin" && targetUser.role !== "advisor") {
    return NextResponse.json(
      { error: "Admins can only edit advisor accounts" },
      { status: 403 }
    );
  }

  // Owner cannot change own role (prevent locking self out)
  if (userId === user.id && role && role !== user.role) {
    return NextResponse.json(
      { error: "Cannot change your own role" },
      { status: 403 }
    );
  }

  // Admin can only set role to advisor
  if (user.role === "admin" && role && role !== "advisor") {
    return NextResponse.json(
      { error: "Admins can only assign advisor role" },
      { status: 403 }
    );
  }

  // Owner can set advisor or admin, not owner
  if (user.role === "owner" && role && role !== "advisor" && role !== "admin") {
    return NextResponse.json(
      { error: "Invalid role" },
      { status: 400 }
    );
  }

  // Build update object
  const updates: Record<string, unknown> = {};
  if (full_name !== undefined) updates.full_name = full_name;
  if (role !== undefined) updates.role = role;
  if (is_active !== undefined) updates.is_active = is_active;

  if (Object.keys(updates).length === 0) {
    return NextResponse.json(
      { error: "No fields to update" },
      { status: 400 }
    );
  }

  const { data: updatedUser, error: dbError } = await supabase
    .from("users")
    .update(updates)
    .eq("id", userId)
    .eq("tenant_id", user.tenant_id)
    .select("id, email, full_name, role, is_active, created_at")
    .single();

  if (dbError) {
    return NextResponse.json(
      { error: dbError.message },
      { status: 500 }
    );
  }

  return NextResponse.json(updatedUser);
}
