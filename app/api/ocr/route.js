import { NextResponse } from "next/server";

export async function POST(request) {
    try {
        const formData = await request.formData();
        const file = formData.get("file");

        if (!file) {
            return NextResponse.json(
                { error: "No file uploaded" },
                { status: 400 }
            );
        }

        console.log("File received:", file.name);
        console.log("File size:", file.size);

        return NextResponse.json({
            success: true,
            message: "File uploaded successfully",
            filename: file.name,
            size: file.size,
        });
    } catch (error) {
        console.error("Upload error:", error);

        return NextResponse.json(
            {
                success: false,
                error: error.message,
            },
            { status: 500 }
        );
    }
}