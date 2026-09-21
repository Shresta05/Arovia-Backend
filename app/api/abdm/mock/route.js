import { NextResponse } from "next/server";
import { supabase } from "../../../../lib/supabaseClient";

export const dynamic = "force-dynamic";

export async function POST(request) {
    try {
        const body = await request.json();

        const patientId = body.patient_id;

        if (!patientId) {
            return NextResponse.json(
                {
                    success: false,
                    error: "patient_id is required"
                },
                { status: 400 }
            );
        }

        // Check patient exists
        const { data: patient, error: patientError } =
            await supabase
                .from("patients")
                .select("id, full_name")
                .eq("id", patientId)
                .maybeSingle();

        if (patientError) {
            return NextResponse.json(
                {
                    success: false,
                    step: "patient_lookup",
                    error: patientError.message
                },
                { status: 500 }
            );
        }

        if (!patient) {
            return NextResponse.json(
                {
                    success: false,
                    error: "Patient not found"
                },
                { status: 404 }
            );
        }

        // Check existing mock ABDM identity
        const { data: identity, error: identityError } =
            await supabase
                .from("abdm_identity_links")
                .select("*")
                .eq("patient_id", patientId)
                .maybeSingle();

        if (identityError) {
            return NextResponse.json(
                {
                    success: false,
                    step: "identity_lookup",
                    error: identityError.message
                },
                { status: 500 }
            );
        }

        if (!identity) {
            return NextResponse.json(
                {
                    success: false,
                    error:
                        "No ABDM identity link found. Create the mock identity link first."
                },
                { status: 404 }
            );
        }

        // Generate a clearly fake demo session ID
        const mockSessionId =
            "MOCK-ABDM-" +
            Date.now();

        return NextResponse.json({
            success: true,

            mode: "mock",

            message:
                "ABDM sandbox/mock flow completed successfully",

            mock_session: {
                session_id: mockSessionId,
                status: "authenticated",
                environment: "AROVIA_DEMO",
                expires_in: 3600
            },

            patient: {
                id: patient.id,
                full_name: patient.full_name
            },

            abdm_identity: {
                abha_number: identity.abha_number,
                abha_address: identity.abha_address,
                link_status: identity.link_status
            },

            fhir_exchange: {
                status: "ready",
                message:
                    "FHIR records can be prepared for mock ABDM exchange"
            },

            disclaimer:
                "This is a mock/demo ABDM flow. No real ABDM service or real ABHA verification was performed."
        });
    } catch (error) {
        return NextResponse.json(
            {
                success: false,
                error: error.message
            },
            { status: 400 }
        );
    }
}

export async function GET() {
    return NextResponse.json({
        success: true,
        endpoint: "/api/abdm/mock",
        method: "POST",
        mode: "mock",
        message:
            "AROVIA mock ABDM sandbox endpoint is running"
    });
}