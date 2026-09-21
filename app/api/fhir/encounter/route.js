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

        const { data: visits, error } = await supabase
            .from("visits")
            .select("*")
            .eq("patient_id", patientId)
            .order("visit_date", { ascending: false });

        if (error) {
            return NextResponse.json(
                {
                    success: false,
                    error: error.message
                },
                { status: 500 }
            );
        }

        const fhirEncounters = (visits || []).map((visit) => {
            const encounter = {
                resourceType: "Encounter",
                id: visit.id,

                status: "finished",

                class: {
                    system:
                        "http://terminology.hl7.org/CodeSystem/v3-ActCode",
                    code: "AMB",
                    display: "Ambulatory"
                },

                subject: {
                    reference: `Patient/${visit.patient_id}`
                }
            };

            // Visit type
            if (visit.visit_type) {
                encounter.type = [
                    {
                        text: visit.visit_type
                    }
                ];
            }

            // Visit date
            if (visit.visit_date) {
                encounter.period = {
                    start: visit.visit_date
                };
            }

            // Chief complaint
            if (visit.chief_complaint) {
                encounter.reasonCode = [
                    {
                        text: visit.chief_complaint
                    }
                ];
            }

            // Symptoms and examination
            const clinicalNotes = [];

            if (visit.symptoms) {
                clinicalNotes.push(
                    `Symptoms: ${visit.symptoms}`
                );
            }

            if (visit.examination_notes) {
                clinicalNotes.push(
                    `Examination: ${visit.examination_notes}`
                );
            }

            // Diagnosis
            if (visit.diagnosis) {
                encounter.diagnosis = [
                    {
                        condition: {
                            display: visit.diagnosis
                        }
                    }
                ];
            }

            // Health worker
            if (visit.health_worker_id) {
                encounter.participant = [
                    {
                        individual: {
                            reference:
                                `Practitioner/${visit.health_worker_id}`
                        }
                    }
                ];
            }

            // Treatment and prescription
            if (visit.treatment_plan) {
                clinicalNotes.push(
                    `Treatment plan: ${visit.treatment_plan}`
                );
            }

            if (visit.prescription_text) {
                clinicalNotes.push(
                    `Prescription: ${visit.prescription_text}`
                );
            }

            if (visit.prescription_notes) {
                clinicalNotes.push(
                    `Prescription notes: ${visit.prescription_notes}`
                );
            }

            // Add all notes
            if (clinicalNotes.length > 0) {
                encounter.note = clinicalNotes.map((text) => ({
                    text
                }));
            }

            // Follow-up date
            if (visit.follow_up_date) {
                encounter.extension = [
                    {
                        url:
                            "https://arovia.health/fhir/StructureDefinition/follow-up-date",
                        valueDate: visit.follow_up_date
                    }
                ];
            }

            // Referral information
            if (visit.referral_required !== null) {
                if (!encounter.extension) {
                    encounter.extension = [];
                }

                encounter.extension.push({
                    url:
                        "https://arovia.health/fhir/StructureDefinition/referral-required",
                    valueBoolean: Boolean(
                        visit.referral_required
                    )
                });
            }

            if (visit.referral_notes) {
                if (!encounter.note) {
                    encounter.note = [];
                }

                encounter.note.push({
                    text:
                        `Referral notes: ${visit.referral_notes}`
                });
            }

            return encounter;
        });

        return NextResponse.json({
            success: true,
            resourceType: "Encounter",
            patient_id: patientId,
            total_encounters: fhirEncounters.length,
            fhir: fhirEncounters
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