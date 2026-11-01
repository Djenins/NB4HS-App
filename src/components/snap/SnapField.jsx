// SnapField.jsx -- labelled selects and inputs for the Outreach module's
// forms, on the design system's Field/Select/Input (components/ui/field.jsx).
// Option lists are either code lists from lib/outreachContacts.js, labelled
// by the i18n key `<labelPrefix><code>` (e.g. snapLang_ht), or a program's
// configured options, labelled by `labelFor(code)`. Either way the database
// stores stable codes and every language reads its own label.
import { cn } from "../../lib/cn.js";
import { Field, Input, Select } from "../ui/field.jsx";

export function SnapSelect({ id, label, value, options, labelPrefix, labelFor, emptyLabel, onChange, disabled, t, className }) {
  return (
    <Field label={label} htmlFor={id} className={className}>
      <Select id={id} value={value || ""} disabled={disabled} onChange={(e) => onChange(e.target.value)}>
        {emptyLabel !== undefined && <option value="">{emptyLabel}</option>}
        {options.map((o) => <option key={o} value={o}>{labelFor ? labelFor(o) : t(labelPrefix + o)}</option>)}
      </Select>
    </Field>
  );
}

export function SnapInput({ id, label, value, onChange, type = "text", required, placeholder, invalid }) {
  return (
    <Field label={label} htmlFor={id} required={required}>
      <Input
        id={id} type={type} value={value} placeholder={placeholder} autoComplete="off"
        aria-invalid={invalid || undefined} aria-required={required || undefined}
        onChange={(e) => onChange(e.target.value)}
      />
    </Field>
  );
}

// A labelled group of checkboxes (assistance types): two columns from sm, so
// long labels like "EBT card help (never ask for the PIN)" don't crowd;
// `wide` adds a third from lg, for the xl case dialog.
export function SnapCheckboxes({ legend, items, isChecked, onToggle, disabled, wide }) {
  return (
    <fieldset className="m-0 min-w-0 border-0 p-0">
      <legend className="mb-2 p-0 text-meta font-semibold text-card-foreground">{legend}</legend>
      <div className={cn("grid gap-x-4 gap-y-2 sm:grid-cols-2", wide && "lg:grid-cols-3")}>
        {items.map((it) => (
          <label key={it.key} className="flex items-start gap-2 text-ui text-card-foreground">
            <input type="checkbox" className="mt-0.5 h-4 w-4 shrink-0 cursor-pointer accent-primary disabled:cursor-not-allowed"
              checked={isChecked(it.key)} disabled={disabled} onChange={() => onToggle(it.key)} />
            {it.label}
          </label>
        ))}
      </div>
    </fieldset>
  );
}
