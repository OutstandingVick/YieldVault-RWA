import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import App from "./App.tsx";

import { initSentry } from "./config/sentry.ts";
import { setupLogging } from "./lib/logger.ts";

// Initialize sentry
initSentry();

// Activate structured JSON logging via the telemetry bus
setupLogging();

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
