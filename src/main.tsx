import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import App from "./App.tsx";
import { initNativeShell } from "./lib/native";
import { initRevenueCat } from "./lib/revenueCat";

void (async () => {
  await initNativeShell();
  await initRevenueCat();
})();

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
