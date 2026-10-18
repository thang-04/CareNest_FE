import { useMemo, useState } from 'react';
import { Unlock } from '@/components/ui/icons';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/contexts/ToastContext';
import { useAsync } from '@/hooks/useAsync';
import { useClasses } from '@/hooks/useSchool';
import { getAssessmentDayUnlocks, unlockAssessmentDay } from '@/services/assessment/assessmentService';
import { getCampuses } from '@/services/masterDataService';
import { getAgeGroups } from '@/services/school-config/schoolConfigService';
import { ClassPicker } from '@/components/assessment/ClassPicker';
import { Breadcrumb } from '@/components/ui/Breadcrumb';
import { FormField } from '@/components/form/FormField';
import { SearchSubmit } from '@/components/ui/SearchSubmit';
import { Pagination, paginate } from '@/components/ui/Pagination';
import { EmptyState, ErrorState, SkeletonRows, Spinner } from '@/components/ui/States';
import { formatDate, formatDateTime, normalizeText } from '@/utils/format';
import { UNLOCK_MAX_DAYS, addDays, isSchoolDay, isUnlockActive, todayIso, unlockDeadline } from '@/utils/assessment/assessmentPeriods';
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
  const { data: ageGroups } = useAsync(() => getAgeGroups(), []);
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
  const classId = form.classId || scoped[0]?.id || '';
  const today = todayIso();
  // Lọc bảng "Các lần mở lại": tìm (lớp, người mở, lý do), lớp, hiệu lực, ngày đánh giá
  const [filters, setFilters] = useState({ keyword: '', classId: '', status: '', from: '', to: '' });
  const [page, setPage] = useState(1);
  const setFilter = (patch) => {
    setFilters((f) => ({ ...f, ...patch }));
    setPage(1);
  };
  const kw = normalizeText(filters.keyword.trim());
  const shown = (unlocks || []).filter(
    (u) =>
      (!kw || normalizeText(`${u.className} ${u.unlockedByName} ${u.reason}`).includes(kw)) &&
      (!filters.classId || u.classId === filters.classId) &&
      (!filters.status || (filters.status === 'ACTIVE') === isUnlockActive(u)) &&
      (!filters.from || u.date >= filters.from) &&
      (!filters.to || u.date <= filters.to),
  );
  const filtered = !!(filters.keyword || filters.classId || filters.status || filters.from || filters.to);

  const submit = async (e) => {
    e.preventDefault();
    const errs = {};
    if (!classId) errs.classId = 'Chọn lớp.';
    if (!form.date) errs.date = 'Chọn ngày.';
    else if (form.date >= today) errs.date = 'Chỉ mở lại ngày đã qua (ngày đã khóa).';
    else if (!isSchoolDay(form.date)) errs.date = 'Ngày đã chọn không phải ngày học.';
    const until = new Date(`${form.untilDate}T${form.untilTime || '00:00'}`);
    if (!form.untilDate || !form.untilTime || Number.isNaN(until.getTime())) errs.until = 'Chọn ngày giờ hết hạn.';
    else if (until <= new Date()) errs.until = 'Hạn phải sau thời điểm hiện tại.';
    else if (form.untilDate > addDays(today, UNLOCK_MAX_DAYS)) errs.until = `Tối đa ${UNLOCK_MAX_DAYS} ngày kể từ hôm nay.`;
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
      toast.error(err.message, 'Không mở lại được');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="page">
      <Breadcrumb items={assessmentCrumbs(SECTIONS.unlocks)} />
      <div className="page__head">
        <h1 className="page__title">Mở lại ngày đánh giá</h1>
      </div>

      <form className="card dg-unlock-form" onSubmit={submit} noValidate>
        <FormField label="Lớp" required error={errors.classId} className="dg-unlock-form__class">
          <ClassPicker
            classes={scoped}
            ageGroups={ageGroups || []}
            campuses={campuses || []}
            value={classId}
            disabled={classesLoading}
            error={errors.classId}
            placeholder={classesLoading ? 'Đang tải lớp...' : 'Tìm lớp, vd: Chồi 1'}
            onChange={(v) => setForm({ ...form, classId: v })}
          />
        </FormField>
        <FormField label="Ngày cần mở lại" required error={errors.date}>
          <input
            type="date"
            className="input"
            value={form.date}
            max={addDays(today, -1)}
            onChange={(e) => setForm({ ...form, date: e.target.value })}
          />
        </FormField>
        <FormField label="Mở đến" required error={errors.until}>
          <div className="dg-unlock-until">
            <input
              type="date"
              className="input"
              aria-label="Mở đến ngày"
              value={form.untilDate}
              min={today}
              max={addDays(today, UNLOCK_MAX_DAYS)}
              onChange={(e) => setForm({ ...form, untilDate: e.target.value })}
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
        <FormField label="Lý do" className="dg-unlock-form__reason">
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
          <SearchSubmit
            value={filters.keyword}
            placeholder="Tìm lớp, người mở, lý do"
            label="Tìm lớp, người mở hoặc lý do"
            onSearch={(text) => setFilter({ keyword: text })}
          />
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
          <input
            type="date"
            className="input"
            aria-label="Ngày đánh giá từ"
            value={filters.from}
            max={filters.to || undefined}
            onChange={(e) => setFilter({ from: e.target.value })}
          />
          <span className="muted">–</span>
          <input
            type="date"
            className="input"
            aria-label="Ngày đánh giá đến"
            value={filters.to}
            min={filters.from || undefined}
            onChange={(e) => setFilter({ to: e.target.value })}
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
                  <th>Hiệu lực</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <SkeletonRows rows={3} cols={6} />
                ) : !unlocks?.length ? (
                  <tr>
                    <td colSpan={6}>
                      <EmptyState icon={Unlock} title="Chưa mở lại ngày nào" description="Các ngày đã mở lại cho giáo viên hiện ở đây." />
                    </td>
                  </tr>
                ) : !shown.length ? (
                  <tr>
                    <td colSpan={6}>
                      <EmptyState icon={Unlock} title="Không có lần mở lại phù hợp bộ lọc" />
                    </td>
                  </tr>
                ) : (
                  paginate(shown, page, 10).map((u) => (
                    <tr key={u.id}>
                      <td className="fw-600">{u.className}</td>
                      <td>{formatDate(u.date)}</td>
                      <td>{u.unlockedByName}</td>
                      <td>{formatDateTime(u.unlockedAt)}</td>
                      <td>{u.reason || '—'}</td>
                      <td>
                        {isUnlockActive(u) ? (
                          <span className="chip chip--green">Đến {formatDateTime(unlockDeadline(u.validUntil))}</span>
                        ) : (
                          <span className="chip chip--gray">Đã hết · {formatDateTime(unlockDeadline(u.validUntil))}</span>
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
