// SubmitCheckInButton.jsx -- the kiosk's primary call to action. Blue
// (var(--primary), the NB4HS interactive blue), full width of whichever
// column it sits in, and sized for a fingertip rather than a cursor.
import { Send } from "lucide-react";
import { cn } from "../../lib/cn.js";

export default function SubmitCheckInButton({ label, busy = false, className }) {
  return (
    <button
      type="submit"
      disabled={busy}
      className={cn(
        "flex w-full items-center justify-center gap-2.5 whitespace-nowrap rounded-2xl bg-primary px-4 text-[1.05rem] font-bold text-white xl:gap-3 xl:text-[1.15rem]",
        "min-h-[72px] xl:min-h-[80px] shadow-[0_6px_18px_rgba(37,99,235,.28)] transition-colors duration-150",
        "hover:bg-primary-dark active:bg-primary-dark active:scale-[0.99]",
        "focus-visible:outline focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-primary",
        busy && "cursor-not-allowed opacity-70",
        className
      )}
    >
      <Send size={22} strokeWidth={2.2} aria-hidden="true" />
      {label}
    </button>
  );
}
