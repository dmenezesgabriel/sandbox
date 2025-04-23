import { createContext, useContext } from "react";
import { Runtime } from "../utils/runtime";

interface RuntimeContextType {
  runtime: Runtime;
}

const RuntimeContext = createContext({} as RuntimeContextType);

export function RuntimeContextProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const runtime = new Runtime();

  return (
    <RuntimeContext.Provider value={{ runtime }}>
      {children}
    </RuntimeContext.Provider>
  );
}

export const useRuntime = () => useContext(RuntimeContext);
