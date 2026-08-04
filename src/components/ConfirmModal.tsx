import React, { useEffect } from 'react';
import { createPortal } from 'react-dom';

export type ConfirmModalConfig = {
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  isDangerous?: boolean;
  onConfirm: () => void;
  onCancel?: () => void;
};

type Props = {
  config: ConfirmModalConfig | null;
  onClose: () => void;
};

export default function ConfirmModal({ config, onClose }: Props) {
  useEffect(() => {
    if (!config) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [config, onClose]);

  if (!config) return null;

  const handleConfirm = () => {
    config.onConfirm();
    onClose();
  };

  const handleCancel = () => {
    config.onCancel?.();
    onClose();
  };

  return createPortal(
    <div className="confirm-modal-backdrop" onClick={handleCancel}>
      <div className="confirm-modal" role="alertdialog" aria-modal="true" aria-labelledby="confirm-title" aria-describedby="confirm-desc" onClick={e => e.stopPropagation()}>
        <div className="confirm-modal__icon">
          {config.isDangerous
            ? <i className="fas fa-triangle-exclamation" style={{ color: 'var(--error)' }}></i>
            : <i className="fas fa-circle-question" style={{ color: 'var(--accent)' }}></i>
          }
        </div>
        <h3 id="confirm-title" className="confirm-modal__title">{config.title}</h3>
        <p id="confirm-desc" className="confirm-modal__message">{config.message}</p>
        <div className="confirm-modal__actions">
          <button type="button" className="btn btn-ghost" onClick={handleCancel}>
            {config.cancelLabel || 'Cancel'}
          </button>
          <button
            type="button"
            className={config.isDangerous ? 'btn btn-danger' : 'btn btn-primary'}
            onClick={handleConfirm}
            autoFocus
          >
            {config.confirmLabel || 'Confirm'}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
