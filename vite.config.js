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
        // Each large dependency group gets its own file, so none is over 500 KB
        // and each is cached on its own. React must be named: left unassigned,
        // Rollup parked it inside "charts", which then loaded on every page.
        // Everything recharts pulls in (lodash, decimal.js-light...) follows it
        // into "charts", which only the chart pages load.
        manualChunks(id) {
          if (/node_modules\/(react|react-dom|scheduler)\//.test(id)) return "react";
          if (/node_modules\/(react-router|react-router-dom|@remix-run)\//.test(id)) return "router";
          if (/node_modules\/@supabase\//.test(id)) return "supabase";
          if (/node_modules\/(@radix-ui|@floating-ui|lucide-react|tailwind-merge|clsx|class-variance-authority)\//.test(id)) return "ui";
          if (/node_modules\/(recharts|d3-|victory-vendor)/.test(id)) return "charts";
          if (/\/src\/lib\/i18n\.js$/.test(id)) return "i18n";
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
