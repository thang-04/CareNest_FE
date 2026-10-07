import { useEffect, useId, useState } from 'react';
import { ConfirmationModal } from '@/components/ui/ConfirmationModal';

/**
 * Confirmation with a note field: required for reject / cancel (GBR-FAC-05, DESIGN 12.2), optional for approve / forward.
 * `onConfirm(text)` may be async; throw to keep the dialog open.
 */
export function DecisionModal({
  open,
  title,
  message,
  confirmLabel,
  danger = false,
  noteLabel,
  required = false,
  placeholder,
  onConfirm,
  onClose,
  children,
}) {
  const id = useId();
  const [text, setText] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    if (open) {
      setText('');
      setError('');
    }
  }, [open]);

  const confirm = async () => {
    if (required && !text.trim()) {
      setError(`Vui lòng nhập ${noteLabel.toLowerCase()}`);
      return;
    }
    try {
      await onConfirm(text.trim());
    } catch {
      // The page already showed the error toast; keep the dialog open so nothing typed is lost.
    }
  };

  return (
    <ConfirmationModal
      open={open}
      title={title}
      message={message}
      confirmLabel={confirmLabel}
      cancelLabel="Quay lại"
      danger={danger}
      onConfirm={confirm}
      onClose={onClose}
    >
      {children}
      <div className="field mt-12">
        <label className="field__label" htmlFor={id}>
          {noteLabel}
          {required && <span className="req">*</span>}
        </label>
        <textarea
          id={id}
          className={`textarea ${error ? 'textarea--error' : ''}`}
          rows={3}
          maxLength={500}
          placeholder={placeholder}
          value={text}
          aria-invalid={!!error || undefined}
          aria-describedby={error ? `${id}-error` : undefined}
          onChange={(e) => {
            setText(e.target.value);
            setError('');
          }}
        />
        {error && (
          <span className="field__error" id={`${id}-error`} role="alert">
            {error}
          </span>
        )}
      </div>
    </ConfirmationModal>
  );
}
