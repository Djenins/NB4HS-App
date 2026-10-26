// SnapField.jsx -- labelled controls for the SNAP module's forms. Option
// lists are code lists from lib/outreachContacts.js; each code's label is
// the i18n key `<labelPrefix><code>` (e.g. snapLang_ht), so the database
// stores stable codes and every language reads its own label.
export const SNAP_CONTROL = "h-10 min-h-0 w-full rounded-lg border border-border bg-background px-3 text-sm text-card-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/15 disabled:opacity-60";

export function SnapSelect({ id, label, value, options, labelPrefix, emptyLabel, onChange, disabled, t }) {
  return (
    <div className="grid gap-1.5">
      <label htmlFor={id} className="text-xs font-semibold text-muted">{label}</label>
      <select id={id} className={SNAP_CONTROL} value={value || ""} disabled={disabled} onChange={(e) => onChange(e.target.value)}>
        {emptyLabel !== undefined && <option value="">{emptyLabel}</option>}
        {options.map((o) => <option key={o} value={o}>{t(labelPrefix + o)}</option>)}
      </select>
    </div>
  );
}

export function SnapInput({ id, label, value, onChange, type = "text", required, placeholder, invalid }) {
  return (
    <div className="grid gap-1.5">
      <label htmlFor={id} className={"text-xs font-semibold text-muted" + (required ? " required" : "")}>{label}</label>
      <input
        id={id} type={type} value={value} placeholder={placeholder} autoComplete="off"
        aria-invalid={invalid || undefined}
        className={SNAP_CONTROL + (invalid ? " field-invalid" : "")}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  );
}
