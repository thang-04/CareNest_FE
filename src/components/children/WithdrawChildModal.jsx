import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/contexts/ToastContext';
import { ConfirmationModal } from '@/components/ui/ConfirmationModal';
import { ErrorState, LoadingState } from '@/components/ui/States';
import { FormField } from '@/components/form/FormField';
import { ChoiceGroup } from '@/components/children/ChoiceGroup';
import { useLeaveOptions } from '@/hooks/children/useChildRecords';
import { withdrawChild } from '@/services/children/childrenService';
import { formatDate, formatWeekdayDate } from '@/utils/format';

// "thứ Sáu 27/11" + năm ⇒ "thứ Sáu 27/11/2026" (dùng tên thứ có sẵn ở utils/format)
const weekdayLabel = (iso) => `${formatWeekdayDate(iso).replace(/ \d{2}\/\d{2}$/, '')} ${formatDate(iso)}`;

/**
 * "Cho nghỉ học" from the children list: dữ liệu không bị xóa, BE chuyển trạng thái Đã nghỉ.
 * G94-180/CHD-03: chỉ chọn hôm nay hoặc ngày học kế tiếp; hôm nay khóa khi BE báo trẻ có dữ liệu trong ngày.
 * Mount with key={child.id} so the form resets per child.
 */
export function WithdrawChildModal({ child, onClose, onDone }) {
  const { user } = useAuth();
  const toast = useToast();
  const { options, loading, error, reload } = useLeaveOptions(child?.id);
  const [choice, setChoice] = useState(null);
  const [reason, setReason] = useState('');
  const [errors, setErrors] = useState({});

  // Mặc định: hôm nay nếu BE cho, không thì ngày học kế tiếp
  useEffect(() => {
    if (options && choice === null) setChoice(options.todayAllowed ? options.today : options.nextSchoolDay);
  }, [options, choice]);

  const clearError = (key) =>
    setErrors((e) => {
      const next = { ...e };
      delete next[key];
      return next;
    });

  const leftAt = choice || '';
  const choices = options
    ? [
        {
          value: options.today,
          label: `Hôm nay (${formatDate(options.today)})`,
          disabled: !options.todayAllowed,
        },
        ...(options.nextSchoolDay
          ? [{ value: options.nextSchoolDay, label: `Ngày học kế tiếp – ${weekdayLabel(options.nextSchoolDay)}` }]
          : []),
      ]
    : [];

  const confirm = async () => {
    const errs = {};
    if (!leftAt) errs.leftAt = 'Chọn ngày nghỉ học';
    if (!reason.trim()) errs.reason = 'Nhập lý do cho trẻ nghỉ học';
    setErrors(errs);
    if (Object.keys(errs).length) return;
    try {
      await withdrawChild(child.id, { leftAt, reason: reason.trim() }, user);
      toast.success(`${child.fullName} nghỉ học từ ${formatDate(leftAt)}.`, 'Đã cho trẻ nghỉ học');
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
      confirmDisabled={loading || !!error || !options || !leftAt}
      onConfirm={confirm}
      onClose={onClose}
    >
      {loading && <LoadingState text="Đang tải ngày nghỉ học..." />}
      {!loading && error && <ErrorState error={error} onRetry={reload} />}
      {options && (
        <div className="stack gap-3 mt-12 tr-withdraw-form">
          <FormField label="Ngày nghỉ học" required error={errors.leftAt}>
            <ChoiceGroup
              name="withdraw-left-at"
              label="Ngày nghỉ học"
              options={choices}
              value={choice}
              onChange={(value) => {
                setChoice(value);
                clearError('leftAt');
              }}
            />
          </FormField>
          {!options.todayAllowed && options.todayBlockedReason && <p className="text-muted">{options.todayBlockedReason}</p>}
          {!options.todayAllowed && !options.nextSchoolDay && (
            <p className="text-muted">Không tìm thấy ngày học kế tiếp trong năm học. Liên hệ quản trị để kiểm tra lịch nghỉ.</p>
          )}
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
      )}
    </ConfirmationModal>
  );
}
