import OCRUpload from "./components/ocrupload";
import MultilingualOCR from "./components/multilingualocr";
import DiagnosisExtractor from "./components/diagnosisextractor";
import InvestigationExtractor from "./components/investigationextractor";
import ProcedureExtractor from "./components/procedureextractor";

export default function Home() {
  return (
    <main>
      <OCRUpload />

      <hr />

      <MultilingualOCR />

      <hr />

      <DiagnosisExtractor />

      <hr />

      <InvestigationExtractor />

      <hr />

      <ProcedureExtractor />
    </main>
  );
}