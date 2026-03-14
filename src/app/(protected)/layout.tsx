import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import type { UserRole } from "@/lib/permissions";
import { AuthProvider, type AuthUser } from "@/lib/auth-context";
import { Sidebar } from "./sidebar";

export default async function ProtectedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createSupabaseServerClient();
  const t = await getTranslations();

  const {
    data: { user: authUser },
  } = await supabase.auth.getUser();

  if (!authUser) {
    redirect("/login");
  }

  const { data: userData } = await supabase
    .from("users")
    .select("full_name, role, tenant_id, is_active")
    .eq("id", authUser.id)
    .single();

  if (!userData || !userData.is_active) {
    redirect("/login");
  }

  const user: AuthUser = {
    id: authUser.id,
    email: authUser.email!,
    fullName: userData.full_name,
    role: userData.role as UserRole,
    tenantId: userData.tenant_id,
  };

  return (
    <AuthProvider user={user}>
      <div className="flex min-h-screen bg-[#0f1c2e]">
        <Sidebar user={user} />
        <main className="flex-1 p-6 md:p-8">{children}</main>
      </div>
    </AuthProvider>
  );
}
