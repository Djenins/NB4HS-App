// confirm-dialog.jsx -- "are you sure?" before a destructive or
// irreversible action. The confirm button names the action ("Delete
// visit"), never just "OK"; `danger` paints it red. While `loading` the
// confirm button spins and can't be pressed twice.
import { Button } from "./button.jsx";
import { Dialog } from "./dialog.jsx";

export function ConfirmDialog({ open, onClose, onConfirm, title, description, confirmLabel, cancelLabel, closeLabel, danger, loading, children }) {
  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={title}
      description={description}
      size="sm"
      closeLabel={closeLabel}
      footer={
        <>
          {/* Focus starts on Cancel for a destructive action, so a stray
              Enter can't delete anything. */}
          <Button variant="secondary" onClick={onClose} disabled={loading} data-autofocus={danger ? true : undefined}>{cancelLabel}</Button>
          <Button variant={danger ? "danger" : "primary"} onClick={onConfirm} loading={loading} data-autofocus={danger ? undefined : true}>{confirmLabel}</Button>
        </>
      }
    >
      {children}
    </Dialog>
  );
}
