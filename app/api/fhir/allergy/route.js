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

        // Get allergy records for the patient
        const { data: allergies, error } = await supabase
            .from("allergies_medications")
            .select("*")
            .eq("patient_id", patientId)
            .ilike("item_type", "allergy")
            .order("created_at", { ascending: false });

        if (error) {
            return NextResponse.json(
                {
                    success: false,
                    error: error.message
                },
                { status: 500 }
            );
        }

        // Convert AROVIA allergies to FHIR AllergyIntolerance resources
        const fhirAllergies = (allergies || []).map((allergy) => {
            const allergyName =
                allergy.allergy_name ||
                allergy.name ||
                "Unknown allergy";

            const resource = {
                resourceType: "AllergyIntolerance",

                id: allergy.id,

                patient: {
                    reference: `Patient/${allergy.patient_id}`
                },

                code: {
                    text: allergyName
                },

                verificationStatus: {
                    coding: [
                        {
                            system:
                                "http://terminology.hl7.org/CodeSystem/allergyintolerance-verification",
                            code: "confirmed",
                            display: "Confirmed"
                        }
                    ]
                },

                clinicalStatus: {
                    coding: [
                        {
                            system:
                                "http://terminology.hl7.org/CodeSystem/allergyintolerance-clinical",
                            code: "active",
                            display: "Active"
                        }
                    ]
                }
            };

            if (allergy.reaction) {
                resource.reaction = [
                    {
                        manifestation: [
                            {
                                text: allergy.reaction
                            }
                        ]
                    }
                ];
            }

            if (allergy.notes) {
                resource.note = [
                    {
                        text: allergy.notes
                    }
                ];
            }

            return resource;
        });

        return NextResponse.json({
            success: true,
            resourceType: "AllergyIntolerance",
            patient_id: patientId,
            total_allergies: fhirAllergies.length,
            fhir: fhirAllergies
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