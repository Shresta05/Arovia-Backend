import { NextResponse } from "next/server";
import { supabase } from "../../../../lib/supabaseClient";

export const dynamic = "force-dynamic";

export async function GET(request) {
    try {
        const { searchParams } = new URL(request.url);
        const patientId = searchParams.get("patient_id");

        if (!patientId) {
            return NextResponse.json(
                {
                    success: false,
                    error: "patient_id is required"
                },
                { status: 400 }
            );
        }

        // Get patient from AROVIA database
        const { data: patients, error } = await supabase
            .from("patients")
            .select("*")
            .eq("id", patientId);

        if (error) {
            return NextResponse.json(
                {
                    success: false,
                    error: error.message
                },
                { status: 500 }
            );
        }

        if (!patients || patients.length === 0) {
            return NextResponse.json(
                {
                    success: false,
                    error: "Patient not found",
                    patient_id: patientId
                },
                { status: 404 }
            );
        }

        const patient = patients[0];

        // Convert AROVIA patient data to FHIR Patient resource
        const fhirPatient = {
            resourceType: "Patient",

            id: patient.id,

            identifier: [
                {
                    system: "https://arovia.health/patient-id",
                    value: patient.id
                }
            ],

            name: [
                {
                    text: patient.full_name || ""
                }
            ],

            gender: patient.gender || undefined,

            birthDate: patient.date_of_birth || undefined,

            telecom: [
                patient.phone
                    ? {
                        system: "phone",
                        value: patient.phone
                    }
                    : null,

                patient.email
                    ? {
                        system: "email",
                        value: patient.email
                    }
                    : null
            ].filter(Boolean),

            address:
                patient.address ||
                    patient.village ||
                    patient.district ||
                    patient.state
                    ? [
                        {
                            text: [
                                patient.address,
                                patient.village,
                                patient.district,
                                patient.state
                            ]
                                .filter(Boolean)
                                .join(", ")
                        }
                    ]
                    : undefined,

            communication: patient.preferred_language
                ? [
                    {
                        language: {
                            text: patient.preferred_language
                        }
                    }
                ]
                : undefined,

            contact: patient.emergency_contact_name
                ? [
                    {
                        relationship: [
                            {
                                text: "Emergency contact"
                            }
                        ],

                        name: {
                            text: patient.emergency_contact_name
                        },

                        telecom: patient.emergency_contact_phone
                            ? [
                                {
                                    system: "phone",
                                    value:
                                        patient.emergency_contact_phone
                                }
                            ]
                            : []
                    }
                ]
                : undefined
        };

        return NextResponse.json({
            success: true,
            resourceType: "Patient",
            fhir: fhirPatient
        });
    } catch (error) {
        return NextResponse.json(
            {
                success: false,
                error: error.message
            },
            { status: 500 }
        );
    }
}