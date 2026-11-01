// section-card.jsx -- a titled card section: the building block of record
// pages, dashboards and settings. `flush` drops the body padding for a
// table or list that runs edge to edge. With no children (a collapsed
// section) only the header renders, padded evenly top and bottom. Extra
// props (id, aria-*) pass through to the card, e.g. for a scroll anchor.
import { cn } from "../../lib/cn.js";
import { Card } from "./card.jsx";

export function SectionCard({ title, description, action, footer, flush, className, children, ...rest }) {
  const hasBody = children != null && children !== false;
  return (
    <Card className={cn("overflow-hidden", className)} {...rest}>
      {title || action ? (
        // A lone title centres on the action; with a description under it the
        // action lines up with the top instead of floating mid-paragraph.
        <div className={cn("flex flex-wrap justify-between gap-3 px-5 pt-5 sm:px-6", description ? "items-start" : "items-center", hasBody ? "pb-3" : "pb-5")}>
          {/* flex-1 + a 16rem basis: a long description wraps inside this
              column instead of pushing the action onto its own line. */}
          <div className="min-w-0 flex-1 basis-64">
            {title ? <h2 className="m-0 text-section font-semibold text-card-foreground">{title}</h2> : null}
            {description ? <p className="m-0 mt-0.5 text-meta text-muted">{description}</p> : null}
          </div>
          {action ? <div className="flex shrink-0 items-center gap-2">{action}</div> : null}
        </div>
      ) : null}
      {hasBody ? <div className={cn(flush ? "" : "px-5 pb-5 sm:px-6 sm:pb-6", !title && !action && !flush && "pt-5 sm:pt-6")}>{children}</div> : null}
      {footer ? <div className="border-t border-border px-5 py-3 sm:px-6">{footer}</div> : null}
    </Card>
  );
}
