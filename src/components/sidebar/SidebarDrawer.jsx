// SidebarDrawer.jsx -- the phone version of the sidebar: the same floating
// panel, slid in from the left over a dimmed backdrop. A modal while open:
// focus is trapped and restored afterwards, Escape and the backdrop close
// it, and the page underneath can't scroll. Shell closes it on navigation.
//
// Motion is the design system's drawer motion: 200ms on the ease-out curve,
// the same as ui/drawer.jsx, mirrored to slide from the left. With "reduce
// motion" on, main.jsx's MotionConfig drops the slide and keeps the fade.
import { m } from "framer-motion";
import { useEffect } from "react";
import { useModalA11y } from "../../lib/useModalA11y.js";

export default function SidebarDrawer({ label, onClose, children }) {
  const boxRef = useModalA11y(onClose);

  useEffect(() => {
    const root = document.documentElement;
    const prev = root.style.overflow;
    root.style.overflow = "hidden";
    return () => { root.style.overflow = prev; };
  }, []);

  return (
    <div className="fixed inset-0 z-[1100]">
      <m.div
        aria-hidden="true"
        onClick={onClose}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.15 }}
        className="absolute inset-0 bg-surface-overlay"
      />
      <m.div
        ref={boxRef}
        role="dialog"
        aria-modal="true"
        aria-label={label}
        initial={{ x: "-104%" }}
        animate={{ x: 0 }}
        exit={{ x: "-104%" }}
        transition={{ type: "tween", duration: 0.2, ease: [0.2, 0.8, 0.2, 1] }}
        className="absolute bottom-3 left-3 top-3 w-[min(320px,calc(100vw-24px))]"
      >
        {children}
      </m.div>
    </div>
  );
}
