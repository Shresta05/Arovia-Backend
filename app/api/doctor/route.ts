import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export async function POST(request: Request) {
  try {
    const { name, email, password, hospital_name } =
      await request.json();

    // Check required fields
    if (!name || !email || !password || !hospital_name) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Name, email, password and hospital name are required",
        },
        { status: 400 }
      );
    }

    // Create doctor account in Supabase Auth
    const { data, error } = await supabase.auth.signUp({
      email,
      password,

      // Send doctor information as Auth metadata
      options: {
        data: {
          name: name,
          hospital_name: hospital_name,
        },
      },
    });

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
      message: "Doctor signup successful",
      user: data.user,
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        message: "Something went wrong",
      },
      { status: 500 }
    );
  }
}