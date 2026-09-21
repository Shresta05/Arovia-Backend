"use client";

import { useState } from "react";
import { createWorker } from "tesseract.js";

export default function ProcedureExtractor() {
    const [file, setFile] = useState(null);
    const [results, setResults] = useState([]);
    const [loading, setLoading] = useState(false);

    const extractProcedures = (text) => {
        const lines = text
            .split("\n")
            .map((line) => line.trim())
            .filter(Boolean);

        const extracted = [];

        for (const line of lines) {
            const match = line.match(
                /^(?:procedure|surgery|operation|procedure\/surgery)\s*[:\-]\s*(.+?)\s+(?:date\s*[:\-]\s*)?(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4})$/i
            );

            if (match) {
                extracted.push({
                    procedure: match[1].trim(),
                    date: match[2].trim(),
                });

                continue;
            }

            const simpleMatch = line.match(
                /^(.+?(?:surgery|operation|procedure|appendectomy|biopsy|excision|transplant|replacement))\s*[:\-]?\s*(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4})$/i
            );

            if (simpleMatch) {
                extracted.push({
                    procedure: simpleMatch[1].trim(),
                    date: simpleMatch[2].trim(),
                });
            }
        }

        return extracted;
    };

    const handleExtract = async () => {
        if (!file) {
            alert("Please select a medical document");
            return;
        }

        setLoading(true);
        setResults([]);

        try {
            const worker = await createWorker("eng");

            const result = await worker.recognize(file);

            const extractedResults = extractProcedures(result.data.text);

            setResults(extractedResults);

            await worker.terminate();
        } catch (error) {
            console.error("Procedure extraction error:", error);
            alert("Unable to extract procedure or surgery details.");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div style={{ padding: "20px" }}>
            <h2>Procedure / Surgery Extraction</h2>

            <p>
                Upload a medical document to extract procedure or surgery names and
                their dates.
            </p>

            <input
                type="file"
                accept="image/png,image/jpeg,image/jpg"
                onChange={(e) => setFile(e.target.files[0])}
            />

            <br />
            <br />

            <button onClick={handleExtract} disabled={loading}>
                {loading ? "Extracting..." : "Extract Procedure / Surgery"}
            </button>

            {results.length > 0 && (
                <div style={{ marginTop: "20px" }}>
                    <h3>Extracted Procedures / Surgeries</h3>

                    <table
                        border="1"
                        cellPadding="8"
                        style={{
                            borderCollapse: "collapse",
                            width: "100%",
                        }}
                    >
                        <thead>
                            <tr>
                                <th>Procedure / Surgery</th>
                                <th>Date</th>
                            </tr>
                        </thead>

                        <tbody>
                            {results.map((item, index) => (
                                <tr key={index}>
                                    <td>{item.procedure}</td>
                                    <td>{item.date}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}

            {results.length === 0 && !loading && file && (
                <p style={{ marginTop: "20px" }}>
                    No procedure or surgery details were detected.
                </p>
            )}
        </div>
    );
}