"use client";

import { useState } from "react";
import { createWorker } from "tesseract.js";

export default function InvestigationExtractor() {
    const [file, setFile] = useState(null);
    const [results, setResults] = useState([]);
    const [loading, setLoading] = useState(false);

    const extractInvestigations = (text) => {
        const lines = text
            .split("\n")
            .map((line) => line.trim())
            .filter(Boolean);

        const extracted = [];

        for (const line of lines) {
            // Matches common lab-report formats:
            // Hemoglobin 13.5 g/dL 12-16 g/dL
            // Glucose 95 mg/dL 70-100 mg/dL
            const match = line.match(
                /^(.+?)\s+([<>]?\s*\d+(?:\.\d+)?)\s*([a-zA-Z/%µμ]+(?:\/[a-zA-Z]+)?)?\s+(\d+(?:\.\d+)?\s*[-–]\s*\d+(?:\.\d+)?)\s*(.*)$/i
            );

            if (match) {
                extracted.push({
                    test: match[1].trim(),
                    value: `${match[2].trim()}${match[3] ? " " + match[3].trim() : ""}`,
                    referenceRange: `${match[4].trim()} ${match[5].trim()}`.trim(),
                });
            }
        }

        return extracted;
    };

    const handleExtract = async () => {
        if (!file) {
            alert("Please select a lab report");
            return;
        }

        setLoading(true);
        setResults([]);

        try {
            const worker = await createWorker("eng");

            const result = await worker.recognize(file);

            const extractedResults = extractInvestigations(result.data.text);

            setResults(extractedResults);

            await worker.terminate();
        } catch (error) {
            console.error("Investigation extraction error:", error);
            alert("Unable to extract investigation results.");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div style={{ padding: "20px" }}>
            <h2>Investigation / Test Extraction</h2>

            <p>
                Upload a lab report to extract test names, values and reference ranges.
            </p>

            <input
                type="file"
                accept="image/png,image/jpeg,image/jpg"
                onChange={(e) => setFile(e.target.files[0])}
            />

            <br />
            <br />

            <button onClick={handleExtract} disabled={loading}>
                {loading ? "Extracting results..." : "Extract Test Results"}
            </button>

            {results.length > 0 && (
                <div style={{ marginTop: "20px" }}>
                    <h3>Extracted Investigation Results</h3>

                    <table
                        border="1"
                        cellPadding="8"
                        style={{ borderCollapse: "collapse", width: "100%" }}
                    >
                        <thead>
                            <tr>
                                <th>Investigation / Test</th>
                                <th>Value</th>
                                <th>Reference Range</th>
                            </tr>
                        </thead>

                        <tbody>
                            {results.map((item, index) => (
                                <tr key={index}>
                                    <td>{item.test}</td>
                                    <td>{item.value}</td>
                                    <td>{item.referenceRange}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}

            {results.length === 0 && !loading && file && (
                <p style={{ marginTop: "20px" }}>
                    No matching investigation results were detected.
                </p>
            )}
        </div>
    );
}