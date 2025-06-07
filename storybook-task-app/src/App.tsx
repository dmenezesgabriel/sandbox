import "./App.css";
import { Provider } from "react-redux";
import { InboxScreen } from "./components/inbox-screen";
import { store } from "./lib/store";

export function App() {
  return (
    <Provider store={store}>
      <InboxScreen />
    </Provider>
  );
}
