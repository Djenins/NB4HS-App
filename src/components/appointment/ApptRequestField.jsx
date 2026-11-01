// ApptRequestField.jsx -- the labeled controls used by the public "Request an
// Appointment" kiosk (ApptRequest.jsx). Same contract the page always had:
// every control is uncontrolled and named, and the page reads the values back
// through form.elements at submit time -- these components only supply the
// label/icon/error chrome and the touch scale the kiosk needs.
//
// main.css's bare input/select/textarea rules already provide the fill, 14px
// radius, border and blue focus ring used everywhere else in the app; the
// utilities here only grow that to a fingertip-sized target and leave room
// for the leading Lucide icon.
import DatePicker from "../DatePicker.jsx";
import { cn } from "../../lib/cn.js";
import { formatPhone, todayStr } from "../../lib/utils.js";
import AddressInput from "../AddressInput.jsx";
import { TOUCH_FILL } from "../ui/field.jsx";

// `appt-control` is the hook main.css uses to trim these back on short
// landscape kiosks (1366x768 and friends) without shrinking the type.
export const APPT_CONTROL = TOUCH_FILL + " appt-control block min-h-[56px] rounded-touch text-touch-body";

export function ApptLabel({ htmlFor, required, children, className }) {
  return (
    <label
      htmlFor={htmlFor}
      className={cn("appt-label mb-1.5 block text-touch-label font-bold text-navy dark:text-[color:var(--text)]", className)}
    >
      {children}
      {required && <span className="text-accent" aria-hidden="true"> *</span>}
    </label>
  );
}

export function ApptFieldError({ id, children }) {
  if (!children) return null;
  return (
    <p id={id} role="alert" className="appt-error mt-1.5 text-touch-label font-semibold text-tone-danger-ink">
      {children}
    </p>
  );
}

export function ApptField({
  name, label, type = "text", required = false, error = "", placeholder, autoComplete, className, onAddressSelect
}) {
  // The street field passes onAddressSelect and gets address suggestions.
  const InputEl = onAddressSelect ? AddressInput : "input";
  const addressProps = onAddressSelect ? { onAddressSelect } : {};
  const id = "appt-req-" + name;
  const errorId = error ? id + "-error" : undefined;
  return (
    <div className={cn("min-w-0", className)}>
      <ApptLabel htmlFor={id} required={required}>{label}</ApptLabel>
      <div className="relative">
        <InputEl
          {...addressProps}
          type={type}
          name={name}
          id={id}
          autoComplete={autoComplete}
          placeholder={placeholder}
          aria-required={required ? "true" : undefined}
          aria-invalid={error ? "true" : undefined}
          aria-describedby={errorId}
          className={cn(APPT_CONTROL, error && "field-invalid")}
          // Preserved from the original form: phone input is reformatted as
          // it's typed, exactly the same helper FormField.jsx used.
          onInput={type === "tel" ? (e) => { e.target.value = formatPhone(e.target.value); } : undefined}
        />
      </div>
      <ApptFieldError id={errorId}>{error}</ApptFieldError>
    </div>
  );
}

// Native <select> on purpose: on a front-desk touchscreen the OS's own
// full-screen option list is a far easier target than any custom dropdown,
// and the surrounding form keeps reading the value off form.elements.
export function ApptSelect({
  name, id, label, required = false, error = "", value, defaultValue, onChange, children, className
}) {
  const selectId = id || "appt-req-" + name;
  const errorId = error ? selectId + "-error" : undefined;
  return (
    <div className={cn("min-w-0", className)}>
      <ApptLabel htmlFor={selectId} required={required}>{label}</ApptLabel>
      <div className="relative">
        <select
          name={name}
          id={selectId}
          value={value}
          defaultValue={defaultValue}
          onChange={onChange}
          aria-required={required ? "true" : undefined}
          aria-invalid={error ? "true" : undefined}
          aria-describedby={errorId}
          className={cn(APPT_CONTROL, "appt-select pr-10", error && "field-invalid")}
        >
          {children}
        </select>
      </div>
      <ApptFieldError id={errorId}>{error}</ApptFieldError>
    </div>
  );
}

export function ApptTextarea({ name, label, placeholder, hint, className }) {
  const id = "appt-req-" + name;
  const hintId = hint ? id + "-hint" : undefined;
  return (
    <div className={cn("min-w-0", className)}>
      <ApptLabel htmlFor={id}>{label}</ApptLabel>
      <div className="relative">
        <textarea
          name={name}
          id={id}
          aria-describedby={hintId}
          placeholder={placeholder}
          className={cn(APPT_CONTROL, "appt-textarea resize-y py-3")}
        />
      </div>
      {hint && <p id={hintId} className="appt-hint mt-1.5 text-touch-meta leading-snug text-muted">{hint}</p>}
    </div>
  );
}

// Preferred Date keeps the app-wide DatePicker in its uncontrolled mode --
// same component, same hidden "YYYY-MM-DD" input the page already read at
// submit time, same "-- Please select --" empty label. Only the trigger's
// touch scale changes, via .appt-request in main.css.
// pastOnly: a date that has already happened (date of birth): past days
// allowed, nothing after today.
export function ApptDateField({ name, label, required = false, error = "", className, pastOnly = false }) {
  const id = "appt-req-" + name;
  const errorId = error ? id + "-error" : undefined;
  return (
    <div className={cn("min-w-0", className)}>
      <ApptLabel htmlFor={id} required={required}>{label}</ApptLabel>
      {/* Appointment dates: no past days, request_appointment refuses them. */}
      <DatePicker id={id} name={name} required={required} invalid={!!error}
        min={pastOnly ? undefined : todayStr()} max={pastOnly ? todayStr() : undefined} />
      <ApptFieldError id={errorId}>{error}</ApptFieldError>
    </div>
  );
}
