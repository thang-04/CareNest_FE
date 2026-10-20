import { useEffect, useMemo, useRef, useState } from 'react';
import { Info, Lock, RotateCcw, Unlock } from '@/components/ui/icons';
import { Breadcrumb } from '@/components/ui/Breadcrumb';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { ConfirmationModal } from '@/components/ui/ConfirmationModal';
import { EmptyState, ErrorState, LoadingState, SkeletonRows, Spinner } from '@/components/ui/States';
import { Pagination, paginate } from '@/components/ui/Pagination';
import { FilterMore } from '@/components/ui/FilterMore';
import { DateInput } from '@/components/form/DateInput';
import { FormField } from '@/components/form/FormField';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/contexts/ToastContext';
import { useAsync } from '@/hooks/useAsync';
import { useAttendanceClasses } from '@/hooks/attendance/useAttendance';
import { getCampuses } from '@/services/masterDataService';
import {
  getAttendanceDayUnlocks,
  getDayInfo,
  revokeAttendanceDayUnlock,
  unlockAttendanceDay,
} from '@/services/attendance/attendanceService';
import { RowActions } from '@/components/ui/RowActions';
import { canUnlockAttendanceDay } from '@/utils/attendance/attendancePermissions';
import { isAttendanceUnlockActive } from '@/utils/attendance/attendanceUnlock';
import { isValidTime, schoolToday } from '@/utils/attendance/attendanceTime';
import { attendanceCrumbs } from '@/utils/attendance/breadcrumbs';
import { formatDate, formatDateTime, isIsoDate } from '@/utils/format';
import '@/styles/modules/attendance.css';

