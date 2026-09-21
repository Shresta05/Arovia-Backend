import { NextResponse } from "next/server";
import { supabase } from "../../../../lib/supabaseClient";

export const dynamic = "force-dynamic";

export async function POST(request) {
    try {
        const body = await request.json();

        const patientId = body.patient_id;
        const abhaNumber = body.abha_number;
        const abhaAddress = body.abha_address;

        if (!patientId) {
            return NextResponse.json(
                {
                    success: false,
                    error: "patient_id is required"
                },
                { status: 400 }
            );
        }

        if (!abhaNumber && !abhaAddress) {
            return NextResponse.json(
                {
                    success: false,
                    error: "abha_number or abha_address is required"
                },
                { status: 400 }
            );
        }

        // Check patient
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
                    error: patientError.message,
                    details: patientError
                },
                { status: 500 }
            );
        }

        if (!patient) {
            return NextResponse.json(
                {
                    success: false,
                    step: "patient_lookup",
                    error: "Patient not found"
                },
                { status: 404 }
            );
        }

        // Insert/update ABDM identity link
        const { data, error } = await supabase
            .from("abdm_identity_links")
            .upsert(
                {
                    patient_id: patientId,
                    abha_number: abhaNumber || null,
                    abha_address: abhaAddress || null,
                    link_status: "mock_linked",
                    identity_source: "AROVIA_DEMO",
                    linked_at: new Date().toISOString(),
                    updated_at: new Date().toISOString()
                },
                {
                    onConflict: "patient_id"
                }
            )
            .select()
            .single();

        if (error) {
            return NextResponse.json(
                {
                    success: false,
                    step: "abdm_identity_link",
                    error: error.message,
                    details: error
                },
                { status: 500 }
            );
        }

        return NextResponse.json({
            success: true,
            message:
                "ABDM identity linked successfully in mock/demo mode",
            mode: "mock",
            patient: {
                id: patient.id,
                full_name: patient.full_name
            },
            abdm_identity: data
        });
    } catch (error) {
        return NextResponse.json(
            {
                success: false,
                step: "request_processing",
                error: error.message
            },
            { status: 400 }
        );
    }
}

export async function GET() {
    return NextResponse.json({
        success: true,
        message: "ABDM linking API is running",
        endpoint: "/api/abdm/link",
        method: "POST",
        mode: "mock"
    });
}