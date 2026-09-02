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
import { formatPhone } from "../../lib/utils.js";

// `appt-control` is the hook main.css uses to trim these back on short
// landscape kiosks (1366x768 and friends) without shrinking the type.
export const APPT_CONTROL = "appt-control block w-full min-h-[56px] rounded-[14px] text-base sm:text-[1.02rem]";
const ICON_PAD = "pl-[52px]";

export function ApptLabel({ htmlFor, required, children, className }) {
  return (
    <label
      htmlFor={htmlFor}
      className={cn("appt-label mb-1.5 block text-[0.95rem] font-bold text-navy dark:text-[color:var(--text)]", className)}
    >
      {children}
      {required && <span className="text-accent" aria-hidden="true"> *</span>}
    </label>
  );
}

export function ApptFieldError({ id, children }) {
  if (!children) return null;
  return (
    <p id={id} role="alert" className="appt-error mt-1.5 text-[0.9rem] font-semibold text-accent">
      {children}
    </p>
  );
}

function LeadingIcon({ icon: Glyph }) {
  if (!Glyph) return null;
  return (
    <Glyph
      size={20}
      strokeWidth={2}
      aria-hidden="true"
      className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-primary"
    />
  );
}

export function ApptField({
  name, label, type = "text", required = false, error = "", icon, placeholder, autoComplete, className
}) {
  const id = "appt-req-" + name;
  const errorId = error ? id + "-error" : undefined;
  return (
    <div className={cn("min-w-0", className)}>
      <ApptLabel htmlFor={id} required={required}>{label}</ApptLabel>
      <div className="relative">
        <LeadingIcon icon={icon} />
        <input
          type={type}
          name={name}
          id={id}
          autoComplete={autoComplete}
          placeholder={placeholder}
          aria-required={required ? "true" : undefined}
          aria-invalid={error ? "true" : undefined}
          aria-describedby={errorId}
          className={cn(APPT_CONTROL, icon && ICON_PAD, error && "field-invalid")}
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
  name, id, label, required = false, error = "", icon, value, defaultValue, onChange, children, className
}) {
  const selectId = id || "appt-req-" + name;
  const errorId = error ? selectId + "-error" : undefined;
  return (
    <div className={cn("min-w-0", className)}>
      <ApptLabel htmlFor={selectId} required={required}>{label}</ApptLabel>
      <div className="relative">
        <LeadingIcon icon={icon} />
        <select
          name={name}
          id={selectId}
          value={value}
          defaultValue={defaultValue}
          onChange={onChange}
          aria-required={required ? "true" : undefined}
          aria-invalid={error ? "true" : undefined}
          aria-describedby={errorId}
          className={cn(APPT_CONTROL, "appt-select", icon && ICON_PAD, error && "field-invalid")}
        >
          {children}
        </select>
      </div>
      <ApptFieldError id={errorId}>{error}</ApptFieldError>
    </div>
  );
}

export function ApptTextarea({ name, label, icon: Glyph, placeholder, hint, className }) {
  const id = "appt-req-" + name;
  const hintId = hint ? id + "-hint" : undefined;
  return (
    <div className={cn("min-w-0", className)}>
      <ApptLabel htmlFor={id}>{label}</ApptLabel>
      <div className="relative">
        {/* Sits with the first line of text rather than centred: a textarea
            grows, and a vertically centred icon would drift down with it. */}
        {Glyph && (
          <Glyph
            size={20}
            strokeWidth={2}
            aria-hidden="true"
            className="pointer-events-none absolute left-4 top-[17px] text-primary"
          />
        )}
        <textarea
          name={name}
          id={id}
          aria-describedby={hintId}
          placeholder={placeholder}
          className={cn(APPT_CONTROL, "appt-textarea resize-y py-3", Glyph && ICON_PAD)}
        />
      </div>
      {hint && <p id={hintId} className="appt-hint mt-1.5 text-[0.85rem] leading-snug text-muted">{hint}</p>}
    </div>
  );
}

// Preferred Date keeps the app-wide DatePicker in its uncontrolled mode --
// same component, same hidden "YYYY-MM-DD" input the page already read at
// submit time, same "-- Please select --" empty label. Only the trigger's
// touch scale changes, via .appt-request in main.css.
export function ApptDateField({ name, label, required = false, error = "", className }) {
  const id = "appt-req-" + name;
  const errorId = error ? id + "-error" : undefined;
  return (
    <div className={cn("min-w-0", className)}>
      <ApptLabel htmlFor={id} required={required}>{label}</ApptLabel>
      <DatePicker id={id} name={name} required={required} invalid={!!error} />
      <ApptFieldError id={errorId}>{error}</ApptFieldError>
    </div>
  );
}
