import React, { useState } from "react";
import "./App.css";

function App() {
  const [answerScript, setAnswerScript] = useState(null);
  const [questionPaper, setQuestionPaper] = useState(null);
  const [evaluationId, setEvaluationId] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [uploadStatus, setUploadStatus] = useState("");

  const handleFileChange = (e, type) => {
    const file = e.target.files[0];
    if (file && file.type === "application/pdf") {
      if (type === "answer") {
        setAnswerScript(file);
      } else {
        setQuestionPaper(file);
      }
      setError(null);
    } else {
      setError("Please upload a valid PDF file");
    }
  };

  const handleUpload = async () => {
    if (!answerScript || !questionPaper) {
      setError("Please upload both answer script and question paper");
      return;
    }

    setIsLoading(true);
    setError(null);
    setUploadStatus("Uploading files...");

    const formData = new FormData();
    formData.append("answer_script", answerScript);
    formData.append("question_paper", questionPaper);

    try {
      const response = await fetch("http://localhost:8000/upload-pdfs/", {
        method: "POST",
        body: formData,
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.detail || "Upload failed");
      }

      setEvaluationId(data.evaluation_id);
      setUploadStatus("Evaluation completed successfully!");
    } catch (err) {
      setError(err.message);
      setUploadStatus("");
    } finally {
      setIsLoading(false);
    }
  };

  const handleDownload = async () => {
    if (!evaluationId) return;

    try {
      const response = await fetch(
        `http://localhost:8000/get-evaluated-pdf/${evaluationId}`
      );
      if (!response.ok) throw new Error("Failed to download PDF");

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `evaluated_script_${evaluationId}.pdf`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (err) {
      setError("Failed to download PDF: " + err.message);
    }
  };

  return (
    <div className="app-container">
      <header className="app-header">
        <h1>Answer Script Evaluator</h1>
      </header>

      <main className="app-main">
        <div className="upload-section">
          <h2>Upload Files</h2>
          <div className="upload-container">
            <div className="file-upload">
              <label htmlFor="answer-script">Answer Script</label>
              <input
                type="file"
                id="answer-script"
                accept=".pdf"
                onChange={(e) => handleFileChange(e, "answer")}
                disabled={isLoading}
              />
              {answerScript && <p className="file-name">{answerScript.name}</p>}
            </div>

            <div className="file-upload">
              <label htmlFor="question-paper">Question Paper</label>
              <input
                type="file"
                id="question-paper"
                accept=".pdf"
                onChange={(e) => handleFileChange(e, "question")}
                disabled={isLoading}
              />
              {questionPaper && (
                <p className="file-name">{questionPaper.name}</p>
              )}
            </div>

            <button
              className="upload-button"
              onClick={handleUpload}
              disabled={isLoading || !answerScript || !questionPaper}
            >
              {isLoading ? "Processing..." : "Upload & Evaluate"}
            </button>
          </div>
        </div>

        <div className="output-section">
          <h2>Evaluation Output</h2>
          <div className="output-container">
            {error && <div className="error-message">{error}</div>}

            {uploadStatus && (
              <div className="status-message">{uploadStatus}</div>
            )}

            {evaluationId && (
              <button
                className="download-button"
                onClick={handleDownload}
                disabled={isLoading}
              >
                Download Evaluated PDF
              </button>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}

export default App;
