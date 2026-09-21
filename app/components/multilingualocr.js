"use client";

import { useState } from "react";
import { createWorker } from "tesseract.js";

export default function MultilingualOCR() {
    const [file, setFile] = useState(null);
    const [language, setLanguage] = useState("eng");
    const [text, setText] = useState("");
    const [loading, setLoading] = useState(false);

    const handleOCR = async () => {
        if (!file) {
            alert("Please select a document");
            return;
        }

        setLoading(true);
        setText("");

        try {
            const worker = await createWorker(language);

            const result = await worker.recognize(file);

            setText(result.data.text || "No readable text detected.");

            await worker.terminate();
        } catch (error) {
            console.error(error);
            setText("OCR failed. Please try again.");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div style={{ padding: "20px" }}>
            <h2>Multilingual Document OCR</h2>

            <p>Select document language:</p>

            <select
                value={language}
                onChange={(e) => setLanguage(e.target.value)}
            >
                <option value="eng">English</option>
                <option value="hin">Hindi</option>
                <option value="tel">Telugu</option>
            </select>

            <br />
            <br />

            <input
                type="file"
                accept="image/png,image/jpeg,image/jpg"
                onChange={(e) => setFile(e.target.files[0])}
            />

            <br />
            <br />

            <button onClick={handleOCR} disabled={loading}>
                {loading ? "Reading document..." : "Run Multilingual OCR"}
            </button>

            {text && (
                <div style={{ marginTop: "20px" }}>
                    <h3>Extracted Text</h3>

                    <textarea
                        value={text}
                        readOnly
                        rows={15}
                        style={{ width: "100%" }}
                    />
                </div>
            )}
        </div>
    );
}