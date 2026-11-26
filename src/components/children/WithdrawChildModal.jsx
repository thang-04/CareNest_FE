import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/contexts/ToastContext';
import { ConfirmationModal } from '@/components/ui/ConfirmationModal';
import { ErrorState, LoadingState } from '@/components/ui/States';
import { DateInput } from '@/components/form/DateInput';
import { FormField } from '@/components/form/FormField';
import { useLeaveOptions } from '@/hooks/children/useChildRecords';
import { withdrawChild } from '@/services/children/childrenService';
import { defaultLeaveDate } from '@/utils/children/leaveDate';
import { addDays, formatDate, isIsoDate } from '@/utils/format';

/**
 * "Cho nghỉ học" from the children list: dữ liệu không bị xóa. BE (GET leave-options) trả khoảng ngày chọn được.
 * G94-180/CHD-03: chọn ngày bất kỳ từ minDate tới maxDate (hết năm học); hôm nay thì nghỉ ngay, ngày sau thì đặt lịch nghỉ
 * (trẻ vẫn học tới hết ngày đó). Hôm nay khóa khi BE báo trẻ có dữ liệu trong ngày (todayAllowed=false, minDate = ngày mai).
 * Mount with key={child.id} so the form resets per child.
 */
export function WithdrawChildModal({ child, onClose, onDone }) {
  const { user } = useAuth();
  const toast = useToast();
  const { options, loading, error, reload } = useLeaveOptions(child?.id);
  const [picked, setPicked] = useState(null);
  const [reason, setReason] = useState('');
  const [errors, setErrors] = useState({});

  const clearError = (key) =>
    setErrors((e) => {
      const next = { ...e };
      delete next[key];
      return next;
    });

  const leftAt = picked ?? defaultLeaveDate(options);
  const noDays = !!options && options.minDate > options.maxDate;
  const validDate =
    !!options &&
    !noDays &&
    isIsoDate(leftAt) &&
    leftAt >= options.minDate &&
    leftAt <= options.maxDate &&
    (options.todayAllowed || leftAt > options.today);
  // Ngày gõ đủ nhưng ngoài khoảng chọn được: báo ngay, cùng câu BE
  let dateError = '';
  if (options && !noDays && isIsoDate(leftAt) && !validDate) {
    if (leftAt < options.today) dateError = 'Ngày nghỉ học không được trước hôm nay';
    else if (leftAt > options.maxDate) dateError = `Ngày nghỉ học phải trong năm học (tới ${formatDate(options.maxDate)})`;
    else dateError = options.todayBlockedReason || 'Chọn ngày nghỉ học trong khoảng cho phép';
  }
  const scheduled = !!options && validDate && leftAt > options.today;

  const confirm = async () => {
    const errs = {};
    if (!validDate) errs.leftAt = 'Chọn ngày nghỉ học trong khoảng cho phép';
    if (!reason.trim()) errs.reason = 'Nhập lý do cho trẻ nghỉ học';
    setErrors(errs);
    if (Object.keys(errs).length) return;
    try {
      await withdrawChild(child.id, { leftAt, reason: reason.trim() }, user);
      toast.success(
        scheduled
          ? `${child.fullName} học tới hết ${formatDate(addDays(leftAt, -1))}, nghỉ học từ ${formatDate(leftAt)}.`
          : `${child.fullName} nghỉ học từ ${formatDate(leftAt)}.`,
        scheduled ? 'Đã hẹn ngày nghỉ học' : 'Đã cho trẻ nghỉ học',
      );
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
      confirmDisabled={loading || !!error || !options || !validDate}
      onConfirm={confirm}
      onClose={onClose}
    >
      {loading && <LoadingState text="Đang tải ngày nghỉ học..." />}
      {!loading && error && <ErrorState error={error} onRetry={reload} />}
      {options && (
        <div className="stack gap-3 mt-12 tr-withdraw-form">
          <FormField
            label="Ngày nghỉ học"
            required
            error={errors.leftAt || dateError || undefined}
            hint={
              noDays
                ? 'Không còn ngày nào chọn được trong năm học này'
                : `Chọn từ ${formatDate(options.minDate)} tới ${formatDate(options.maxDate)} (hết năm học)`
            }
          >
            <DateInput
              value={leftAt}
              min={options.minDate}
              max={options.maxDate}
              onChange={(value) => {
                setPicked(value);
                clearError('leftAt');
              }}
            />
          </FormField>
          {!options.todayAllowed && options.todayBlockedReason && <p className="text-muted">{options.todayBlockedReason}</p>}
          {scheduled && (
            <p className="text-muted">
              {`Trẻ vẫn học tới hết ngày ${formatDate(addDays(leftAt, -1))}, hệ thống tự chuyển sang Đã nghỉ học từ ngày đã chọn.`}
            </p>
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
