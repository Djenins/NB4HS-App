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
  soft: "bg-[#EEF3FC] text-navy dark:text-[color:var(--text)] dark:bg-[#1c2740] dark:text-primary",
  violet: "bg-[#EDE9FE] text-[#7C3AED] dark:bg-[#2c2447] dark:text-[#b39ef2]"
};

export default function KioskSection({ id, sectionRef, icon: SectionIcon, tone = "primary", title, subtitle, children, className }) {
  return (
    <section
      id={id}
      ref={sectionRef}
      aria-labelledby={id + "-title"}
      className={cn(
        "rounded-[18px] border border-border bg-card p-4 shadow-card",
        className
      )}
    >
      <div className="mb-3 flex items-center gap-3">
        <span className={cn("flex h-10 w-10 shrink-0 items-center justify-center rounded-full", BADGE_TONES[tone])}>
          <SectionIcon size={21} strokeWidth={2} aria-hidden="true" />
        </span>
        <div className="min-w-0">
          <h2 id={id + "-title"} className="m-0 text-[1.35rem] font-extrabold tracking-tight text-navy dark:text-[color:var(--text)]">{title}</h2>
          {subtitle && <p className="m-0 mt-0.5 text-[0.92rem] leading-snug text-muted">{subtitle}</p>}
        </div>
      </div>
      {children}
    </section>
  );
}
