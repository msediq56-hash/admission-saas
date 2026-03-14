import { config } from "dotenv";
import { readFileSync } from "fs";

config({ path: ".env.local" });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const databaseUrl = process.env.DATABASE_URL;

if (!supabaseUrl || !serviceRoleKey) {
  console.error(
    "Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local"
  );
  process.exit(1);
}

const sqlFile = process.argv[2];
if (!sqlFile) {
  console.error("Usage: npx tsx scripts/run-migration.ts <path-to-sql-file>");
  process.exit(1);
}

const sqlContent = readFileSync(sqlFile, "utf-8");
console.log(`Running migration: ${sqlFile}\n`);

async function runWithPostgres() {
  const postgres = (await import("postgres")).default;
  const sql = postgres(databaseUrl!, { ssl: "require" });
  try {
    await sql.unsafe(sqlContent);
    console.log("Migration completed successfully!");
  } finally {
    await sql.end();
  }
}

async function run() {
  if (databaseUrl) {
    console.log("Using DATABASE_URL for direct postgres connection...");
    await runWithPostgres();
    return;
  }

  // Extract project ref from URL
  const ref = new URL(supabaseUrl!).hostname.split(".")[0];

  console.log("No DATABASE_URL found. Cannot run DDL via PostgREST API.");
  console.log("");
  console.log("Please run this SQL manually in the Supabase SQL Editor:");
  console.log(
    `https://supabase.com/dashboard/project/${ref}/sql/new`
  );
  console.log("");
  console.log("--- SQL ---");
  console.log(sqlContent);
  console.log("--- END ---");
  console.log("");
  console.log(
    "To enable automatic migrations, add DATABASE_URL to .env.local:"
  );
  console.log(
    "DATABASE_URL=postgresql://postgres.[ref]:[password]@aws-0-[region].pooler.supabase.com:6543/postgres"
  );
  console.log(
    "Find your connection string in Supabase Dashboard > Settings > Database"
  );
  process.exit(1);
}

run();
