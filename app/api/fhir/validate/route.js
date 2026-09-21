import { NextResponse } from "next/server";
import { validateFHIRResource } from "../../../../lib/fhirValidator";

export const dynamic = "force-dynamic";

export async function POST(request) {
    try {
        const resource = await request.json();

        const validation = validateFHIRResource(resource);

        return NextResponse.json({
            success: true,
            valid: validation.valid,
            resourceType: resource?.resourceType || null,
            errors: validation.errors
        });
    } catch (error) {
        return NextResponse.json(
            {
                success: false,
                valid: false,
                errors: ["Invalid JSON payload"],
                details: error.message
            },
            { status: 400 }
        );
    }
}