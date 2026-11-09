import { useState } from 'react';
import { Modal } from '@/components/ui/Modal';
import { FormField } from '@/components/form/FormField';
import { REASON_MAX_LENGTH } from '@/models/account/permissionConstants';
import { validatePermissionChange } from '@/utils/account/permissionValidation';

/**
 * Hộp nhập lý do trước khi lưu quyền; `children` thay danh sách `changes` khi cần bản xem trước chi tiết hơn.
 * `canSubmit = false` khóa nút lưu (vd. đã hoàn tác hết thay đổi ngay trong bản xem trước).
 */
export function ReasonModal({
  title = 'Vì sao thay đổi?',
  changes = [],
  children,
  size,
  confirmLabel = 'Lưu thay đổi',
  canSubmit = true,
  saving,
  onClose,
  onSubmit,
}) {
  const [reason, setReason] = useState('');
  const [error, setError] = useState();
  const submit = () => {
    if (saving || !canSubmit) return;
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
          <button className="btn btn--primary" disabled={saving || !canSubmit} onClick={submit}>
            {saving ? 'Đang lưu…' : confirmLabel}
          </button>
        </>
      }
    >
      {!children && <p className="text-sm text-2">Lý do được lưu vào lịch sử thay đổi quyền.</p>}
      {children || (
        <ul className="permission-reason-list">
          {changes.map((change, index) => (
            <li key={index}>{change}</li>
          ))}
        </ul>
      )}
      {/* Bản xem trước chi tiết: lý do tách thành khối riêng dưới danh sách, gợi ý ngay dưới ô */}
      <div className={children ? 'reason-modal__reason' : undefined}>
        <FormField
          label={children ? 'Lý do thay đổi' : 'Lý do'}
          required
          error={error}
          hint={children ? `Lưu vào lịch sử thay đổi quyền · ${reason.length}/${REASON_MAX_LENGTH} ký tự` : undefined}
        >
          <textarea
            className="textarea"
            rows={3}
            value={reason}
            maxLength={REASON_MAX_LENGTH}
            disabled={saving || !canSubmit}
            placeholder={children ? 'Vì sao thay đổi việc giao?' : undefined}
            onChange={(e) => setReason(e.target.value)}
          />
        </FormField>
      </div>
    </Modal>
  );
}
