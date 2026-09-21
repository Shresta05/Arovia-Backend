import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    const { patient_id, accessed_by, reason } = body;

    if (!patient_id || !accessed_by || !reason) {
      return NextResponse.json(
        {
          error: "patient_id, accessed_by, and reason are required",
        },
        { status: 400 }
      );
    }

    const { data, error } = await supabaseAdmin
      .from("emergency_access_logs")
      .insert([
        {
          patient_id,
          accessed_by,
          reason,
        },
      ])
      .select()
      .single();

    if (error) {
      return NextResponse.json(
        {
          error: "Failed to create emergency access log",
          details: error.message,
        },
        { status: 500 }
      );
    }

    return NextResponse.json(
      {
        message: "Emergency access log created successfully",
        data,
      },
      { status: 201 }
    );
  } catch {
    return NextResponse.json(
      {
        error: "Invalid request",
      },
      { status: 400 }
    );
  }
}