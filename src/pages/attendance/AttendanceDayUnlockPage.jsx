import { useEffect, useMemo, useRef, useState } from 'react';
import { Info, Unlock } from '@/components/ui/icons';
import { Breadcrumb } from '@/components/ui/Breadcrumb';
import { ConfirmationModal } from '@/components/ui/ConfirmationModal';
import { EmptyState, ErrorState, LoadingState, SkeletonRows, Spinner } from '@/components/ui/States';
import { Pagination, paginate } from '@/components/ui/Pagination';
import { SearchSubmit } from '@/components/ui/SearchSubmit';
import { DateInput } from '@/components/form/DateInput';
import { FormField } from '@/components/form/FormField';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/contexts/ToastContext';
import { useAsync } from '@/hooks/useAsync';
import { useAttendanceClasses } from '@/hooks/attendance/useAttendance';
import { getCampuses } from '@/services/masterDataService';
import { getAttendanceDayUnlocks, getDayInfo, unlockAttendanceDay } from '@/services/attendance/attendanceService';
import { canUnlockAttendanceDay } from '@/utils/attendance/attendancePermissions';
import { ATTENDANCE_UNLOCK_MAX_DAYS, isAttendanceUnlockActive } from '@/utils/attendance/attendanceUnlock';
import { addDays, isValidTime, schoolToday } from '@/utils/attendance/attendanceTime';
import { attendanceCrumbs } from '@/utils/attendance/breadcrumbs';
import { formatDate, formatDateTime, isIsoDate, normalizeText } from '@/utils/format';
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
  const [form, setForm] = useState({ classId: '', untilDate: today, untilTime: '23:59', reason: '' });
  const [errors, setErrors] = useState({});
  const [busy, setBusy] = useState(false);
  const [confirming, setConfirming] = useState(null);
  const [saveError, setSaveError] = useState(null);
  const submitting = useRef(false);
  const day = useAsync(
    async () => ({ ...(await getDayInfo(today, form.classId, user)), classId: form.classId }),
    [today, form.classId, user.id],
    { enabled: !!form.classId },
  );
  const reloadDay = day.reload;
  const [filters, setFilters] = useState({ keyword: '', classId: '', status: '', from: '', to: '' });
  const [page, setPage] = useState(1);
  const selected = scoped.find((cls) => cls.id === form.classId);
  const campusLabel = (id) => (campuses || []).find((campus) => campus.id === id)?.name || id;
  const multiCampus = new Set(scoped.map((cls) => cls.campusId)).size > 1;
  const classLabel = (cls) => `${cls.name}${multiCampus ? ` · ${campusLabel(cls.campusId)}` : ''}`;
  const active = (history.data || []).find((item) => item.classId === form.classId && isAttendanceUnlockActive(item, now));
  const ready = selected && day.data?.classId === form.classId && day.data?.date === today && !day.loading && !day.error;
  const filtered = Object.values(filters).some(Boolean);
  const invalidRange =
    (filters.from && !isIsoDate(filters.from)) ||
    (filters.to && !isIsoDate(filters.to)) ||
    (filters.from && filters.to && filters.from > filters.to);
  const keyword = normalizeText(filters.keyword.trim());
  const shown = invalidRange
    ? []
    : (history.data || []).filter(
        (item) =>
          (!keyword || normalizeText(`${item.className} ${item.unlockedByName} ${item.reason}`).includes(keyword)) &&
          (!filters.classId || item.classId === filters.classId) &&
          (!filters.status || (filters.status === 'ACTIVE') === isAttendanceUnlockActive(item, now)) &&
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
    if (!isIsoDate(form.untilDate) || !isValidTime(form.untilTime)) next.until = 'Nhập đủ ngày giờ hợp lệ.';
    const until = new Date(`${form.untilDate}T${form.untilTime}:00+07:00`);
    if (!next.until && (until <= new Date() || until.getTime() - Date.now() > ATTENDANCE_UNLOCK_MAX_DAYS * 86400000))
      next.until = 'Hạn phải sau hiện tại, tối đa 7 ngày.';
    if (!form.reason.trim() || form.reason.trim().length > 300) next.reason = 'Nhập lý do mở lại, tối đa 300 ký tự.';
    setErrors(next);
    if (Object.keys(next).length || !ready || !day.data.schoolDay || !day.data.baseLocked || active || history.error) return;
    setConfirming({
      classId: selected.id,
      className: classLabel(selected),
      date: today,
      validUntil: until.toISOString(),
      reason: form.reason.trim(),
    });
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
      <div className="alert alert--info mb-16">
        <Info size={18} />
        <div>
          Dành cho lớp quên điểm danh sau giờ chốt. Chỉ mở riêng lớp/ngày hôm nay; Phó hiệu trưởng chỉ mở được lớp thuộc điểm trường mình.
          <div className="text-sm">Thay đổi báo ăn cần được xác nhận lại, không tự đổi số suất bếp đã nhận.</div>
        </div>
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
        <form className="card" onSubmit={requestUnlock} noValidate aria-busy={busy}>
          <fieldset disabled={busy} className="dd-unlock-fields">
            <div className="grid-2 dd-unlock-grid">
              <FormField label="Lớp cần mở lại" required error={errors.classId}>
                <select className="select" value={form.classId} onChange={(event) => set({ classId: event.target.value })}>
                  <option value="">Chọn lớp</option>
                  {scoped.map((cls) => (
                    <option key={cls.id} value={cls.id}>
                      {classLabel(cls)}
                    </option>
                  ))}
                </select>
              </FormField>
              <FormField label="Ngày cần mở lại" hint="Chỉ áp dụng cho ngày học hôm nay.">
                <input className="input" value={formatDate(today)} readOnly />
              </FormField>
              <FormField
                label="Mở đến ngày"
                required
                error={errors.until}
                hint="Qua ngày mới, lần mở hôm trước không cho phép sửa điểm danh ngày cũ."
              >
                <DateInput
                  value={form.untilDate}
                  min={today}
                  max={addDays(today, ATTENDANCE_UNLOCK_MAX_DAYS)}
                  onChange={(value) => set({ untilDate: value })}
                />
              </FormField>
              <FormField label="Mở đến giờ" required error={errors.until}>
                <input type="time" className="input" value={form.untilTime} onChange={(event) => set({ untilTime: event.target.value })} />
              </FormField>
            </div>
            <FormField label="Lý do mở lại" required className="mt-12" error={errors.reason}>
              <input
                className="input"
                maxLength={300}
                value={form.reason}
                placeholder="Ví dụ: Cô lớp Chồi 1 quên lưu điểm danh"
                onChange={(event) => set({ reason: event.target.value })}
              />
            </FormField>
            {form.classId && day.loading && <LoadingState text="Đang kiểm tra trạng thái lớp..." />}
            {day.error && <ErrorState error={day.error} onRetry={day.reload} />}
            {ready && (
              <div className="alert alert--info mt-12" role="status">
                <Info size={18} />
                <div>
                  {!day.data.schoolDay
                    ? 'Hôm nay không phải ngày học, không thể mở lại điểm danh.'
                    : active
                      ? `Lớp đã mở lại đến ${formatDateTime(active.validUntil)}.`
                      : !day.data.baseLocked
                        ? `Chưa đến giờ chốt ${day.data.cutoff}; giáo viên vẫn điểm danh bình thường.`
                        : `Đã qua giờ chốt ${day.data.cutoff}. Có thể mở lại riêng lớp ${selected.name}.`}
                </div>
              </div>
            )}
            {saveError && (
              <div className="alert alert--danger mt-12" role="alert">
                {saveError.message}
              </div>
            )}
            <div className="row mt-16">
              <button
                className="btn btn--primary"
                type="submit"
                disabled={busy || !ready || !day.data?.schoolDay || !day.data?.baseLocked || !!active || history.loading || !!history.error}
              >
                {busy ? <Spinner small /> : <Unlock size={16} />} Mở lại điểm danh
              </button>
            </div>
          </fieldset>
        </form>
      )}
      <div className="card mt-16">
        <div className="card__header">
          <h2 className="card__title">Các lần mở lại</h2>
        </div>
        <div className="filter-bar">
          <SearchSubmit
            value={filters.keyword}
            label="Tìm lớp, người mở hoặc lý do"
            placeholder="Tìm lớp, người mở, lý do"
            onSearch={(keyword) => setFilter({ keyword })}
          />
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
          <DateInput
            aria-label="Ngày điểm danh từ"
            value={filters.from}
            max={filters.to || today}
            onChange={(from) => setFilter({ from })}
          />
          <DateInput
            aria-label="Ngày điểm danh đến"
            value={filters.to}
            min={filters.from || undefined}
            max={today}
            onChange={(to) => setFilter({ to })}
          />
          {filtered && (
            <button
              className="btn btn--sm"
              type="button"
              onClick={() => setFilter({ keyword: '', classId: '', status: '', from: '', to: '' })}
            >
              Bỏ lọc
            </button>
          )}
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
                  <th>Hiệu lực</th>
                </tr>
              </thead>
              <tbody>
                {history.loading ? (
                  <SkeletonRows rows={3} cols={6} />
                ) : !shown.length ? (
                  <tr>
                    <td colSpan={6}>
                      <EmptyState
                        title={filtered ? 'Không có lần mở lại phù hợp' : 'Chưa có lần mở lại'}
                        description="Lịch sử mở lại trong phạm vi của bạn hiển thị tại đây."
                      />
                    </td>
                  </tr>
                ) : (
                  paginate(shown, currentPage, 10).map((item) => (
                    <tr key={item.id}>
                      <td className="fw-600">
                        {item.className}
                        {multiCampus && <div className="text-sm muted">{campusLabel(item.campusId)}</div>}
                      </td>
                      <td className="nowrap">{formatDate(item.date)}</td>
                      <td>{item.unlockedByName}</td>
                      <td>{formatDateTime(item.unlockedAt)}</td>
                      <td>{item.reason || '—'}</td>
                      <td>
                        <span className={`chip ${isAttendanceUnlockActive(item, now) ? 'chip--green' : 'chip--gray'}`}>
                          {isAttendanceUnlockActive(item, now) ? 'Còn hiệu lực' : 'Đã hết'} · {formatDateTime(item.validUntil)}
                        </span>
                      </td>
                    </tr>
                  ))
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
