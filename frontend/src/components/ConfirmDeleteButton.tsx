import { useState } from "react";

interface ConfirmDeleteButtonProps {
  onConfirm: () => void;
  label: string;
  confirmLabel: string;
  className?: string;
}

export function ConfirmDeleteButton({
  onConfirm,
  label,
  confirmLabel,
  className = "detail-panel__btn detail-panel__btn--danger",
}: ConfirmDeleteButtonProps) {
  const [confirming, setConfirming] = useState(false);

  return (
    <button
      type="button"
      className={className}
      onClick={() => (confirming ? onConfirm() : setConfirming(true))}
    >
      {confirming ? confirmLabel : label}
    </button>
  );
}
