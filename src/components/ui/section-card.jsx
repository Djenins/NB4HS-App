// section-card.jsx -- a titled card section: the building block of record
// pages, dashboards and settings. `flush` drops the body padding for a
// table or list that runs edge to edge.
import { cn } from "../../lib/cn.js";
import { Card } from "./card.jsx";

export function SectionCard({ title, description, action, footer, flush, className, children }) {
  return (
    <Card className={cn("overflow-hidden", className)}>
      {title || action ? (
        <div className="flex flex-wrap items-start justify-between gap-3 px-5 pb-3 pt-5 sm:px-6">
          <div className="min-w-0">
            {title ? <h2 className="m-0 text-section font-semibold text-card-foreground">{title}</h2> : null}
            {description ? <p className="m-0 mt-0.5 text-meta text-muted">{description}</p> : null}
          </div>
          {action ? <div className="flex shrink-0 items-center gap-2">{action}</div> : null}
        </div>
      ) : null}
      <div className={cn(flush ? "" : "px-5 pb-5 sm:px-6 sm:pb-6", !title && !action && !flush && "pt-5 sm:pt-6")}>{children}</div>
      {footer ? <div className="border-t border-border px-5 py-3 sm:px-6">{footer}</div> : null}
    </Card>
  );
}
