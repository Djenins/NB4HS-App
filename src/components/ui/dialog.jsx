// dialog.jsx -- the app's one modal dialog, for work that needs protected
// focus (an edit form, a confirmation). For looking at a record, prefer
// Drawer: it keeps the list in view.
//
//   <Dialog open onClose title description size="sm|md|lg|xl|2xl"
//           footer={<>...buttons</>} closeLabel>
//     body
//   </Dialog>
//
// Anatomy (from the SNAP modals, the strongest of the five older patterns):
// an <h2> title wired to aria-labelledby, an X close button, a body that
// scrolls inside the viewport, and a footer row of Buttons. Focus trap,
// Escape, focus return and dialog stacking come from useModalA11y. Rendered
// into document.body so no ancestor's transform/overflow can clip it.
import { useId } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, m } from "framer-motion";
import { X } from "lucide-react";
import { cn } from "../../lib/cn.js";
import { useModalA11y } from "../../lib/useModalA11y.js";
import { IconButton } from "./icon-button.jsx";

const SIZE = { sm: "max-w-md", md: "max-w-lg", lg: "max-w-2xl", xl: "max-w-4xl", "2xl": "max-w-6xl" };

function DialogPanel({ onClose, title, description, size, footer, closeLabel, children, as: As = "div", panelProps }) {
  const ref = useModalA11y(onClose, true);
  const titleId = useId();
  const descId = useId();
  return (
    <m.div
      initial={{ opacity: 0, y: 8, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 4, scale: 0.98 }}
      transition={{ duration: 0.18, ease: [0.2, 0.8, 0.2, 1] }}
      className={cn("relative flex max-h-[calc(100vh-2rem)] w-full flex-col overflow-hidden rounded-surface border border-border bg-card text-card-foreground shadow-overlay", SIZE[size] || SIZE.md)}
    >
      <As
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={description ? descId : undefined}
        className="flex min-h-0 flex-1 flex-col"
        {...panelProps}
      >
        <div className="flex items-start gap-3 border-b border-border px-6 py-4">
          <div className="min-w-0 flex-1">
            <h2 id={titleId} className="m-0 text-heading font-bold text-card-foreground">{title}</h2>
            {description ? <p id={descId} className="m-0 mt-1 text-meta text-muted">{description}</p> : null}
          </div>
          <IconButton label={closeLabel} onClick={onClose} className="-mr-2 -mt-1">
            <X aria-hidden="true" />
          </IconButton>
        </div>
        {children ? <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5">{children}</div> : null}
        {footer ? (
          <div className="flex flex-wrap items-center justify-end gap-2 border-t border-border bg-surface-sunken px-6 py-3">{footer}</div>
        ) : null}
      </As>
    </m.div>
  );
}

// `as="form"` + panelProps={{ onSubmit }} makes the whole dialog a form, so
// the footer's submit button and Enter in a field both submit it.
export function Dialog({ open, onClose, className, ...rest }) {
  return createPortal(
    <AnimatePresence>
      {open ? (
        <m.div
          key="dialog"
          className={cn("fixed inset-0 z-[1200] flex items-center justify-center bg-surface-overlay p-4", className)}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
          onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}
        >
          <DialogPanel onClose={onClose} {...rest} />
        </m.div>
      ) : null}
    </AnimatePresence>,
    document.body
  );
}
