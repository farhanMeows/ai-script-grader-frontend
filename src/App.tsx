import { useState, useEffect, useRef } from "react";
import type { ChangeEvent } from "react";
import React from "react";

interface UploadResponse {
  status: string;
  message: string;
  evaluation_id: string;
}

const API_BASE_URL = "https://ai-script-grader-backend.onrender.com";

function App(): React.ReactElement {
  const [answerScript, setAnswerScript] = useState<File | null>(null);
  const [questionPaper, setQuestionPaper] = useState<File | null>(null);
  const [evaluationId, setEvaluationId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [uploadStatus, setUploadStatus] = useState<string>("");
  const [logs, setLogs] = useState<string[]>([]);
  const [isEvaluating, setIsEvaluating] = useState<boolean>(false);
  const logEndRef = useRef<HTMLDivElement>(null);

  // Scroll to bottom of logs
  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [logs]);

  // Handle SSE connection for logs
  useEffect(() => {
    let eventSource: EventSource | null = null;

    if (evaluationId && isEvaluating) {
      eventSource = new EventSource(
        `${API_BASE_URL}/evaluation-logs/${evaluationId}`,
        { withCredentials: true }
      );

      eventSource.onmessage = (event) => {
        if (event.data.trim()) {
          setLogs((prevLogs) => [...prevLogs, event.data]);
        }
      };

      eventSource.onerror = (error) => {
        console.error("SSE Error:", error);
        eventSource?.close();
        setIsEvaluating(false);
        setUploadStatus("Evaluation completed");
        if (
          error instanceof Event &&
          (error.target as EventSource).readyState === EventSource.CLOSED
        ) {
          setError(
            "Connection to server lost. Please refresh the page and try again."
          );
        }
      };
    }

    return () => {
      eventSource?.close();
    };
  }, [evaluationId, isEvaluating]);

  const handleFileChange = (
    e: ChangeEvent<HTMLInputElement>,
    type: "answer" | "question"
  ): void => {
    const file = e.target.files?.[0];
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

  const handleUpload = async (): Promise<void> => {
    if (!answerScript || !questionPaper) {
      setError("Please upload both answer script and question paper");
      return;
    }

    setIsLoading(true);
    setError(null);
    setUploadStatus("Uploading files...");
    setLogs([]);
    setIsEvaluating(false);

    const formData = new FormData();
    formData.append("answer_script", answerScript);
    formData.append("question_paper", questionPaper);

    try {
      const response = await fetch(`${API_BASE_URL}/upload-pdfs/`, {
        method: "POST",
        body: formData,
        headers: {
          Accept: "application/json",
        },
        mode: "cors",
        credentials: "include",
      });

      if (response.status === 502) {
        throw new Error(
          "Server is currently unavailable. Please try again in a few moments."
        );
      }

      const data: UploadResponse = await response.json();

      if (!response.ok) {
        throw new Error(
          data.message || `Upload failed (Status: ${response.status})`
        );
      }

      setEvaluationId(data.evaluation_id);
      setUploadStatus("Evaluation in progress...");
      setIsEvaluating(true);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "An unknown error occurred"
      );
      setUploadStatus("");
    } finally {
      setIsLoading(false);
    }
  };

  const handleDownload = async (): Promise<void> => {
    if (!evaluationId) return;

    try {
      const response = await fetch(
        `${API_BASE_URL}/get-evaluated-pdf/${evaluationId}`,
        {
          headers: {
            Accept: "application/json",
          },
          mode: "cors",
          credentials: "include",
        }
      );

      if (response.status === 502) {
        throw new Error(
          "Server is currently unavailable. Please try again in a few moments."
        );
      }

      if (!response.ok) {
        throw new Error(`Failed to download PDF (Status: ${response.status})`);
      }

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
      setError(err instanceof Error ? err.message : "Failed to download PDF");
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 text-gray-100">
      {/* Header with gradient and subtle pattern */}
      <header className="relative bg-gradient-to-r from-blue-600 to-blue-800 py-8 shadow-lg">
        <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHZpZXdCb3g9IjAgMCA2MCA2MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZyBmaWxsPSJub25lIiBmaWxsLXJ1bGU9ImV2ZW5vZGQiPjxwYXRoIGQ9Ik0zNiAzNGMwLTIuMjA5IDEuNzkxLTQgNC00czQgMS43OTEgNCA0LTEuNzkxIDQtNCA0LTQtMS43OTEtNC00eiIgZmlsbD0iI2ZmZiIgZmlsbC1vcGFjaXR5PSIuMDUiLz48L2c+PC9zdmc+')] opacity-10"></div>
        <div className="container mx-auto px-4 relative">
          <div className="flex flex-col items-center space-y-2">
            <h1 className="text-3xl font-bold text-white tracking-tight">
              AI Script Grader
            </h1>
            <p className="text-blue-100 text-sm font-medium">
              Intelligent Answer Script Evaluation
            </p>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 max-w-7xl mx-auto">
          {/* Upload Section */}
          <div
            className="bg-gray-800/50 backdrop-blur-sm rounded-xl shadow-xl p-6 border border-gray-700/50 
            hover:border-blue-500/30 transition-all duration-300"
          >
            <div className="flex items-center space-x-3 mb-6">
              <div className="p-2 bg-blue-500/10 rounded-lg">
                <svg
                  className="w-6 h-6 text-blue-400"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
                  />
                </svg>
              </div>
              <h2 className="text-xl font-semibold text-blue-400">
                Upload Files
              </h2>
            </div>

            <div className="space-y-6">
              <div className="space-y-4">
                <div className="group">
                  <label
                    htmlFor="answer-script"
                    className="block text-sm font-medium text-gray-300 mb-2 group-hover:text-blue-400 transition-colors"
                  >
                    Answer Script
                  </label>
                  <div className="relative">
                    <input
                      type="file"
                      id="answer-script"
                      accept=".pdf"
                      onChange={(e) => handleFileChange(e, "answer")}
                      disabled={isLoading || isEvaluating}
                      className="block w-full text-sm text-gray-400
                        file:mr-4 file:py-2 file:px-4
                        file:rounded-lg file:border-0
                        file:text-sm file:font-semibold
                        file:bg-blue-500/10 file:text-blue-400
                        hover:file:bg-blue-500/20
                        disabled:opacity-50 disabled:cursor-not-allowed
                        bg-gray-700/50 rounded-lg
                        border border-gray-600/50
                        hover:border-blue-500/50
                        focus:border-blue-500
                        focus:ring-2 focus:ring-blue-500/20
                        transition-all duration-200"
                    />
                    {answerScript && (
                      <p className="mt-2 text-sm text-gray-400 flex items-center">
                        <svg
                          className="w-4 h-4 mr-2 text-green-400"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth="2"
                            d="M5 13l4 4L19 7"
                          />
                        </svg>
                        {answerScript.name}
                      </p>
                    )}
                  </div>
                </div>

                <div className="group">
                  <label
                    htmlFor="question-paper"
                    className="block text-sm font-medium text-gray-300 mb-2 group-hover:text-blue-400 transition-colors"
                  >
                    Question Paper
                  </label>
                  <div className="relative">
                    <input
                      type="file"
                      id="question-paper"
                      accept=".pdf"
                      onChange={(e) => handleFileChange(e, "question")}
                      disabled={isLoading || isEvaluating}
                      className="block w-full text-sm text-gray-400
                        file:mr-4 file:py-2 file:px-4
                        file:rounded-lg file:border-0
                        file:text-sm file:font-semibold
                        file:bg-blue-500/10 file:text-blue-400
                        hover:file:bg-blue-500/20
                        disabled:opacity-50 disabled:cursor-not-allowed
                        bg-gray-700/50 rounded-lg
                        border border-gray-600/50
                        hover:border-blue-500/50
                        focus:border-blue-500
                        focus:ring-2 focus:ring-blue-500/20
                        transition-all duration-200"
                    />
                    {questionPaper && (
                      <p className="mt-2 text-sm text-gray-400 flex items-center">
                        <svg
                          className="w-4 h-4 mr-2 text-green-400"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth="2"
                            d="M5 13l4 4L19 7"
                          />
                        </svg>
                        {questionPaper.name}
                      </p>
                    )}
                  </div>
                </div>
              </div>

              <button
                onClick={handleUpload}
                disabled={
                  isLoading || isEvaluating || !answerScript || !questionPaper
                }
                className="w-full py-3 px-4 rounded-lg font-medium text-white
                  bg-gradient-to-r from-blue-600 to-blue-700
                  hover:from-blue-500 hover:to-blue-600
                  focus:outline-none focus:ring-2 
                  focus:ring-blue-500 focus:ring-offset-2 focus:ring-offset-gray-800
                  disabled:opacity-50 disabled:cursor-not-allowed
                  transition-all duration-200
                  shadow-lg shadow-blue-500/20
                  hover:shadow-xl hover:shadow-blue-500/30"
              >
                <div className="flex items-center justify-center space-x-2">
                  {isLoading ? (
                    <>
                      <svg
                        className="animate-spin h-5 w-5 text-white"
                        xmlns="http://www.w3.org/2000/svg"
                        fill="none"
                        viewBox="0 0 24 24"
                      >
                        <circle
                          className="opacity-25"
                          cx="12"
                          cy="12"
                          r="10"
                          stroke="currentColor"
                          strokeWidth="4"
                        ></circle>
                        <path
                          className="opacity-75"
                          fill="currentColor"
                          d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                        ></path>
                      </svg>
                      <span>Uploading...</span>
                    </>
                  ) : isEvaluating ? (
                    <>
                      <svg
                        className="animate-spin h-5 w-5 text-white"
                        xmlns="http://www.w3.org/2000/svg"
                        fill="none"
                        viewBox="0 0 24 24"
                      >
                        <circle
                          className="opacity-25"
                          cx="12"
                          cy="12"
                          r="10"
                          stroke="currentColor"
                          strokeWidth="4"
                        ></circle>
                        <path
                          className="opacity-75"
                          fill="currentColor"
                          d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                        ></path>
                      </svg>
                      <span>Evaluating...</span>
                    </>
                  ) : (
                    <>
                      <svg
                        className="w-5 h-5"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth="2"
                          d="M13 10V3L4 14h7v7l9-11h-7z"
                        />
                      </svg>
                      <span>Upload & Evaluate</span>
                    </>
                  )}
                </div>
              </button>
            </div>
          </div>

          {/* Output Section */}
          <div
            className="bg-gray-800/50 backdrop-blur-sm rounded-xl shadow-xl p-6 border border-gray-700/50
            hover:border-blue-500/30 transition-all duration-300"
          >
            <div className="flex items-center space-x-3 mb-6">
              <div className="p-2 bg-blue-500/10 rounded-lg">
                <svg
                  className="w-6 h-6 text-blue-400"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
              </div>
              <h2 className="text-xl font-semibold text-blue-400">
                Evaluation Output
              </h2>
            </div>

            <div className="space-y-4">
              {error && (
                <div
                  className="bg-red-500/10 border border-red-500/20 text-red-200 px-4 py-3 rounded-lg
                  flex items-center space-x-2"
                >
                  <svg
                    className="w-5 h-5 text-red-400"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="2"
                      d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                    />
                  </svg>
                  <span>{error}</span>
                </div>
              )}

              {uploadStatus && (
                <div
                  className="bg-blue-500/10 border border-blue-500/20 text-blue-200 px-4 py-3 rounded-lg
                  flex items-center space-x-2"
                >
                  <svg
                    className="w-5 h-5 text-blue-400"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="2"
                      d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                    />
                  </svg>
                  <span>{uploadStatus}</span>
                </div>
              )}

              {logs.length > 0 && (
                <div
                  className="bg-gray-900/50 rounded-lg overflow-hidden border border-gray-700/50
                  transition-all duration-300 hover:shadow-lg hover:shadow-blue-500/10
                  backdrop-blur-sm"
                >
                  {/* Terminal Header */}
                  <div className="bg-gray-800/80 px-4 py-2 flex items-center space-x-2 border-b border-gray-700/50">
                    <div className="w-3 h-3 rounded-full bg-red-500 hover:opacity-80 transition-opacity cursor-pointer"></div>
                    <div className="w-3 h-3 rounded-full bg-yellow-500 hover:opacity-80 transition-opacity cursor-pointer"></div>
                    <div className="w-3 h-3 rounded-full bg-green-500 hover:opacity-80 transition-opacity cursor-pointer"></div>
                    <span className="text-sm text-gray-400 ml-2 font-medium">
                      Evaluation Logs
                    </span>
                  </div>

                  {/* Terminal Content */}
                  <div
                    className="h-[400px] overflow-y-auto scrollbar-thin scrollbar-thumb-gray-600 
                    scrollbar-track-gray-800/50 hover:scrollbar-thumb-gray-500
                    font-mono text-sm p-4 bg-gray-900/50"
                  >
                    {logs.map((log, index) => (
                      <pre
                        key={index}
                        className="text-gray-300 whitespace-pre-wrap break-words mb-1"
                      >
                        {log}
                      </pre>
                    ))}
                    <div ref={logEndRef} />
                  </div>
                </div>
              )}

              {evaluationId && !isEvaluating && (
                <button
                  onClick={handleDownload}
                  disabled={isLoading}
                  className="w-full py-3 px-4 rounded-lg font-medium text-white
                    bg-gradient-to-r from-green-600 to-green-700
                    hover:from-green-500 hover:to-green-600
                    focus:outline-none focus:ring-2 
                    focus:ring-green-500 focus:ring-offset-2 focus:ring-offset-gray-800
                    disabled:opacity-50 disabled:cursor-not-allowed
                    transition-all duration-200
                    shadow-lg shadow-green-500/20
                    hover:shadow-xl hover:shadow-green-500/30
                    flex items-center justify-center space-x-2"
                >
                  <svg
                    className="w-5 h-5"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="2"
                      d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
                    />
                  </svg>
                  <span>Download Evaluated PDF</span>
                </button>
              )}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

export default App;
