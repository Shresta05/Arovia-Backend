import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

const MAX_FILE_SIZE = 10 * 1024 * 1024;

const ALLOWED_FILE_TYPES = [
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
];

function isValidUUID(value: string) {
  const uuidRegex =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

  return uuidRegex.test(value);
}

function isValidDate(value: string) {
  if (!value.trim()) return false;

  const date = new Date(value);

  return !Number.isNaN(date.getTime());
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

    const formData = await request.formData();

    const file = formData.get("file");
    const patientId = formData.get("patient_id");
    const uploadedBy = formData.get("uploaded_by");
    const reportType = formData.get("report_type");
    const title = formData.get("title");
    const description = formData.get("description");
    const doctorName = formData.get("doctor_name");
    const reportDate = formData.get("report_date");

    // Validate file
    if (!(file instanceof File)) {
      return NextResponse.json(
        { error: "A valid file is required" },
        { status: 400 }
      );
    }

    // Validate patient ID
    if (
      typeof patientId !== "string" ||
      !patientId.trim()
    ) {
      return NextResponse.json(
        { error: "patient_id is required" },
        { status: 400 }
      );
    }

    if (!isValidUUID(patientId)) {
      return NextResponse.json(
        { error: "Invalid patient_id format" },
        { status: 400 }
      );
    }

    // Validate report type
    if (
      typeof reportType !== "string" ||
      !reportType.trim()
    ) {
      return NextResponse.json(
        { error: "report_type must be a non-empty string" },
        { status: 400 }
      );
    }

    // Validate title
    if (
      typeof title !== "string" ||
      !title.trim()
    ) {
      return NextResponse.json(
        { error: "title must be a non-empty string" },
        { status: 400 }
      );
    }

    // Validate file name
    if (!file.name || !file.name.trim()) {
      return NextResponse.json(
        { error: "File name is required" },
        { status: 400 }
      );
    }

    // Validate empty file
    if (file.size === 0) {
      return NextResponse.json(
        { error: "File cannot be empty" },
        { status: 400 }
      );
    }

    // Validate file size
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: "File size must not exceed 10 MB" },
        { status: 400 }
      );
    }

    // Validate file type
    if (!ALLOWED_FILE_TYPES.includes(file.type)) {
      return NextResponse.json(
        {
          error:
            "Unsupported file type. Allowed types: PDF, JPEG, PNG, and WEBP",
        },
        { status: 400 }
      );
    }

    // Validate optional report date
    if (reportDate !== null) {
      if (
        typeof reportDate !== "string" ||
        !isValidDate(reportDate)
      ) {
        return NextResponse.json(
          { error: "Invalid report_date format" },
          { status: 400 }
        );
      }
    }

    const fileName = `${Date.now()}-${file.name}`;
    const filePath = `${patientId}/${fileName}`;

    const fileBuffer = Buffer.from(await file.arrayBuffer());

    // Upload file to Supabase Storage
    const { error: uploadError } = await supabaseAdmin.storage
      .from("medical-documents")
      .upload(filePath, fileBuffer, {
        contentType: file.type,
        upsert: false,
      });

    if (uploadError) {
      return NextResponse.json(
        { error: uploadError.message },
        { status: 500 }
      );
    }

    // Generate public URL
    const { data: publicUrlData } = supabaseAdmin.storage
      .from("medical-documents")
      .getPublicUrl(filePath);

    const fileUrl = publicUrlData.publicUrl;

    // Create report record
    const { data: report, error: reportError } = await supabaseAdmin
      .from("reports_prescriptions")
      .insert({
        patient_id: patientId,
        uploaded_by:
          typeof uploadedBy === "string" && uploadedBy.trim()
            ? uploadedBy.trim()
            : null,
        report_type: reportType.trim(),
        title: title.trim(),
        description:
          typeof description === "string" && description.trim()
            ? description.trim()
            : null,
        doctor_name:
          typeof doctorName === "string" && doctorName.trim()
            ? doctorName.trim()
            : null,
        report_date:
          typeof reportDate === "string" && reportDate.trim()
            ? reportDate
            : null,
        file_name: file.name,
        file_path: filePath,
        file_url: fileUrl,
      })
      .select()
      .single();

    if (reportError) {
      // Delete uploaded file if database insertion fails
      await supabaseAdmin.storage
        .from("medical-documents")
        .remove([filePath]);

      return NextResponse.json(
        { error: reportError.message },
        { status: 500 }
      );
    }

    return NextResponse.json(
      {
        message: "File uploaded and report created successfully",
        data: report,
      },
      { status: 200 }
    );

  } catch (error) {
    console.error("Complete upload error:", error);

    return NextResponse.json(
      { error: "Invalid request" },
      { status: 400 }
    );
  }
}