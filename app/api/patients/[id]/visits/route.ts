import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

function getSupabaseClient(request: Request) {
  const authorization = request.headers.get("Authorization");

  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      global: {
        headers: authorization
          ? {
              Authorization: authorization,
            }
          : {},
      },
    }
  );
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = getSupabaseClient(request);
    const body = await request.json();

    const {
  health_worker_id,
  visit_type,
  chief_complaint,
  symptoms,
  examination_notes,
  diagonsis,
  treatment_plan,
  doctor_name,
  prescription_text,
  hospital_name,
  visit_date,
  referral_required,
} = body;

    const { data, error } = await supabase
      .from("visits")
      .insert([
        {
  patient_id: id,
  health_worker_id,
  visit_type,
  chief_complaint,
  symptoms,
  examination_notes,
  diagonsis,
  treatment_plan,
  doctor_name,
  prescription_text,
  hospital_name,
  visit_date,
  referral_required,
}
      ])
      .select()
      .single();

    if (error) {
      return NextResponse.json(
        {
          success: false,
          message: error.message,
        },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      message: "Patient visit created successfully",
      visit: data,
    });
  } catch (error) {
  console.error("Visit creation error:", error);

  return NextResponse.json(
    {
      success: false,
      message: error instanceof Error ? error.message : String(error),
    },
    { status: 500 }
  );
}
}