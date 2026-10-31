// KioskSection.jsx -- one white form card in the kiosk's centre column
// (Visitor Information / Address / Visit Details). Purely presentational:
// icon badge + title in the header, caller-supplied fields in the body.
import { cn } from "../../lib/cn.js";

// Badge tints. Blue is the NB4HS primary; violet is kept for Visit Details
// only (same accent the previous check-in form used for that section), so
// the three sections stay tellable apart at a glance without inventing a
// competing palette.
const BADGE_TONES = {
  primary: "bg-primary-tint text-primary",
  soft: "bg-tone-info-bg text-tone-info-ink",
  violet: "bg-tone-violet-chip text-tone-violet-ink"
};

export default function KioskSection({ id, sectionRef, icon: SectionIcon, tone = "primary", title, subtitle, children, className }) {
  return (
    <section
      id={id}
      ref={sectionRef}
      aria-labelledby={id + "-title"}
      className={cn(
        "rounded-surface border border-border bg-card p-4 shadow-card",
        className
      )}
    >
      <div className="mb-3 flex items-center gap-3">
        <span className={cn("flex h-9 w-9 shrink-0 items-center justify-center rounded-full sm:h-10 sm:w-10", BADGE_TONES[tone])}>
          <SectionIcon strokeWidth={2} aria-hidden="true" className="h-[19px] w-[19px] sm:h-[21px] sm:w-[21px]" />
        </span>
        <div className="min-w-0">
          <h2 id={id + "-title"} className="m-0 text-touch-section font-extrabold leading-tight tracking-tight sm:text-touch-heading text-navy dark:text-[color:var(--text)]">{title}</h2>
          {subtitle && <p className="m-0 mt-0.5 text-touch-label leading-snug text-muted">{subtitle}</p>}
        </div>
      </div>
      {children}
    </section>
  );
}
