import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const patient_id = searchParams.get("patient_id");

    let query = supabaseAdmin
      .from("emergency_access_logs")
      .select("*")
      .order("access_time", { ascending: false });

    if (patient_id) {
      query = query.eq("patient_id", patient_id);
    }

    const { data, error } = await query;

    if (error) {
      return NextResponse.json(
        {
          error: "Failed to fetch emergency access logs",
          details: error.message,
        },
        { status: 500 }
      );
    }

    return NextResponse.json(
      {
        message: "Emergency access logs fetched successfully",
        data,
      },
      { status: 200 }
    );
  } catch (error) {
    return NextResponse.json(
      {
        error: "Invalid request",
      },
      { status: 400 }
    );
  }
}