// main.jsx -- entry point. Mounts the app once: BrowserRouter (URL-based
// navigation) wraps AppProvider (all shared state) wraps App (the route
// table). Toast and ConfirmModal render alongside App so they're available
// on every route without every page needing to think about them.
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { LazyMotion, MotionConfig } from "framer-motion";
import App from "./App.jsx";
import { AppProvider } from "./context/AppContext.jsx";
import Toast from "./components/Toast.jsx";
import ConfirmModal from "./components/ConfirmModal.jsx";
// Tailwind loads first (preflight is disabled in tailwind.config.js, so
// this only adds utility classes -- it can't strip main.css's styling from
// pages that haven't been touched by the Tailwind/shadcn redesign pass).
import "./styles/tailwind.css";
import "./styles/main.css";

// MotionConfig reducedMotion="user": with the OS "reduce motion" setting on,
// every framer-motion entrance drops its slide/scale and keeps the fade, so
// the state change still reads without anything moving across the screen.
//
// LazyMotion: components use the slim `m.*` elements, and framer-motion's
// animation engine (domAnimation -- animate/exit/variants/hover/tap, no
// drag or layout) arrives as its own chunk right after first paint instead
// of riding in the entry bundle. `strict` makes a stray full `motion.*`
// element throw in dev, so the saving can't silently regress.
const loadMotionFeatures = () => import("./lib/motionFeatures.js").then((mod) => mod.default);

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <LazyMotion features={loadMotionFeatures} strict>
      <MotionConfig reducedMotion="user">
        <BrowserRouter>
          <AppProvider>
            <App />
            <Toast />
            <ConfirmModal />
          </AppProvider>
        </BrowserRouter>
      </MotionConfig>
    </LazyMotion>
  </StrictMode>
);
