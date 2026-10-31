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
        "flex w-full items-center justify-center gap-2.5 whitespace-nowrap rounded-touch bg-primary px-4 text-touch-lead font-bold text-primary-foreground xl:gap-3 xl:text-touch-section",
        "min-h-[72px] xl:min-h-[80px] shadow-raised transition-colors duration-fast",
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
