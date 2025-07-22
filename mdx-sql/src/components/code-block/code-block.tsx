import { useEffect, useState } from "react";
import type { JSX } from "react";
import { highlight } from "../../lib/shared";
import { ChevronDown, ChevronRight } from "lucide-react";

const highlightCache = new Map<string, JSX.Element>();

export function CodeBlock({
  code,
  lang = "sql",
  initial,
  defaultOpen = false,
}: {
  code: string;
  lang?: string;
  initial?: JSX.Element;
  defaultOpen?: boolean;
}) {
  const [nodes, setNodes] = useState<JSX.Element | undefined>(
    () => highlightCache.get(`${lang}:${code}`) ?? initial
  );

  const [isOpen, setIsOpen] = useState(defaultOpen);

  useEffect(() => {
    const cacheKey = `${lang}:${code}`;
    if (highlightCache.has(cacheKey)) {
      setNodes(highlightCache.get(cacheKey));
      return;
    }

    highlight(code, lang).then((result) => {
      highlightCache.set(cacheKey, result);
      setNodes(result);
    });
  }, [code, lang]);

  return (
    <details
      className="my-4"
      open={isOpen}
      onToggle={(e) => setIsOpen((e.target as HTMLDetailsElement).open)}
    >
      <summary className="cursor-pointer select-none bg-gray-100 hover:bg-gray-200 px-4 py-3 rounded-t-lg border border-gray-300 flex items-center justify-between transition-colors">
        <div className="flex items-center space-x-2">
          <span className="font-medium text-gray-700">
            {lang.toUpperCase()}
          </span>
          <span className="text-xs text-gray-500 bg-gray-200 px-2 py-1 rounded">
            {code.split("\n").length} lines
          </span>
        </div>

        <div className="flex items-center space-x-2">
          {isOpen ? (
            <ChevronDown size={16} className="text-gray-500" />
          ) : (
            <ChevronRight size={16} className="text-gray-500" />
          )}
        </div>
      </summary>

      <div className="border-l border-r border-b border-gray-300 rounded-b-lg overflow-hidden">
        <div className="bg-gray-900">
          <div className="p-4 overflow-x-auto">
            {nodes ?? <p className="text-gray-400">Loading code...</p>}
          </div>
        </div>
      </div>
    </details>
  );
}
