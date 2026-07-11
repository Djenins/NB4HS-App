// main.jsx -- entry point. Mounts the app once: BrowserRouter (URL-based
// navigation) wraps AppProvider (all shared state) wraps App (the route
// table). Toast and ConfirmModal render alongside App so they're available
// on every route without every page needing to think about them.
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App.jsx";
import { AppProvider } from "./context/AppContext.jsx";
import Toast from "./components/Toast.jsx";
import ConfirmModal from "./components/ConfirmModal.jsx";
// Tailwind loads first (preflight is disabled in tailwind.config.js, so
// this only adds utility classes -- it can't strip main.css's styling from
// pages that haven't been touched by the Tailwind/shadcn redesign pass).
import "./styles/tailwind.css";
import "./styles/main.css";

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <BrowserRouter>
      <AppProvider>
        <App />
        <Toast />
        <ConfirmModal />
      </AppProvider>
    </BrowserRouter>
  </StrictMode>
);
