import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import i18nSplit from "./vite-i18n-split.js";

// Standard Vite + React setup plus one plugin, i18nSplit, which ships
// Kreyòl and French as on-demand chunks (see vite-i18n-split.js). See
// README-Dev.md for exact run instructions.
export default defineConfig({
  plugins: [react(), i18nSplit()],
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
          if (id.startsWith("\0virtual:i18n-lang/")) return "i18n-" + id.slice("\0virtual:i18n-lang/".length);
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
