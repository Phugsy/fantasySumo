import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import Trial from "./Trial";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <Trial />
  </StrictMode>,
);
