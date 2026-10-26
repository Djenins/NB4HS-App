// ConfirmModal.jsx -- in-app confirm dialog, replacing window.confirm() /
// the original's showConfirmModal(). Renders nothing when confirmState is
// null; when a component calls requestConfirm(), this shows up rendered
// inside #root's tree (React re-renders handle it -- no need for the
// original's "append straight to document.body so a render() doesn't wipe
// it out" trick, since React doesn't blow away the whole tree on updates).
import { useApp, useT } from "../context/AppContext.jsx";
import { useModalA11y } from "../lib/useModalA11y.js";

export default function ConfirmModal() {
  const { confirmState, resolveConfirm } = useApp();
  const t = useT();
  const boxRef = useModalA11y(() => resolveConfirm(false), !!confirmState);

  if (!confirmState) return null;
  const { message, opts } = confirmState;

  return (
    <div
      className="modal-overlay"
      onClick={(e) => { if (e.target === e.currentTarget) resolveConfirm(false); }}
    >
      <div ref={boxRef} className="modal-box" role="alertdialog" aria-modal="true" aria-labelledby="confirm-modal-text">
        <p id="confirm-modal-text">{message}</p>
        <div className="pill-row" style={{ justifyContent: "flex-end", marginBottom: 0 }}>
          <button type="button" className="btn-secondary" onClick={() => resolveConfirm(false)}>
            {t("cancelLabel")}
          </button>
          <button
            type="button"
            data-autofocus
            className={opts.danger ? "btn-accent" : "btn-primary"}
            onClick={() => resolveConfirm(true)}
          >
            {opts.confirmLabel || t("confirmLabel")}
          </button>
        </div>
      </div>
    </div>
  );
}
