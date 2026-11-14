import { useState } from 'react';
import { Unlock } from '@/components/ui/icons';
import { Button } from '@/components/ui/Button';
import { SelectField, TextField } from '@/components/form/Field';
import { FormField } from '@/components/form/FormField';
import { DateInput } from '@/components/form/DateInput';
import { useToast } from '@/contexts/ToastContext';
import { useAsync } from '@/hooks/useAsync';
import { getEvaluationPeriods, unlockEvaluation } from '@/services/assessment/assessmentService';
import { lockedPeriods, reopenFormErrors } from '@/models/assessment/evaluationLocks.mjs';
import { defaultUnlockUntil, parseUnlockUntil } from '@/utils/assessment/unlockTime';
import { formatDate, formatDateTime, isIsoDate } from '@/utils/format';
import { todayIso } from '@/utils/assessment/assessmentPeriods';

const REASON_MAX = 300;

/**
 * Mở lại đánh giá cuối chủ đề / học kỳ / cuối năm đã khóa của một lớp – kỳ (BE OBS-30), cùng bố cục form mở lại ngày:
 * lớp, kỳ đã khóa, mở đến, lý do. Quyền, phạm vi, kỳ hợp lệ do BE kiểm.
 */
export function EvaluationReopenForm({ kind, kindField, classes, classesLoading, classLabel, user, onReopened }) {
  const toast = useToast();
  const [form, setForm] = useState(() => ({ classId: '', periodKey: '', reason: '', ...defaultUnlockUntil() }));
  const [errors, setErrors] = useState({});
  const [busy, setBusy] = useState(false);
  const set = (patch) => {
    setForm((f) => ({ ...f, ...patch }));
    setErrors({});
  };

  const {
    data: periods,
    loading,
    error,
    reload,
  } = useAsync(() => getEvaluationPeriods({ classId: form.classId }, user), [form.classId, user?.id], { enabled: !!form.classId });
  const locked = lockedPeriods(periods || [], kind);
  const periodKey = locked.some((p) => p.periodKey === form.periodKey) ? form.periodKey : '';

  const submit = async (e) => {
    e.preventDefault();
    if (busy) return;
    const until = parseUnlockUntil(form.untilDate, form.untilTime);
    const errs = reopenFormErrors(
      {
        classId: form.classId,
        periodKey,
        validUntilOk: isIsoDate(form.untilDate) && !!form.untilTime && !Number.isNaN(until.getTime()),
        reason: form.reason,
      },
      { hasLocked: locked.length > 0, reasonMax: REASON_MAX },
    );
    setErrors(errs);
    if (Object.keys(errs).length) return;
    setBusy(true);
    try {
      const u = await unlockEvaluation(
        { kind, classId: form.classId, periodKey, reason: form.reason.trim(), validUntil: until.toISOString() },
        user,
      );
      toast.success(`Đã mở lại ${u.periodLabel || 'đánh giá'} cho ${u.className} đến ${formatDateTime(u.validUntil)}.`);
      setForm((f) => ({ ...f, periodKey: '', reason: '', ...defaultUnlockUntil() }));
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
        onChange={(e) => set({ classId: e.target.value, periodKey: '' })}
        options={classes.map((c) => ({ value: c.id, label: classLabel(c) }))}
      />
      <SelectField
        label="Kỳ cần mở lại"
        required
        error={errors.periodKey || (form.classId && error ? error.message : undefined)}
        fieldClassName="dg-unlock-week"
        value={periodKey}
        disabled={!form.classId || loading || busy || !locked.length}
        placeholder={loading ? 'Đang tải kỳ...' : form.classId && !locked.length ? 'Chưa có kỳ đã khóa' : 'Chọn kỳ'}
        onChange={(e) => set({ periodKey: e.target.value })}
        options={locked.map((p) => ({ value: p.periodKey, label: `${p.label} · khóa từ ${formatDate(p.deadline)}` }))}
      />
      <FormField label="Mở đến" required error={errors.validUntil}>
        <div className="form-inline__pair">
          <DateInput
            aria-label="Mở đến ngày"
            value={form.untilDate}
            min={todayIso()}
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
        placeholder="Ví dụ: cô nghỉ ốm, chưa kịp xác nhận"
        onChange={(e) => set({ reason: e.target.value })}
      />
      <Button variant="primary" type="submit" icon={Unlock} loading={busy} disabled={!classes.length}>
        Mở lại kỳ
      </Button>
      {errors._form && (
        <div className="alert alert--danger form-inline__full" role="alert">
          {errors._form}
        </div>
      )}
    </form>
  );
}
