// SnapListParts.jsx -- small pieces the Outreach list sections share, so
// Contacts, Cases and Staff read the same: the record-name button that opens
// a detail dialog, the label/value pairs a phone row stacks, and the load
// error with its retry.
import { useT } from "../../context/AppContext.jsx";
import { cn } from "../../lib/cn.js";
import { BUTTON_RESET, Button } from "../ui/button.jsx";
import { EmptyState } from "../ui/empty-state.jsx";

export function RecordName({ children, onOpen, className }) {
  return (
    <button
      type="button"
      onClick={onOpen}
      className={cn(BUTTON_RESET, "block max-w-full truncate rounded-badge text-left text-ui font-semibold leading-snug text-card-foreground transition-colors duration-fast hover:text-primary hover:underline focus-visible:outline-none focus-visible:ring-2", className)}
    >
      {children}
    </button>
  );
}

// A phone row's secondary facts: label over value, two to a line.
export function RowFacts({ items }) {
  return (
    <dl className="m-0 mt-3 grid grid-cols-2 gap-x-4 gap-y-2">
      {items.map((it) => (
        <div key={it.label} className="min-w-0">
          <dt className="text-meta text-muted">{it.label}</dt>
          <dd className="m-0 truncate text-ui text-card-foreground">{it.value}</dd>
        </div>
      ))}
    </dl>
  );
}

export function LoadError({ title, onRetry }) {
  const t = useT();
  return (
    <EmptyState
      variant="error"
      title={title}
      description={t("snapLoadErrorHint")}
      action={onRetry ? <Button variant="secondary" onClick={onRetry}>{t("retryLabel")}</Button> : null}
    />
  );
}
