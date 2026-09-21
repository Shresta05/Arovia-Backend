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

        // Get medical history for the patient
        const { data: conditions, error } = await supabase
            .from("medical_history")
            .select("*")
            .eq("patient_id", patientId)
            .order("diagnosis_date", { ascending: false });

        if (error) {
            return NextResponse.json(
                {
                    success: false,
                    error: error.message
                },
                { status: 500 }
            );
        }

        // Convert each AROVIA medical history record
        // into a FHIR Condition resource
        const fhirConditions = (conditions || []).map((condition) => {
            const fhirCondition = {
                resourceType: "Condition",

                id: condition.id,

                subject: {
                    reference: `Patient/${condition.patient_id}`
                },

                code: {
                    text: condition.condition || "Unknown condition"
                }
            };

            if (condition.diagnosis_date) {
                fhirCondition.onsetDateTime =
                    condition.diagnosis_date;
            }

            if (condition.treatment) {
                fhirCondition.note = [
                    {
                        text: `Treatment: ${condition.treatment}`
                    }
                ];
            }

            if (condition.notes) {
                if (!fhirCondition.note) {
                    fhirCondition.note = [];
                }

                fhirCondition.note.push({
                    text: condition.notes
                });
            }

            return fhirCondition;
        });

        return NextResponse.json({
            success: true,
            resourceType: "Condition",
            patient_id: patientId,
            total_conditions: fhirConditions.length,
            fhir: fhirConditions
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