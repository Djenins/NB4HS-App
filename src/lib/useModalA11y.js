// useModalA11y.js -- the keyboard/focus contract every .modal-overlay dialog
// needs, in one place instead of hand-rolled per modal (it used to live only
// in Assessments.jsx; ~15 other modals had no Escape or focus handling).
//
//   const boxRef = useModalA11y(onClose);          // modal mounted = open
//   const boxRef = useModalA11y(onClose, isOpen);  // modal rendered inline
//   <div className="modal-box" ref={boxRef} role="dialog" aria-modal="true">
//
// What it does while active:
//   - moves focus into the dialog -- to a [data-autofocus] element if there is
//     one, else the first focusable; an autoFocus field that already took it
//     keeps it -- and puts it back on the opener on close
//   - Escape closes, Tab / Shift+Tab wrap inside the dialog
//   - labels the dialog by its first heading when it has no aria-label(ledby)
//
// Dialogs can stack (a ConfirmModal over a form modal), so only the top-most
// one reacts to keys. Escape is also left alone while a popup inside the
// dialog is open (DatePicker panel, a Radix dropdown portalled outside it) --
// that popup closes first, the dialog on the next Escape.
import { useEffect, useRef } from "react";

const FOCUSABLE = 'button, a[href], input, select, textarea, [tabindex]:not([tabindex="-1"])';
const stack = [];
let labelSeq = 0;

function focusables(container) {
  return Array.from(container.querySelectorAll(FOCUSABLE))
    .filter((el) => !el.disabled && !el.closest("[hidden]") && (typeof el.checkVisibility !== "function" || el.checkVisibility()));
}

function popupOwnsEscape(container, target) {
  if (!(target instanceof Element) || target === document.body) return false;
  if (!container.contains(target)) return true; // focus is in a portal (Radix menu, tooltip)
  if (target.closest('[aria-expanded="true"]')) return true;
  const innerDialog = target.closest('[role="dialog"], [role="alertdialog"]');
  return !!innerDialog && innerDialog !== container;
}

export function useModalA11y(onClose, active = true) {
  const ref = useRef(null);
  // Callers pass inline arrows; keep the latest in a ref so the effect below
  // runs once per open rather than on every render (which would yank focus).
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  // The opener is read during render, not in the effect: autoFocus fields
  // grab focus at commit, before any effect runs, so by then it's gone.
  const openerRef = useRef(null);
  const wasActive = useRef(false);
  if (active && !wasActive.current) openerRef.current = document.activeElement;
  wasActive.current = active;

  useEffect(() => {
    const container = ref.current;
    if (!active || !container) return undefined;
    const previouslyFocused = openerRef.current;
    const entry = { container };
    // React runs a child's effects before its parent's, so a dialog nested
    // inside another one in the same render registers first. Slot a dialog
    // below any dialog it contains, so the innermost stays top-most.
    const nestedAt = stack.findIndex((e) => container.contains(e.container));
    if (nestedAt === -1) stack.push(entry); else stack.splice(nestedAt, 0, entry);

    if (!container.getAttribute("aria-label") && !container.getAttribute("aria-labelledby")) {
      const heading = container.querySelector("h1, h2, h3");
      if (heading) {
        if (!heading.id) heading.id = "modal-title-" + (++labelSeq);
        container.setAttribute("aria-labelledby", heading.id);
      }
    }

    if (!container.contains(document.activeElement)) {
      const first = container.querySelector("[data-autofocus]") || focusables(container)[0];
      if (first) first.focus();
      else { container.setAttribute("tabindex", "-1"); container.focus(); }
    }

    function onKeyDown(e) {
      if (stack[stack.length - 1] !== entry) return;
      if (e.key === "Escape") {
        if (e.defaultPrevented || popupOwnsEscape(container, e.target)) return;
        onCloseRef.current?.();
        return;
      }
      if (e.key !== "Tab" || e.defaultPrevented) return;
      const items = focusables(container);
      if (!items.length) { e.preventDefault(); return; }
      const firstEl = items[0], lastEl = items[items.length - 1];
      const inside = container.contains(document.activeElement);
      if (e.shiftKey && (document.activeElement === firstEl || !inside)) { e.preventDefault(); lastEl.focus(); }
      else if (!e.shiftKey && (document.activeElement === lastEl || !inside)) { e.preventDefault(); firstEl.focus(); }
    }
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      const i = stack.indexOf(entry);
      if (i !== -1) stack.splice(i, 1);
      if (previouslyFocused && previouslyFocused.isConnected && previouslyFocused.focus) previouslyFocused.focus();
    };
  }, [active]);

  return ref;
}
