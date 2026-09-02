// ApptRequestCard.jsx -- one of the two big white form cards on the public
// "Request an Appointment" screen (Your Information | Appointment Details).
//
// On the landscape kiosk the two sit side by side and are always open. Below
// the kiosk breakpoint they become accordions so a phone doesn't open onto a
// wall of fields -- collapsing only hides the body with display:none, it
// never unmounts it, so the uncontrolled inputs keep whatever the visitor has
// already typed (and the page still reads every value at submit time).
import { ChevronDown, ChevronUp } from "lucide-react";
import { cn } from "../../lib/cn.js";

export default function ApptRequestCard({ id, icon: CardIcon, title, description, open = true, onToggle, children }) {
  const bodyId = id + "-body";
  return (
    <section
      aria-labelledby={id + "-title"}
      className="appt-card flex flex-col rounded-[18px] border border-border bg-card p-4 shadow-card sm:p-5 xl:p-6"
    >
      <div className="appt-card-head flex items-start gap-3 sm:gap-4">
        <span className="appt-card-badge flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-primary-tint text-primary sm:h-12 sm:w-12">
          <CardIcon size={22} strokeWidth={2} aria-hidden="true" />
        </span>
        <div className="min-w-0 flex-1">
          <h2
            id={id + "-title"}
            className="appt-card-title m-0 text-[1.15rem] font-extrabold leading-tight tracking-tight text-navy dark:text-[color:var(--text)] sm:text-[1.3rem]"
          >
            {title}
          </h2>
          <p className="appt-card-desc m-0 mt-1 text-[0.92rem] leading-snug text-muted sm:text-[0.95rem]">{description}</p>
        </div>
        {/* Kiosk columns are always expanded, so the toggle only exists at
            phone/tablet widths -- where it's a full-height 44px target. */}
        <button
          type="button"
          onClick={onToggle}
          aria-expanded={open}
          aria-controls={bodyId}
          className="-mr-1 flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-border bg-card p-0 text-primary transition-colors hover:bg-primary-tint focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary lg:hidden"
        >
          <span className="sr-only">{title}</span>
          {open
            ? <ChevronUp size={22} strokeWidth={2.4} aria-hidden="true" />
            : <ChevronDown size={22} strokeWidth={2.4} aria-hidden="true" />}
        </button>
      </div>

      <div id={bodyId} className={cn("appt-card-body mt-4 flex-1 sm:mt-5", !open && "hidden lg:block")}>
        {children}
      </div>
    </section>
  );
}
