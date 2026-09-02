// StudentNameButton.jsx -- one name on the student kiosk's class roster.
// The whole card is the check-in control (tapping a name *is* the submit
// here), so it's sized as a fingertip target rather than a text link, and
// it shows its own in-flight state while its createVisit() call settles.
import { LoaderCircle } from "lucide-react";
import { cn } from "../../lib/cn.js";

function initials(student) {
  const first = (student.firstName || "").trim().charAt(0);
  const last = (student.lastName || "").trim().charAt(0);
  return (first + last).toUpperCase() || "?";
}

export default function StudentNameButton({ student, busy = false, disabled = false, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-busy={busy ? "true" : undefined}
      className={cn(
        "flex min-h-[76px] w-full items-center gap-3 rounded-2xl border border-border bg-card px-4 py-3 text-left",
        "transition-colors duration-150 focus-visible:outline focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-primary",
        !disabled && "hover:border-primary hover:bg-primary-tint active:bg-primary-tint",
        busy && "border-primary bg-primary-tint",
        disabled && !busy && "cursor-not-allowed opacity-55"
      )}
    >
      <span
        className={cn(
          "flex h-12 w-12 shrink-0 items-center justify-center rounded-full text-[1.05rem] font-extrabold",
          busy ? "bg-primary text-white" : "bg-primary-tint text-primary"
        )}
        aria-hidden="true"
      >
        {busy ? <LoaderCircle size={22} strokeWidth={2.4} className="animate-spin" /> : initials(student)}
      </span>
      <span className="min-w-0 flex-1 text-[1.1rem] font-bold leading-tight text-navy dark:text-[color:var(--text)]">
        {student.firstName} {student.lastName}
      </span>
    </button>
  );
}
