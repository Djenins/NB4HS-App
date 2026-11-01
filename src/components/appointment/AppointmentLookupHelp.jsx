// AppointmentLookupHelp.jsx -- the pale-blue "Need help?" panel at the foot of
// the public appointment-lookup page. Deliberately quiet: it sits below the
// primary Find My Appointments action and carries the same "ask a staff
// member" line the kiosk landing screen and check-in form already use.
import { CalendarDays } from "lucide-react";
import calendarIllustration from "../../assets/nb4hs-appointment-calendar.svg";

export default function AppointmentLookupHelp({ title, text }) {
  return (
    <aside className="mt-6 flex items-center gap-4 overflow-hidden rounded-surface bg-tone-info-bg p-5 sm:gap-5 sm:p-6">
      <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-primary-tint text-primary sm:h-16 sm:w-16">
        <CalendarDays size={28} strokeWidth={2} aria-hidden="true" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="m-0 text-touch-section font-extrabold text-navy dark:text-[color:var(--text)] sm:text-touch-section">{title}</p>
        <p className="m-0 mt-1 text-touch-body leading-snug text-muted">{text}</p>
      </div>
      <img
        src={calendarIllustration}
        alt=""
        aria-hidden="true"
        width={260}
        height={200}
        className="hidden h-[104px] w-auto shrink-0 object-contain md:block lg:h-[124px]"
      />
    </aside>
  );
}
