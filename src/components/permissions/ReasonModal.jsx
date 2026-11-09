import { useState } from 'react';
import { Modal } from '@/components/ui/Modal';
import { FormField } from '@/components/form/FormField';
import { REASON_MAX_LENGTH } from '@/models/account/permissionConstants';
import { validatePermissionChange } from '@/utils/account/permissionValidation';

/** Hộp nhập lý do trước khi lưu quyền; `children` thay danh sách `changes` khi cần bản xem trước chi tiết hơn. */
export function ReasonModal({
  title = 'Vì sao thay đổi?',
  changes = [],
  children,
  size,
  confirmLabel = 'Lưu thay đổi',
  saving,
  onClose,
  onSubmit,
}) {
  const [reason, setReason] = useState('');
  const [error, setError] = useState();
  const submit = () => {
    if (saving) return;
    const message = validatePermissionChange({ reason }).reason;
    setError(message);
    if (!message) onSubmit(reason.trim());
  };
  return (
    <Modal
      open
      title={title}
      size={size}
      onClose={saving ? undefined : onClose}
      footer={
        <>
          <button className="btn" disabled={saving} onClick={onClose}>
            Quay lại
          </button>
          <button className="btn btn--primary" disabled={saving} onClick={submit}>
            {saving ? 'Đang lưu…' : confirmLabel}
          </button>
        </>
      }
    >
      <p className="text-sm text-2">Lý do được lưu vào lịch sử thay đổi quyền.</p>
      {children || (
        <ul className="permission-reason-list">
          {changes.map((change, index) => (
            <li key={index}>{change}</li>
          ))}
        </ul>
      )}
      <FormField label="Lý do" required error={error}>
        <textarea
          className="textarea"
          rows={3}
          value={reason}
          maxLength={REASON_MAX_LENGTH}
          disabled={saving}
          onChange={(e) => setReason(e.target.value)}
        />
      </FormField>
    </Modal>
  );
}
