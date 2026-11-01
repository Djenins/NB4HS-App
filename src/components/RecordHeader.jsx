// RecordHeader.jsx -- the identity header shared by record pages (client,
// employer, job client, placement). Back link, initials avatar, the record's
// name as the page's h1 at title size, a badge row, an optional contact
// line, then a strip of "at a glance" facts so the details staff check most
// don't sit three tabs deep. Once the header scrolls out of view a compact
// bar (avatar, name, badges, actions) slides in under the topbar, so the
// name and the main actions stay in reach on long tabs.
//
// Purely presentational: the page decides which facts, badges and actions
// to show. `actions` renders in the full header; `compactActions` (smaller
// buttons) in the bar, falling back to `actions`. `backLabel` names where
// the back link goes (e.g. "Employers"); it defaults to "Back".
import { useEffect, useRef, useState } from "react";
import { ArrowLeft } from "lucide-react";
import { useT } from "../context/AppContext.jsx";
import { avatarColorFor } from "../lib/avatarTone.js";
import { cn } from "../lib/cn.js";
import { useTopbarOffset } from "./ModuleNav.jsx";
import { Avatar, AvatarFallback } from "./ui/avatar.jsx";
import { Button } from "./ui/button.jsx";

export function ContactItem({ icon: Icon, label, children }) {
  return (
    <div className="flex min-w-0 items-center gap-1.5">
      <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
      <dt className="sr-only">{label}</dt>
      <dd className="m-0 min-w-0 break-words">{children}</dd>
    </div>
  );
}

// One cell of the facts strip: an icon disc in the fact's tone, the label as
// an overline-sized meta line, the value below. `hint` is a quieter second
// line (e.g. a time under a date). Full class names so Tailwind sees them.
const FACT_TONE = {
  info: "bg-tone-info-bg text-tone-info-ink",
  success: "bg-tone-success-bg text-tone-success-ink",
  warning: "bg-tone-warning-bg text-tone-warning-ink",
  danger: "bg-tone-danger-bg text-tone-danger-ink",
  neutral: "bg-tone-neutral-bg text-tone-neutral-ink",
  violet: "bg-tone-violet-bg text-tone-violet-ink"
};

function Fact({ icon: Icon, label, value, hint, tone = "neutral" }) {
  return (
    <div className="flex min-w-0 items-start gap-2.5 bg-card px-3 py-3 sm:gap-3 sm:px-5 sm:py-3.5">
      {Icon ? (
        <span className={cn("mt-0.5 hidden h-8 w-8 shrink-0 sm:flex items-center justify-center rounded-chip", FACT_TONE[tone])}>
          <Icon className="h-4 w-4" aria-hidden="true" />
        </span>
      ) : null}
      <div className="min-w-0">
        <dt className="text-meta font-medium text-muted">{label}</dt>
        <dd className="m-0 mt-0.5 break-words text-ui font-semibold text-card-foreground tabular-nums">{value}</dd>
        {hint ? <dd className="m-0 text-meta text-muted tabular-nums">{hint}</dd> : null}
      </div>
    </div>
  );
}

// True once `ref`'s element has scrolled up under the topbar.
function useScrolledPast(ref, offset) {
  const [past, setPast] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el || typeof IntersectionObserver === "undefined") return undefined;
    const io = new IntersectionObserver(
      ([entry]) => setPast(!entry.isIntersecting && entry.boundingClientRect.top < offset + 1),
      { rootMargin: `-${Math.round(offset)}px 0px 0px 0px` }
    );
    io.observe(el);
    return () => io.disconnect();
  }, [ref, offset]);
  return past;
}

export default function RecordHeader({ name, initials, onBack, backLabel, badges, contact, facts, actions, compactActions }) {
  const t = useT();
  const top = useTopbarOffset();
  const sentinelRef = useRef(null);
  const compact = useScrolledPast(sentinelRef, top);
  const avatarTone = avatarColorFor(name);
  const shownFacts = (facts || []).filter(Boolean);

  return (
    <>
      {/* Zero-height sticky anchor: the bar hangs off it, so it parks under
          the topbar without taking space in the flow. The bar floats as a
          raised card at content width rather than bleeding edge to edge,
          since <main>'s measure and padding differ between shell layouts. */}
      <div className="no-print sticky z-10 h-0" style={{ top }}>
        <div
          className={cn(
            "mt-2 rounded-surface border border-border bg-card px-4 py-2.5 shadow-raised transition duration-200 ease-out motion-reduce:transition-none",
            compact ? "translate-y-0 opacity-100" : "pointer-events-none -translate-y-2 opacity-0"
          )}
          inert={compact ? undefined : ""}
          aria-hidden={compact ? undefined : true}
        >
          <div className="flex items-center gap-3">
            <Avatar className="h-9 w-9 shrink-0" aria-hidden="true">
              <AvatarFallback className={avatarTone + " text-meta"}>{initials}</AvatarFallback>
            </Avatar>
            <div className="flex min-w-0 flex-1 flex-wrap items-center gap-x-3 gap-y-1">
              <span className="truncate text-section font-semibold text-card-foreground">{name}</span>
              <span className="hidden items-center gap-2 sm:flex">{badges}</span>
            </div>
            <div className="flex shrink-0 items-center gap-2">{compactActions || actions}</div>
          </div>
        </div>
      </div>

      <header className="mb-6">
        {onBack ? (
          <Button variant="ghost" size="sm" className="-ml-2 mb-3 text-muted" onClick={onBack}>
            <ArrowLeft className="h-4 w-4" aria-hidden="true" />
            {backLabel || t("back")}
          </Button>
        ) : null}

        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="flex min-w-0 items-start gap-4">
            <Avatar className="h-16 w-16 shrink-0" aria-hidden="true">
              <AvatarFallback className={avatarTone + " text-heading"}>{initials}</AvatarFallback>
            </Avatar>
            <div className="min-w-0">
              {/* m-0 and explicit weight: main.css still styles bare h1 at 2rem/800. */}
              <h1 className="m-0 break-words text-title font-bold text-card-foreground [text-wrap:balance]">{name}</h1>
              {badges ? <div className="mt-2 flex flex-wrap items-center gap-2">{badges}</div> : null}
              {contact ? <dl className="m-0 mt-3 flex flex-wrap gap-x-5 gap-y-1.5 text-meta text-muted">{contact}</dl> : null}
            </div>
          </div>
          {actions ? <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div> : null}
        </div>

        {shownFacts.length ? (
          // gap-px over a line-coloured fill draws hairlines between cells at
          // every column count, with no border juggling per breakpoint.
          // !gap-px: main.css's legacy `.grid{gap:16px}` wins on phones.
          <dl
            className={cn(
              "m-0 mt-5 grid grid-cols-2 !gap-px overflow-hidden rounded-surface border border-border bg-line-subtle shadow-card",
              shownFacts.length >= 4 ? "lg:grid-cols-4" : shownFacts.length === 3 ? "lg:grid-cols-3" : ""
            )}
          >
            {shownFacts.map((f) => <Fact key={f.label} {...f} />)}
          </dl>
        ) : null}
        <div ref={sentinelRef} aria-hidden="true" />
      </header>
    </>
  );
}
