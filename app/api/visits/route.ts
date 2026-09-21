import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

function getUserSupabase(req: NextRequest) {
  const authHeader = req.headers.get("Authorization");

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return {
      supabase: null,
      error: "Authorization token is required",
    };
  }

  const accessToken = authHeader.replace("Bearer ", "").trim();

  if (!accessToken) {
    return {
      supabase: null,
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

  return {
    supabase,
    error: null,
  };
}

function getSupabaseAdmin() {
  if (!supabaseUrl || !supabaseServiceRoleKey) {
    throw new Error("Supabase environment variables are missing");
  }

  return createClient(
    supabaseUrl,
    supabaseServiceRoleKey
  );
}

async function authenticateUser(req: NextRequest) {
  const { supabase, error } = getUserSupabase(req);

  if (error || !supabase) {
    return {
      user: null,
      error: error || "Authentication failed",
    };
  }

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
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


// GET /api/visits
// GET /api/visits?patient_id=PATIENT_ID
// GET /api/visits?id=VISIT_ID
export async function GET(request: NextRequest) {
  try {
    const { user, error: authError } = await authenticateUser(request);

    if (authError || !user) {
      return NextResponse.json(
        { error: authError },
        { status: 401 }
      );
    }

    const supabase = getSupabaseAdmin();
    const { searchParams } = new URL(request.url);

    const patientId = searchParams.get("patient_id");
    const visitId = searchParams.get("id");

    let query = supabase
      .from("visits")
      .select("*")
      .order("visit_date", { ascending: false });

    if (visitId) {
      query = query.eq("id", visitId);
    } else if (patientId) {
      query = query.eq("patient_id", patientId);
    }

    const { data, error } = await query;

    if (error) {
      return NextResponse.json(
        {
          success: false,
          error: error.message,
        },
        { status: 500 }
      );
    }

    if (visitId && (!data || data.length === 0)) {
      return NextResponse.json(
        {
          success: false,
          error: "Visit not found",
        },
        { status: 404 }
      );
    }

    return NextResponse.json(
      {
        success: true,
        data: visitId ? data[0] : data,
      },
      { status: 200 }
    );

  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Internal server error",
      },
      { status: 500 }
    );
  }
}


// POST /api/visits
export async function POST(request: NextRequest) {
  try {
    const { user, error: authError } = await authenticateUser(request);

    if (authError || !user) {
      return NextResponse.json(
        { error: authError },
        { status: 401 }
      );
    }

    const supabase = getSupabaseAdmin();
    const body = await request.json();

    const {
      patient_id,
      health_worker_id,
      visit_date,
      visit_type,
      chief_complaint,
      symptoms,
      examination_notes,
      diagnosis,
      treatment_plan,
      prescription_notes,
      follow_up_date,
      referral_required,
      referral_notes,
      date,
      doctor_name,
      prescription_text,
      hospital_name,
    } = body;

    if (!patient_id) {
      return NextResponse.json(
        {
          success: false,
          error: "patient_id is required",
        },
        { status: 400 }
      );
    }

    const { data, error } = await supabase
      .from("visits")
      .insert([
        {
          patient_id,
          health_worker_id: health_worker_id || null,
          visit_date: visit_date || new Date().toISOString(),
          visit_type: visit_type || null,
          chief_complaint: chief_complaint || null,
          symptoms: symptoms || null,
          examination_notes: examination_notes || null,
          diagnosis: diagnosis || null,
          treatment_plan: treatment_plan || null,
          prescription_notes: prescription_notes || null,
          follow_up_date: follow_up_date || null,
          referral_required: referral_required ?? false,
          referral_notes: referral_notes || null,
          date: date || null,
          doctor_name: doctor_name || null,
          prescription_text: prescription_text || null,
          hospital_name: hospital_name || null,
        },
      ])
      .select()
      .single();

    if (error) {
      return NextResponse.json(
        {
          success: false,
          error: error.message,
        },
        { status: 500 }
      );
    }

    return NextResponse.json(
      {
        success: true,
        message: "Visit record created successfully",
        data,
      },
      { status: 201 }
    );

  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Invalid request body",
      },
      { status: 400 }
    );
  }
}


// PATCH /api/visits?id=VISIT_ID
export async function PATCH(request: NextRequest) {
  try {
    const { user, error: authError } = await authenticateUser(request);

    if (authError || !user) {
      return NextResponse.json(
        { error: authError },
        { status: 401 }
      );
    }

    const supabase = getSupabaseAdmin();
    const { searchParams } = new URL(request.url);
    const visitId = searchParams.get("id");

    if (!visitId) {
      return NextResponse.json(
        {
          success: false,
          error: "Visit id is required",
        },
        { status: 400 }
      );
    }

    const body = await request.json();

    const allowedFields = [
      "patient_id",
      "health_worker_id",
      "visit_date",
      "visit_type",
      "chief_complaint",
      "symptoms",
      "examination_notes",
      "diagnosis",
      "treatment_plan",
      "prescription_notes",
      "follow_up_date",
      "referral_required",
      "referral_notes",
      "date",
      "doctor_name",
      "prescription_text",
      "hospital_name",
    ];

    const updates: Record<string, unknown> = {};

    for (const field of allowedFields) {
      if (body[field] !== undefined) {
        updates[field] = body[field];
      }
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json(
        {
          success: false,
          error: "No fields provided for update",
        },
        { status: 400 }
      );
    }

    updates.updated_at = new Date().toISOString();

    const { data, error } = await supabase
      .from("visits")
      .update(updates)
      .eq("id", visitId)
      .select();

    if (error) {
      return NextResponse.json(
        {
          success: false,
          error: error.message,
        },
        { status: 500 }
      );
    }

    if (!data || data.length === 0) {
      return NextResponse.json(
        {
          success: false,
          error: "Visit not found",
        },
        { status: 404 }
      );
    }

    return NextResponse.json(
      {
        success: true,
        message: "Visit record updated successfully",
        data: data[0],
      },
      { status: 200 }
    );

  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Invalid request body",
      },
      { status: 400 }
    );
  }
}


// DELETE /api/visits?id=VISIT_ID
export async function DELETE(request: NextRequest) {
  try {
    const { user, error: authError } = await authenticateUser(request);

    if (authError || !user) {
      return NextResponse.json(
        { error: authError },
        { status: 401 }
      );
    }

    const supabase = getSupabaseAdmin();
    const { searchParams } = new URL(request.url);
    const visitId = searchParams.get("id");

    if (!visitId) {
      return NextResponse.json(
        {
          success: false,
          error: "Visit id is required",
        },
        { status: 400 }
      );
    }

    const { error } = await supabase
      .from("visits")
      .delete()
      .eq("id", visitId);

    if (error) {
      return NextResponse.json(
        {
          success: false,
          error: error.message,
        },
        { status: 500 }
      );
    }

    return NextResponse.json(
      {
        success: true,
        message: "Visit record deleted successfully",
        deleted_id: visitId,
      },
      { status: 200 }
    );

  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Internal server error",
      },
      { status: 500 }
    );
  }
}