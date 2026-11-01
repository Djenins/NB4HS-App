// collapsible-section.jsx -- a SectionCard whose body can be collapsed, for
// a form that stays out of the way until staff need it (Add a household,
// Import). The toggle is a real button with aria-expanded in the card's
// action slot; collapsed, only the header (and any `extra`, e.g. a
// duplicate-client warning) renders. Same anatomy as Case Management's
// local copy, which can move onto this one in the design clean-up.
//
//   <CollapsibleSection title description collapsed onToggle expandLabel collapseLabel cardRef extra>
import { useId } from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "../../lib/cn.js";
import { IconButton } from "./icon-button.jsx";
import { SectionCard } from "./section-card.jsx";

export function CollapsibleSection({ title, description, collapsed, onToggle, expandLabel, collapseLabel, cardRef, extra, className, children }) {
  const bodyId = useId();
  // Name the section in the toggle, so two collapsed cards on one page
  // don't both read as just "Expand section".
  const toggleLabel = (collapsed ? expandLabel : collapseLabel) + (typeof title === "string" ? ": " + title : "");
  return (
    <div ref={cardRef} className={cn("mb-5 scroll-mt-4", className)}>
      <SectionCard
        title={title}
        description={description}
        flush={collapsed}
        action={
          <IconButton
            variant="secondary"
            label={toggleLabel}
            aria-expanded={!collapsed}
            aria-controls={bodyId}
            onClick={onToggle}
          >
            <ChevronDown className={cn("transition-transform duration-fast", !collapsed && "rotate-180")} aria-hidden="true" />
          </IconButton>
        }
      >
        {collapsed ? (extra || null) : <><div id={bodyId}>{children}</div>{extra}</>}
      </SectionCard>
    </div>
  );
}
