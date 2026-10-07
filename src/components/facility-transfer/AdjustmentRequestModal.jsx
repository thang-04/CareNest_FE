import { useEffect, useState } from 'react';
import { AlertTriangle } from 'lucide-react';
import { Modal } from '@/components/ui/Modal';
import { Spinner } from '@/components/ui/States';

/** Handover person asks the VP to fix the document (before signing). */
export function AdjustmentRequestModal({ open, initialReason = '', onSubmit, onClose }) {
  const [reason, setReason] = useState(initialReason);
  const [touched, setTouched] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (open) {
      setReason(initialReason);
      setTouched(false);
    }
  }, [open, initialReason]);

  const error = !reason.trim() ? 'Vui lòng nhập lý do yêu cầu điều chỉnh' : reason.length > 500 ? 'Tối đa 500 ký tự' : '';

  const submit = async () => {
    setTouched(true);
    if (error) return;
    setBusy(true);
    try {
      await onSubmit(reason.trim());
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      open={open}
      title="Yêu cầu điều chỉnh phiếu"
      onClose={busy ? undefined : onClose}
      footer={
        <>
          <button className="btn" onClick={onClose} disabled={busy}>
            Quay lại
          </button>
          <button className="btn btn--warning" onClick={submit} disabled={busy}>
            {busy ? <Spinner small /> : <AlertTriangle size={16} />} Gửi yêu cầu điều chỉnh
          </button>
        </>
      }
    >
      <div className="alert alert--warning mb-16">
        <AlertTriangle size={18} />
        <div>
          Bạn <b>chưa ký bàn giao</b>. Phiếu sẽ chuyển sang trạng thái <b>Cần điều chỉnh</b> và Phó hiệu trưởng sẽ nhận được thông báo để
          sửa lại.
        </div>
      </div>
      <div className="field">
        <label className="field__label" htmlFor="adj-reason">
          Lý do yêu cầu điều chỉnh<span className="req">*</span>
        </label>
        <textarea
          id="adj-reason"
          className={`textarea ${touched && error ? 'textarea--error' : ''}`}
          rows={5}
          value={reason}
          maxLength={500}
          onChange={(e) => setReason(e.target.value)}
          onBlur={() => setTouched(true)}
          placeholder="Ví dụ: Thực tế chỉ có 8 ghế nhưng phiếu ghi 10. Đề nghị PHT điều chỉnh lại số lượng."
        />
        <div className="row row--between">
          <span className="field__error">{touched && error}</span>
          <span className="char-count">{reason.length}/500</span>
        </div>
      </div>
    </Modal>
  );
}
