// ModuleNav.jsx -- the standard program submenu: the horizontal strip that
// switches between the sections *inside* one module (Case Management's
// Dashboard / Clients / Resources / Intakes / Appointments, Workforce,
// Outreach/SNAP, Adult Education, Food Distribution). One white card with
// the items spread evenly across it; each item is a softly tinted rounded
// icon tile with its label underneath. The active item sits on a pale-blue
// background with a blue icon and label -- that is the only active marker.
//
// Each module passes its own `items` ({ key, label, icon, tone?, badge?,
// disabled? }) and `value` (derive it from the route). Permission-based
// visibility stays with the module: it only passes the items the signed-in
// user may see, and the server still enforces access on its own.
//
// Tiles take the TONES palette in order unless an item pins its own `tone`.
// On a phone the strip scrolls sideways (scrollbar hidden) and keeps the
// active item in view; it stays put at the top of the content column while
// the page scrolls.
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
//     nudge each item up on hover -- a visible jump the brief rules out --
//     hence `transform-none`.
import { useEffect, useRef, useState } from "react";
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
// Also used by RecordHeader.jsx's compact bar.
export function useTopbarOffset() {
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

// Tile colours, in the order sections get them: blue, slate, green, amber,
// violet, pink, teal, sky. All theme-aware tokens (light + dark in main.css).
// The active item's tile: a stronger blue than the pale-blue item behind it.
const ACTIVE_TONE = "bg-[color:var(--border-primary-soft)] text-primary";
const TONES = [
  "bg-primary-tint text-primary",
  "bg-tint-neutral text-navy dark:text-[color:var(--text)]",
  "bg-tint-success text-success",
  "bg-tint-warn text-gold-ink",
  "bg-violet-tint text-violet-ink",
  "bg-pink-tint text-pink-ink",
  "bg-teal-tint text-teal-ink",
  "bg-sky-tint text-sky-ink"
];

export default function ModuleNav({ items, value, onChange, label, className }) {
  const top = useTopbarOffset();
  const scrollRef = useRef(null);

  // Keep the active item visible when the strip scrolls (phones): nudge only
  // the strip's own horizontal scroll, never the page.
  useEffect(() => {
    const strip = scrollRef.current;
    const el = strip && strip.querySelector('[aria-current="page"]');
    if (!el) return;
    const left = el.offsetLeft - 8;
    const right = el.offsetLeft + el.offsetWidth + 8;
    if (left < strip.scrollLeft) strip.scrollLeft = left;
    else if (right > strip.scrollLeft + strip.clientWidth) strip.scrollLeft = right - strip.clientWidth;
  }, [value]);

  // A strip with one item switches nothing; the page's own header names it.
  if (items.length < 2) return null;

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
        ref={scrollRef}
        className={cn("no-scrollbar overflow-x-auto rounded-[22px] border border-border bg-card p-1.5 shadow-card lg:p-2.5", className)}
      >
        <ul className="m-0 flex min-w-max list-none gap-0.5 p-0 sm:min-w-0 lg:gap-1.5">
          {items.map((item, i) => {
            const active = item.key === value;
            const disabled = !!item.disabled;
            const Icon = item.icon;
            const tone = active ? ACTIVE_TONE : (item.tone || TONES[i % TONES.length]);
            return (
              <li key={item.key} className="flex min-w-[84px] flex-1 lg:min-w-[104px]">
                <button
                  type="button"
                  onClick={() => { if (!disabled) onChange(item.key); }}
                  aria-current={active ? "page" : undefined}
                  aria-disabled={disabled || undefined}
                  // With a badge, name it explicitly ("Intakes (3)") -- the
                  // visible number is aria-hidden so it isn't read twice.
                  aria-label={item.badge ? item.label + " (" + item.badge + ")" : undefined}
                  className={cn(
                    BTN_RESET,
                    "group flex min-h-[96px] w-full flex-col items-center justify-center gap-2 rounded-2xl px-2 py-3 transition-colors lg:px-3 duration-150 motion-reduce:transition-none",
                    "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary",
                    active ? "bg-primary-tint" : "hover:bg-background",
                    disabled && "cursor-not-allowed opacity-50 hover:bg-transparent"
                  )}
                >
                  <span className={cn("relative flex h-12 w-12 items-center justify-center rounded-[15px] sm:h-[52px] sm:w-[52px]", tone)}>
                    <Icon className="h-6 w-6 shrink-0 sm:h-[26px] sm:w-[26px]" strokeWidth={2} aria-hidden="true" />
                    {item.badge ? (
                      <span aria-hidden="true" className="absolute -right-1.5 -top-1.5 min-w-[20px] rounded-full bg-primary px-1.5 text-center text-[11px] font-bold leading-5 text-primary-foreground shadow-sm">
                        {item.badge > 99 ? "99+" : item.badge}
                      </span>
                    ) : null}
                  </span>
                  <span
                    className={cn(
                      "whitespace-nowrap text-[13px] leading-tight sm:text-sm",
                      active ? "font-semibold text-primary" : "font-medium text-[color:var(--ev-ink-soft)] group-hover:text-navy dark:group-hover:text-[color:var(--text)]"
                    )}
                  >
                    {item.label}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      </nav>
    </div>
  );
}
