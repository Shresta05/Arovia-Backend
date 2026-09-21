import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

function getSupabaseClient(req: NextRequest) {
  const authHeader = req.headers.get("Authorization");

  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      global: {
        headers: {
          Authorization: authHeader || "",
        },
      },
    }
  );
}

type Params = {
  params: Promise<{ id: string }>;
};

// PATCH: Update medical-history record
export async function PATCH(
  req: NextRequest,
  { params }: Params
) {
  try {
    const supabase = getSupabaseClient(req);
    const { id } = await params;
    const body = await req.json();

    const updates: Record<string, string | null> = {};

    if (body.condition !== undefined) {
      updates.condition = body.condition;
    }

    if (body.diagnosis_date !== undefined) {
      updates.diagnosis_date = body.diagnosis_date || null;
    }

    if (body.treatment !== undefined) {
      updates.treatment = body.treatment || null;
    }

    if (body.notes !== undefined) {
      updates.notes = body.notes || null;
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json(
        { error: "No fields provided for update" },
        { status: 400 }
      );
    }

    updates.updated_at = new Date().toISOString();

    const { data, error } = await supabase
      .from("medical_history")
      .update(updates)
      .eq("id", id)
      .select()
      .single();

    if (error) {
      return NextResponse.json(
        { error: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json(data, { status: 200 });
  } catch (error) {
    return NextResponse.json(
      { error: "Invalid request body" },
      { status: 400 }
    );
  }
}

// DELETE: Delete medical-history record
export async function DELETE(
  req: NextRequest,
  { params }: Params
) {
  try {
    const supabase = getSupabaseClient(req);
    const { id } = await params;

    const { data, error } = await supabase
      .from("medical_history")
      .delete()
      .eq("id", id)
      .select("id");

    if (error) {
      return NextResponse.json(
        { error: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json(
      {
        message: "Medical-history record deleted successfully",
        deleted_id: id
      },
      { status: 200 }
    );
  } catch (error) {
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}