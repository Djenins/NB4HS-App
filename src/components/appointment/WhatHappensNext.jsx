// WhatHappensNext.jsx -- the pale-blue reassurance strip between the two form
// cards and the Submit Request button. It answers the one question a visitor
// has at that point ("I've filled this in -- now what?") and is deliberately
// short: a request is not a confirmed appointment, and the panel says so.
//
// On a phone it collapses to its heading so it can't push the primary action
// below the fold, and the illustration drops out entirely below the tablet
// breakpoint rather than eating scarce vertical space.
import { ChevronDown, ChevronUp, Info } from "lucide-react";
import calendarIllustration from "../../assets/nb4hs-appointment-calendar.svg";
import { cn } from "../../lib/cn.js";

export default function WhatHappensNext({ title, text, open, onToggle }) {
  return (
    <aside className="appt-next rounded-[18px] bg-[#F1F6FE] p-4 dark:bg-background sm:p-5">
      {/* Top-aligned while the text wraps to several lines on a phone;
          centred once the panel is a single wide strip on the kiosk. */}
      <div className="flex items-start gap-3 sm:gap-4 lg:items-center">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-primary-tint text-primary sm:h-12 sm:w-12">
          <Info size={22} strokeWidth={2} aria-hidden="true" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="m-0 text-[1.05rem] font-extrabold text-navy dark:text-[color:var(--text)] sm:text-[1.15rem]">{title}</p>
          <p
            id="appt-req-next-text"
            className={cn(
              "m-0 mt-1 max-w-[70ch] text-[0.95rem] leading-snug text-muted",
              !open && "hidden lg:block"
            )}
          >
            {text}
          </p>
        </div>
        <img
          src={calendarIllustration}
          alt=""
          aria-hidden="true"
          className="appt-next-art hidden h-[88px] w-auto shrink-0 object-contain md:block"
        />
        <button
          type="button"
          onClick={onToggle}
          aria-expanded={open}
          aria-controls="appt-req-next-text"
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-border bg-card p-0 text-primary transition-colors hover:bg-primary-tint focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary lg:hidden"
        >
          <span className="sr-only">{title}</span>
          {open
            ? <ChevronUp size={22} strokeWidth={2.4} aria-hidden="true" />
            : <ChevronDown size={22} strokeWidth={2.4} aria-hidden="true" />}
        </button>
      </div>
    </aside>
  );
}
