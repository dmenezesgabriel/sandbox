import { useState } from "react";

export interface MdxLoaderHook {
  content: string | null;
  isLoading: boolean;
  error: string | null;
  loadMdxFile: (filePath: string) => Promise<void>;
}

export const useMdxLoader = (): MdxLoaderHook => {
  const [content, setContent] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadMdxFile = async (filePath: string) => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(filePath);
      if (!response.ok) {
        throw new Error(`Failed to load file: ${response.statusText}`);
      }
      const text = await response.text();
      setContent(text);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load MDX file");
    } finally {
      setIsLoading(false);
    }
  };

  return { content, isLoading, error, loadMdxFile };
};
