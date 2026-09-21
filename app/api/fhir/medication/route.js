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

        // Get medications for the patient
        const { data: medications, error } = await supabase
            .from("allergies_medications")
            .select("*")
            .eq("patient_id", patientId)
            .ilike("item_type", "medication")
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

        // Convert AROVIA medications to FHIR Medication resources
        const fhirMedications = (medications || []).map((medication) => {
            const resource = {
                resourceType: "Medication",

                id: medication.id,

                code: {
                    text: medication.name || "Unknown medication"
                }
            };

            if (medication.dosage) {
                resource.dosage = [
                    {
                        text: medication.dosage
                    }
                ];
            }

            if (medication.frequency) {
                if (!resource.dosage) {
                    resource.dosage = [
                        {
                            text: medication.frequency
                        }
                    ];
                } else {
                    resource.dosage[0].text =
                        `${medication.dosage}, ${medication.frequency}`;
                }
            }

            if (medication.route) {
                resource.doseForm = {
                    text: medication.route
                };
            }

            if (medication.start_date || medication.end_date) {
                resource.extension = [];

                if (medication.start_date) {
                    resource.extension.push({
                        url: "https://arovia.health/fhir/StructureDefinition/medication-start-date",
                        valueDate: medication.start_date
                    });
                }

                if (medication.end_date) {
                    resource.extension.push({
                        url: "https://arovia.health/fhir/StructureDefinition/medication-end-date",
                        valueDate: medication.end_date
                    });
                }
            }

            if (medication.notes) {
                resource.note = [
                    {
                        text: medication.notes
                    }
                ];
            }

            return resource;
        });

        return NextResponse.json({
            success: true,
            resourceType: "Medication",
            patient_id: patientId,
            total_medications: fhirMedications.length,
            fhir: fhirMedications
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