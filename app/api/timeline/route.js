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

        const timeline = [];

        // -----------------------------------------
        // 1. PRESCRIPTIONS / REPORTS
        // -----------------------------------------

        const { data: reports, error: reportsError } = await supabase
            .from("reports_prescriptions")
            .select("*")
            .eq("patient_id", patientId);

        if (reportsError) throw reportsError;

        reports?.forEach((report) => {
            timeline.push({
                type: "prescription_report",
                date: report.report_date || report.created_at || null,
                source_document_url: report.file_url || null,
                data: report,
            });
        });

        // -----------------------------------------
        // 2. PATIENT DOCUMENTS
        // -----------------------------------------

        const { data: documents, error: documentsError } = await supabase
            .from("document upload endpoint")
            .select("*")
            .eq("patient_id", patientId);

        if (documentsError) throw documentsError;

        // -----------------------------------------
        // 3. LAB EXTRACTIONS
        // -----------------------------------------

        const documentIds = (documents || []).map(
            (document) => document.id
        );

        if (documentIds.length > 0) {
            const { data: extractions, error: extractionError } =
                await supabase
                    .from("structured_extractions")
                    .select("*")
                    .in("document_id", documentIds)
                    .eq("extraction_type", "investigation");

            if (extractionError) throw extractionError;

            extractions?.forEach((extraction) => {
                const extracted = extraction.extracted_data || {};

                const valueText = String(extracted.value || "");
                const rangeText = String(extracted.referenceRange || "");

                const valueMatch = valueText.match(
                    /[-+]?\d*\.?\d+/
                );

                const rangeMatch = rangeText.match(
                    /([-+]?\d*\.?\d+)\s*(?:-|–|to)\s*([-+]?\d*\.?\d+)/
                );

                let numericValue = null;
                let lowerLimit = null;
                let upperLimit = null;
                let abnormalFlag = "unknown";
                let flagType = "none";

                if (valueMatch) {
                    numericValue = Number(valueMatch[0]);
                }

                if (rangeMatch) {
                    lowerLimit = Number(rangeMatch[1]);
                    upperLimit = Number(rangeMatch[2]);
                }

                // -----------------------------------------
                // CLINICIAN-ATTENTION FLAG LOGIC
                // -----------------------------------------

                if (
                    numericValue !== null &&
                    lowerLimit !== null &&
                    upperLimit !== null
                ) {
                    if (numericValue < lowerLimit) {
                        abnormalFlag = "low";
                        flagType = "clinician_attention";
                    } else if (numericValue > upperLimit) {
                        abnormalFlag = "high";
                        flagType = "clinician_attention";
                    } else {
                        abnormalFlag = "normal";
                        flagType = "none";
                    }
                }

                const document = documents.find(
                    (item) => item.id === extraction.document_id
                );

                timeline.push({
                    type: "investigation",
                    date:
                        document?.created_at ||
                        extraction.created_at ||
                        null,

                    source_document_url:
                        document?.file_url || null,

                    data: {
                        test: extracted.test || null,
                        value: extracted.value || null,
                        referenceRange:
                            extracted.referenceRange || null,

                        numericValue,
                        lowerLimit,
                        upperLimit,

                        abnormalFlag,

                        // This is a review flag, NOT a diagnosis
                        flagType,

                        clinicianAttention:
                            flagType === "clinician_attention",
                    },
                });
            });
        }

        // -----------------------------------------
        // 4. LAB REPORTS
        // -----------------------------------------

        const { data: labs, error: labsError } = await supabase
            .from("lab_reports")
            .select("*");

        if (labsError) throw labsError;

        labs?.forEach((lab) => {
            timeline.push({
                type: "lab",
                date: lab.report_date || lab.created_at || null,
                source_document_url: lab.report_file_url || null,
                data: lab,
            });
        });

        // -----------------------------------------
        // 5. DISCHARGE SUMMARIES
        // -----------------------------------------

        const { data: discharges, error: dischargeError } =
            await supabase
                .from("discharge_summaries")
                .select("*");

        if (dischargeError) throw dischargeError;

        discharges?.forEach((summary) => {
            timeline.push({
                type: "discharge_summary",
                date:
                    summary.discharge_date ||
                    summary.created_at ||
                    null,
                source_document_url:
                    summary.summary_file_url || null,
                data: summary,
            });
        });

        // -----------------------------------------
        // 6. PROCEDURES
        // -----------------------------------------

        const { data: procedures, error: proceduresError } =
            await supabase
                .from("extracted_procedures")
                .select("*");

        if (proceduresError) throw proceduresError;

        procedures?.forEach((procedure) => {
            timeline.push({
                type: "procedure",
                date:
                    procedure.surgery_date ||
                    procedure.created_at ||
                    null,
                source_document_url: null,
                data: procedure,
            });
        });

        // -----------------------------------------
        // 7. SORT CHRONOLOGICALLY
        // -----------------------------------------

        timeline.sort((a, b) => {
            const dateA = a.date
                ? new Date(a.date).getTime()
                : NaN;

            const dateB = b.date
                ? new Date(b.date).getTime()
                : NaN;

            if (Number.isNaN(dateA) && Number.isNaN(dateB)) {
                return 0;
            }

            if (Number.isNaN(dateA)) {
                return 1;
            }

            if (Number.isNaN(dateB)) {
                return -1;
            }

            return dateA - dateB;
        });

        // -----------------------------------------
        // 8. RETURN RESULT
        // -----------------------------------------

        return NextResponse.json({
            success: true,
            patient_id: patientId,
            total_events: timeline.length,
            timeline,
        });

    } catch (error) {
        console.error("Timeline API error:", error);

        return NextResponse.json(
            {
                success: false,
                error: error.message,
            },
            { status: 500 }
        );
    }
}