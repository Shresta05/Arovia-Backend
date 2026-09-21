import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

// UUID validation
function isValidUUID(value: string) {
  const uuidRegex =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

  return uuidRegex.test(value);
}

// Authenticate the request using the Supabase Auth JWT
async function authenticateUser(request: NextRequest) {
  const authHeader = request.headers.get("Authorization");

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return {
      user: null,
      error: "Authorization token is required",
    };
  }

  const accessToken = authHeader.replace("Bearer ", "").trim();

  if (!accessToken) {
    return {
      user: null,
      error: "Authorization token is required",
    };
  }

  const supabase = createClient(
    supabaseUrl,
    supabaseAnonKey,
    {
      global: {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      },
    }
  );

  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) {
    return {
      user: null,
      error: "Invalid or expired authorization token",
    };
  }

  return {
    user,
    error: null,
  };
}


// GET: Fetch all reports or reports for a specific patient
export async function GET(request: NextRequest) {
  try {
    const { user, error: authError } = await authenticateUser(request);

    if (authError || !user) {
      return NextResponse.json(
        { error: authError },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);

    const patient_id = searchParams.get("patient_id");
    const id = searchParams.get("id");

    // Validate IDs if provided
    if (id && !isValidUUID(id)) {
      return NextResponse.json(
        { error: "Invalid report id format" },
        { status: 400 }
      );
    }

    if (patient_id && !isValidUUID(patient_id)) {
      return NextResponse.json(
        { error: "Invalid patient_id format" },
        { status: 400 }
      );
    }

    let query = supabaseAdmin
      .from("reports_prescriptions")
      .select("*")
      .order("report_date", { ascending: false });

    if (id) {
      query = query.eq("id", id);
    } else if (patient_id) {
      query = query.eq("patient_id", patient_id);
    }

    const { data, error } = await query;

    if (error) {
      return NextResponse.json(
        {
          error: "Failed to fetch reports",
          details: error.message,
        },
        { status: 500 }
      );
    }

    return NextResponse.json(
      {
        message: "Reports fetched successfully",
        data,
      },
      { status: 200 }
    );

  } catch (error) {
    console.error("Reports GET error:", error);

    return NextResponse.json(
      { error: "Invalid request" },
      { status: 400 }
    );
  }
}


// POST: Add a report record
export async function POST(request: NextRequest) {
  try {
    const { user, error: authError } = await authenticateUser(request);

    if (authError || !user) {
      return NextResponse.json(
        { error: authError },
        { status: 401 }
      );
    }

    const body = await request.json();

    const {
      patient_id,
      uploaded_by,
      report_type,
      title,
      description,
      doctor_name,
      report_date,
      file_name,
      file_path,
      file_url,
      extracted_text,
      ai_summary,
    } = body;

    if (!patient_id || !report_type || !title) {
      return NextResponse.json(
        {
          error: "patient_id, report_type, and title are required",
        },
        { status: 400 }
      );
    }

    if (!isValidUUID(patient_id)) {
      return NextResponse.json(
        { error: "Invalid patient_id format" },
        { status: 400 }
      );
    }

    if (
      typeof report_type !== "string" ||
      !report_type.trim()
    ) {
      return NextResponse.json(
        { error: "report_type must be a non-empty string" },
        { status: 400 }
      );
    }

    if (
      typeof title !== "string" ||
      !title.trim()
    ) {
      return NextResponse.json(
        { error: "title must be a non-empty string" },
        { status: 400 }
      );
    }

    const { data, error } = await supabaseAdmin
      .from("reports_prescriptions")
      .insert([
        {
          patient_id,
          uploaded_by: uploaded_by || null,
          report_type: report_type.trim(),
          title: title.trim(),
          description: description || null,
          doctor_name: doctor_name || null,
          report_date: report_date || null,
          file_name: file_name || null,
          file_path: file_path || null,
          file_url: file_url || null,
          extracted_text: extracted_text || null,
          ai_summary: ai_summary || null,
        },
      ])
      .select()
      .single();

    if (error) {
      return NextResponse.json(
        {
          error: "Failed to create report",
          details: error.message,
        },
        { status: 500 }
      );
    }

    return NextResponse.json(
      {
        message: "Report created successfully",
        data,
      },
      { status: 201 }
    );

  } catch (error) {
    console.error("Reports POST error:", error);

    return NextResponse.json(
      { error: "Invalid request" },
      { status: 400 }
    );
  }
}


// PATCH: Update a report record
export async function PATCH(request: NextRequest) {
  try {
    const { user, error: authError } = await authenticateUser(request);

    if (authError || !user) {
      return NextResponse.json(
        { error: authError },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json(
        { error: "Report id is required" },
        { status: 400 }
      );
    }

    if (!isValidUUID(id)) {
      return NextResponse.json(
        { error: "Invalid report id format" },
        { status: 400 }
      );
    }

    const body = await request.json();

    const allowedFields = [
      "uploaded_by",
      "report_type",
      "title",
      "description",
      "doctor_name",
      "report_date",
      "file_name",
      "file_path",
      "file_url",
      "extracted_text",
      "ai_summary",
    ];

    const updates: Record<string, unknown> = {};

    for (const field of allowedFields) {
      if (body[field] !== undefined) {
        updates[field] = body[field];
      }
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json(
        { error: "No valid fields to update" },
        { status: 400 }
      );
    }

    if (
      updates.report_type !== undefined &&
      (typeof updates.report_type !== "string" ||
        !(updates.report_type as string).trim())
    ) {
      return NextResponse.json(
        { error: "report_type must be a non-empty string" },
        { status: 400 }
      );
    }

    if (
      updates.title !== undefined &&
      (typeof updates.title !== "string" ||
        !(updates.title as string).trim())
    ) {
      return NextResponse.json(
        { error: "title must be a non-empty string" },
        { status: 400 }
      );
    }

    const { data, error } = await supabaseAdmin
      .from("reports_prescriptions")
      .update(updates)
      .eq("id", id)
      .select()
      .single();

    if (error) {
      return NextResponse.json(
        {
          error: "Failed to update report",
          details: error.message,
        },
        { status: 500 }
      );
    }

    return NextResponse.json(
      {
        message: "Report updated successfully",
        data,
      },
      { status: 200 }
    );

  } catch (error) {
    console.error("Reports PATCH error:", error);

    return NextResponse.json(
      { error: "Invalid request" },
      { status: 400 }
    );
  }
}


// DELETE: Delete a report record
export async function DELETE(request: NextRequest) {
  try {
    const { user, error: authError } = await authenticateUser(request);

    if (authError || !user) {
      return NextResponse.json(
        { error: authError },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json(
        { error: "Report id is required" },
        { status: 400 }
      );
    }

    if (!isValidUUID(id)) {
      return NextResponse.json(
        { error: "Invalid report id format" },
        { status: 400 }
      );
    }

    const { data, error } = await supabaseAdmin
      .from("reports_prescriptions")
      .delete()
      .eq("id", id)
      .select("id")
      .single();

    if (error) {
      return NextResponse.json(
        {
          error: "Failed to delete report",
          details: error.message,
        },
        { status: 500 }
      );
    }

    return NextResponse.json(
      {
        success: true,
        message: "Report deleted successfully",
        deleted_id: data.id,
      },
      { status: 200 }
    );

  } catch (error) {
    console.error("Reports DELETE error:", error);

    return NextResponse.json(
      { error: "Invalid request" },
      { status: 400 }
    );
  }
}