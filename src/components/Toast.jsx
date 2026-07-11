// Toast.jsx -- renders AppContext's `toast` string, if any. Ported from
// ui_widgets.js's showToast(), which injected the same markup into a
// #toast-root div; here it's just driven by state instead of direct DOM writes.
import { useApp } from "../context/AppContext.jsx";

export default function Toast() {
  const { toast } = useApp();
  if (!toast) return <div id="toast-root" />;
  return (
    <div id="toast-root">
      <div className="toast" role="status" aria-live="polite">{toast}</div>
    </div>
  );
}
