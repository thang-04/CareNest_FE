import { useMemo, useState } from 'react';
import { Lock, RotateCcw, Unlock } from '@/components/ui/icons';
import { useAuth } from '@/contexts/AuthContext';
import { useSchoolYear } from '@/contexts/SchoolYearContext';
import { useToast } from '@/contexts/ToastContext';
import { useAsync } from '@/hooks/useAsync';
import { useAgeGroups, useClasses } from '@/hooks/useSchool';
import { getAssessmentDayUnlocks, revokeAssessmentDayUnlock, unlockAssessmentDay } from '@/services/assessment/assessmentService';
import { RowActions } from '@/components/ui/RowActions';
import { getCampuses } from '@/services/masterDataService';
import { UnlockWindowBadge } from '@/components/assessment/AssessmentBadges';
import { DateInput } from '@/components/form/DateInput';
import { Breadcrumb } from '@/components/ui/Breadcrumb';
import { FormField } from '@/components/form/FormField';
import { FilterMore } from '@/components/ui/FilterMore';
import { Pagination, paginate } from '@/components/ui/Pagination';
import { EmptyState, ErrorState, SkeletonRows, Spinner } from '@/components/ui/States';
import { formatDate, formatDateTime, isIsoDate } from '@/utils/format';
import { addDays, isSchoolDay, isUnlockActive, todayIso, unlockDeadline } from '@/utils/assessment/assessmentPeriods';
import { canUnlockAssessmentDay } from '@/utils/assessment/assessmentPermissions';
import { assessmentCrumbs, SECTIONS } from '@/utils/assessment/breadcrumbs';
import '@/styles/modules/assessment.css';

const lastLockedDay = () => {
  let d = addDays(todayIso(), -1);
  while (!isSchoolDay(d)) d = addDays(d, -1);
  return d;
};

/**
 * Mở lại ngày đánh giá đã khóa (khóa sau 23:59:59 của ngày đó). Giáo viên quên đánh giá thì gửi mail cho PHT điểm trường
 * hoặc Hiệu trưởng; người đó mở lại ngày cho lớp ở đây và chọn hạn (ngày giờ), giáo viên đánh giá được đến hạn đó.
 */
