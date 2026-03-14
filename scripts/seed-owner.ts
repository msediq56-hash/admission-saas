import { createClient } from "@supabase/supabase-js";
import { config } from "dotenv";

config({ path: ".env.local" });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!supabaseUrl || !serviceRoleKey) {
  console.error(
    "Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local"
  );
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

async function seed() {
  console.log("Creating owner user in Supabase Auth...");

  const { data: authData, error: authError } =
    await supabase.auth.admin.createUser({
      email: "m.sediq56@gmail.com",
      password: "123456",
      email_confirm: true,
    });

  if (authError) {
    if (authError.message.includes("already been registered")) {
      console.log("Auth user already exists, fetching...");
      const { data: listData } = await supabase.auth.admin.listUsers();
      const existing = listData?.users?.find(
        (u) => u.email === "m.sediq56@gmail.com"
      );
      if (!existing) {
        console.error("Could not find existing user");
        process.exit(1);
      }
      await seedData(existing.id);
      return;
    }
    console.error("Error creating auth user:", authError.message);
    process.exit(1);
  }

  await seedData(authData.user.id);
}

async function seedData(userId: string) {
  console.log(`Auth user ID: ${userId}`);

  // Create tenant
  console.log("Creating tenant...");
  const { data: tenant, error: tenantError } = await supabase
    .from("tenants")
    .upsert(
      { name: "United Education", slug: "united-education" },
      { onConflict: "slug" }
    )
    .select("id")
    .single();

  if (tenantError) {
    console.error("Error creating tenant:", tenantError.message);
    process.exit(1);
  }

  console.log(`Tenant ID: ${tenant.id}`);

  // Create user record
  console.log("Creating user record...");
  const { error: userError } = await supabase.from("users").upsert(
    {
      id: userId,
      tenant_id: tenant.id,
      email: "m.sediq56@gmail.com",
      full_name: "محمد صديق",
      role: "owner",
      is_active: true,
    },
    { onConflict: "id" }
  );

  if (userError) {
    console.error("Error creating user record:", userError.message);
    process.exit(1);
  }

  console.log("Seed completed successfully!");
  console.log("Login with: m.sediq56@gmail.com / 123456");
}

seed();
