import { useEffect, useRef } from "react";

type WindowWithConsole = Window & {
  console: {
    log: (...args: unknown[]) => void;
    error: (...args: unknown[]) => void;
    warn: (...args: unknown[]) => void;
  };
};

interface IframeProps {
  scriptUrl: string | null;
  onConsoleLog: (...args: unknown[]) => void;
  onIframeLoad?: (iframe: HTMLIFrameElement) => void;
}

export function Iframe({ scriptUrl, onConsoleLog, onIframeLoad }: IframeProps) {
  const iframeRef = useRef<HTMLIFrameElement>(null);

  useEffect(() => {
    if (!scriptUrl) {
      return;
    }

    const iframeDocument = iframeRef.current?.contentDocument;

    if (!iframeDocument) {
      return;
    }
    iframeDocument.body.innerHTML = "";

    if (onIframeLoad) {
      onIframeLoad(iframeRef.current!);
    }

    const script = iframeDocument.createElement("script");
    script.type = "module";
    script.src = scriptUrl;
    iframeDocument.body.appendChild(script);

    return () => {
      iframeDocument.body.removeChild(script);
    };
  }, [onIframeLoad, scriptUrl]);

  useEffect(() => {
    if (!iframeRef.current) {
      return;
    }

    const iframeWindow = iframeRef.current?.contentWindow as WindowWithConsole;

    if (!iframeWindow) {
      return;
    }

    const originalConsole = { ...iframeWindow.console };

    iframeWindow.console = {
      ...originalConsole,
      log: (...args: unknown[]) => {
        onConsoleLog(...args);
        // originalConsole.log(...args);
      },
      error: (...args: unknown[]) => {
        onConsoleLog(...args);
        // originalConsole.error(...args);
      },
      warn: (...args: unknown[]) => {
        onConsoleLog(...args);
        // (prev) => prev + "Warning: " + args.join(" ") + "\n";
        // originalConsole.warn(...args);
      },
    };
  });

  return <iframe ref={iframeRef}></iframe>;
}
