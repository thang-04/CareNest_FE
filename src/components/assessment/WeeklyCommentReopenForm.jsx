import { useMemo, useState } from 'react';
import { Unlock } from '@/components/ui/icons';
import { Button } from '@/components/ui/Button';
import { ConfirmationModal } from '@/components/ui/ConfirmationModal';
import { SelectField, TextField } from '@/components/form/Field';
import { useToast } from '@/contexts/ToastContext';
import { useAsync } from '@/hooks/useAsync';
import { getWeeklyComments, reopenWeeklyComments } from '@/services/assessment/assessmentService';
import { WEEKLY_STATUS, weekOptionLabel } from '@/models/assessment/weeklyComments.mjs';

const REASON_MAX = 300;
const ALL = '';

/**
 * Mở lại nhận xét tuần đã gửi (BE OBS-29) trong cùng thẻ form một hàng với mở lại ngày đánh giá: lớp, tuần giáo án,
 * một trẻ hoặc mọi trẻ đã gửi, lý do. Bản về nháp để GV sửa, gửi lại; quyền và phạm vi do BE kiểm.
 */
export function WeeklyCommentReopenForm({ kindField, classes, classesLoading, classLabel, user, onReopened }) {
  const toast = useToast();
  const [classId, setClassId] = useState('');
  const [weekStart, setWeekStart] = useState('');
  const [childId, setChildId] = useState(ALL);
  const [reason, setReason] = useState('');
  const [errors, setErrors] = useState({});
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);

  const {
    data: board,
    loading,
    error,
    reload,
  } = useAsync(() => getWeeklyComments({ classId, weekStart }, user), [classId, weekStart, user?.id], { enabled: !!classId });
  const sent = useMemo(() => (board?.children || []).filter((r) => r.status === WEEKLY_STATUS.SENT), [board]);
  const week = weekStart || board?.weekStart || '';
  const count = childId === ALL ? sent.length : 1;

  const clear = (key) => setErrors((x) => ({ ...x, [key]: undefined, _form: undefined }));

  const ask = (e) => {
    e.preventDefault();
    if (busy) return;
    const errs = {};
    if (!classId) errs.classId = 'Chọn lớp.';
    else if (!week) errs.weekStart = 'Chọn tuần.';
    if (!reason.trim()) errs.reason = 'Nhập lý do mở lại.';
    else if (reason.trim().length > REASON_MAX) errs.reason = `Lý do tối đa ${REASON_MAX} ký tự.`;
    setErrors(errs);
    if (!Object.keys(errs).length) setConfirm(true);
  };

  const doReopen = async () => {
    setBusy(true);
    try {
      const done = await reopenWeeklyComments(
        { classId, weekStart: week, childIds: childId === ALL ? [] : [childId], reason: reason.trim() },
        user,
      );
      toast.success(`Đã mở lại ${done.length} nhận xét tuần. Giáo viên sửa rồi gửi lại cho phụ huynh.`);
      setConfirm(false);
      setChildId(ALL);
      setReason('');
      reload({ silent: true });
      onReopened?.();
    } catch (err) {
      setConfirm(false);
      setErrors(err.details || { _form: err.message });
      toast.error(err, 'Không mở lại được');
    } finally {
      setBusy(false);
    }
  };

  return (
    <form className="card form-inline" onSubmit={ask} noValidate aria-busy={busy}>
      {kindField}
      <SelectField
        label="Lớp cần mở lại"
        required
        error={errors.classId}
        fieldClassName="form-inline__class"
        value={classId}
        disabled={classesLoading || busy}
        placeholder={classesLoading ? 'Đang tải lớp...' : 'Chọn lớp'}
        onChange={(e) => {
          setClassId(e.target.value);
          setWeekStart('');
          setChildId(ALL);
          setErrors({});
        }}
        options={classes.map((c) => ({ value: c.id, label: classLabel(c) }))}
      />
      <SelectField
        label="Tuần"
        required
        error={errors.weekStart || (classId && error ? error.message : undefined)}
        fieldClassName="dg-unlock-week"
        value={week}
        disabled={!classId || loading || busy}
        placeholder={loading ? 'Đang tải tuần...' : 'Chọn tuần'}
        onChange={(e) => {
          setWeekStart(e.target.value);
          setChildId(ALL);
          clear('weekStart');
        }}
        options={(board?.weeks || []).map((w) => ({ value: w.weekStart, label: weekOptionLabel(w) }))}
      />
      <SelectField
        label="Trẻ"
        fieldClassName="dg-unlock-child"
        value={childId}
        disabled={!classId || loading || busy || !sent.length}
        onChange={(e) => setChildId(e.target.value)}
        options={
          sent.length
            ? [{ value: ALL, label: `Tất cả trẻ đã gửi (${sent.length})` }, ...sent.map((r) => ({ value: r.childId, label: r.fullName }))]
            : [{ value: ALL, label: 'Chưa có bản đã gửi' }]
        }
      />
      <TextField
        label="Lý do"
        required
        error={errors.reason}
        fieldClassName="form-inline__grow"
        value={reason}
        maxLength={REASON_MAX}
        disabled={busy}
        placeholder="Ví dụ: cô gửi nhầm nội dung"
        onChange={(e) => {
          setReason(e.target.value);
          clear('reason');
        }}
      />
      <Button variant="primary" type="submit" icon={Unlock} loading={busy} disabled={!!classId && (loading || !sent.length)}>
        Mở lại nhận xét
      </Button>
      {errors._form && (
        <div className="alert alert--danger form-inline__full" role="alert">
          {errors._form}
        </div>
      )}
      <ConfirmationModal
        open={confirm}
        title="Mở lại nhận xét tuần?"
        message={`Mở lại ${count} nhận xét đã gửi: phụ huynh tạm không thấy cho tới khi giáo viên sửa và gửi lại.`}
        confirmLabel="Mở lại"
        onConfirm={doReopen}
        onClose={() => setConfirm(false)}
      />
    </form>
  );
}
