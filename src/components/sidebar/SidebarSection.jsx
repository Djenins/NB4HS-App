// SidebarSection.jsx -- one labelled group of nav rows. Expanded: a small
// uppercase heading with a hairline running out to the edge. Collapsed: the
// heading is visually hidden (still read out) and a short divider separates
// groups on the rail instead.
import { useId } from "react";
import { cn } from "../../lib/cn.js";

export default function SidebarSection({ label, collapsed, first, children }) {
  const id = useId();
  return (
    <div role="group" aria-labelledby={id} className={cn(!first && (collapsed ? "mt-2" : "mt-4"))}>
      {collapsed ? (
        <>
          <span id={id} className="sr-only">{label}</span>
          {!first && <div aria-hidden="true" className="mx-auto mb-2 h-px w-8 bg-sb-divider" />}
        </>
      ) : (
        <div className="flex items-center gap-2 px-2.5 pb-1.5">
          <span id={id} className="shrink-0 text-caption font-semibold uppercase tracking-[0.06em] text-sb-muted">{label}</span>
          <span aria-hidden="true" className="h-px flex-1 bg-sb-divider" />
        </div>
      )}
      <ul role="list" className={cn("m-0 list-none p-0", collapsed ? "space-y-1" : "space-y-0.5")}>{children}</ul>
    </div>
  );
}
