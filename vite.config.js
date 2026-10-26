import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Standard Vite + React setup, nothing custom. See README-Dev.md for why
// this project exists alongside the buildless NB4HS-App version, and for
// exact run instructions.
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173
  },
  // Staff pages are lazy routes (App.jsx). Recharts is shared by Dashboard,
  // Reports and Workforce Reports, so give it its own named chunk -- cached
  // once across all three instead of being named after whichever page
  // Rollup happened to see first.
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (/node_modules\/(recharts|d3-|victory-vendor)/.test(id)) return "charts";
        }
      }
    }
  },
  // `npm test` (Vitest, config lives here since Vitest reads Vite's own
  // config file). jsdom + jest-dom matchers so component tests aren't
  // limited to the pure-function tests in src/lib/*.test.js -- see
  // src/test/setup.js.
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: "./src/test/setup.js",
    // supabase/functions/**/*.test.ts are Deno tests (CI runs them with deno).
    include: ["src/**/*.test.{js,jsx}"]
  }
});
