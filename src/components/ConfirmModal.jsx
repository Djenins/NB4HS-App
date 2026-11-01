// ConfirmModal.jsx -- the app-wide confirm dialog behind requestConfirm(),
// replacing window.confirm(). Renders nothing when confirmState is null;
// otherwise the shared ConfirmDialog, with the caller's message as the body.
import { useApp, useT } from "../context/AppContext.jsx";
import { ConfirmDialog } from "./ui/confirm-dialog.jsx";

export default function ConfirmModal() {
  const { confirmState, resolveConfirm } = useApp();
  const t = useT();
  const opts = confirmState?.opts || {};

  return (
    <ConfirmDialog
      open={!!confirmState}
      onClose={() => resolveConfirm(false)}
      onConfirm={() => resolveConfirm(true)}
      title={t("confirmTitle")}
      confirmLabel={opts.confirmLabel || t("confirmLabel")}
      cancelLabel={t("cancelLabel")}
      closeLabel={t("closeLabel")}
      danger={!!opts.danger}
    >
      {confirmState ? <p className="m-0 text-body text-card-foreground">{confirmState.message}</p> : null}
    </ConfirmDialog>
  );
}
