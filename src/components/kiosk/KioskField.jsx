// KioskField.jsx -- one labeled control in the landscape check-in kiosk.
// Same contract as the older FormField.jsx (uncontrolled <input name=...>,
// read back through FormData at submit time, id'd "checkin-field-<name>"),
// with the kiosk touch scale layered on top: taller hit area, a label above
// the control, an optional leading Lucide icon, and the per-field error
// message the kiosk shows underneath instead of only a toast.
import { cn } from "../../lib/cn.js";
import { formatPhone } from "../../lib/utils.js";
import AddressInput from "../AddressInput.jsx";
import { TOUCH_FILL } from "../ui/field.jsx";

// Shared control sizing for every kiosk input/select/textarea. main.css's
// bare input/select/textarea rules already supply the fill, border, radius
// and blue focus ring the design system uses everywhere else -- these
// utilities only scale that up to the 52-56px touch target the kiosk needs.
export const KIOSK_CONTROL = TOUCH_FILL + " min-h-[52px] rounded-touch text-touch-body";

export function KioskLabel({ htmlFor, children, required, className }) {
  return (
    <label htmlFor={htmlFor} className={cn("mb-1 block text-touch-label font-semibold text-navy dark:text-[color:var(--text)]", className)}>
      {children}
      {required && <span className="text-accent" aria-hidden="true"> *</span>}
    </label>
  );
}

export function KioskFieldError({ id, children }) {
  if (!children) return null;
  return (
    <p id={id} role="alert" className="mt-1.5 text-touch-label font-semibold text-tone-danger-ink">
      {children}
    </p>
  );
}

export default function KioskField({
  name, label, type = "text", required = false, error = "",
  placeholder, value, disabled = false, readOnly = false, className, onAddressSelect
}) {
  // The street field passes onAddressSelect and gets address suggestions.
  const InputEl = onAddressSelect ? AddressInput : "input";
  const addressProps = onAddressSelect ? { onAddressSelect } : {};
  const id = "checkin-field-" + name;
  const errorId = error ? id + "-error" : undefined;
  return (
    <div className={cn("min-w-0", className)}>
      <KioskLabel htmlFor={id} required={required}>{label}</KioskLabel>
      <div className="relative">
        <InputEl
          {...addressProps}
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
          className={cn(KIOSK_CONTROL, "w-full", error && "field-invalid")}
          onInput={type === "tel" ? (e) => { e.target.value = formatPhone(e.target.value); } : undefined}
        />
      </div>
      <KioskFieldError id={errorId}>{error}</KioskFieldError>
    </div>
  );
}
