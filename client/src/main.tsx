// Browser entry point.
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App";
import "./firebaseApp"; // initialise Firebase at startup
import "./global.css";

const rootEl = document.getElementById("root");
if (!rootEl) throw new Error("No #root element found");

createRoot(rootEl).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
