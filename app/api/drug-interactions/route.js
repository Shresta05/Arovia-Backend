import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

export async function GET(request) {
    try {
        const { searchParams } = new URL(request.url);
        const patientId = searchParams.get("patient_id");

        if (!patientId) {
            return NextResponse.json(
                {
                    success: false,
                    error: "patient_id is required",
                },
                { status: 400 }
            );
        }

        const supabase = createClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL,
            process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
        );

        // Get active medications for this patient
        const { data: medications, error: medicationError } = await supabase
            .from("allergies_medications")
            .select("*")
            .eq("patient_id", patientId)
            .eq("item_type", "medication")
            .eq("status", "active");

        if (medicationError) {
            throw medicationError;
        }

        // Get drug interaction rules
        const { data: rules, error: rulesError } = await supabase
            .from("drug_interaction_rules")
            .select("*");

        if (rulesError) {
            throw rulesError;
        }

        const alerts = [];

        // Compare every medication pair
        for (let i = 0; i < medications.length; i++) {
            for (let j = i + 1; j < medications.length; j++) {
                const medicationA = medications[i].name.trim().toLowerCase();
                const medicationB = medications[j].name.trim().toLowerCase();

                const matchingRule = rules.find((rule) => {
                    const drugA = rule.drug_a.trim().toLowerCase();
                    const drugB = rule.drug_b.trim().toLowerCase();

                    return (
                        (drugA === medicationA && drugB === medicationB) ||
                        (drugA === medicationB && drugB === medicationA)
                    );
                });

                if (matchingRule) {
                    alerts.push({
                        medication_1: medications[i].name,
                        medication_2: medications[j].name,
                        severity: matchingRule.severity,
                        alert_message: matchingRule.alert_message,
                        source: matchingRule.source,
                    });
                }
            }
        }

        return NextResponse.json({
            success: true,
            patient_id: patientId,
            medications_checked: medications.map((medication) => ({
                name: medication.name,
                dosage: medication.dosage,
                frequency: medication.frequency,
            })),
            total_alerts: alerts.length,
            alerts,
        });
    } catch (error) {
        console.error("Drug interaction API error:", error);

        return NextResponse.json(
            {
                success: false,
                error: error.message,
            },
            { status: 500 }
        );
    }
}