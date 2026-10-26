// drawer.jsx -- a right-hand panel for looking at (and acting on) one
// record without leaving the list: the calendar's EventDrawer anatomy,
// generalised. 448px wide; full width on phones.
//
//   <Drawer open onClose title icon footer closeLabel>body</Drawer>
//
// Header (optional icon disc, h2 title, close), a scrolling body, and a
// footer of actions. Same focus/Escape handling as Dialog.
import { useId } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, m } from "framer-motion";
import { X } from "lucide-react";
import { cn } from "../../lib/cn.js";
import { useModalA11y } from "../../lib/useModalA11y.js";
import { IconButton } from "./icon-button.jsx";

function DrawerPanel({ onClose, title, subtitle, icon, footer, closeLabel, children }) {
  const ref = useModalA11y(onClose, true);
  const titleId = useId();
  return (
    <m.aside
      ref={ref}
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      initial={{ x: "100%" }}
      animate={{ x: 0 }}
      exit={{ x: "100%" }}
      transition={{ type: "tween", duration: 0.2, ease: [0.2, 0.8, 0.2, 1] }}
      className="fixed inset-y-0 right-0 z-[1201] flex w-full max-w-md flex-col border-l border-border bg-card text-card-foreground shadow-overlay"
    >
      <div className="flex items-center gap-3 border-b border-border px-5 py-4">
        {icon ? <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-control bg-tone-info-chip text-tone-info-ink [&_svg]:h-[18px] [&_svg]:w-[18px]">{icon}</div> : null}
        <div className="min-w-0 flex-1">
          <h2 id={titleId} className="m-0 truncate text-section font-semibold text-card-foreground">{title}</h2>
          {subtitle ? <p className="m-0 truncate text-meta text-muted">{subtitle}</p> : null}
        </div>
        <IconButton label={closeLabel} onClick={onClose} className="-mr-2">
          <X aria-hidden="true" />
        </IconButton>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5">{children}</div>
      {footer ? <div className="flex flex-wrap items-center justify-end gap-2 border-t border-border px-5 py-3">{footer}</div> : null}
    </m.aside>
  );
}

export function Drawer({ open, onClose, className, ...rest }) {
  return createPortal(
    <AnimatePresence>
      {open ? (
        <div key="drawer" className={cn("no-print", className)}>
          <m.div
            className="fixed inset-0 z-[1200] bg-surface-overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            onMouseDown={onClose}
            aria-hidden="true"
          />
          <DrawerPanel onClose={onClose} {...rest} />
        </div>
      ) : null}
    </AnimatePresence>,
    document.body
  );
}

// A label/value row for a drawer or detail panel.
export function DetailRow({ label, children, className }) {
  return (
    // flex-wrap + ml-auto: a value too long for the row drops to its own
    // line whole, instead of breaking a phone number mid-way.
    <div className={cn("flex flex-wrap items-baseline justify-between gap-x-4 gap-y-0.5 border-b border-line-subtle py-2.5 last:border-b-0", className)}>
      <dt className="text-meta text-muted">{label}</dt>
      <dd className="m-0 ml-auto max-w-full text-right text-ui font-semibold tabular-nums text-card-foreground [overflow-wrap:anywhere]">{children}</dd>
    </div>
  );
}
