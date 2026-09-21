import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

function isValidUUID(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value
  );
}

async function authenticateUser(request: NextRequest) {
  const authHeader = request.headers.get("authorization");

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
      error: "Invalid or expired authentication token",
    };
  }

  return {
    user,
    error: null,
  };
}


// POST - Create audit log
export async function POST(request: NextRequest) {
  try {
    const { user, error: authError } = await authenticateUser(request);

    if (authError || !user) {
      return NextResponse.json(
        { error: authError },
        { status: 401 }
      );
    }

    // Create authenticated Supabase client
    const supabase = createClient(
      supabaseUrl,
      supabaseAnonKey,
      {
        global: {
          headers: {
            Authorization: request.headers.get("authorization")!,
          },
        },
      }
    );

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
      action,
      purpose,
    } = body as {
      patient_id?: unknown;
      action?: unknown;
      purpose?: unknown;
    };

    // Check required fields
    if (
      patient_id === undefined ||
      action === undefined ||
      purpose === undefined
    ) {
      return NextResponse.json(
        {
          success: false,
          error: "patient_id, action, and purpose are required",
        },
        { status: 400 }
      );
    }

    // Validate patient_id
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

    if (!isValidUUID(cleanedPatientId)) {
      return NextResponse.json(
        {
          success: false,
          error: "patient_id must be a valid UUID",
        },
        { status: 400 }
      );
    }

    // Validate action
    if (typeof action !== "string") {
      return NextResponse.json(
        {
          success: false,
          error: "action must be a string",
        },
        { status: 400 }
      );
    }

    const cleanedAction = action.trim();

    if (!cleanedAction) {
      return NextResponse.json(
        {
          success: false,
          error: "action cannot be empty",
        },
        { status: 400 }
      );
    }

    // Validate purpose
    if (typeof purpose !== "string") {
      return NextResponse.json(
        {
          success: false,
          error: "purpose must be a string",
        },
        { status: 400 }
      );
    }

    const cleanedPurpose = purpose.trim();

    if (!cleanedPurpose) {
      return NextResponse.json(
        {
          success: false,
          error: "purpose cannot be empty",
        },
        { status: 400 }
      );
    }

    // Check whether the logged-in user is a doctor
    const { data: doctor, error: doctorError } = await supabase
      .from("doctors")
      .select("id")
      .eq("user_id", user.id)
      .single();

    if (doctorError || !doctor) {
      return NextResponse.json(
        {
          error: "Only authenticated doctors can create audit logs",
        },
        { status: 403 }
      );
    }

    // Insert audit log
    const { data, error } = await supabase
      .from("audit_logs")
      .insert({
        patient_id: cleanedPatientId,
        doctor_id: doctor.id,
        action: cleanedAction,
        purpose: cleanedPurpose,
      })
      .select()
      .single();

    if (error) {
      console.error("Audit log insertion error:", error);

      return NextResponse.json(
        {
          success: false,
          error: "Failed to create audit log",
        },
        { status: 500 }
      );
    }

    return NextResponse.json(
      {
        success: true,
        message: "Audit log created successfully",
        audit_log: data,
      },
      { status: 201 }
    );

  } catch (error) {
    console.error("Unexpected audit log POST error:", error);

    return NextResponse.json(
      {
        success: false,
        error: "Internal server error",
      },
      { status: 500 }
    );
  }
}


// GET - Fetch audit logs
export async function GET(request: NextRequest) {
  try {
    const { user, error: authError } = await authenticateUser(request);

    if (authError || !user) {
      return NextResponse.json(
        { error: authError },
        { status: 401 }
      );
    }

    // Create authenticated Supabase client
    const supabase = createClient(
      supabaseUrl,
      supabaseAnonKey,
      {
        global: {
          headers: {
            Authorization: request.headers.get("authorization")!,
          },
        },
      }
    );

    // Check whether the logged-in user is a doctor
    const { data: doctor, error: doctorError } = await supabase
      .from("doctors")
      .select("id")
      .eq("user_id", user.id)
      .single();

    if (doctorError || !doctor) {
      return NextResponse.json(
        {
          error: "Only authenticated doctors can view audit logs",
        },
        { status: 403 }
      );
    }

    // Get optional patient_id
    const { searchParams } = new URL(request.url);
    const patientId = searchParams.get("patient_id");

    // Validate optional patient_id
    if (patientId !== null) {
      const cleanedPatientId = patientId.trim();

      if (!cleanedPatientId) {
        return NextResponse.json(
          {
            success: false,
            error: "patient_id cannot be empty",
          },
          { status: 400 }
        );
      }

      if (!isValidUUID(cleanedPatientId)) {
        return NextResponse.json(
          {
            success: false,
            error: "patient_id must be a valid UUID",
          },
          { status: 400 }
        );
      }
    }

    // Get audit logs
    let query = supabase
      .from("audit_logs")
      .select("*")
      .eq("doctor_id", doctor.id)
      .order("created_at", { ascending: false });

    if (patientId) {
      query = query.eq("patient_id", patientId.trim());
    }

    const { data, error } = await query;

    if (error) {
      console.error("Audit log fetch error:", error);

      return NextResponse.json(
        {
          success: false,
          error: "Failed to fetch audit logs",
        },
        { status: 500 }
      );
    }

    return NextResponse.json(
      {
        success: true,
        message: "Audit logs fetched successfully",
        audit_logs: data,
      },
      { status: 200 }
    );

  } catch (error) {
    console.error("Unexpected audit log GET error:", error);

    return NextResponse.json(
      {
        success: false,
        error: "Internal server error",
      },
      { status: 500 }
    );
  }
}