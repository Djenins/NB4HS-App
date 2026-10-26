// page-header.jsx -- the one page header every staff screen uses: an
// optional back link, the h1, a one-line description, and an actions slot
// on the right that moves under the title below lg (with the sidebar open, a
// tablet leaves too little width to share a row). Record pages
// pass `meta` (badges, an id) to sit under the title.
import { ArrowLeft } from "lucide-react";
import { cn } from "../../lib/cn.js";
import { Button } from "./button.jsx";

export function PageHeader({ title, description, actions, back, meta, className }) {
  return (
    <header className={cn("mb-6 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between", className)}>
      <div className="min-w-0">
        {back ? (
          <Button variant="ghost" size="sm" className="-ml-2 mb-2 text-muted" onClick={back.onClick}>
            <ArrowLeft className="h-4 w-4" aria-hidden="true" />
            {back.label}
          </Button>
        ) : null}
        {/* m-0 and explicit weight: main.css still styles bare h1 at 2rem/800. */}
        <h1 className="m-0 text-title font-bold text-card-foreground [text-wrap:balance]">{title}</h1>
        {description ? <p className="m-0 mt-1 max-w-[65ch] text-body text-muted">{description}</p> : null}
        {meta ? <div className="mt-2 flex flex-wrap items-center gap-2">{meta}</div> : null}
      </div>
      {actions ? <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div> : null}
    </header>
  );
}