export default function AttendanceDayUnlockPage() {
  const { user } = useAuth();
  const toast = useToast();
  const [now, setNow] = useState(() => new Date());
  const today = schoolToday();
  const classesQuery = useAttendanceClasses();
  const scoped = useMemo(() => classesQuery.classes.filter((cls) => canUnlockAttendanceDay(cls, user)), [classesQuery.classes, user]);
  const { data: campuses } = useAsync(() => getCampuses(), []);
  const history = useAsync(() => getAttendanceDayUnlocks(user), [user.id], { refreshOnDataChange: true });
  // Ngày cần mở lại: mặc định hôm nay, chọn được ngày khác từ đầu năm học (Cần chốt 21/10/2026)
  const [form, setForm] = useState({ classId: '', date: today, untilDate: today, untilTime: '23:59', reason: '' });
  const [errors, setErrors] = useState({});
  const [busy, setBusy] = useState(false);
  const [confirming, setConfirming] = useState(null);
  const [saveError, setSaveError] = useState(null);
  const submitting = useRef(false);
  const day = useAsync(
    async () => ({ ...(await getDayInfo(form.date, form.classId, user)), classId: form.classId }),
    [form.date, form.classId, user.id],
    { enabled: !!form.classId && isIsoDate(form.date) },
  );
  const reloadDay = day.reload;
  const [filters, setFilters] = useState({ classId: '', status: '', from: '', to: '' });
  const [page, setPage] = useState(1);
  const selected = scoped.find((cls) => cls.id === form.classId);
  const campusLabel = (id) => (campuses || []).find((campus) => campus.id === id)?.name || id;
  const multiCampus = new Set(scoped.map((cls) => cls.campusId)).size > 1;
  const classLabel = (cls) => `${cls.name}${multiCampus ? ` · ${campusLabel(cls.campusId)}` : ''}`;
  const active = (history.data || []).find(
    (item) => item.classId === form.classId && item.date === form.date && !item.revokedAt && isAttendanceUnlockActive(item, now),
  );
  const isToday = form.date === today;
  const ready = selected && day.data?.classId === form.classId && day.data?.date === form.date && !day.loading && !day.error;
  // BA: hôm nay chỉ mở lại trong thời hạn (phút sau giờ chốt) Hiệu trưởng cấu hình; ngày cũ không theo thời hạn này
  const canReopen = !!day.data?.schoolDay && !!day.data?.baseLocked && (!isToday || !!day.data?.reopenUntil) && !day.data?.reopenExpired;
  const filtered = Object.values(filters).some(Boolean);
  const invalidRange =
    (filters.from && !isIsoDate(filters.from)) ||
    (filters.to && !isIsoDate(filters.to)) ||
    (filters.from && filters.to && filters.from > filters.to);
  const shown = invalidRange
    ? []
    : (history.data || []).filter(
        (item) =>
          (!filters.classId || item.classId === filters.classId) &&
          (!filters.status || (filters.status === 'ACTIVE') === (!item.revokedAt && isAttendanceUnlockActive(item, now))) &&
          (!filters.from || item.date >= filters.from) &&
          (!filters.to || item.date <= filters.to),
      );
  const currentPage = Math.min(page, Math.max(1, Math.ceil(shown.length / 10)));
  const setFilter = (patch) => {
    setFilters((value) => ({ ...value, ...patch }));
    setPage(1);
  };
  const set = (patch) => {
    setForm((value) => ({ ...value, ...patch }));
    setErrors({});
    setSaveError(null);
  };

  useEffect(() => {
    const timer = setInterval(() => {
      setNow(new Date());
      reloadDay({ silent: true });
    }, 30000);
    return () => clearInterval(timer);
  }, [reloadDay]);

  const requestUnlock = (event) => {
    event.preventDefault();
    if (submitting.current) return;
    const next = {};
    if (!selected) next.classId = 'Chọn lớp trong phạm vi của bạn.';
    if (!isIsoDate(form.date) || form.date > today) next.date = 'Chọn ngày từ đầu năm học đến hôm nay.';
    if (!isIsoDate(form.untilDate) || !isValidTime(form.untilTime)) next.until = 'Nhập đủ ngày giờ hợp lệ.';
    const until = new Date(`${form.untilDate}T${form.untilTime}:00+07:00`);
    const yearEnd = day.data?.yearEnd;
    if (!next.until && (until <= new Date() || (yearEnd && form.untilDate > yearEnd)))
      next.until = `Hạn phải sau hiện tại${yearEnd ? `, không quá ngày kết thúc năm học ${formatDate(yearEnd)}` : ''}.`;
    if (!form.reason.trim() || form.reason.trim().length > 300) next.reason = 'Nhập lý do mở lại, tối đa 300 ký tự.';
    setErrors(next);
    if (Object.keys(next).length || !ready || !canReopen || active || history.error) return;
    setConfirming({
      classId: selected.id,
      className: classLabel(selected),
      date: form.date,
      validUntil: until.toISOString(),
      reason: form.reason.trim(),
    });
  };
  // Mở nhầm hoặc giáo viên đã xong: kết thúc sớm, vẫn giữ trong lịch sử
  const revoke = async (item) => {
    try {
      await revokeAttendanceDayUnlock(item.id, user);
      setNow(new Date());
      toast.success(`Đã kết thúc mở lại điểm danh ${item.className}. Giáo viên được thông báo.`);
      await Promise.all([history.reload({ silent: true }), day.reload({ silent: true })]);
    } catch (error) {
      toast.error(error, 'Không kết thúc được');
    }
  };
  const save = async () => {
    if (submitting.current || !confirming) return;
    submitting.current = true;
    setBusy(true);
    setSaveError(null);
    try {
      const saved = await unlockAttendanceDay(confirming, user);
      toast.success(`Đã mở lại ${saved.className}. Giáo viên được thông báo và có thể điểm danh trong hạn mở.`);
      setConfirming(null);
      setForm((value) => ({ ...value, reason: '' }));
      await Promise.all([history.reload({ silent: true }), day.reload({ silent: true })]);
    } catch (error) {
      setConfirming(null);
      setSaveError(error);
    } finally {
      submitting.current = false;
      setBusy(false);
    }
  };

  return (
    <div className="page">
      <Breadcrumb items={attendanceCrumbs('Mở lại điểm danh', { linkParent: false })} />
      <div className="page__head">
        <h1 className="page__title">Mở lại điểm danh</h1>
      </div>
      {classesQuery.error ? (
        <ErrorState error={classesQuery.error} onRetry={classesQuery.reload} />
      ) : classesQuery.loading ? (
        <LoadingState />
      ) : !scoped.length ? (
        <div className="card">
          <EmptyState title="Không có lớp để mở lại" description="Chỉ mở lớp của năm học đang hoạt động trong phạm vi được giao." />
        </div>
      ) : (
        <form className="card form-inline" onSubmit={requestUnlock} noValidate aria-busy={busy}>
          <FormField label="Lớp cần mở lại" required error={errors.classId} className="form-inline__class">
            <select className="select" value={form.classId} disabled={busy} onChange={(event) => set({ classId: event.target.value })}>
              <option value="">Chọn lớp</option>
              {scoped.map((cls) => (
                <option key={cls.id} value={cls.id}>
                  {classLabel(cls)}
                </option>
              ))}
            </select>
          </FormField>
          <FormField label="Ngày cần mở lại" required error={errors.date}>
            <DateInput
              aria-label="Ngày cần mở lại"
              value={form.date}
              min={day.data?.yearStart || undefined}
              max={today}
              disabled={busy}
              onChange={(value) => set({ date: value })}
            />
          </FormField>
          <FormField label="Mở đến" required error={errors.until}>
            <div className="form-inline__pair">
              <DateInput
                aria-label="Mở đến ngày"
                value={form.untilDate}
                min={today}
                max={day.data?.yearEnd || undefined}
                disabled={busy}
                onChange={(value) => set({ untilDate: value })}
              />
              <input
                type="time"
                className="input"
                aria-label="Mở đến giờ"
                value={form.untilTime}
                disabled={busy}
                onChange={(event) => set({ untilTime: event.target.value })}
              />
            </div>
          </FormField>
          <FormField label="Lý do" required className="form-inline__grow" error={errors.reason}>
            <input
              className="input"
              maxLength={300}
              value={form.reason}
              disabled={busy}
              placeholder="Ví dụ: Cô lớp Chồi 1 quên lưu điểm danh"
              onChange={(event) => set({ reason: event.target.value })}
            />
          </FormField>
          <button
            className="btn btn--primary"
            type="submit"
            disabled={busy || !ready || !canReopen || !!active || history.loading || !!history.error}
          >
            {busy ? <Spinner small /> : <Unlock size={16} />} Mở lại điểm danh
          </button>
          {form.classId && day.loading && (
            <div className="form-inline__full">
              <LoadingState text="Đang kiểm tra trạng thái lớp..." />
            </div>
          )}
          {day.error && (
            <div className="form-inline__full">
              <ErrorState error={day.error} onRetry={day.reload} />
            </div>
          )}
          {ready && (
            <div className="alert alert--info form-inline__full" role="status">
              <Info size={18} />
              <div>
                {!day.data.schoolDay
                  ? `${isToday ? 'Hôm nay' : `Ngày ${formatDate(form.date)}`} không phải ngày học, không thể mở lại điểm danh.`
                  : active
                    ? `Lớp đã mở lại ngày ${formatDate(form.date)} đến ${formatDateTime(active.validUntil)}.`
                    : !day.data.baseLocked
                      ? `Chưa đến giờ chốt ${day.data.cutoff}; giáo viên vẫn điểm danh bình thường.`
                      : !isToday
                        ? `Ngày ${formatDate(form.date)} đã khóa. Có thể mở lại riêng ${selected.name} để cô sửa điểm danh ngày này.`
                        : !day.data.reopenUntil
                          ? 'Hiệu trưởng chưa cấu hình thời hạn mở lại điểm danh, chưa mở lại được.'
                          : day.data.reopenExpired
                            ? `Quá hạn mở lại hôm nay: chỉ mở lại được đến ${day.data.reopenUntil} (giờ chốt ${day.data.cutoff}).`
                            : `Đã qua giờ chốt ${day.data.cutoff}. Có thể mở lại riêng ${selected.name} đến ${day.data.reopenUntil}.`}
              </div>
            </div>
          )}
          {saveError && (
            <div className="alert alert--danger form-inline__full" role="alert">
              {saveError.message}
            </div>
          )}
        </form>
      )}
      <div className="card mt-16">
        <div className="card__header">
          <h2 className="card__title">Các lần mở lại</h2>
        </div>
        <div className="filter-bar">
          <select
            className="select"
            aria-label="Lọc lớp"
            value={filters.classId}
            onChange={(event) => setFilter({ classId: event.target.value })}
          >
            <option value="">Tất cả lớp</option>
            {scoped.map((cls) => (
              <option key={cls.id} value={cls.id}>
                {classLabel(cls)}
              </option>
            ))}
          </select>
          <select
            className="select"
            aria-label="Lọc hiệu lực"
            value={filters.status}
            onChange={(event) => setFilter({ status: event.target.value })}
          >
            <option value="">Tất cả hiệu lực</option>
            <option value="ACTIVE">Còn hiệu lực</option>
            <option value="EXPIRED">Đã hết</option>
          </select>
          <FilterMore count={[filters.from, filters.to].filter(Boolean).length}>
            <div className="field">
              <span className="field__label">Ngày điểm danh từ</span>
              <DateInput
                aria-label="Ngày điểm danh từ"
                value={filters.from}
                max={filters.to || today}
                onChange={(from) => setFilter({ from })}
              />
            </div>
            <div className="field">
              <span className="field__label">Ngày điểm danh đến</span>
              <DateInput
                aria-label="Ngày điểm danh đến"
                value={filters.to}
                min={filters.from || undefined}
                max={today}
                onChange={(to) => setFilter({ to })}
              />
            </div>
          </FilterMore>
          <button
            className="btn"
            type="button"
            disabled={!filtered}
            onClick={() => setFilter({ classId: '', status: '', from: '', to: '' })}
          >
            <RotateCcw size={15} /> Đặt lại bộ lọc
          </button>
        </div>
        {invalidRange && (
          <p className="field__error" role="alert">
            Nhập khoảng ngày hợp lệ theo dd/mm/yyyy, ngày bắt đầu không sau ngày kết thúc.
          </p>
        )}
        {history.error ? (
          <ErrorState error={history.error} onRetry={history.reload} />
        ) : (
          <div className="table-wrap">
            <table className="table table--grid">
              <thead>
                <tr>
                  <th>Lớp</th>
                  <th>Ngày điểm danh</th>
                  <th>Người mở</th>
                  <th>Lúc mở</th>
                  <th>Lý do</th>
                  <th className="center">Hiệu lực</th>
                  <th className="cell--actions">Thao tác</th>
                </tr>
              </thead>
              <tbody>
                {history.loading ? (
                  <SkeletonRows rows={3} cols={7} />
                ) : !shown.length ? (
                  <tr>
                    <td colSpan={7}>
                      <EmptyState
                        title={filtered ? 'Không có lần mở lại phù hợp' : 'Chưa có lần mở lại'}
                        description="Lịch sử mở lại trong phạm vi của bạn hiển thị tại đây."
                      />
                    </td>
                  </tr>
                ) : (
                  paginate(shown, currentPage, 10).map((item) => {
                    // Đã kết thúc sớm thì hết hiệu lực ngay, không chờ đồng hồ trang cập nhật
                    const active = !item.revokedAt && isAttendanceUnlockActive(item, now);
                    return (
                      <tr key={item.id}>
                        <td className="fw-600">
                          {item.className}
                          {multiCampus && <div className="text-sm muted">{campusLabel(item.campusId)}</div>}
                        </td>
                        <td className="nowrap">{formatDate(item.date)}</td>
                        <td>{item.unlockedByName}</td>
                        <td>{formatDateTime(item.unlockedAt)}</td>
                        <td>{item.reason || '—'}</td>
                        <td className="center">
                          <StatusBadge
                            tone={active ? 'green' : item.revokedAt ? 'red' : 'gray'}
                            icon={active ? Unlock : Lock}
                            label={`${active ? 'Còn hiệu lực' : item.revokedAt ? 'Kết thúc sớm' : 'Đã hết'} · ${formatDateTime(item.validUntil)}`}
                          />
                          {item.revokedByName && <div className="text-xs muted">bởi {item.revokedByName}</div>}
                        </td>
                        <td className="cell--actions">
                          {active && (
                            <RowActions
                              name={item.className}
                              menu={[
                                {
                                  label: 'Kết thúc sớm',
                                  icon: Lock,
                                  danger: true,
                                  onClick: () => revoke(item),
                                  confirm: {
                                    title: 'Kết thúc mở lại điểm danh?',
                                    message: `${item.className}, ngày ${formatDate(item.date)}: giáo viên không sửa điểm danh được nữa. Lần mở lại vẫn lưu trong lịch sử.`,
                                    confirmLabel: 'Kết thúc sớm',
                                  },
                                },
                              ]}
                            />
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        )}
        {!history.error && shown.length > 10 && (
          <Pagination page={currentPage} total={shown.length} pageSize={10} onChange={setPage} unit="lần" />
        )}
      </div>
      <ConfirmationModal
        open={!!confirming}
        title="Mở lại điểm danh cho lớp?"
        message={
          confirming
            ? `${confirming.className}, ngày ${formatDate(confirming.date)}, mở đến ${formatDateTime(confirming.validUntil)}. Giáo viên lớp sẽ được thông báo; không tự thay số suất bếp đã nhận.`
            : ''
        }
        confirmLabel="Xác nhận mở lại"
        onConfirm={save}
        onClose={() => !busy && setConfirming(null)}
      />
    </div>
  );
}
