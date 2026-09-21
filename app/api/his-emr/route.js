import { NextResponse } from "next/server";
import {
    validateFHIRBundle
} from "../../../lib/fhirValidator";
import { supabase } from "../../../lib/supabaseClient";

export const dynamic = "force-dynamic";

export async function POST(request) {
    try {
        const body = await request.json();

        if (!body.patient_id) {
            return NextResponse.json(
                {
                    success: false,
                    error: "patient_id is required"
                },
                { status: 400 }
            );
        }

        if (!Array.isArray(body.resources)) {
            return NextResponse.json(
                {
                    success: false,
                    error: "resources must be an array of FHIR resources"
                },
                { status: 400 }
            );
        }

        if (body.resources.length === 0) {
            return NextResponse.json(
                {
                    success: false,
                    error: "At least one FHIR resource is required"
                },
                { status: 400 }
            );
        }

        // ------------------------------------------------
        // STEP 1: Check patient consent
        // ------------------------------------------------

        const { data: consent, error: consentError } =
            await supabase
                .from("consent")
                .select("*")
                .eq("patient_id", body.patient_id)
                .eq("consent_type", "HIS_EMR_SHARING")
                .eq("status", "granted")
                .maybeSingle();

        if (consentError) {
            return NextResponse.json(
                {
                    success: false,
                    step: "consent_check",
                    error: consentError.message
                },
                { status: 500 }
            );
        }

        if (!consent) {
            return NextResponse.json(
                {
                    success: false,
                    status: "rejected",
                    reason: "CONSENT_REQUIRED",
                    message:
                        "Patient consent is required before sharing data with HIS/EMR."
                },
                { status: 403 }
            );
        }

        // Check consent expiry
        if (
            consent.expires_at &&
            new Date(consent.expires_at) < new Date()
        ) {
            return NextResponse.json(
                {
                    success: false,
                    status: "rejected",
                    reason: "CONSENT_EXPIRED",
                    message:
                        "Patient consent has expired. HIS/EMR sharing is not allowed."
                },
                { status: 403 }
            );
        }

        // ------------------------------------------------
        // STEP 2: Validate FHIR resources
        // ------------------------------------------------

        const validation = validateFHIRBundle(body.resources);

        if (!validation.valid) {
            return NextResponse.json(
                {
                    success: false,
                    status: "rejected",
                    reason: "FHIR_VALIDATION_FAILED",
                    message:
                        "FHIR validation failed. Data was not accepted by the mock HIS/EMR system.",
                    validation
                },
                { status: 422 }
            );
        }

        // ------------------------------------------------
        // STEP 3: Mock HIS/EMR acceptance
        // ------------------------------------------------

        const mockTransactionId =
            "MOCK-HIS-" + Date.now();

        return NextResponse.json({
            success: true,

            mode: "mock",

            status: "accepted",

            message:
                "Verified structured FHIR data accepted by mock HIS/EMR system after consent verification.",

            transaction_id: mockTransactionId,

            patient_id: body.patient_id,

            consent: {
                verified: true,
                consent_type: consent.consent_type,
                purpose: consent.purpose,
                status: consent.status
            },

            resource_summary: {
                total: body.resources.length,
                resource_types: body.resources.map(
                    (resource) => resource.resourceType
                )
            },

            validation: {
                valid: true,
                valid_count: validation.valid_count,
                invalid_count: validation.invalid_count
            },

            disclaimer:
                "This is a mock/demo HIS/EMR endpoint. No real hospital or EMR system was contacted."
        });
    } catch (error) {
        return NextResponse.json(
            {
                success: false,
                status: "error",
                error: error.message
            },
            { status: 400 }
        );
    }
}

export async function GET() {
    return NextResponse.json({
        success: true,
        endpoint: "/api/his-emr",
        method: "POST",
        mode: "mock",
        consent_required: true,
        message:
            "AROVIA mock HIS/EMR API is running"
    });
}