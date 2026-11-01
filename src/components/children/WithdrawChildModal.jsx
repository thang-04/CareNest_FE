import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/contexts/ToastContext';
import { ConfirmationModal } from '@/components/ui/ConfirmationModal';
import { FormField } from '@/components/form/FormField';
import { Info } from '@/components/ui/icons';
import { withdrawChild } from '@/services/children/childrenService';
import { todayInput } from '@/utils/format';

/**
 * "Cho nghỉ học" from the children list: dữ liệu không bị xóa, BE chuyển trạng thái Đã nghỉ.
 * Mount with key={child.id} so the form resets per child.
 */
export function WithdrawChildModal({ child, onClose, onDone }) {
  const { user } = useAuth();
  const toast = useToast();
  const [leftAt, setLeftAt] = useState(todayInput());
  const [reason, setReason] = useState('');
  const [errors, setErrors] = useState({});

  const clearError = (key) =>
    setErrors((e) => {
      const next = { ...e };
      delete next[key];
      return next;
    });

  const confirm = async () => {
    const errs = {};
    if (!leftAt) errs.leftAt = 'Chọn ngày nghỉ học';
    if (!reason.trim()) errs.reason = 'Nhập lý do cho trẻ nghỉ học';
    setErrors(errs);
    if (Object.keys(errs).length) return;
    try {
      await withdrawChild(child.id, { leftAt, reason: reason.trim() }, user);
      toast.success(`${child.fullName} đã chuyển sang trạng thái Đã nghỉ.`, 'Đã cho trẻ nghỉ học');
      onDone?.();
      onClose();
    } catch (err) {
      if (err.details) setErrors(err.details);
      toast.error(err, 'Không cho nghỉ học được');
    }
  };

  return (
    <ConfirmationModal
      open={!!child}
      danger
      title={`Cho ${child?.fullName || 'trẻ'} nghỉ học?`}
      message="Trẻ không còn trong sĩ số lớp, điểm danh và suất ăn từ ngày nghỉ. Hồ sơ, sổ sức khỏe và lịch sử vẫn được giữ."
      confirmLabel="Cho nghỉ học"
      onConfirm={confirm}
      onClose={onClose}
    >
      <div className="stack gap-3 mt-12 tr-withdraw-form">
        {child?.openFollowUpId && (
          <div className="alert alert--warning">
            <Info size={18} />
            <div>
              Trẻ đang có phiếu theo dõi sức khỏe. Khi cho nghỉ học, phiếu tự đóng với lý do “Trẻ nghỉ học: &lt;lý do bạn nhập&gt;”.
            </div>
          </div>
        )}
        <FormField label="Ngày nghỉ học" required error={errors.leftAt}>
          <input
            type="date"
            className="input"
            value={leftAt}
            max={todayInput()}
            onChange={(e) => {
              setLeftAt(e.target.value);
              clearError('leftAt');
            }}
          />
        </FormField>
        <FormField label="Lý do" required error={errors.reason}>
          <textarea
            className="textarea"
            rows={3}
            maxLength={300}
            placeholder="Ví dụ: Gia đình chuyển nơi ở"
            value={reason}
            onChange={(e) => {
              setReason(e.target.value);
              clearError('reason');
            }}
          />
        </FormField>
      </div>
    </ConfirmationModal>
  );
}
