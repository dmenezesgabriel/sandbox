import { Home } from "./pages/home";
import { NotebooksContextProvider } from "./contexts/notebooks-context";
import { SWCContextProvider } from "./contexts/swc-context";

export function App() {
  return (
    <NotebooksContextProvider>
      <SWCContextProvider>
        <Home />
      </SWCContextProvider>
    </NotebooksContextProvider>
  );
}
