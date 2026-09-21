import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

function isValidUUID(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value
  );
}

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

// GET - Fetch emergency access logs
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
    const patientId = searchParams.get("patient_id");

    // Validate optional patient_id
    if (patientId !== null) {
      const cleanedPatientId = patientId.trim();

      if (!cleanedPatientId) {
        return NextResponse.json(
          {
            success: false,
            message: "patient_id cannot be empty",
          },
          { status: 400 }
        );
      }

      if (!isValidUUID(cleanedPatientId)) {
        return NextResponse.json(
          {
            success: false,
            message: "patient_id must be a valid UUID",
          },
          { status: 400 }
        );
      }
    }

    let query = supabaseAdmin
      .from("emergency_access_logs")
      .select("*")
      .order("access_time", { ascending: false });

    if (patientId) {
      query = query.eq("patient_id", patientId.trim());
    }

    const { data, error } = await query;

    if (error) {
      console.error("Emergency access fetch error:", error);

      return NextResponse.json(
        {
          success: false,
          error: "Failed to fetch emergency access logs",
        },
        { status: 500 }
      );
    }

    return NextResponse.json(
      {
        success: true,
        message: "Emergency access logs fetched successfully",
        emergency_access_logs: data,
      },
      { status: 200 }
    );

  } catch (error) {
    console.error("Unexpected emergency access GET error:", error);

    return NextResponse.json(
      {
        success: false,
        error: "Internal server error",
      },
      { status: 500 }
    );
  }
}


// POST - Create emergency access log
export async function POST(request: NextRequest) {
  try {
    const { user, error: authError } = await authenticateUser(request);

    if (authError || !user) {
      return NextResponse.json(
        { error: authError },
        { status: 401 }
      );
    }

    // Parse JSON safely
    let body: unknown;

    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        {
          success: false,
          error: "Request body must contain valid JSON",
        },
        { status: 400 }
      );
    }

    // Validate request body
    if (
      typeof body !== "object" ||
      body === null ||
      Array.isArray(body)
    ) {
      return NextResponse.json(
        {
          success: false,
          error: "Request body must be a JSON object",
        },
        { status: 400 }
      );
    }

    const {
      patient_id,
      accessed_by,
      reason,
    } = body as {
      patient_id?: unknown;
      accessed_by?: unknown;
      reason?: unknown;
    };

    // Check required fields
    if (
      patient_id === undefined ||
      accessed_by === undefined ||
      reason === undefined
    ) {
      return NextResponse.json(
        {
          success: false,
          error: "patient_id, accessed_by, and reason are required",
        },
        { status: 400 }
      );
    }

    // Validate patient_id type
    if (typeof patient_id !== "string") {
      return NextResponse.json(
        {
          success: false,
          error: "patient_id must be a string",
        },
        { status: 400 }
      );
    }

    const cleanedPatientId = patient_id.trim();

    if (!cleanedPatientId) {
      return NextResponse.json(
        {
          success: false,
          error: "patient_id cannot be empty",
        },
        { status: 400 }
      );
    }

    // Validate patient_id UUID
    if (!isValidUUID(cleanedPatientId)) {
      return NextResponse.json(
        {
          success: false,
          error: "patient_id must be a valid UUID",
        },
        { status: 400 }
      );
    }

    // Validate accessed_by
    if (typeof accessed_by !== "string") {
      return NextResponse.json(
        {
          success: false,
          error: "accessed_by must be a string",
        },
        { status: 400 }
      );
    }

    const cleanedAccessedBy = accessed_by.trim();

    if (!cleanedAccessedBy) {
      return NextResponse.json(
        {
          success: false,
          error: "accessed_by cannot be empty",
        },
        { status: 400 }
      );
    }

    // Validate reason
    if (typeof reason !== "string") {
      return NextResponse.json(
        {
          success: false,
          error: "reason must be a string",
        },
        { status: 400 }
      );
    }

    const cleanedReason = reason.trim();

    if (!cleanedReason) {
      return NextResponse.json(
        {
          success: false,
          error: "reason cannot be empty",
        },
        { status: 400 }
      );
    }

    const { data, error } = await supabaseAdmin
      .from("emergency_access_logs")
      .insert({
        patient_id: cleanedPatientId,
        accessed_by: cleanedAccessedBy,
        reason: cleanedReason,
      })
      .select()
      .single();

    if (error) {
      console.error("Emergency access insertion error:", error);

      return NextResponse.json(
        {
          success: false,
          error: "Failed to create emergency access log",
        },
        { status: 500 }
      );
    }

    return NextResponse.json(
      {
        success: true,
        message: "Emergency access log created successfully",
        emergency_access_log: data,
      },
      { status: 201 }
    );

  } catch (error) {
    console.error("Unexpected emergency access POST error:", error);

    return NextResponse.json(
      {
        success: false,
        error: "Internal server error",
      },
      { status: 500 }
    );
  }
}