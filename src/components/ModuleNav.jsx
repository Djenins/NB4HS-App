// ModuleNav.jsx -- the standard secondary navigation for switching between
// the sections *inside* one module (e.g. Workforce Development's Job
// Seekers / Dashboard / Employers / ... strip). Stacked icon + label, with
// a blue underline marking the active section, on its own white card, and
// it stays put at the top of the content column while the page scrolls.
//
// Scope, deliberately: this is NOT the app's primary navigation. The left
// sidebar, the header and everything else in components/Shell.jsx are the
// permanent application shell and stay exactly as they are. This component
// is also not for local page controls -- record-detail tabs (ClientProfile/
// EmployerProfile/JobClientProfile), the Calendar's Week/Month/Day picker,
// filters and status chips keep their own existing idioms. Reach for
// ModuleNav only when a menu sits inside a page and switches between
// sections of that same module.
//
// Two notes on the classes below, both project traps:
//   * main.css styles the bare `button` tag app-wide (min-height:52px;
//     padding:12px 20px; border:2px solid transparent; border-radius:10px;
//     font-weight:600) because Tailwind's preflight is off -- so every
//     button here has to cancel that itself via BTN_RESET, the same way
//     Shell.jsx does, or the items inflate to 52px pills.
//   * `:where(button:hover){transform:translateY(-1px)}` in main.css would
//     bounce each item away from its underline on hover, hence
//     `transform-none`.
import { useEffect, useState } from "react";
import { cn } from "../lib/cn.js";

const BTN_RESET = "min-h-0 rounded-none border-0 bg-transparent font-normal transform-none";

// How far down the viewport the strip should park itself. The window is the
// scroll container here (Shell.jsx's <aside> is `sticky top-0 h-screen`,
// nothing sets overflow on .app-shell/.content-col/main), and .content-col's
// own header is already `position:sticky; top:0` -- so parking at top:0 would
// slide the strip underneath it. The topbar has no fixed height: it wraps
// (`flex-wrap`), and it carries the brand block only on screens where
// Shell.jsx hides the sidebar. So measure it rather than hard-coding a
// number, and re-measure whenever it resizes. Returns 0 on the routes that
// render no topbar at all (kiosk landing, appointment lookup/request).
function useTopbarOffset() {
  const [offset, setOffset] = useState(0);

  useEffect(() => {
    const bar = document.querySelector(".content-col > header.topbar");
    if (!bar) return undefined;
    const measure = () => setOffset(bar.getBoundingClientRect().height);
    measure();
    if (typeof ResizeObserver === "undefined") return undefined;
    const ro = new ResizeObserver(measure);
    ro.observe(bar);
    return () => ro.disconnect();
  }, []);

  return offset;
}

export default function ModuleNav({ items, value, onChange, label, className }) {
  const top = useTopbarOffset();

  return (
    // The sticky element is this wrapper, not the card, so it can paint a
    // page-coloured backdrop over the gap the card would otherwise leave for
    // content to scroll through: `-mt-4 pt-4` covers <main>'s 16px top
    // padding, `-mx-4 px-4` bleeds out to <main>'s border box on both sides
    // (both mirror `main{padding:16px}` in main.css). z-10 keeps it under
    // the topbar's z-index:15, so the strip slides beneath the header rather
    // than over it on the way up.
    <div className="sticky z-10 -mx-4 -mt-4 mb-5 bg-background px-4 pb-4 pt-4" style={{ top }}>
      <nav
        aria-label={label}
        className={cn("overflow-x-auto rounded-xl border border-border bg-card shadow-card", className)}
      >
        <div className="flex min-w-max items-stretch px-2 sm:px-3">
          {items.map((item) => {
            const active = item.key === value;
            const Icon = item.icon;
            return (
              <button
                key={item.key}
                type="button"
                onClick={() => onChange(item.key)}
                aria-current={active ? "page" : undefined}
                className={cn(
                  BTN_RESET,
                  "relative flex shrink-0 flex-col items-center gap-2.5 px-4 pb-[18px] pt-5 text-[13px] font-semibold leading-none transition-colors sm:px-5",
                  active ? "text-primary" : "text-muted hover:text-card-foreground"
                )}
              >
                <Icon className="h-6 w-6 shrink-0" strokeWidth={1.9} aria-hidden="true" />
                <span className="whitespace-nowrap">{item.label}</span>
                {/* Active underline: pinned to the card's bottom edge rather
                    than drawn as the button's own border-bottom, so it keeps
                    a constant width/position while the label above it changes
                    colour. */}
                <span
                  aria-hidden="true"
                  className={cn(
                    "absolute inset-x-3 bottom-0 h-[3px] rounded-full bg-primary transition-opacity sm:inset-x-4",
                    active ? "opacity-100" : "opacity-0"
                  )}
                />
              </button>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
