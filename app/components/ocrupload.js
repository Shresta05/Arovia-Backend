"use client";

import { useState } from "react";
import { createWorker } from "tesseract.js";

export default function HandwritingOCR() {
    const [file, setFile] = useState(null);
    const [text, setText] = useState("");
    const [loading, setLoading] = useState(false);

    const handleOCR = async () => {
        if (!file) {
            alert("Please select a handwritten image");
            return;
        }

        setLoading(true);
        setText("");

        try {
            const worker = await createWorker("eng");

            const result = await worker.recognize(file);

            const extractedText = result.data.text.trim();

            if (extractedText) {
                setText(extractedText);
            } else {
                setText(
                    "No readable handwriting detected. Please upload a clearer image."
                );
            }

            await worker.terminate();
        } catch (error) {
            console.error("Handwriting OCR error:", error);
            setText("Handwriting OCR failed. Please try again.");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div style={{ padding: "20px" }}>
            <h2>Handwritten Text OCR</h2>

            <p>
                Upload a clear handwritten document. Recognition works best with
                neat and readable handwriting.
            </p>

            <input
                type="file"
                accept="image/png,image/jpeg,image/jpg"
                onChange={(e) => setFile(e.target.files[0])}
            />

            <br />
            <br />

            <button onClick={handleOCR} disabled={loading}>
                {loading ? "Reading handwriting..." : "Read Handwriting"}
            </button>

            {text && (
                <div style={{ marginTop: "20px" }}>
                    <h3>Recognized Handwritten Text</h3>

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