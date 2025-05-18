import { useCallback, useEffect, useRef, useState } from "react";
import styles from "./iframe.module.css";

interface IframeProps {
  scriptUrl: string | null;
  onConsoleLog: (...args: unknown[]) => void;
}

export function Iframe({ scriptUrl, onConsoleLog }: IframeProps) {
  const [iframeHeight, setIframeHeight] = useState(0);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  const updateIframeHeight = useCallback(() => {
    const iframe = iframeRef.current;
    if (!iframe?.contentWindow) return;
    const height = iframe.contentWindow.document.documentElement.scrollHeight;
    setIframeHeight((prev) => (prev !== height ? height : prev));
  }, []);

  useEffect(() => {
    const iframe = iframeRef.current;
    if (!iframe || !scriptUrl) return;
    const iframeDocument = iframe.contentDocument;
    if (!iframeDocument) return;

    iframeDocument.body.innerHTML = "";
    const script = iframeDocument.createElement("script");
    script.type = "module";
    script.src = scriptUrl;
    iframeDocument.body.appendChild(script);

    const resizeObserver = new ResizeObserver(updateIframeHeight);
    resizeObserver.observe(iframeDocument.body);
    updateIframeHeight();

    const handleLoad = () => updateIframeHeight();
    iframe.addEventListener("load", handleLoad);

    const iframeWindow = iframe.contentWindow as
      | (Window & { console: Console })
      | null;

    if (iframeWindow) {
      const originalConsole = { ...iframeWindow.console };
      iframeWindow.console = {
        ...originalConsole,
        log: (...args: unknown[]) => {
          onConsoleLog(...args);
        },
        error: (...args: unknown[]) => {
          onConsoleLog(...args);
        },
        warn: (...args: unknown[]) => {
          onConsoleLog(...args);
          // keep the below comment as reference
          // (prev) => prev + "Warning: " + args.join(" ") + "\n";
          // originalConsole.warn(...args);
        },
      };
    }

    return () => {
      iframe.removeEventListener("load", handleLoad);
      resizeObserver.disconnect();
      if (iframeDocument.body.contains(script)) {
        iframeDocument.body.removeChild(script);
      }
    };
  }, [scriptUrl, onConsoleLog, updateIframeHeight]);

  return (
    <iframe
      ref={iframeRef}
      className={styles.iframe}
      style={{ height: `${iframeHeight}px` }}
    />
  );
}
