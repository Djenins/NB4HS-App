// tailwind.config.js -- added for the Dashboard + sidebar shell redesign
// (Tailwind/shadcn/Recharts/Framer Motion pass). Every color below is a
// pointer at the CSS custom properties already defined in src/styles/
// main.css (:root / html[data-theme="dark"]) -- NOT a new hex palette.
// That's deliberate: the NB4HS Design System's navy/blue/red/gold values and
// their light/dark-mode variants stay defined in exactly one place, so
// Tailwind utilities (bg-primary, text-accent, etc.) and the rest of the
// app's existing hand-written CSS never drift apart. Dark mode is wired to the
// app's existing `data-theme="dark"` attribute toggle (ThemeToggle.jsx /
// storage.js's applyTheme()) instead of Tailwind's own class-based scheme,
// so there's exactly one dark-mode mechanism in the app, not two.
import tailwindcssAnimate from "tailwindcss-animate";

/** @type {import('tailwindcss').Config} */
export default {
  darkMode: ["selector", '[data-theme="dark"]'],
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: ["Inter", "-apple-system", "BlinkMacSystemFont", "Segoe UI", "Roboto", "Helvetica", "Arial", "sans-serif"]
      },
      colors: {
        // Primary is the NB4HS Design System's interactive blue (buttons,
        // active nav items, links, focus, charts, icons) -- split apart from
        // brand navy (chrome/backgrounds) below, since the two used to be
        // conflated under one --primary value.
        // `soft` is the hairline-border tint (border-primary-soft); it exists
        // because `border-primary/25` can't work on a var()-backed colour --
        // see --border-*-soft in main.css.
        primary: { DEFAULT: "var(--primary)", dark: "var(--primary-dark)", foreground: "#ffffff", soft: "var(--border-primary-soft)" },
        navy: { DEFAULT: "var(--navy)", dark: "var(--navy-dark)", foreground: "#ffffff" },
        // Accent is red, reserved for errors/validation/destructive actions only.
        accent: { DEFAULT: "var(--accent)", dark: "var(--accent-dark)", foreground: "#ffffff", soft: "var(--border-accent-soft)" },
        success: { DEFAULT: "var(--success)", soft: "var(--border-success-soft)" },
        // Gold: sparing premium accent (dividers, featured stats, KPI
        // highlights, badges) -- never a dominant color.
        gold: { DEFAULT: "var(--gold)", dark: "var(--gold-dark)", foreground: "#1F172A" },
        warn: "var(--warn)",
        background: "var(--bg)",
        card: { DEFAULT: "var(--card)", foreground: "var(--text)" },
        border: "var(--border)",
        "secondary-border": "var(--secondary-border)",
        muted: { DEFAULT: "var(--muted)", foreground: "var(--muted)" },
        "primary-tint": "var(--primary-tint)",
        "accent-tint": "var(--accent-tint)",
        "gold-tint": "var(--gold-tint)",
        "tint-neutral": "var(--tint-neutral)",
        "tint-success": "var(--tint-success)",
        "tint-warn": "var(--tint-warn)",
        "tint-danger": "var(--tint-danger)",
        // Fixed (non-theme-swapping) navy shades for the permanently dark
        // sidebar chrome -- the sidebar stays brand-navy regardless of the
        // Light/Dark content toggle, same pattern as Linear/Vercel-style
        // admin shells. sidebar-bg/-border/-text sample the new NB4HS Navy;
        // sidebar-bg-active is the new Primary Blue (the brand spec calls
        // out "Active menu items" as a Blue usage, not a navy shade).
        "sidebar-bg": "#1F2A6D",
        "sidebar-bg-active": "#2563EB",
        "sidebar-border": "#2c3868",
        "sidebar-text": "#c7cde3",
        "sidebar-text-active": "#ffffff"
      },
      borderRadius: {
        lg: "var(--radius)",
        xl: "var(--radius-lg)"
      },
      boxShadow: {
        card: "var(--shadow-sm)",
        "card-hover": "var(--shadow-md)",
        lg: "var(--shadow-lg)"
      }
    }
  },
  corePlugins: {
    // Preflight resets bare tag selectors (button/input/h1/etc.) globally.
    // main.css already styles those same tag selectors for the ~90% of the
    // app not touched by this redesign pass -- letting preflight in would
    // silently strip that styling everywhere else. Disabled; the new
    // Tailwind-based components below use explicit utility classes instead
    // of relying on a reset.
    preflight: false
  },
  plugins: [tailwindcssAnimate]
};
