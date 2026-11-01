// KioskResult.jsx -- the confirmation screen at the end of every kiosk task
// (checked in, checked out, registered, appointment requested). One frame so
// the four endings look alike: a success check, a title, what happens next,
// then the actions. Centred in the space below KioskTopBar, which already
// carries the logo.
//
// `returnAfterMs` sends the kiosk back to its start screen by itself, so the
// next person never walks up to someone else's confirmation.
import { useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { Check } from "lucide-react";

export default function KioskResult({ title, children, actions, returnAfterMs, onReturn }) {
  const navigate = useNavigate();
  // Held in a ref so a caller's inline onReturn doesn't restart the timer on
  // every render.
  const onReturnRef = useRef(onReturn);
  onReturnRef.current = onReturn;

  useEffect(() => {
    if (!returnAfterMs) return undefined;
    const id = setTimeout(() => {
      if (onReturnRef.current) onReturnRef.current();
      else navigate("/checkin", { replace: true });
    }, returnAfterMs);
    return () => clearTimeout(id);
  }, [returnAfterMs, navigate]);

  return (
    <div className="flex w-full flex-1 flex-col px-1 py-4 sm:py-8">
      <section
        aria-live="polite"
        className="m-auto flex w-full max-w-[640px] flex-col items-center rounded-surface border border-border bg-card px-5 py-7 text-center shadow-card sm:px-10 sm:py-12"
      >
        <span className="success-icon flex h-16 w-16 items-center justify-center rounded-full bg-success text-success-foreground sm:h-[88px] sm:w-[88px]">
          <Check strokeWidth={3} aria-hidden="true" className="h-8 w-8 sm:h-10 sm:w-10" />
        </span>
        <h1 className="m-0 mt-5 text-balance text-touch-heading font-extrabold leading-tight tracking-tight text-navy dark:text-[color:var(--text)] sm:mt-6 sm:text-touch-hero">
          {title}
        </h1>
        <div className="mt-2.5 flex max-w-[52ch] flex-col items-center gap-3 text-touch-body text-muted sm:mt-3 sm:text-touch-lead">
          {children}
        </div>
        {actions && <div className="mt-6 sm:mt-8 flex w-full max-w-[420px] flex-col gap-3">{actions}</div>}
      </section>
    </div>
  );
}

// The two button weights a result screen uses, at kiosk touch scale.
export const RESULT_PRIMARY_BTN = "flex min-h-[60px] w-full items-center justify-center gap-3 rounded-touch bg-primary px-5 text-touch-lead font-bold text-primary-foreground shadow-card transform-none transition-colors duration-fast hover:bg-primary-dark focus-visible:outline focus-visible:outline-[3px] focus-visible:outline-offset-2 focus-visible:outline-primary";
export const RESULT_SECONDARY_BTN = "flex min-h-[56px] w-full items-center justify-center gap-2.5 rounded-touch border border-border bg-card px-5 text-touch-lead font-bold text-navy transform-none transition-colors hover:bg-primary-tint focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary dark:text-[color:var(--text)]";
