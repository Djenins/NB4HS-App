// ModuleNav.jsx -- the standard secondary navigation for switching between
// the sections *inside* one module (e.g. Workforce Development's Job
// Seekers / Dashboard / Employers / ... strip). Stacked icon + label, with
// a blue underline marking the active section, on its own white card.
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
import { cn } from "../lib/cn.js";

const BTN_RESET = "min-h-0 rounded-none border-0 bg-transparent font-normal transform-none";

export default function ModuleNav({ items, value, onChange, label, className }) {
  return (
    <nav
      aria-label={label}
      className={cn("mb-5 overflow-x-auto rounded-xl border border-border bg-card shadow-card", className)}
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
  );
}
