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

        const { data, error } = await supabase
            .from("lab_reports")
            .select("*")
            .eq("patient_id", patientId);

        if (error) {
            return NextResponse.json(
                {
                    success: false,
                    error: error.message
                },
                { status: 500 }
            );
        }

        const fhirReports = (data || []).map((report) => ({
            resourceType: "DiagnosticReport",
            id: String(report.id),

            status:
                report.report_status === "available"
                    ? "final"
                    : "unknown",

            category: [
                {
                    text: report.report_type || "Laboratory"
                }
            ],

            code: {
                text: report.report_name || "Diagnostic report"
            },

            subject: {
                reference: `Patient/${report.patient_id}`
            },

            effectiveDateTime: report.report_date || undefined,

            performer: [
                ...(report.doctor_name
                    ? [
                        {
                            display: report.doctor_name
                        }
                    ]
                    : []),

                ...(report.hospital_name
                    ? [
                        {
                            display: report.hospital_name
                        }
                    ]
                    : [])
            ],

            conclusion: report.notes || undefined,

            presentedForm: report.report_file_url
                ? [
                    {
                        url: report.report_file_url,
                        title:
                            report.report_name ||
                            "Diagnostic report"
                    }
                ]
                : undefined
        }));

        return NextResponse.json({
            success: true,
            resourceType: "DiagnosticReport",
            patient_id: patientId,
            total_reports: fhirReports.length,
            fhir: fhirReports
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