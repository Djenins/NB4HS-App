// KioskStepCard.jsx -- one of the three "where am I in this form" cards in
// the kiosk sidebar. Doubles as anchor navigation: tapping a card scrolls
// its matching KioskSection into view. The blue "you are here" highlight
// is one shared layer that slides from card to card as the client moves
// through the form, rather than one card switching off and another on.
import { m } from "framer-motion";
import { cn } from "../../lib/cn.js";

export default function KioskStepCard({ number, icon: StepIcon, title, description, active, onClick, enterAt = 0 }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-current={active ? "step" : undefined}
      style={{ "--d": enterAt + "s" }}
      className={cn(
        "k-enter k-press relative flex w-full min-w-0 flex-1 items-start gap-3 rounded-surface border p-2.5 text-left xl:p-3.5 lg:flex-none",
        "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary",
        active
          ? "border-transparent"
          : "border-border bg-card hover:border-primary-soft hover:bg-surface-sunken"
      )}
    >
      {active ? (
        <m.span
          layoutId="kiosk-step-highlight"
          aria-hidden="true"
          className="absolute -inset-px rounded-[inherit] border border-primary bg-primary-tint shadow-card"
          transition={{ type: "tween", duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
        />
      ) : null}
      <span
        className={cn(
          "relative flex h-10 w-10 shrink-0 items-center justify-center rounded-full transition-colors duration-fast xl:h-11 xl:w-11",
          active ? "bg-primary text-primary-foreground" : "bg-surface-sunken text-muted"
        )}
      >
        <StepIcon size={20} strokeWidth={2} aria-hidden="true" />
      </span>
      <span className="relative min-w-0 flex-1">
        <span className="flex items-baseline gap-2">
          <span className={cn("text-touch-meta font-extrabold tabular-nums", active ? "text-primary" : "text-muted")}>{number}</span>
          <span className="text-touch-section font-bold leading-tight text-navy dark:text-[color:var(--text)]">{title}</span>
        </span>
        <span className="mt-0.5 block text-touch-meta leading-snug text-muted xl:mt-1 xl:text-touch-meta">{description}</span>
      </span>
    </button>
  );
}
