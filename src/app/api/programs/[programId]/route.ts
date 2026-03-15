import { NextResponse } from "next/server";
import { getAuthenticatedAdmin } from "../../_helpers";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ programId: string }> }
) {
  const { error, supabase } = await getAuthenticatedAdmin();
  if (error) return error;

  const { programId } = await params;
  const body = await request.json();
  const {
    program,
    requirements,
    custom_requirements,
    certificate_type_id: certTypeId,
    req_row_id: reqRowId,
    delete_requirement_row_id: deleteRowId,
    convert_cert_type: convertCertType,
  } = body;

  // Look up tenant_id from the program (needed for inserts)
  const { data: progRow } = await supabase
    .from("programs")
    .select("tenant_id")
    .eq("id", programId)
    .single();

  if (!progRow) {
    return NextResponse.json({ error: "Program not found" }, { status: 404 });
  }

  const tenantId = progRow.tenant_id;

  // ─── Delete a cert type's requirements row (and associated data) ───
  if (deleteRowId) {
    // Delete custom_requirements for this cert type
    const delCrQuery = supabase
      .from("custom_requirements")
      .delete()
      .eq("program_id", programId);

    // Get the cert type from the row we're deleting
    const { data: rowToDelete } = await supabase
      .from("requirements")
      .select("certificate_type_id")
      .eq("id", deleteRowId)
      .single();

    if (rowToDelete) {
      if (rowToDelete.certificate_type_id) {
        await delCrQuery.eq(
          "certificate_type_id",
          rowToDelete.certificate_type_id
        );
      } else {
        await delCrQuery.is("certificate_type_id", null);
      }
    }

    // Delete scholarship_tiers for this cert type
    if (rowToDelete) {
      const delStQuery = supabase
        .from("scholarship_tiers")
        .delete()
        .eq("program_id", programId);

      if (rowToDelete.certificate_type_id) {
        await delStQuery.eq(
          "certificate_type_id",
          rowToDelete.certificate_type_id
        );
      } else {
        await delStQuery.is("certificate_type_id", null);
      }
    }

    // Delete the requirements row itself
    await supabase.from("requirements").delete().eq("id", deleteRowId);

    return NextResponse.json({ ok: true });
  }

  // ─── Convert certificate_type_id on a requirements row + associated data ───
  // Used when converting from universal (null) to a specific cert type, or vice versa
  if (convertCertType) {
    const { req_row_id: convertRowId, from_cert_type_id: fromCertTypeId, to_cert_type_id: toCertTypeId } = convertCertType;

    // Update requirements row
    if (convertRowId) {
      await supabase
        .from("requirements")
        .update({ certificate_type_id: toCertTypeId ?? null })
        .eq("id", convertRowId);
    }

    // Update custom_requirements: change from old cert type to new cert type
    let crUpdateQuery = supabase
      .from("custom_requirements")
      .update({ certificate_type_id: toCertTypeId ?? null })
      .eq("program_id", programId);

    if (fromCertTypeId) {
      crUpdateQuery = crUpdateQuery.eq("certificate_type_id", fromCertTypeId);
    } else {
      crUpdateQuery = crUpdateQuery.is("certificate_type_id", null);
    }
    await crUpdateQuery;

    // Update scholarship_tiers similarly
    let stUpdateQuery = supabase
      .from("scholarship_tiers")
      .update({ certificate_type_id: toCertTypeId ?? null })
      .eq("program_id", programId);

    if (fromCertTypeId) {
      stUpdateQuery = stUpdateQuery.eq("certificate_type_id", fromCertTypeId);
    } else {
      stUpdateQuery = stUpdateQuery.is("certificate_type_id", null);
    }
    await stUpdateQuery;

    return NextResponse.json({ ok: true });
  }

  // ─── Update program info ───
  if (program) {
    const updates: Record<string, unknown> = {};
    if (program.name !== undefined) updates.name = program.name;
    if (program.category !== undefined) updates.category = program.category;
    if (program.complexity_level !== undefined)
      updates.complexity_level = program.complexity_level;
    if (program.is_active !== undefined) updates.is_active = program.is_active;

    if (Object.keys(updates).length > 0) {
      const { error: progError } = await supabase
        .from("programs")
        .update(updates)
        .eq("id", programId);

      if (progError) {
        return NextResponse.json(
          { error: progError.message },
          { status: 500 }
        );
      }
    }
  }

  // ─── Upsert requirements (scoped by cert type) ───
  let newReqRowId: string | null = null;

  if (requirements) {
    if (reqRowId) {
      // Update existing requirements row by ID
      const { error: reqError } = await supabase
        .from("requirements")
        .update(requirements)
        .eq("id", reqRowId);

      if (reqError) {
        return NextResponse.json(
          { error: reqError.message },
          { status: 500 }
        );
      }
    } else {
      // Insert new requirements row for a new cert type
      const { data: newRow, error: reqError } = await supabase
        .from("requirements")
        .insert({
          program_id: programId,
          tenant_id: tenantId,
          certificate_type_id: certTypeId ?? null,
          ...requirements,
        })
        .select("id")
        .single();

      if (reqError) {
        return NextResponse.json(
          { error: reqError.message },
          { status: 500 }
        );
      }
      newReqRowId = newRow?.id || null;
    }
  }

  // ─── Upsert custom requirements (scoped by cert type) ───
  if (custom_requirements !== undefined) {
    const keepIds = custom_requirements
      .filter((cr: { id?: string }) => cr.id)
      .map((cr: { id: string }) => cr.id);

    // Delete custom_requirements for THIS cert type only
    let deleteQuery = supabase
      .from("custom_requirements")
      .delete()
      .eq("program_id", programId);

    if (certTypeId) {
      deleteQuery = deleteQuery.eq("certificate_type_id", certTypeId);
    } else {
      deleteQuery = deleteQuery.is("certificate_type_id", null);
    }

    if (keepIds.length > 0) {
      deleteQuery = deleteQuery.not("id", "in", `(${keepIds.join(",")})`);
    }

    await deleteQuery;

    // Upsert each custom requirement
    for (const cr of custom_requirements) {
      if (cr.id) {
        await supabase
          .from("custom_requirements")
          .update({
            question_text: cr.question_text,
            question_type: cr.question_type,
            effect: cr.effect,
            negative_message: cr.negative_message,
            positive_message: cr.positive_message,
            sort_order: cr.sort_order,
            options: cr.options || null,
            option_effects: cr.option_effects || null,
            certificate_type_id: certTypeId ?? null,
            show_in_comparison: cr.show_in_comparison || false,
            comparison_input_type: cr.comparison_input_type || null,
            comparison_key: cr.comparison_key || null,
          })
          .eq("id", cr.id);
      } else {
        await supabase.from("custom_requirements").insert({
          program_id: programId,
          tenant_id: tenantId,
          certificate_type_id: certTypeId ?? null,
          question_text: cr.question_text,
          question_type: cr.question_type || "yes_no",
          effect: cr.effect || "blocks_admission",
          negative_message: cr.negative_message,
          positive_message: cr.positive_message,
          sort_order: cr.sort_order || 0,
          options: cr.options || null,
          option_effects: cr.option_effects || null,
          show_in_comparison: cr.show_in_comparison || false,
          comparison_input_type: cr.comparison_input_type || null,
          comparison_key: cr.comparison_key || null,
        });
      }
    }
  }

  return NextResponse.json({ ok: true, req_row_id: newReqRowId });
}
