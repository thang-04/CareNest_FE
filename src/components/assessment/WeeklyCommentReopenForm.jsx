import { useState } from 'react';
import { Unlock } from '@/components/ui/icons';
import { Button } from '@/components/ui/Button';
import { SelectField, TextField } from '@/components/form/Field';
import { FormField } from '@/components/form/FormField';
import { DateInput } from '@/components/form/DateInput';
import { useToast } from '@/contexts/ToastContext';
import { useAsync } from '@/hooks/useAsync';
import { getWeeklyComments, unlockWeeklyComments } from '@/services/assessment/assessmentService';
import { weekLocked, weekOptionLabel } from '@/models/assessment/weeklyComments.mjs';
import { defaultUnlockUntil, parseUnlockUntil } from '@/utils/assessment/unlockTime';
import { formatDate, formatDateTime, isIsoDate } from '@/utils/format';
import { todayIso } from '@/utils/assessment/assessmentPeriods';

const REASON_MAX = 300;

/**
 * Mở lại nhận xét tuần đã khóa (BE OBS-29) cùng bố cục form mở lại ngày đánh giá: lớp, tuần giáo án đã khóa, mở đến,
 * lý do. Trong thời gian mở GV sửa, gửi được cả lớp tuần đó; hết hạn tự khóa lại. Quyền và phạm vi do BE kiểm.
 */
export function WeeklyCommentReopenForm({ kindField, classes, classesLoading, classLabel, yearEnd, user, onReopened }) {
  const toast = useToast();
  const [form, setForm] = useState(() => ({ classId: '', weekStart: '', reason: '', ...defaultUnlockUntil(yearEnd) }));
  const [errors, setErrors] = useState({});
  const [busy, setBusy] = useState(false);
  const set = (patch) => {
    setForm((f) => ({ ...f, ...patch }));
    setErrors({});
  };

  const {
    data: board,
    loading,
    error,
    reload,
  } = useAsync(() => getWeeklyComments({ classId: form.classId }, user), [form.classId, user?.id], { enabled: !!form.classId });
  const locked = (board?.weeks || []).filter(weekLocked);

  const submit = async (e) => {
    e.preventDefault();
    if (busy) return;
    // Chỉ kiểm tra nhập đủ; tuần đã khóa, hạn hợp lệ do BE quyết định
    const errs = {};
    if (!form.classId) errs.classId = 'Chọn lớp.';
    else if (!form.weekStart) errs.weekStart = locked.length ? 'Chọn tuần.' : 'Lớp chưa có tuần nào đã khóa.';
    const until = parseUnlockUntil(form.untilDate, form.untilTime);
    if (!isIsoDate(form.untilDate) || !form.untilTime || Number.isNaN(until.getTime())) errs.validUntil = 'Chọn ngày giờ hết hạn.';
    if (!form.reason.trim()) errs.reason = 'Nhập lý do mở lại.';
    else if (form.reason.trim().length > REASON_MAX) errs.reason = `Lý do tối đa ${REASON_MAX} ký tự.`;
    setErrors(errs);
    if (Object.keys(errs).length) return;
    setBusy(true);
    try {
      const u = await unlockWeeklyComments(
        { classId: form.classId, weekStart: form.weekStart, reason: form.reason.trim(), validUntil: until.toISOString() },
        user,
      );
      toast.success(
        `Đã mở lại nhận xét tuần ${formatDate(u.weekFrom)} – ${formatDate(u.weekEnd)} cho ${u.className} đến ${formatDateTime(u.validUntil)}.`,
      );
      setForm((f) => ({ ...f, weekStart: '', reason: '', ...defaultUnlockUntil(yearEnd) }));
      reload({ silent: true });
      onReopened?.();
    } catch (err) {
      setErrors(err.details || { _form: err.message });
      toast.error(err, 'Không mở lại được');
    } finally {
      setBusy(false);
    }
  };

  return (
    <form className="card form-inline" onSubmit={submit} noValidate aria-busy={busy}>
      {kindField}
      <SelectField
        label="Lớp cần mở lại"
        required
        error={errors.classId}
        fieldClassName="form-inline__class"
        value={form.classId}
        disabled={classesLoading || busy}
        placeholder={classesLoading ? 'Đang tải lớp...' : 'Chọn lớp'}
        onChange={(e) => set({ classId: e.target.value, weekStart: '' })}
        options={classes.map((c) => ({ value: c.id, label: classLabel(c) }))}
      />
      <SelectField
        label="Tuần cần mở lại"
        required
        error={errors.weekStart || (form.classId && error ? error.message : undefined)}
        fieldClassName="dg-unlock-week"
        value={form.weekStart}
        disabled={!form.classId || loading || busy || !locked.length}
        placeholder={loading ? 'Đang tải tuần...' : form.classId && !locked.length ? 'Chưa có tuần đã khóa' : 'Chọn tuần'}
        onChange={(e) => set({ weekStart: e.target.value })}
        options={locked.map((w) => ({ value: w.weekStart, label: weekOptionLabel(w) }))}
      />
      <FormField label="Mở đến" required error={errors.validUntil}>
        <div className="form-inline__pair">
          <DateInput
            aria-label="Mở đến ngày"
            value={form.untilDate}
            min={todayIso()}
            max={yearEnd}
            disabled={busy}
            onChange={(untilDate) => set({ untilDate })}
          />
          <TextField
            type="time"
            aria-label="Mở đến giờ"
            value={form.untilTime}
            disabled={busy}
            onChange={(e) => set({ untilTime: e.target.value })}
          />
        </div>
      </FormField>
      <TextField
        label="Lý do"
        required
        error={errors.reason}
        fieldClassName="form-inline__grow"
        value={form.reason}
        maxLength={REASON_MAX}
        disabled={busy}
        placeholder="Ví dụ: cô gửi nhầm nội dung"
        onChange={(e) => set({ reason: e.target.value })}
      />
      <Button variant="primary" type="submit" icon={Unlock} loading={busy} disabled={!classes.length}>
        Mở lại tuần
      </Button>
      {errors._form && (
        <div className="alert alert--danger form-inline__full" role="alert">
          {errors._form}
        </div>
      )}
    </form>
  );
}
