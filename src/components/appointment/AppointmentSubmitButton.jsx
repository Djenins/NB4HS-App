// AppointmentSubmitButton.jsx -- the strongest call to action on the
// "Request an Appointment" screen: NB4HS blue, full width, and tall enough
// to hit with a thumb on the kiosk.
//
// While the insert is in flight the button is disabled and relabelled
// "Submitting…", which is what stops an impatient double-tap on a
// touchscreen from filing the same request twice.
import { Loader2, Send } from "lucide-react";
import { cn } from "../../lib/cn.js";

export default function AppointmentSubmitButton({ label, busyLabel, busy = false, className }) {
  return (
    <button
      type="submit"
      disabled={busy}
      aria-busy={busy ? "true" : undefined}
      className={cn(
        "appt-submit flex w-full items-center justify-center gap-3 rounded-[14px] bg-primary px-5 font-bold text-white",
        "min-h-[60px] text-[1.08rem] sm:min-h-[66px] sm:text-[1.2rem]",
        "shadow-[0_6px_18px_rgba(37,99,235,.28)] transition-colors duration-150",
        "hover:bg-primary-dark active:bg-primary-dark active:scale-[0.995]",
        "focus-visible:outline focus-visible:outline-[3px] focus-visible:outline-offset-2 focus-visible:outline-primary",
        busy && "cursor-not-allowed opacity-70",
        className
      )}
    >
      {busy
        ? <Loader2 size={24} strokeWidth={2.4} aria-hidden="true" className="animate-spin" />
        : <Send size={24} strokeWidth={2.2} aria-hidden="true" />}
      {busy ? busyLabel : label}
    </button>
  );
}
