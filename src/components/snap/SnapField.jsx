// SnapField.jsx -- labelled controls for the Outreach module's forms.
// Option lists are either code lists from lib/outreachContacts.js, labelled
// by the i18n key `<labelPrefix><code>` (e.g. snapLang_ht), or a program's
// configured options, labelled by `labelFor(code)`. Either way the database
// stores stable codes and every language reads its own label.
// py-0 cancels main.css's 12px top/bottom padding on inputs and selects (it
// clips the text in a 40px box); selects keep room on the right for the chevron.
export const SNAP_CONTROL = "h-10 min-h-0 w-full rounded-lg border border-border bg-background px-3 py-0 [&:is(select)]:pr-9 text-sm text-card-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/15 disabled:opacity-60";

export function SnapSelect({ id, label, value, options, labelPrefix, labelFor, emptyLabel, onChange, disabled, t }) {
  return (
    <div className="grid gap-1.5">
      <label htmlFor={id} className="text-xs font-semibold text-muted">{label}</label>
      <select id={id} className={SNAP_CONTROL} value={value || ""} disabled={disabled} onChange={(e) => onChange(e.target.value)}>
        {emptyLabel !== undefined && <option value="">{emptyLabel}</option>}
        {options.map((o) => <option key={o} value={o}>{labelFor ? labelFor(o) : t(labelPrefix + o)}</option>)}
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
