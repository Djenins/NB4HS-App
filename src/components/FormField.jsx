// FormField.jsx -- ported from checkin_checkout.js's field() string builder:
// a labeled text-ish input, id'd as "checkin-field-<name>" so labels/inputs
// stay paired the same way they were in the original. type="date" renders
// DatePicker in its uncontrolled mode instead of a native input -- the
// caller still reads the value via FormData at submit time (DatePicker
// keeps a hidden input in sync), so no surrounding form logic changes.
import DatePicker from "./DatePicker.jsx";

export default function FormField({ name, label, type = "text", required = false, invalid = false }) {
  const id = "checkin-field-" + name;
  return (
    <div className="field">
      <label className={required ? "required" : ""} htmlFor={id}>{label}</label>
      {type === "date" ? (
        <DatePicker id={id} name={name} required={required} invalid={invalid} />
      ) : (
        <input type={type} name={name} id={id} autoComplete="off" className={invalid ? "field-invalid" : ""} />
      )}
    </div>
  );
}
