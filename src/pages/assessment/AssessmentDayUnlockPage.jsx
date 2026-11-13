import { defaultUnlockUntil as defaultUntil, parseUnlockUntil } from '@/utils/assessment/unlockTime';
import { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Lock, RotateCcw, Unlock } from '@/components/ui/icons';
import { useAuth } from '@/contexts/AuthContext';
import { useSchoolYear } from '@/contexts/SchoolYearContext';
import { useToast } from '@/contexts/ToastContext';
import { useAsync } from '@/hooks/useAsync';
import { useDailyAssessmentClasses } from '@/hooks/assessment/useAssessment';
import {
  getAssessmentDayUnlocks,
  getWeeklyCommentReopens,
  revokeAssessmentDayUnlock,
  unlockAssessmentDay,
} from '@/services/assessment/assessmentService';
import { WeeklyCommentReopenForm } from '@/components/assessment/WeeklyCommentReopenForm';
import { SelectField } from '@/components/form/Field';
import { RowActions } from '@/components/ui/RowActions';
import { getCampuses } from '@/services/masterDataService';
import { UnlockWindowBadge } from '@/components/assessment/AssessmentBadges';
import { DateInput } from '@/components/form/DateInput';
import { Breadcrumb } from '@/components/ui/Breadcrumb';
import { CampusFilter } from '@/components/ui/CampusFilter';
import { FormField } from '@/components/form/FormField';
import { FilterMore } from '@/components/ui/FilterMore';
import { Pagination, paginate } from '@/components/ui/Pagination';
import { EmptyState, ErrorState, SkeletonRows, Spinner } from '@/components/ui/States';
import { formatDate, formatDateTime, isIsoDate } from '@/utils/format';
import { addDays, isSchoolDay, todayIso } from '@/utils/assessment/assessmentPeriods';
import { canUnlockAssessmentDay } from '@/utils/assessment/assessmentPermissions';
import { assessmentCrumbs, SECTIONS } from '@/utils/assessment/breadcrumbs';
import '@/styles/modules/assessment.css';

const lastLockedDay = (yearStart) => {
  let d = addDays(todayIso(), -1);
  while (!isSchoolDay(d)) d = addDays(d, -1);
  return yearStart && d < yearStart ? '' : d;
};

const EMPTY_FILTERS = { kind: '', campusId: '', classId: '', active: '', from: '', to: '' };

// Loại mở lại: ngày đánh giá đã khóa (OBS-19) hoặc nhận xét tuần đã gửi (OBS-29)
const KINDS = [
  { value: 'DAY', label: 'Đánh giá ngày' },
  { value: 'WEEK', label: 'Nhận xét tuần' },
];
const KIND_LABELS = Object.fromEntries(KINDS.map((k) => [k.value, k.label]));

/**
 * Mở lại đánh giá: ngày đánh giá đã khóa (khóa sau 23:59:59 của ngày đó; chọn hạn, giáo viên đánh giá được đến hạn đó)
 * hoặc nhận xét tuần đã gửi phụ huynh (về nháp để giáo viên sửa, gửi lại). Người mở: PHT điểm trường hoặc Hiệu trưởng.
 */
