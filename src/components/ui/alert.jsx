// alert.jsx -- an inline callout inside a page or form: information,
// success, a warning, or an error with its recovery. Full hairline border in
// the tone (no thick side stripe); the icon sits on a chip one step deeper
// than the surface so it stays visible on the tint.
import { AlertTriangle, CheckCircle2, Info, XCircle } from "lucide-react";
import { cn } from "../../lib/cn.js";

const TONES = {
  info: { Icon: Info, box: "border-tone-info-border bg-tone-info-bg", chip: "bg-tone-info-chip text-tone-info-ink" },
  success: { Icon: CheckCircle2, box: "border-tone-success-border bg-tone-success-bg", chip: "bg-tone-success-chip text-tone-success-ink" },
  warning: { Icon: AlertTriangle, box: "border-tone-warning-border bg-tone-warning-bg", chip: "bg-tone-warning-chip text-tone-warning-ink" },
  danger: { Icon: XCircle, box: "border-tone-danger-border bg-tone-danger-bg", chip: "bg-tone-danger-chip text-tone-danger-ink" }
};

export function Alert({ tone = "info", title, children, action, className }) {
  const t = TONES[tone] || TONES.info;
  return (
    <div role={tone === "danger" ? "alert" : "status"} className={cn("flex items-start gap-3 rounded-control border p-3.5", t.box, className)}>
      <div className={cn("flex h-8 w-8 shrink-0 items-center justify-center rounded-chip", t.chip)}>
        <t.Icon className="h-4 w-4" aria-hidden="true" />
      </div>
      <div className="min-w-0 flex-1 pt-1">
        {title ? <div className="text-ui font-semibold text-card-foreground">{title}</div> : null}
        {children ? <div className="text-ui text-on-tint">{children}</div> : null}
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  );
}
