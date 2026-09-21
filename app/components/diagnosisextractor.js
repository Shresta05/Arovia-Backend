"use client";

import { useState } from "react";
import { createWorker } from "tesseract.js";

export default function DiagnosisExtractor() {
    const [file, setFile] = useState(null);
    const [diagnosis, setDiagnosis] = useState("");
    const [loading, setLoading] = useState(false);

    const extractDiagnosis = (text) => {
        const lines = text
            .split("\n")
            .map((line) => line.trim())
            .filter(Boolean);

        const diagnosisLine = lines.find((line) =>
            /^(diagnosis|diagnoses|clinical diagnosis|assessment|impression)\s*[:\-]/i.test(
                line
            )
        );

        if (diagnosisLine) {
            return diagnosisLine.replace(
                /^(diagnosis|diagnoses|clinical diagnosis|assessment|impression)\s*[:\-]\s*/i,
                ""
            );
        }

        return "No explicit diagnosis found in the document.";
    };

    const handleExtract = async () => {
        if (!file) {
            alert("Please select a medical document");
            return;
        }

        setLoading(true);
        setDiagnosis("");

        try {
            const worker = await createWorker("eng");

            const result = await worker.recognize(file);

            const extractedText = result.data.text;

            const diagnosisResult = extractDiagnosis(extractedText);

            setDiagnosis(diagnosisResult);

            await worker.terminate();
        } catch (error) {
            console.error("Diagnosis extraction error:", error);
            setDiagnosis("Unable to extract diagnosis.");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div style={{ padding: "20px" }}>
            <h2>Diagnosis Extraction</h2>

            <p>
                Upload a medical document to extract an explicitly written diagnosis.
            </p>

            <input
                type="file"
                accept="image/png,image/jpeg,image/jpg"
                onChange={(e) => setFile(e.target.files[0])}
            />

            <br />
            <br />

            <button onClick={handleExtract} disabled={loading}>
                {loading ? "Extracting diagnosis..." : "Extract Diagnosis"}
            </button>

            {diagnosis && (
                <div style={{ marginTop: "20px" }}>
                    <h3>Diagnosis</h3>

                    <textarea
                        value={diagnosis}
                        readOnly
                        rows={5}
                        style={{ width: "100%" }}
                    />
                </div>
            )}
        </div>
    );
}