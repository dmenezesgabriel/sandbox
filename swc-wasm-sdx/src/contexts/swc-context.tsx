import { createContext, useContext, useEffect, useState } from "react";
import type { ReactNode } from "react";
import initSwc from "@swc/wasm-web";

interface SWCContextType {
  isInitialized: boolean;
}

const SWCContext = createContext({} as SWCContextType);

export function SWCContextProvider({ children }: { children: ReactNode }) {
  const [isInitialized, setIsInitialized] = useState(false);

  useEffect(() => {
    async function importAndRunSwcOnMount() {
      try {
        await initSwc({
          module_or_path: "node_modules/@swc/wasm-web/wasm_bg.wasm",
        });

        setIsInitialized(true);
      } catch (e) {
        throw Error(`SWC initialization failed: ${(e as Error).message}`);
      }
    }

    importAndRunSwcOnMount();
  });

  return (
    <SWCContext.Provider value={{ isInitialized }}>
      {children}
    </SWCContext.Provider>
  );
}

export const useSWCContext = () => useContext(SWCContext);
