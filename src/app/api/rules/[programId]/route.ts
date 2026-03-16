import { NextResponse } from "next/server";
import { getAuthenticatedAdmin } from "../../_helpers";
import { dualWriteRequirements } from "@/lib/rules/dual-write";

// GET /api/rules/[programId]
// Returns all requirement_rules for a program, grouped by certificate_type_id
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ programId: string }> }
) {
  const { error, supabase } = await getAuthenticatedAdmin();
  if (error) return error;

  const { programId } = await params;

  const { data: rules, error: rulesError } = await supabase
    .from("requirement_rules")
    .select("*")
    .eq("program_id", programId)
    .order("sort_order");

  if (rulesError) {
    return NextResponse.json({ error: rulesError.message }, { status: 500 });
  }

  // Also fetch the existing requirements rows so we know the req_row_ids
  const { data: reqRows } = await supabase
    .from("requirements")
    .select("id, certificate_type_id")
    .eq("program_id", programId);

  // Build a map: certificate_type_id → req_row_id
  const reqRowMap: Record<string, string> = {};
  for (const row of reqRows || []) {
    const key = row.certificate_type_id || "__universal__";
    reqRowMap[key] = row.id;
  }

  return NextResponse.json({ rules: rules || [], req_row_map: reqRowMap });
}

// PUT /api/rules/[programId]
// Accepts the full rules list per certificate tab. Does:
// 1. Delete old rules for this program + cert_type
// 2. Insert new rules
// 3. Dual-write to requirements table
export async function PUT(
  request: Request,
  { params }: { params: Promise<{ programId: string }> }
) {
  const { error, supabase } = await getAuthenticatedAdmin();
  if (error) return error;

  const { programId } = await params;
  const body = await request.json();
  const {
    certificate_type_id: certTypeId,
    rules,
    req_row_id: existingReqRowId,
  } = body as {
    certificate_type_id: string | null;
    rules: Array<{
      id?: string;
      rule_type: string;
      config: Record<string, unknown>;
      effect: string;
      effect_message: string | null;
      sort_order: number;
      is_enabled: boolean;
    }>;
    req_row_id: string | null;
  };

  // Look up tenant_id
  const { data: progRow } = await supabase
    .from("programs")
    .select("tenant_id")
    .eq("id", programId)
    .single();

  if (!progRow) {
    return NextResponse.json({ error: "Program not found" }, { status: 404 });
  }

  const tenantId = progRow.tenant_id;

  // 1. Delete existing rules for this program + cert_type
  let deleteQuery = supabase
    .from("requirement_rules")
    .delete()
    .eq("program_id", programId);

  if (certTypeId) {
    deleteQuery = deleteQuery.eq("certificate_type_id", certTypeId);
  } else {
    deleteQuery = deleteQuery.is("certificate_type_id", null);
  }
  await deleteQuery;

  // 2. Insert new rules
  if (rules.length > 0) {
    const insertRows = rules.map((r, idx) => ({
      program_id: programId,
      tenant_id: tenantId,
      certificate_type_id: certTypeId,
      rule_type: r.rule_type,
      config: r.config,
      effect: r.effect,
      effect_message: r.effect_message,
      sort_order: idx,
      is_enabled: r.is_enabled ?? true,
    }));

    const { error: insertError } = await supabase
      .from("requirement_rules")
      .insert(insertRows);

    if (insertError) {
      return NextResponse.json({ error: insertError.message }, { status: 500 });
    }
  }

  // 3. Dual-write to old requirements table
  const newReqRowId = await dualWriteRequirements(
    supabase,
    programId,
    certTypeId,
    tenantId,
    rules,
    existingReqRowId
  );

  return NextResponse.json({ ok: true, req_row_id: newReqRowId });
}