export default function AssessmentDayUnlockPage() {
  const { user } = useAuth();
  const toast = useToast();
  const { classes, loading: classesLoading } = useClasses();
  const scoped = useMemo(() => classes.filter((c) => canUnlockAssessmentDay(c, user)), [classes, user]);
  const { data: unlocks, loading, error, reload } = useAsync(() => getAssessmentDayUnlocks(user), [user?.id]);
  const { data: campuses } = useAsync(() => getCampuses(), []);
  const { ageGroups } = useAgeGroups();
  // Hiệu trưởng thấy lớp cả 2 điểm trường (trùng tên) nên ghi kèm điểm trường
  const multiCampus = new Set(scoped.map((c) => c.campusId)).size > 1;
  const campusLabel = (id) => {
    const c = (campuses || []).find((x) => x.id === id);
    return c ? c.shortName || c.name : '';
  };
  const classLabel = (c) => (multiCampus && campusLabel(c.campusId) ? `${c.name} · ${campusLabel(c.campusId)}` : c.name);
  const [form, setForm] = useState({ classId: '', date: lastLockedDay(), reason: '', untilDate: todayIso(), untilTime: '23:59' });
  const [errors, setErrors] = useState({});
  const [busy, setBusy] = useState(false);
  const classId = form.classId;
  const today = todayIso();
  // Lùi được tới ngày bắt đầu năm học đang hoạt động
  const activeYear = useSchoolYear()?.schoolYears?.find((y) => y.status === 'ACTIVE');
  const yearStart = activeYear?.startDate || undefined;
  // Hạn "Mở đến" do HT / PHT chọn, không quá ngày kết thúc năm học
  const yearEnd = activeYear?.endDate || undefined;
  // Lọc bảng "Các lần mở lại": tìm (lớp, người mở, lý do), lớp, hiệu lực, ngày đánh giá
  const [filters, setFilters] = useState({ classId: '', status: '', from: '', to: '' });
  const [page, setPage] = useState(1);
  const setFilter = (patch) => {
    setFilters((f) => ({ ...f, ...patch }));
    setPage(1);
  };
  // Khoảng ngày nhập tay dd/mm/yyyy: sai thì báo, không lọc (như Mở lại điểm danh)
  const invalidRange =
    (filters.from && !isIsoDate(filters.from)) ||
    (filters.to && !isIsoDate(filters.to)) ||
    (filters.from && filters.to && filters.from > filters.to);
  const shown = (invalidRange ? [] : unlocks || []).filter(
    (u) =>
      (!filters.classId || u.classId === filters.classId) &&
      (!filters.status || (filters.status === 'ACTIVE') === isUnlockActive(u)) &&
      (!filters.from || u.date >= filters.from) &&
      (!filters.to || u.date <= filters.to),
  );
  const filtered = !!(filters.classId || filters.status || filters.from || filters.to);

  const submit = async (e) => {
    e.preventDefault();
    const errs = {};
    if (!classId) errs.classId = 'Chọn lớp.';
    if (!form.date) errs.date = 'Chọn ngày.';
    else if (form.date >= today) errs.date = 'Chỉ mở lại ngày đã qua (ngày đã khóa).';
    else if (yearStart && form.date < yearStart) errs.date = 'Chỉ mở lại ngày từ đầu năm học.';
    else if (!isSchoolDay(form.date)) errs.date = 'Ngày đã chọn không phải ngày học.';
    const until = new Date(`${form.untilDate}T${form.untilTime || '00:00'}`);
    if (!form.untilDate || !form.untilTime || Number.isNaN(until.getTime())) errs.until = 'Chọn ngày giờ hết hạn.';
    else if (until <= new Date()) errs.until = 'Hạn phải sau thời điểm hiện tại.';
    else if (yearEnd && form.untilDate > yearEnd) errs.until = `Không quá ngày kết thúc năm học ${formatDate(yearEnd)}.`;
    setErrors(errs);
    if (Object.keys(errs).length) return;
    setBusy(true);
    try {
      const u = await unlockAssessmentDay({ classId, date: form.date, reason: form.reason, validUntil: until.toISOString() }, user);
      toast.success(
        `Đã mở lại ngày ${formatDate(u.date)} cho ${u.className} đến ${formatDateTime(unlockDeadline(u.validUntil))}. Giáo viên của lớp đã được thông báo.`,
      );
      setForm((f) => ({ ...f, reason: '' }));
      reload({ silent: true });
    } catch (err) {
      toast.error(err, 'Không mở lại được');
    } finally {
      setBusy(false);
    }
  };

  // Mở nhầm hoặc giáo viên đã xong: kết thúc sớm, ngày khóa lại, vẫn giữ trong lịch sử
  const revoke = async (u) => {
    try {
      await revokeAssessmentDayUnlock(u.id, user);
      toast.success(`Đã kết thúc mở lại ngày ${formatDate(u.date)} của ${u.className}. Giáo viên được thông báo.`);
      reload({ silent: true });
    } catch (err) {
      toast.error(err, 'Không kết thúc được');
    }
  };

  return (
    <div className="page">
      <Breadcrumb items={assessmentCrumbs(SECTIONS.unlocks)} />
      <div className="page__head">
        <h1 className="page__title">Mở lại ngày đánh giá</h1>
      </div>

      <form className="card form-inline" onSubmit={submit} noValidate>
        <FormField label="Lớp cần mở lại" required error={errors.classId} className="form-inline__class">
          <select
            className="select"
            value={classId}
            disabled={classesLoading}
            onChange={(e) => setForm({ ...form, classId: e.target.value })}
          >
            <option value="">{classesLoading ? 'Đang tải lớp...' : 'Chọn lớp'}</option>
            {scoped.map((c) => (
              <option key={c.id} value={c.id}>
                {classLabel(c)}
              </option>
            ))}
          </select>
        </FormField>
        <FormField label="Ngày cần mở lại" required error={errors.date}>
          <DateInput
            aria-label="Ngày cần mở lại"
            value={form.date}
            min={yearStart}
            max={addDays(today, -1)}
            onChange={(date) => setForm({ ...form, date })}
          />
        </FormField>
        <FormField label="Mở đến" required error={errors.until}>
          <div className="form-inline__pair">
            <DateInput
              aria-label="Mở đến ngày"
              value={form.untilDate}
              min={today}
              max={yearEnd}
              onChange={(untilDate) => setForm({ ...form, untilDate })}
            />
            <input
              type="time"
              className="input"
              aria-label="Mở đến giờ"
              value={form.untilTime}
              onChange={(e) => setForm({ ...form, untilTime: e.target.value })}
            />
          </div>
        </FormField>
        <FormField label="Lý do" className="form-inline__grow">
          <input
            className="input"
            value={form.reason}
            maxLength={300}
            placeholder="Ví dụ: theo mail của cô giáo lớp"
            onChange={(e) => setForm({ ...form, reason: e.target.value })}
          />
        </FormField>
        <button className="btn btn--primary" type="submit" disabled={busy || !scoped.length}>
          {busy ? <Spinner small /> : <Unlock size={16} />} Mở lại ngày
        </button>
      </form>

      <div className="card mt-16">
        <div className="card__header">
          <h2 className="card__title">Các lần mở lại</h2>
        </div>
        <div className="filter-bar dg-unlock-filters">
          <select className="select" aria-label="Lọc lớp" value={filters.classId} onChange={(e) => setFilter({ classId: e.target.value })}>
            <option value="">Tất cả lớp</option>
            {(ageGroups || []).map((g) => {
              const items = scoped.filter((c) => c.ageGroupId === g.id);
              return items.length ? (
                <optgroup key={g.id} label={g.name}>
                  {items.map((c) => (
                    <option key={c.id} value={c.id}>
                      {classLabel(c)}
                    </option>
                  ))}
                </optgroup>
              ) : null;
            })}
            {scoped
              .filter((c) => !(ageGroups || []).some((g) => g.id === c.ageGroupId))
              .map((c) => (
                <option key={c.id} value={c.id}>
                  {classLabel(c)}
                </option>
              ))}
          </select>
          <select
            className="select"
            aria-label="Lọc hiệu lực"
            value={filters.status}
            onChange={(e) => setFilter({ status: e.target.value })}
          >
            <option value="">Tất cả hiệu lực</option>
            <option value="ACTIVE">Còn hiệu lực</option>
            <option value="EXPIRED">Đã hết</option>
          </select>
          <FilterMore count={[filters.from, filters.to].filter(Boolean).length}>
            <div className="field">
              <span className="field__label">Ngày đánh giá từ</span>
              <DateInput
                aria-label="Ngày đánh giá từ"
                value={filters.from}
                max={filters.to || addDays(today, -1)}
                onChange={(from) => setFilter({ from })}
              />
            </div>
            <div className="field">
              <span className="field__label">Ngày đánh giá đến</span>
              <DateInput
                aria-label="Ngày đánh giá đến"
                value={filters.to}
                min={filters.from || undefined}
                max={addDays(today, -1)}
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
        {error ? (
          <ErrorState error={error} onRetry={reload} />
        ) : (
          <div className="table-wrap">
            <table className="table table--grid">
              <thead>
                <tr>
                  <th>Lớp</th>
                  <th>Ngày đánh giá</th>
                  <th>Người mở</th>
                  <th>Lúc mở</th>
                  <th>Lý do</th>
                  <th className="center">Hiệu lực</th>
                  <th className="cell--actions">Thao tác</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <SkeletonRows rows={3} cols={7} />
                ) : !unlocks?.length ? (
                  <tr>
                    <td colSpan={7}>
                      <EmptyState icon={Unlock} title="Chưa mở lại ngày nào" description="Các ngày đã mở lại cho giáo viên hiện ở đây." />
                    </td>
                  </tr>
                ) : !shown.length ? (
                  <tr>
                    <td colSpan={7}>
                      <EmptyState icon={Unlock} title="Không có lần mở lại phù hợp bộ lọc" />
                    </td>
                  </tr>
                ) : (
                  paginate(shown, page, 10).map((u) => (
                    <tr key={u.id}>
                      <td className="fw-600">
                        {u.className}
                        {multiCampus && <div className="text-sm muted">{campusLabel(u.campusId)}</div>}
                      </td>
                      <td className="nowrap">{formatDate(u.date)}</td>
                      <td>{u.unlockedByName}</td>
                      <td>{formatDateTime(u.unlockedAt)}</td>
                      <td>{u.reason || '—'}</td>
                      <td className="center">
                        <UnlockWindowBadge
                          status={isUnlockActive(u) ? 'ACTIVE' : u.revokedAt ? 'REVOKED' : 'EXPIRED'}
                          detail={formatDateTime(unlockDeadline(u.validUntil))}
                        />
                        {u.revokedByName && <div className="text-xs muted">bởi {u.revokedByName}</div>}
                      </td>
                      <td className="cell--actions">
                        {isUnlockActive(u) && (
                          <RowActions
                            name={u.className}
                            menu={[
                              {
                                label: 'Kết thúc sớm',
                                icon: Lock,
                                danger: true,
                                onClick: () => revoke(u),
                                confirm: {
                                  title: 'Kết thúc mở lại ngày đánh giá?',
                                  message: `${u.className}, ngày ${formatDate(u.date)}: ngày khóa lại, giáo viên không sửa đánh giá được nữa. Lần mở lại vẫn lưu trong lịch sử.`,
                                  confirmLabel: 'Kết thúc sớm',
                                },
                              },
                            ]}
                          />
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}
        {shown.length > 10 && <Pagination page={page} total={shown.length} pageSize={10} onChange={setPage} unit="lần" />}
      </div>
    </div>
  );
}
