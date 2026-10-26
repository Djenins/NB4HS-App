// field.jsx -- form controls and the Field wrapper that labels them.
//
// <Field label hint error required htmlFor> renders a visible label (never
// placeholder-only), the control, then either the error (role="alert") or
// the hint. Input/Select/Textarea are 40px controls (44px on touch screens)
// on the 10px control radius.
//
// The control classes have to beat main.css's bare input/select/textarea
// rule (52px min-height, 12px/14px padding, 14px radius, --bg fill) -- with
// Tailwind's preflight off those tag rules still apply -- so each slot is
// set explicitly. Select keeps main.css's chevron background-image; bg-card
// only sets the colour.
import { forwardRef } from "react";
import { cn } from "../../lib/cn.js";

export const CONTROL =
  "block min-h-0 w-full rounded-control border border-border bg-card px-3 py-0 text-ui text-card-foreground " +
  "placeholder:text-muted transition-colors duration-fast hover:border-line-strong " +
  "focus:border-primary focus:outline-none focus:ring-2 " +
  "disabled:cursor-not-allowed disabled:bg-surface-sunken disabled:opacity-70 " +
  "aria-[invalid=true]:border-accent";

export const Input = forwardRef(function Input({ className, ...props }, ref) {
  return <input ref={ref} className={cn(CONTROL, "h-10 [@media(pointer:coarse)]:h-11", className)} {...props} />;
});

export const Select = forwardRef(function Select({ className, children, ...props }, ref) {
  return (
    <select ref={ref} className={cn(CONTROL, "h-10 cursor-pointer pr-10 [@media(pointer:coarse)]:h-11", className)} {...props}>
      {children}
    </select>
  );
});

export const Textarea = forwardRef(function Textarea({ className, ...props }, ref) {
  return <textarea ref={ref} className={cn(CONTROL, "min-h-[96px] py-2 leading-relaxed", className)} {...props} />;
});

export function Field({ label, htmlFor, hint, error, required, className, children }) {
  const messageId = htmlFor ? htmlFor + (error ? "-error" : "-hint") : undefined;
  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      {label ? (
        <label htmlFor={htmlFor} className="text-meta font-semibold text-card-foreground">
          {label}
          {required ? <span className="ml-0.5 text-tone-danger-ink" aria-hidden="true">*</span> : null}
        </label>
      ) : null}
      {children}
      {error ? (
        <p id={messageId} role="alert" className="m-0 text-meta text-tone-danger-ink">{error}</p>
      ) : hint ? (
        <p id={messageId} className="m-0 text-meta text-muted">{hint}</p>
      ) : null}
    </div>
  );
}
