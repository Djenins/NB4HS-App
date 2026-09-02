// KioskField.jsx -- one labeled control in the landscape check-in kiosk.
// Same contract as the older FormField.jsx (uncontrolled <input name=...>,
// read back through FormData at submit time, id'd "checkin-field-<name>"),
// with the kiosk touch scale layered on top: taller hit area, a label above
// the control, an optional leading Lucide icon, and the per-field error
// message the kiosk shows underneath instead of only a toast.
import { cn } from "../../lib/cn.js";
import { formatPhone } from "../../lib/utils.js";

// Shared control sizing for every kiosk input/select/textarea. main.css's
// bare input/select/textarea rules already supply the fill, border, radius
// and blue focus ring the design system uses everywhere else -- these
// utilities only scale that up to the 52-56px touch target the kiosk needs.
export const KIOSK_CONTROL = "min-h-[52px] rounded-xl text-base sm:text-[1.05rem]";

export function KioskLabel({ htmlFor, children, required, className }) {
  return (
    <label htmlFor={htmlFor} className={cn("mb-1 block text-[0.95rem] font-semibold text-navy dark:text-[color:var(--text)]", className)}>
      {children}
      {required && <span className="text-accent" aria-hidden="true"> *</span>}
    </label>
  );
}

export function KioskFieldError({ id, children }) {
  if (!children) return null;
  return (
    <p id={id} role="alert" className="mt-1.5 text-[0.9rem] font-semibold text-accent">
      {children}
    </p>
  );
}

export default function KioskField({
  name, label, type = "text", required = false, error = "", icon: LeadingIcon,
  placeholder, value, disabled = false, readOnly = false, className
}) {
  const id = "checkin-field-" + name;
  const errorId = error ? id + "-error" : undefined;
  return (
    <div className={cn("min-w-0", className)}>
      <KioskLabel htmlFor={id} required={required}>{label}</KioskLabel>
      <div className="relative">
        {LeadingIcon && (
          <LeadingIcon
            size={20}
            strokeWidth={2}
            aria-hidden="true"
            className={cn(
              // Hidden on the narrowest phones: at 375px the icon's inset
              // would crowd the field's own value out of view.
              "pointer-events-none absolute left-4 top-1/2 hidden -translate-y-1/2 sm:block",
              disabled ? "text-muted" : "text-primary"
            )}
          />
        )}
        <input
          type={type}
          name={name}
          id={id}
          autoComplete="off"
          placeholder={placeholder}
          value={value}
          disabled={disabled}
          readOnly={readOnly}
          aria-invalid={error ? "true" : undefined}
          aria-describedby={errorId}
          className={cn(KIOSK_CONTROL, "w-full", LeadingIcon && "sm:pl-12", error && "field-invalid")}
          onInput={type === "tel" ? (e) => { e.target.value = formatPhone(e.target.value); } : undefined}
        />
      </div>
      <KioskFieldError id={errorId}>{error}</KioskFieldError>
    </div>
  );
}
