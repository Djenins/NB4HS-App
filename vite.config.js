import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Standard Vite + React setup, nothing custom. See README-Dev.md for why
// this project exists alongside the buildless NB4HS-App version, and for
// exact run instructions.
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173
  }
});
