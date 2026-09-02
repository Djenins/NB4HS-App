// KioskSelectField.jsx -- kiosk-scaled wrapper around a native <select>.
// Native on purpose: the check-in kiosk runs on a touchscreen, where the
// OS's own full-screen option picker is far easier to hit than any custom
// dropdown, and the surrounding form still reads the value via FormData.
import { cn } from "../../lib/cn.js";
import { KioskFieldError, KioskLabel, KIOSK_CONTROL } from "./KioskField.jsx";

export default function KioskSelectField({
  name, id, label, required = false, error = "", value, defaultValue, onChange, children, className, hint
}) {
  const selectId = id || "checkin-field-" + name;
  const errorId = error ? selectId + "-error" : undefined;
  return (
    <div className={cn("min-w-0", className)}>
      <KioskLabel htmlFor={selectId} required={required}>{label}</KioskLabel>
      <select
        name={name}
        id={selectId}
        value={value}
        defaultValue={defaultValue}
        onChange={onChange}
        aria-invalid={error ? "true" : undefined}
        aria-describedby={errorId}
        className={cn(KIOSK_CONTROL, "kiosk-select w-full", error && "field-invalid")}
      >
        {children}
      </select>
      {hint}
      <KioskFieldError id={errorId}>{error}</KioskFieldError>
    </div>
  );
}
