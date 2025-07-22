import React, { useState, useEffect, ComponentPropsWithoutRef } from "react";
import { processMdxContent, SqlBlock } from "../services/mdxProcessor";
import { useQueryContext } from "../context/QueryContext";
import { DataTable } from "./DataTable";
import { DataChart } from "./DataChart";
import { CodeBlock } from "./code-block";
import { Slider } from "./Slider";
import { Loader2, AlertCircle } from "lucide-react";

interface MdxRendererProps {
  content: string;
  variables?: Record<string, unknown>;
}

export const MdxRenderer: React.FC<MdxRendererProps> = ({ content }) => {
  const [renderedContent, setRenderedContent] = useState<React.ComponentType<{
    components: typeof components;
  }> | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sqlBlocks, setSqlBlocks] = useState<SqlBlock[]>([]);
  const {
    executeQuery,
    isDbReady: dbReady,
    dbError,
    setQueryResult,
    inputParams,
  } = useQueryContext();

  const components = React.useMemo(
    () => ({
      DataTable,
      DataChart,
      CodeBlock,
      code: (
        props: ComponentPropsWithoutRef<"code"> & {
          className?: string;
          children?: string;
        }
      ) => {
        // Handle inline code vs code blocks
        if (props.className && props.className.startsWith("language-")) {
          const lang = props.className.replace("language-", "");
          return <CodeBlock code={props.children || ""} lang={lang} />;
        }
        return (
          <code
            className="bg-gray-100 px-2 py-1 rounded text-sm font-mono"
            {...props}
          />
        );
      },
      h1: (props: ComponentPropsWithoutRef<"h1">) => (
        <h1 className="text-3xl font-bold text-gray-900 mb-6" {...props} />
      ),
      h2: (props: ComponentPropsWithoutRef<"h2">) => (
        <h2
          className="text-2xl font-semibold text-gray-800 mb-4 mt-8"
          {...props}
        />
      ),
      h3: (props: ComponentPropsWithoutRef<"h3">) => (
        <h3
          className="text-xl font-medium text-gray-700 mb-3 mt-6"
          {...props}
        />
      ),
      p: (props: ComponentPropsWithoutRef<"p">) => (
        <p className="text-gray-600 mb-4 leading-relaxed" {...props} />
      ),
      ul: (props: ComponentPropsWithoutRef<"ul">) => (
        <ul
          className="list-disc list-inside text-gray-600 mb-4 space-y-2"
          {...props}
        />
      ),
      li: (props: ComponentPropsWithoutRef<"li">) => (
        <li className="text-gray-600" {...props} />
      ),
      Slider,
    }),
    []
  );

  // First useEffect: Process MDX content when content or components change
  useEffect(() => {
    if (!content) return;

    const processMdxContentAsync = async () => {
      setIsProcessing(true);
      setError(null);

      try {
        const { Content, sqlBlocks: blocks } = await processMdxContent(content);
        setRenderedContent(
          () =>
            Content as React.ComponentType<{ components: typeof components }>
        );
        setSqlBlocks(blocks);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Processing failed");
      } finally {
        setIsProcessing(false);
      }
    };

    processMdxContentAsync();
  }, [content, components]);

  // Second useEffect: Execute SQL queries when sqlBlocks or inputParams change
  useEffect(() => {
    if (!dbReady || sqlBlocks.length === 0) {
      return;
    }

    const executeSqlQueries = async () => {
      setError(null);

      // Execute SQL queries sequentially
      for (const block of sqlBlocks) {
        try {
          const result = await executeQuery(block.sql);
          setQueryResult(block.id, result);
        } catch (queryError) {
          console.error(`Error executing query ${block.id}:`, queryError);
          setError(
            `Query ${block.id} failed: ${
              queryError instanceof Error ? queryError.message : "Unknown error"
            }`
          );
        }
      }
    };

    executeSqlQueries();
  }, [sqlBlocks, inputParams, dbReady, executeQuery, setQueryResult]);

  if (dbError) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-6">
        <div className="flex items-center space-x-3">
          <AlertCircle className="text-red-500" size={24} />
          <div>
            <h3 className="text-red-800 font-semibold">Database Error</h3>
            <p className="text-red-600">{dbError}</p>
          </div>
        </div>
      </div>
    );
  }

  if (!dbReady || isProcessing) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="flex items-center space-x-3">
          <Loader2 className="animate-spin text-blue-500" size={24} />
          <span className="text-gray-600">
            {!dbReady ? "Initializing database..." : "Processing content..."}
          </span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6">
        <div className="flex items-center space-x-3">
          <AlertCircle className="text-yellow-500" size={24} />
          <div>
            <h3 className="text-yellow-800 font-semibold">Processing Error</h3>
            <p className="text-yellow-700">{error}</p>
          </div>
        </div>
      </div>
    );
  }

  if (!renderedContent) {
    return (
      <div className="text-gray-500 text-center py-8">
        No content to display
      </div>
    );
  }

  const Content = renderedContent;

  return (
    <div className="prose prose-lg max-w-none">
      <Content components={components} />
    </div>
  );
};
