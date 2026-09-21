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

        // Get documents belonging to the patient
        const { data: documents, error: documentError } = await supabase
            .from("document upload endpoint")
            .select("id, patient_id, file_name, file_url")
            .eq("patient_id", patientId);

        if (documentError) {
            return NextResponse.json(
                {
                    success: false,
                    error: documentError.message
                },
                { status: 500 }
            );
        }

        const documentIds = (documents || []).map(
            (document) => document.id
        );

        if (documentIds.length === 0) {
            return NextResponse.json({
                success: true,
                resourceType: "Observation",
                patient_id: patientId,
                total_observations: 0,
                fhir: []
            });
        }

        // Get investigation extractions
        const { data: extractions, error: extractionError } =
            await supabase
                .from("structured_extractions")
                .select("*")
                .in("document_id", documentIds)
                .eq("extraction_type", "investigation");

        if (extractionError) {
            return NextResponse.json(
                {
                    success: false,
                    error: extractionError.message
                },
                { status: 500 }
            );
        }

        // Convert AROVIA investigation data into FHIR Observation
        const observations = (extractions || []).map((extraction) => {
            const data = extraction.extracted_data || {};

            const valueText = data.value || "";

            // Extract numeric value from strings such as "13.5 g/dL"
            const valueMatch = String(valueText).match(
                /[-+]?\d*\.?\d+/
            );

            const numericValue = valueMatch
                ? Number(valueMatch[0])
                : null;

            // Extract unit such as "g/dL"
            const unitMatch = String(valueText).match(
                /[a-zA-Z%µ\/]+/
            );

            const unit = unitMatch ? unitMatch[0] : null;

            const observation = {
                resourceType: "Observation",

                id: extraction.id,

                status: "final",

                subject: {
                    reference: `Patient/${patientId}`
                },

                code: {
                    text: data.test || "Unknown investigation"
                }
            };

            if (numericValue !== null) {
                observation.valueQuantity = {
                    value: numericValue
                };

                if (unit) {
                    observation.valueQuantity.unit = unit;
                }
            } else if (valueText) {
                observation.valueString = valueText;
            }

            if (data.referenceRange) {
                const rangeMatch = String(
                    data.referenceRange
                ).match(
                    /([-+]?\d*\.?\d+)\s*(?:-|–|to)\s*([-+]?\d*\.?\d+)/
                );

                if (rangeMatch) {
                    observation.referenceRange = [
                        {
                            low: {
                                value: Number(rangeMatch[1])
                            },
                            high: {
                                value: Number(rangeMatch[2])
                            },
                            text: data.referenceRange
                        }
                    ];
                } else {
                    observation.referenceRange = [
                        {
                            text: data.referenceRange
                        }
                    ];
                }
            }

            observation.effectiveDateTime =
                extraction.created_at;

            return observation;
        });

        return NextResponse.json({
            success: true,
            resourceType: "Observation",
            patient_id: patientId,
            total_observations: observations.length,
            fhir: observations
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