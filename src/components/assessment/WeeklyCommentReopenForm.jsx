import { useMemo, useState } from 'react';
import { Unlock } from '@/components/ui/icons';
import { Button } from '@/components/ui/Button';
import { ConfirmationModal } from '@/components/ui/ConfirmationModal';
import { DataTable } from '@/components/ui/DataTable';
import { SelectField, TextField } from '@/components/form/Field';
import { useToast } from '@/contexts/ToastContext';
import { useAsync } from '@/hooks/useAsync';
import { getWeeklyComments, reopenWeeklyComments } from '@/services/assessment/assessmentService';
import { WEEKLY_STATUS, weekOptionLabel } from '@/models/assessment/weeklyComments.mjs';
import { formatDateTime } from '@/utils/format';

const REASON_MAX = 300;

/**
 * Mở lại nhận xét tuần đã gửi (BE OBS-29): chọn lớp, tuần giáo án, một / nhiều / mọi trẻ đã gửi, nhập lý do.
 * Bản về nháp để GV sửa, gửi lại; quyền và phạm vi do BE kiểm.
 */
export function WeeklyCommentReopenForm({ classes, classLabel, user, onReopened }) {
  const toast = useToast();
  const [classId, setClassId] = useState('');
  const [weekStart, setWeekStart] = useState('');
  const [picked, setPicked] = useState([]);
  const [reason, setReason] = useState('');
  const [errors, setErrors] = useState({});
  const [confirm, setConfirm] = useState(false);

  const {
    data: board,
    loading,
    error,
    reload,
  } = useAsync(() => getWeeklyComments({ classId, weekStart }, user), [classId, weekStart, user?.id], { enabled: !!classId });
  const sent = useMemo(() => (board?.children || []).filter((r) => r.status === WEEKLY_STATUS.SENT), [board]);
  const all = picked.length === 0;
  const count = all ? sent.length : picked.length;

  const toggle = (childId) => setPicked((p) => (p.includes(childId) ? p.filter((id) => id !== childId) : [...p, childId]));

  const ask = (e) => {
    e.preventDefault();
    const errs = {};
    if (!classId) errs.classId = 'Chọn lớp.';
    if (classId && !sent.length) errs.children = 'Tuần này chưa có nhận xét nào đã gửi phụ huynh.';
    if (!reason.trim()) errs.reason = 'Nhập lý do mở lại.';
    else if (reason.trim().length > REASON_MAX) errs.reason = `Lý do tối đa ${REASON_MAX} ký tự.`;
    setErrors(errs);
    if (!Object.keys(errs).length) setConfirm(true);
  };

  const doReopen = async () => {
    try {
      const done = await reopenWeeklyComments({ classId, weekStart: board.weekStart, childIds: picked, reason: reason.trim() }, user);
      toast.success(`Đã mở lại ${done.length} nhận xét tuần. Giáo viên sửa rồi gửi lại cho phụ huynh.`);
      setConfirm(false);
      setPicked([]);
      setReason('');
      reload({ silent: true });
      onReopened?.();
    } catch (err) {
      setConfirm(false);
      if (err.details) setErrors(err.details);
      toast.error(err, 'Không mở lại được');
    }
  };

  const columns = [
    { key: 'fullName', header: 'Trẻ', className: 'fw-600' },
    { key: 'sentByName', header: 'Người gửi' },
    { key: 'sentAt', header: 'Lúc gửi', render: (r) => formatDateTime(r.sentAt) },
    {
      key: 'pick',
      header: 'Chọn',
      className: 'cell--actions',
      render: (r) => (
        <Button
          size="sm"
          variant={picked.includes(r.childId) ? 'primary' : undefined}
          aria-pressed={picked.includes(r.childId)}
          onClick={() => toggle(r.childId)}
        >
          {picked.includes(r.childId) ? 'Đã chọn' : 'Chọn'}
        </Button>
      ),
    },
  ];

  return (
    <form className="stack" onSubmit={ask} noValidate>
      <div className="form-inline">
        <SelectField
          label="Lớp"
          required
          error={errors.classId}
          fieldClassName="form-inline__class"
          value={classId}
          placeholder="Chọn lớp"
          onChange={(e) => {
            setClassId(e.target.value);
            setWeekStart('');
            setPicked([]);
            setErrors({});
          }}
          options={classes.map((c) => ({ value: c.id, label: classLabel(c) }))}
        />
        {board?.weeks?.length > 0 && (
          <SelectField
            label="Tuần"
            value={board.weekStart}
            onChange={(e) => {
              setWeekStart(e.target.value);
              setPicked([]);
            }}
            options={board.weeks.map((w) => ({ value: w.weekStart, label: weekOptionLabel(w) }))}
          />
        )}
        <TextField
          label="Lý do"
          required
          error={errors.reason}
          fieldClassName="form-inline__grow"
          value={reason}
          maxLength={REASON_MAX}
          onChange={(e) => {
            setReason(e.target.value);
            setErrors((x) => ({ ...x, reason: undefined }));
          }}
        />
        <Button variant="primary" type="submit" icon={Unlock} disabled={!classId || loading}>
          {all ? 'Mở lại tất cả' : `Mở lại ${picked.length} trẻ`}
        </Button>
      </div>
      {errors.children && (
        <p className="field__error" role="alert">
          {errors.children}
        </p>
      )}
      {classId && (
        <DataTable
          columns={columns}
          rows={sent}
          rowKey="childId"
          loading={loading}
          error={error}
          onRetry={reload}
          empty={{ icon: Unlock, title: 'Tuần này chưa có nhận xét nào đã gửi' }}
        />
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
