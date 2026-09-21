import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

function isValidUUID(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value
  );
}

function isValidDate(value: string): boolean {
  return !Number.isNaN(Date.parse(value));
}

function createSupabaseClient(token: string) {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      global: {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      },
    }
  );
}

async function authenticate(req: NextRequest) {
  const authHeader = req.headers.get("authorization");

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return {
      user: null,
      error: NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 }
      ),
    };
  }

  const token = authHeader.substring(7).trim();

  if (!token) {
    return {
      user: null,
      error: NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 }
      ),
    };
  }

  const supabase = createSupabaseClient(token);

  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) {
    return {
      user: null,
      error: NextResponse.json(
        { success: false, error: "Invalid or expired token" },
        { status: 401 }
      ),
    };
  }

  return { user, error: null };
}

/* =========================
   POST - CREATE CONSENT
========================= */

export async function POST(req: NextRequest) {
  const auth = await authenticate(req);

  if (auth.error) {
    return auth.error;
  }

  try {
    const body = await req.json();

    if (!body || typeof body !== "object" || Array.isArray(body)) {
      return NextResponse.json(
        { success: false, error: "Request body must be a JSON object" },
        { status: 400 }
      );
    }

    const {
      patient_id,
      doctor_id,
      consent_type,
      status,
      expires_at,
      purpose,
      record_type,
    } = body;

    if (!patient_id || !consent_type) {
      return NextResponse.json(
        {
          success: false,
          error: "patient_id and consent_type are required",
        },
        { status: 400 }
      );
    }

    if (typeof patient_id !== "string" || !patient_id.trim()) {
      return NextResponse.json(
        { success: false, error: "patient_id must be a non-empty string" },
        { status: 400 }
      );
    }

    if (!isValidUUID(patient_id.trim())) {
      return NextResponse.json(
        { success: false, error: "Invalid patient_id format" },
        { status: 400 }
      );
    }

    if (typeof consent_type !== "string" || !consent_type.trim()) {
      return NextResponse.json(
        { success: false, error: "consent_type must be a non-empty string" },
        { status: 400 }
      );
    }

    const consentStatus = status ?? "granted";

    if (
      typeof consentStatus !== "string" ||
      !["granted", "revoked"].includes(consentStatus)
    ) {
      return NextResponse.json(
        {
          success: false,
          error: "status must be either granted or revoked",
        },
        { status: 400 }
      );
    }

    if (doctor_id !== undefined && doctor_id !== null) {
      if (typeof doctor_id !== "string" || !doctor_id.trim()) {
        return NextResponse.json(
          { success: false, error: "doctor_id must be a non-empty string" },
          { status: 400 }
        );
      }

      if (!isValidUUID(doctor_id.trim())) {
        return NextResponse.json(
          { success: false, error: "Invalid doctor_id format" },
          { status: 400 }
        );
      }
    }

    if (expires_at !== undefined && expires_at !== null) {
      if (typeof expires_at !== "string" || !isValidDate(expires_at)) {
        return NextResponse.json(
          { success: false, error: "Invalid expires_at date" },
          { status: 400 }
        );
      }
    }

    if (purpose !== undefined && purpose !== null) {
      if (typeof purpose !== "string" || !purpose.trim()) {
        return NextResponse.json(
          { success: false, error: "purpose must be a non-empty string" },
          { status: 400 }
        );
      }
    }

    if (record_type !== undefined && record_type !== null) {
      if (typeof record_type !== "string" || !record_type.trim()) {
        return NextResponse.json(
          { success: false, error: "record_type must be a non-empty string" },
          { status: 400 }
        );
      }
    }

    const insertData: Record<string, any> = {
      patient_id: patient_id.trim(),
      consent_type: consent_type.trim(),
      status: consentStatus,
    };

    if (doctor_id) {
      insertData.doctor_id = doctor_id.trim();
    }

    if (expires_at) {
      insertData.expires_at = expires_at;
    }

    if (purpose) {
      insertData.purpose = purpose.trim();
    }

    if (record_type) {
      insertData.record_type = record_type.trim();
    }

    const { data, error } = await supabaseAdmin
      .from("consent")
      .insert(insertData)
      .select()
      .single();

    if (error) {
      console.error("CONSENT INSERT ERROR:", error);

      return NextResponse.json(
        {
          success: false,
          error: "Failed to create consent",
          details: error.message,
          code: error.code,
          hint: error.hint,
        },
        { status: 500 }
      );
    }

    return NextResponse.json(
      {
        success: true,
        data,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("CONSENT POST ERROR:", error);

    return NextResponse.json(
      {
        success: false,
        error: "Invalid request",
      },
      { status: 400 }
    );
  }
}

/* =========================
   GET - FETCH CONSENT
========================= */

export async function GET(req: NextRequest) {
  const auth = await authenticate(req);

  if (auth.error) {
    return auth.error;
  }

  const { searchParams } = new URL(req.url);

  const patientId = searchParams.get("patient_id");
  const consentId = searchParams.get("id");

  if (!patientId && !consentId) {
    return NextResponse.json(
      {
        success: false,
        error: "patient_id or id is required",
      },
      { status: 400 }
    );
  }

  if (patientId) {
    if (!patientId.trim() || !isValidUUID(patientId.trim())) {
      return NextResponse.json(
        {
          success: false,
          error: "Invalid patient_id format",
        },
        { status: 400 }
      );
    }
  }

  if (consentId) {
    if (!consentId.trim() || !isValidUUID(consentId.trim())) {
      return NextResponse.json(
        {
          success: false,
          error: "Invalid consent id format",
        },
        { status: 400 }
      );
    }
  }

  try {
    if (consentId) {
      const { data, error } = await supabaseAdmin
        .from("consent")
        .select("*")
        .eq("id", consentId.trim())
        .single();

      if (error) {
        console.error("CONSENT GET ERROR:", error);

        return NextResponse.json(
          {
            success: false,
            error: "Failed to fetch consent",
            details: error.message,
            code: error.code,
            hint: error.hint,
          },
          { status: 500 }
        );
      }

      return NextResponse.json({
        success: true,
        data,
      });
    }

    const { data, error } = await supabaseAdmin
      .from("consent")
      .select("*")
      .eq("patient_id", patientId!.trim());

    if (error) {
      console.error("CONSENT GET ERROR:", error);

      return NextResponse.json(
        {
          success: false,
          error: "Failed to fetch consent",
          details: error.message,
          code: error.code,
          hint: error.hint,
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      data,
    });
  } catch (error) {
    console.error("CONSENT GET ERROR:", error);

    return NextResponse.json(
      {
        success: false,
        error: "Failed to fetch consent",
      },
      { status: 500 }
    );
  }
}

/* =========================
   PATCH - REVOKE CONSENT
========================= */

export async function PATCH(req: NextRequest) {
  const auth = await authenticate(req);

  if (auth.error) {
    return auth.error;
  }

  try {
    const body = await req.json();

    if (!body || typeof body !== "object" || Array.isArray(body)) {
      return NextResponse.json(
        {
          success: false,
          error: "Request body must be a JSON object",
        },
        { status: 400 }
      );
    }

    const { searchParams } = new URL(req.url);

    const consentId =
      body.id ||
      body.consent_id ||
      searchParams.get("id");

    if (
      typeof consentId !== "string" ||
      !consentId.trim()
    ) {
      return NextResponse.json(
        {
          success: false,
          error: "Consent id is required",
        },
        { status: 400 }
      );
    }

    if (!isValidUUID(consentId.trim())) {
      return NextResponse.json(
        {
          success: false,
          error: "Invalid consent id format",
        },
        { status: 400 }
      );
    }

    const { status } = body;

    if (
      typeof status !== "string" ||
      !["granted", "revoked"].includes(status)
    ) {
      return NextResponse.json(
        {
          success: false,
          error: "status must be either granted or revoked",
        },
        { status: 400 }
      );
    }

    const updateData: Record<string, any> = {
      status,
    };

    if (status === "revoked") {
      updateData.revoked_at = new Date().toISOString();
    }

    const { data, error } = await supabaseAdmin
      .from("consent")
      .update(updateData)
      .eq("id", consentId.trim())
      .select()
      .single();

    if (error) {
      console.error("CONSENT UPDATE ERROR:", error);

      return NextResponse.json(
        {
          success: false,
          error: "Failed to update consent",
          details: error.message,
          code: error.code,
          hint: error.hint,
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      data,
    });
  } catch (error) {
    console.error("CONSENT PATCH ERROR:", error);

    return NextResponse.json(
      {
        success: false,
        error: "Invalid request",
      },
      { status: 400 }
    );
  }
}