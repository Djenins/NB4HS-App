// empty-state.jsx -- what a list, panel or page shows when there's nothing
// to show. Three variants, because the next step differs:
//   none        nothing exists yet       -> offer to create the first one
//   no-results  filters hide everything  -> offer to clear the filters
//   error       loading failed           -> say so plainly, offer a retry
// The title says what happened; the description says what to do next.
import { AlertTriangle, Inbox, SearchX } from "lucide-react";
import { cn } from "../../lib/cn.js";

const VARIANT = {
  none: { Icon: Inbox, disc: "bg-tone-info-chip text-tone-info-ink" },
  "no-results": { Icon: SearchX, disc: "bg-tone-neutral-chip text-tone-neutral-ink" },
  error: { Icon: AlertTriangle, disc: "bg-tone-danger-chip text-tone-danger-ink" }
};

export function EmptyState({ variant = "none", icon, title, description, action, compact, className }) {
  const v = VARIANT[variant] || VARIANT.none;
  const Icon = icon || v.Icon;
  return (
    <div
      role={variant === "error" ? "alert" : undefined}
      className={cn("flex flex-col items-center justify-center px-6 text-center", compact ? "py-8" : "py-14", className)}
    >
      <div className={cn("mb-4 flex h-12 w-12 items-center justify-center rounded-chip", v.disc)}>
        <Icon className="h-6 w-6" strokeWidth={1.75} aria-hidden="true" />
      </div>
      <h2 className="m-0 text-section font-semibold text-card-foreground">{title}</h2>
      {description ? <p className="m-0 mt-1 max-w-[46ch] text-body text-muted">{description}</p> : null}
      {action ? <div className="mt-5 flex flex-wrap justify-center gap-2">{action}</div> : null}
    </div>
  );
}
