import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

const MAX_REPORT_TEXT_LENGTH = 50000;

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

export async function POST(request: NextRequest) {
  try {
    // Authenticate user first
    const { user, error: authError } = await authenticateUser(request);

    if (authError || !user) {
      return NextResponse.json(
        { error: authError },
        { status: 401 }
      );
    }

    // Parse request body safely
    let body: unknown;

    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        {
          success: false,
          message: "Request body must contain valid JSON",
        },
        { status: 400 }
      );
    }

    // Make sure the body is a JSON object
    if (
      typeof body !== "object" ||
      body === null ||
      Array.isArray(body)
    ) {
      return NextResponse.json(
        {
          success: false,
          message: "Request body must be a JSON object",
        },
        { status: 400 }
      );
    }

    const { report_text } = body as {
      report_text?: unknown;
    };

    // Validate report_text exists
    if (report_text === undefined || report_text === null) {
      return NextResponse.json(
        {
          success: false,
          message: "report_text is required",
        },
        { status: 400 }
      );
    }

    // Validate report_text type
    if (typeof report_text !== "string") {
      return NextResponse.json(
        {
          success: false,
          message: "report_text must be a string",
        },
        { status: 400 }
      );
    }

    // Remove unnecessary whitespace
    const cleanedReportText = report_text.trim();

    // Reject empty or whitespace-only text
    if (!cleanedReportText) {
      return NextResponse.json(
        {
          success: false,
          message: "report_text cannot be empty",
        },
        { status: 400 }
      );
    }

    // Prevent excessively large report text
    if (cleanedReportText.length > MAX_REPORT_TEXT_LENGTH) {
      return NextResponse.json(
        {
          success: false,
          message: `report_text cannot exceed ${MAX_REPORT_TEXT_LENGTH} characters`,
        },
        { status: 400 }
      );
    }

    // Demo analysis
    const analysis = {
      summary: "This is a demo medical report summary.",
      important_findings: [
        "Sample finding extracted from the uploaded report.",
      ],
      questions_for_doctor: [
        "What do these results mean for the patient?",
      ],
      urgency_level: "Discuss with a healthcare professional",
    };

    return NextResponse.json({
      success: true,
      analysis,
      demo_mode: true,
    });

  } catch (error) {
    console.error("Report analysis error:", error);

    return NextResponse.json(
      {
        success: false,
        message: "Something went wrong",
      },
      { status: 500 }
    );
  }
}