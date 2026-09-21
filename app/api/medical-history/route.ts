import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

function getSupabaseClient(accessToken: string) {
  return createClient(
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
}

async function authenticateUser(req: NextRequest) {
  const authHeader = req.headers.get("Authorization");

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return {
      user: null,
      supabase: null,
      error: "Authorization token is required",
    };
  }

  const accessToken = authHeader.replace("Bearer ", "").trim();

  if (!accessToken) {
    return {
      user: null,
      supabase: null,
      error: "Authorization token is required",
    };
  }

  const supabase = getSupabaseClient(accessToken);

  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) {
    return {
      user: null,
      supabase: null,
      error: "Invalid or expired authorization token",
    };
  }

  return {
    user,
    supabase,
    error: null,
  };
}

// UUID validation
function isValidUUID(value: string) {
  const uuidRegex =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

  return uuidRegex.test(value);
}

// GET: Fetch medical history for a patient
export async function GET(req: NextRequest) {
  try {
    const {
      supabase,
      error: authError,
    } = await authenticateUser(req);

    if (authError || !supabase) {
      return NextResponse.json(
        { error: authError },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(req.url);
    const patient_id = searchParams.get("patient_id");

    if (!patient_id || !patient_id.trim()) {
      return NextResponse.json(
        { error: "patient_id is required" },
        { status: 400 }
      );
    }

    if (!isValidUUID(patient_id)) {
      return NextResponse.json(
        { error: "Invalid patient_id format" },
        { status: 400 }
      );
    }

    const { data, error } = await supabase
      .from("medical_history")
      .select("*")
      .eq("patient_id", patient_id)
      .order("diagnosis_date", { ascending: false });

    if (error) {
      return NextResponse.json(
        { error: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json(data, { status: 200 });

  } catch (error) {
    console.error("Medical history GET error:", error);

    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// POST: Add a new medical-history record
export async function POST(req: NextRequest) {
  try {
    const {
      supabase,
      error: authError,
    } = await authenticateUser(req);

    if (authError || !supabase) {
      return NextResponse.json(
        { error: authError },
        { status: 401 }
      );
    }

    const body = await req.json();

    const {
      patient_id,
      condition,
      diagnosis_date,
      treatment,
      notes,
    } = body;

    if (!patient_id || !condition) {
      return NextResponse.json(
        { error: "patient_id and condition are required" },
        { status: 400 }
      );
    }

    if (!isValidUUID(patient_id)) {
      return NextResponse.json(
        { error: "Invalid patient_id format" },
        { status: 400 }
      );
    }

    if (typeof condition !== "string" || !condition.trim()) {
      return NextResponse.json(
        { error: "condition must be a non-empty string" },
        { status: 400 }
      );
    }

    const { data, error } = await supabase
      .from("medical_history")
      .insert([
        {
          patient_id,
          condition: condition.trim(),
          diagnosis_date: diagnosis_date || null,
          treatment: treatment || null,
          notes: notes || null,
        },
      ])
      .select()
      .single();

    if (error) {
      return NextResponse.json(
        { error: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json(data, { status: 201 });

  } catch (error) {
    console.error("Medical history POST error:", error);

    return NextResponse.json(
      { error: "Invalid request body" },
      { status: 400 }
    );
  }
}