export default function AssessmentDayUnlockPage() {
  const { user } = useAuth();
  const toast = useToast();
  const { classes, loading: classesLoading, error: classesError } = useDailyAssessmentClasses();
  // BE trả cờ canUnlock theo lớp; mock dùng phạm vi PHT / Hiệu trưởng
  const scoped = useMemo(() => classes.filter((c) => c.canUnlock ?? canUnlockAssessmentDay(c, user)), [classes, user]);
  const { data: campuses } = useAsync(() => getCampuses(), []);
  const scopedCampuses = useMemo(() => (campuses || []).filter((c) => scoped.some((cls) => cls.campusId === c.id)), [campuses, scoped]);
  // Hiệu trưởng thấy lớp cả 2 điểm trường (trùng tên) nên ghi kèm điểm trường
  const multiCampus = scopedCampuses.length > 1;
  const campusLabel = (id) => {
    const c = (campuses || []).find((x) => x.id === id);
    return c ? c.shortName || c.name : '';
  };
  const classLabel = (c) => (multiCampus && campusLabel(c.campusId) ? `${c.name} · ${campusLabel(c.campusId)}` : c.name);

  // Ngày cần mở lại: từ đầu năm học đang hoạt động đến hôm qua; hạn không quá ngày kết thúc năm học
  const activeYear = useSchoolYear()?.schoolYears?.find((y) => y.status === 'ACTIVE');
  const yearStart = activeYear?.startDate || undefined;
  const yearEnd = activeYear?.endDate || undefined;
  const yesterday = addDays(todayIso(), -1);
  // Mở từ Tổng quan đánh giá: điền sẵn lớp và ngày từ đường dẫn (?classId=&date=)
  const [search] = useSearchParams();
  const presetDate = search.get('date');
  const [form, setForm] = useState(() => ({
    classId: search.get('classId') || '',
    date: isIsoDate(presetDate) ? presetDate : lastLockedDay(yearStart),
    reason: '',
    ...defaultUntil(yearEnd),
  }));
  const [errors, setErrors] = useState({});
  const [busy, setBusy] = useState(false);
  const [kind, setKind] = useState('DAY');
  const set = (patch) => {
    setForm((f) => ({ ...f, ...patch }));
    setErrors({});
  };

  // Lọc "Các lần mở lại" ở BE: điểm trường (Hiệu trưởng), lớp, hiệu lực, khoảng ngày đánh giá
  const [filters, setFilters] = useState(EMPTY_FILTERS);
  const [page, setPage] = useState(1);
  const setFilter = (patch) => {
    setFilters((f) => ({ ...f, ...patch }));
    setPage(1);
  };
  const invalidRange =
    (filters.from && !isIsoDate(filters.from)) ||
    (filters.to && !isIsoDate(filters.to)) ||
    (filters.from && filters.to && filters.from > filters.to);
  const query = useMemo(
    () => ({
      campusId: filters.campusId,
      classId: filters.classId,
      active: filters.active === '' ? undefined : filters.active === 'ACTIVE',
      from: filters.from,
      to: filters.to,
    }),
    [filters],
  );
  const {
    data: unlocks,
    loading,
    error,
    reload,
  } = useAsync(() => getAssessmentDayUnlocks(query, user), [JSON.stringify(query), user?.id], {
    enabled: !invalidRange && filters.kind !== 'WEEK',
  });
  // Lịch sử mở lại nhận xét tuần: lọc lớp, khoảng ngày theo tuần; không có hiệu lực / kết thúc sớm
  const {
    data: reopens,
    loading: reopensLoading,
    error: reopensError,
    reload: reloadReopens,
  } = useAsync(() => getWeeklyCommentReopens(query, user), [JSON.stringify(query), user?.id], {
    enabled: !invalidRange && filters.kind !== 'DAY' && !filters.active,
  });
  const shown = useMemo(() => {
    if (invalidRange) return [];
    const days = filters.kind === 'WEEK' ? [] : (unlocks || []).map((u) => ({ ...u, kind: 'DAY', key: `d-${u.id}` }));
    const weeks =
      filters.kind === 'DAY' || filters.active
        ? []
        : (reopens || []).map((r) => ({
            kind: 'WEEK',
            key: `w-${r.id}`,
            className: r.className,
            campusId: r.campusId,
            childName: r.childName,
            weekFrom: r.weekFrom,
            weekEnd: r.weekEnd,
            unlockedByName: r.reopenedByName,
            unlockedAt: r.reopenedAt,
            reason: r.reason,
          }));
    return [...days, ...weeks].sort((a, b) => String(b.unlockedAt).localeCompare(String(a.unlockedAt)));
  }, [invalidRange, filters.kind, filters.active, unlocks, reopens]);
  const historyLoading = (filters.kind !== 'WEEK' && loading) || (filters.kind !== 'DAY' && !filters.active && reopensLoading);
  const historyError = error || reopensError;
  const reloadHistory = () => {
    reload({ silent: true });
    reloadReopens({ silent: true });
  };
  const filtered = Object.values(filters).some(Boolean);
  const filterClasses = scoped.filter((c) => !filters.campusId || c.campusId === filters.campusId);

  const submit = async (e) => {
    e.preventDefault();
    if (busy) return;
    // Chỉ kiểm tra nhập đủ; ngày học, khóa, hạn hợp lệ do BE quyết định
    const errs = {};
    if (!form.classId) errs.classId = 'Chọn lớp.';
    if (!isIsoDate(form.date)) errs.date = 'Chọn ngày cần mở lại.';
    const until = parseUnlockUntil(form.untilDate, form.untilTime);
    if (!isIsoDate(form.untilDate) || !form.untilTime || Number.isNaN(until.getTime())) errs.validUntil = 'Chọn ngày giờ hết hạn.';
    if (!form.reason.trim()) errs.reason = 'Nhập lý do mở lại.';
    setErrors(errs);
    if (Object.keys(errs).length) return;
    setBusy(true);
    try {
      const u = await unlockAssessmentDay(
        { classId: form.classId, date: form.date, reason: form.reason.trim(), validUntil: until.toISOString() },
        user,
      );
      toast.success(
        `Đã mở lại ngày ${formatDate(u.date)} cho ${u.className} đến ${formatDateTime(u.validUntil)}. Giáo viên của lớp đã được thông báo.`,
      );
      setForm((f) => ({ ...f, reason: '', ...defaultUntil(yearEnd) }));
      reload({ silent: true });
    } catch (err) {
      if (err.details) setErrors(err.details);
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

  // Ô Loại đứng đầu cùng hàng ở cả hai form, cùng bề rộng để đổi loại không xô bố cục
  const kindField = (
    <SelectField
      label="Loại"
      fieldClassName="dg-unlock-kind"
      value={kind}
      disabled={busy}
      onChange={(e) => {
        setKind(e.target.value);
        setErrors({});
      }}
      options={KINDS}
    />
  );

  return (
    <div className="page">
      <Breadcrumb items={assessmentCrumbs(SECTIONS.unlocks)} />
      <div className="page__head">
        <h1 className="page__title">Mở lại đánh giá</h1>
      </div>

      {classesError ? (
        <ErrorState error={classesError} />
      ) : kind === 'WEEK' ? (
        <WeeklyCommentReopenForm
          kindField={kindField}
          classes={scoped}
          classesLoading={classesLoading}
          classLabel={classLabel}
          user={user}
          onReopened={reloadHistory}
        />
      ) : (
        <form className="card form-inline" onSubmit={submit} noValidate aria-busy={busy}>
          {kindField}
          <FormField label="Lớp cần mở lại" required error={errors.classId} className="form-inline__class">
            <select
              className="select"
              value={form.classId}
              disabled={classesLoading || busy}
              onChange={(e) => set({ classId: e.target.value })}
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
              max={yesterday}
              disabled={busy}
              onChange={(date) => set({ date })}
            />
          </FormField>
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
              <input
                type="time"
                className="input"
                aria-label="Mở đến giờ"
                value={form.untilTime}
                disabled={busy}
                onChange={(e) => set({ untilTime: e.target.value })}
              />
            </div>
          </FormField>
          <FormField label="Lý do" required error={errors.reason} className="form-inline__grow">
            <input
              className="input"
              value={form.reason}
              maxLength={300}
              disabled={busy}
              placeholder="Ví dụ: theo mail của cô giáo lớp"
              onChange={(e) => set({ reason: e.target.value })}
            />
          </FormField>
          <button className="btn btn--primary" type="submit" disabled={busy || !scoped.length}>
            {busy ? <Spinner small /> : <Unlock size={16} />} Mở lại ngày
          </button>
          {errors._form && (
            <div className="alert alert--danger form-inline__full" role="alert">
              {errors._form}
            </div>
          )}
        </form>
      )}

      <div className="card mt-16">
        <div className="card__header">
          <h2 className="card__title">Các lần mở lại</h2>
        </div>
        <div className="filter-bar dg-unlock-filters">
          <SelectField
            aria-label="Lọc loại"
            value={filters.kind}
            placeholder="Tất cả loại"
            onChange={(e) => setFilter({ kind: e.target.value })}
            options={KINDS}
          />
          <CampusFilter
            hideLabel
            campuses={scopedCampuses}
            value={filters.campusId}
            onChange={(campusId) => setFilter({ campusId, classId: '' })}
          />
          <select className="select" aria-label="Lọc lớp" value={filters.classId} onChange={(e) => setFilter({ classId: e.target.value })}>
            <option value="">Tất cả lớp</option>
            {filterClasses.map((c) => (
              <option key={c.id} value={c.id}>
                {filters.campusId ? c.name : classLabel(c)}
              </option>
            ))}
          </select>
          <select
            className="select"
            aria-label="Lọc hiệu lực"
            value={filters.active}
            onChange={(e) => setFilter({ active: e.target.value })}
          >
            <option value="">Tất cả hiệu lực</option>
            <option value="ACTIVE">Còn hiệu lực</option>
            <option value="ENDED">Đã hết</option>
          </select>
          <FilterMore count={[filters.from, filters.to].filter(Boolean).length}>
            <div className="field">
              <span className="field__label">Ngày đánh giá từ</span>
              <DateInput
                aria-label="Ngày đánh giá từ"
                value={filters.from}
                max={filters.to || yesterday}
                onChange={(from) => setFilter({ from })}
              />
            </div>
            <div className="field">
              <span className="field__label">Ngày đánh giá đến</span>
              <DateInput
                aria-label="Ngày đánh giá đến"
                value={filters.to}
                min={filters.from || undefined}
                max={yesterday}
                onChange={(to) => setFilter({ to })}
              />
            </div>
          </FilterMore>
          <button className="btn" type="button" disabled={!filtered} onClick={() => setFilter(EMPTY_FILTERS)}>
            <RotateCcw size={15} /> Đặt lại bộ lọc
          </button>
        </div>
        {invalidRange && (
          <p className="field__error" role="alert">
            Nhập khoảng ngày hợp lệ theo dd/mm/yyyy, ngày bắt đầu không sau ngày kết thúc.
          </p>
        )}
        {historyError ? (
          <ErrorState error={historyError} onRetry={reloadHistory} />
        ) : (
          <div className="table-wrap dg-roll-wrap">
            <table className="table table--grid dg-roll">
              <thead>
                <tr>
                  <th>Loại</th>
                  <th>Lớp</th>
                  <th>Ngày / tuần</th>
                  <th>Người mở</th>
                  <th>Lúc mở</th>
                  <th>Lý do</th>
                  <th className="center">Hiệu lực</th>
                  <th className="cell--actions">Thao tác</th>
                </tr>
              </thead>
              <tbody>
                {historyLoading && !invalidRange ? (
                  <SkeletonRows rows={3} cols={8} />
                ) : !shown.length ? (
                  <tr>
                    <td colSpan={8}>
                      <EmptyState
                        icon={Unlock}
                        title={filtered ? 'Không có lần mở lại phù hợp bộ lọc' : 'Chưa mở lại đánh giá nào'}
                        description={filtered ? undefined : 'Các ngày đánh giá, nhận xét tuần đã mở lại hiện ở đây.'}
                      />
                    </td>
                  </tr>
                ) : (
                  paginate(shown, page, 10).map((u) => (
                    <tr key={u.key}>
                      <td>{KIND_LABELS[u.kind]}</td>
                      <td className="fw-600">
                        {u.className}
                        {multiCampus && <div className="text-sm muted">{campusLabel(u.campusId)}</div>}
                      </td>
                      <td className="nowrap">
                        {u.kind === 'WEEK' ? (
                          <>
                            {formatDate(u.weekFrom)} – {formatDate(u.weekEnd)}
                            <div className="text-sm muted">{u.childName}</div>
                          </>
                        ) : (
                          formatDate(u.date)
                        )}
                      </td>
                      <td>{u.unlockedByName}</td>
                      <td>{formatDateTime(u.unlockedAt)}</td>
                      <td>{u.reason || '—'}</td>
                      <td className="center">
                        {u.kind === 'WEEK' ? (
                          <span className="text-sm muted">Về nháp, chờ gửi lại</span>
                        ) : (
                          <UnlockWindowBadge
                            status={u.active ? 'ACTIVE' : u.revokedAt ? 'REVOKED' : 'EXPIRED'}
                            detail={formatDateTime(u.validUntil)}
                          />
                        )}
                        {u.revokedByName && <div className="text-xs muted">bởi {u.revokedByName}</div>}
                      </td>
                      <td className="cell--actions">
                        {u.kind === 'DAY' && u.active && (
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
