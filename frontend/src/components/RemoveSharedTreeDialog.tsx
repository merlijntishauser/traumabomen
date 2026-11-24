import { useEffect, useId, useRef } from "react";
import { createPortal } from "react-dom";
import { RemoveSharedTreeConfirm } from "./RemoveSharedTreeConfirm";

interface Props {
  ownerLabel: string;
  busy: boolean;
  error: string | null;
  onConfirm: () => void;
  onCancel: () => void;
}

/** The remove confirmation as a modal, for the read-only workspace toolbar. */
export function RemoveSharedTreeDialog({ ownerLabel, busy, error, onConfirm, onCancel }: Props) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const titleId = useId();

  useEffect(() => {
    const dialog = dialogRef.current;
    if (dialog && !dialog.open) dialog.showModal();
  }, []);

  return createPortal(
    <dialog
      ref={dialogRef}
      className="remove-shared-dialog"
      aria-labelledby={titleId}
      onCancel={(e) => {
        e.preventDefault();
        if (!busy) onCancel();
      }}
    >
      <div className="remove-shared-dialog__card">
        <RemoveSharedTreeConfirm
          titleId={titleId}
          ownerLabel={ownerLabel}
          busy={busy}
          error={error}
          onConfirm={onConfirm}
          onCancel={onCancel}
        />
      </div>
    </dialog>,
    document.body,
  );
}
