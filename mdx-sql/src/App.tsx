import React, { useState } from "react";
import { QueryProvider } from "./context/QueryContext";
import { MdxRenderer } from "./components/MdxRenderer";
import { CodeEditor } from "./components/CodeEditor";
import { useMdxLoader } from "./hooks/useMdxLoader";
import { Play, FileText } from "lucide-react";

function App() {
  const {
    content: mdxContent,
    isLoading: loadingFile,
    error: fileError,
    loadMdxFile,
  } = useMdxLoader();
  const [editableContent, setEditableContent] = useState("");
  const [activeTab, setActiveTab] = useState<"render" | "source">("render");

  React.useEffect(() => {
    loadMdxFile("/sample-report.mdx");
  }, []);

  React.useEffect(() => {
    if (mdxContent) {
      setEditableContent(mdxContent);
    }
  }, [mdxContent]);

  if (loadingFile) {
    return (
      <div className="min-h-screen bg-neutral-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-pulse w-12 h-12 bg-neutral-200 rounded-full mx-auto mb-4" />
          <p className="text-neutral-500 font-semibold text-lg">
            Loading report...
          </p>
        </div>
      </div>
    );
  }

  if (fileError) {
    return (
      <div className="min-h-screen bg-neutral-50 flex items-center justify-center">
        <div className="bg-red-50 border border-red-200 rounded-xl p-8 max-w-md shadow-lg">
          <h3 className="text-red-800 font-bold mb-2 text-xl">
            Error loading report
          </h3>
          <p className="text-red-600 text-base">{fileError}</p>
        </div>
      </div>
    );
  }

  return (
    <QueryProvider>
      <div className="min-h-screen bg-neutral-50">
        <div className="max-w-4xl mx-auto px-0 py-12">
          <div className="mb-6">
            <nav className="flex space-x-2 border-b border-neutral-200">
              <button
                onClick={() => setActiveTab("render")}
                className={`py-2 px-4 font-bold text-base rounded-t-lg transition-colors duration-150 focus:outline-none ${
                  activeTab === "render"
                    ? "bg-neutral-100 text-neutral-900 border-b-2 border-black shadow-sm"
                    : "bg-transparent text-neutral-500 hover:text-neutral-900"
                }`}
              >
                <div className="flex items-center space-x-2">
                  <Play size={18} />
                  <span>Report</span>
                </div>
              </button>
              <button
                onClick={() => setActiveTab("source")}
                className={`py-2 px-4 font-bold text-base rounded-t-lg transition-colors duration-150 focus:outline-none ${
                  activeTab === "source"
                    ? "bg-neutral-100 text-neutral-900 border-b-2 border-black shadow-sm"
                    : "bg-transparent text-neutral-500 hover:text-neutral-900"
                }`}
              >
                <div className="flex items-center space-x-2">
                  <FileText size={18} />
                  <span>Source</span>
                </div>
              </button>
            </nav>
          </div>

          {/* Content */}
          {activeTab === "render" ? (
            <div className="bg-white rounded-xl shadow border border-neutral-200 p-10 min-h-[400px]">
              <MdxRenderer content={editableContent} />
            </div>
          ) : (
            <div className="bg-white rounded-xl shadow border border-neutral-200">
              <div className="border-b border-neutral-200 px-6 py-4">
                <h3 className="text-xl font-bold text-neutral-900">
                  MDX Source
                </h3>
                <p className="text-sm text-neutral-500">
                  Edit the content below to update the report
                </p>
              </div>
              <div className="p-6">
                <CodeEditor
                  value={editableContent}
                  onChange={(value) => setEditableContent(value)}
                  maxHeight="400px"
                  theme="dark"
                  wordWrap={true}
                />
              </div>
            </div>
          )}
        </div>
      </div>
    </QueryProvider>
  );
}

export default App;
