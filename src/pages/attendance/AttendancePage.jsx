import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { BarChart3, CheckCheck, Save, Utensils, MinusCircle, ClipboardList, UtensilsCrossed } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/contexts/ToastContext';
import { Breadcrumb } from '@/components/ui/Breadcrumb';
import { EmptyState, ErrorState, LoadingState, SkeletonRows, Spinner } from '@/components/ui/States';
import { AttendanceStatusBadge, MealCountStatusBadge, NotRecordedBadge } from '@/components/attendance/AttendanceBadges';
import { ClassDateBar } from '@/components/attendance/ClassDateBar';
import { MealSessionModal } from '@/components/attendance/MealSessionModal';
import { MealCorrectionModal } from '@/components/attendance/MealCorrectionModal';
import { DayLockAlert } from '@/components/attendance/DayLockAlert';
import { useAttendanceClasses, useClassAttendance } from '@/hooks/attendance/useAttendance';
import { correctMealAfterLock, saveClassAttendance } from '@/services/attendance/attendanceService';
import {
  ATTENDANCE_STATUS,
  ATTENDANCE_STATUS_SHORT,
  MEAL_SESSIONS,
  MEAL_SESSION_LABELS,
  allMeals,
  isAbsent,
} from '@/models/attendance/attendanceConstants';
import { validateClassAttendance } from '@/utils/attendance/attendanceValidation';
import { schoolToday } from '@/utils/attendance/attendanceTime';
import { attendanceCrumbs } from '@/utils/attendance/breadcrumbs';
import { formatDate, formatDateTime } from '@/utils/format';
import '@/styles/modules/attendance.css';

const STATUS_ORDER = [ATTENDANCE_STATUS.PRESENT, ATTENDANCE_STATUS.EXCUSED, ATTENDANCE_STATUS.UNEXCUSED];

const defaultMeals = (mealPlan) =>
  mealPlan?.mealsPerDay === 1 ? Object.fromEntries(MEAL_SESSIONS.map((s) => [s, s === mealPlan.defaultSession])) : allMeals(true);

const toDraft = (sheet) =>
  Object.fromEntries(
    (sheet?.children || []).map(({ child, record }) => [
      child.id,
      { childId: child.id, status: record?.status || '', meals: { ...allMeals(false), ...(record?.meals || {}) } },
    ]),
  );

export default function AttendancePage() {
  const { user } = useAuth();
  const toast = useToast();
  const [params, setParams] = useSearchParams();
  const today = schoolToday();
  const date = params.get('date') || today;
  const { classes, loading: loadingClasses, error: classError, reload: reloadClasses } = useAttendanceClasses({ own: true });
  const classId = params.get('classId') || classes[0]?.id || '';
  const [draft, setDraft] = useState({});
  const [dirty, setDirty] = useState(false);
  const { sheet, loading, error, reload } = useClassAttendance(classId, date, { live: !dirty });
  const [rowErrors, setRowErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const [mealFor, setMealFor] = useState(null);
  const [correctFor, setCorrectFor] = useState(null);

  useEffect(() => {
    setDraft(toDraft(sheet));
    setDirty(false);
    setRowErrors({});
  }, [sheet]);

  const setParam = (key, value) => {
    const next = new URLSearchParams(params);
    next.set(key, value);
    if (key === 'classId') next.set('date', date);
    setParams(next, { replace: true });
  };

  const editable = !!sheet && sheet.canRecord && sheet.schoolDay && !sheet.locked && sheet.date === sheet.today;
  const rows = sheet?.children || [];

  const update = (childId, patch) => {
    setDraft((d) => ({ ...d, [childId]: { ...d[childId], ...patch } }));
    setDirty(true);
    setRowErrors((e) => {
      const next = { ...e };
      delete next[childId];
      return next;
    });
  };

  const setStatus = (row, status) => {
    const current = draft[row.child.id];
    const meals = isAbsent(status)
      ? allMeals(false)
      : current.status && !isAbsent(current.status)
        ? current.meals
        : defaultMeals(row.mealPlan);
    update(row.child.id, { status, meals });
  };

  const markAllPresent = () => {
    rows.forEach((row) => {
      if (!draft[row.child.id]?.status) setStatus(row, ATTENDANCE_STATUS.PRESENT);
    });
  };

  // Live feedback while typing; the saved figures come from the server.
  const stats = useMemo(() => {
    const list = Object.values(draft);
    const by = (s) => list.filter((e) => e.status === s).length;
    return {
      total: list.length,
      present: by(ATTENDANCE_STATUS.PRESENT),
      excused: by(ATTENDANCE_STATUS.EXCUSED),
      unexcused: by(ATTENDANCE_STATUS.UNEXCUSED),
      missing: list.filter((e) => !e.status).length,
      meals: Object.fromEntries(MEAL_SESSIONS.map((s) => [s, list.filter((e) => e.meals?.[s]).length])),
    };
  }, [draft]);

  const save = async () => {
    const entries = Object.values(draft).filter((e) => e.status);
    if (entries.length === 0) {
      toast.warning('Chọn trạng thái điểm danh cho ít nhất một trẻ.');
      return;
    }
    const plans = Object.fromEntries(rows.filter((r) => r.mealPlan).map((r) => [r.child.id, r.mealPlan]));
    const errs = validateClassAttendance(entries, plans);
    setRowErrors(errs);
    if (Object.keys(errs).length) {
      toast.error('Kiểm tra các dòng được đánh dấu đỏ.', 'Chưa lưu được điểm danh');
      return;
    }
    setSaving(true);
    try {
      await saveClassAttendance({ classId, date, entries }, user);
      toast.success(
        stats.missing ? `Đã lưu. Còn ${stats.missing} trẻ chưa điểm danh.` : 'Đã lưu điểm danh và báo ăn của cả lớp.',
        'Lưu thành công',
      );
      setDirty(false);
      reload({ silent: true });
    } catch (err) {
      if (err.details) setRowErrors(err.details);
      toast.error(err.message, 'Không lưu được điểm danh');
    } finally {
      setSaving(false);
    }
  };

  const submitCorrection = async (form) => {
    try {
      await correctMealAfterLock({ childId: correctFor.child.id, date, ...form }, user);
      toast.success('Đã hủy suất ăn và thông báo cho bếp.', 'Đã điều chỉnh');
      setCorrectFor(null);
      reload({ silent: true });
    } catch (err) {
      toast.error(err.message, 'Không điều chỉnh được');
      throw err;
    }
  };

  const title = 'Điểm danh & báo ăn';
  if (loadingClasses) return <LoadingState />;

  return (
    <div className="page">
      <Breadcrumb items={attendanceCrumbs()} />
      <div className="page__head">
        <h1 className="page__title">{title}</h1>
        {sheet?.mealCountStatus && (
          <div className="mt-8">
            <MealCountStatusBadge status={sheet.mealCountStatus} />
          </div>
        )}
      </div>

      {classError ? (
        <ErrorState error={classError} onRetry={reloadClasses} />
      ) : classes.length === 0 ? (
        <div className="card">
          <EmptyState
            icon={ClipboardList}
            title="Bạn chưa được phân công lớp"
            description="Điểm danh chỉ dành cho giáo viên của lớp. Liên hệ Phó hiệu trưởng nếu phân công chưa đúng."
          />
        </div>
      ) : (
        <>
          <ClassDateBar
            classes={classes}
            classId={classId}
            onClassChange={(v) => setParam('classId', v)}
            date={date}
            maxDate={today}
            onDateChange={(v) => setParam('date', v)}
          >
            <div className="spacer" />
            <Link className="btn" to={`/attendance/meals?classId=${classId}`}>
              <Utensils size={16} /> Chọn bữa trẻ ăn 1 bữa
            </Link>
            <Link className="btn" to={`/attendance/summary?classId=${classId}`}>
              <BarChart3 size={16} /> Tổng hợp lớp
            </Link>
          </ClassDateBar>

          <DayLockAlert sheet={sheet} />

          {sheet && (
            <div className="dd-stats mb-16" aria-live="polite">
              <div className="dd-stat">
                <span className="dd-stat__value">{stats.total}</span>
                <span className="dd-stat__label">Sĩ số</span>
              </div>
              <div className="dd-stat dd-stat--green">
                <span className="dd-stat__value">{stats.present}</span>
                <span className="dd-stat__label">Có mặt</span>
              </div>
              <div className="dd-stat dd-stat--orange">
                <span className="dd-stat__value">{stats.excused}</span>
                <span className="dd-stat__label">Vắng có phép</span>
              </div>
              <div className="dd-stat dd-stat--red">
                <span className="dd-stat__value">{stats.unexcused}</span>
                <span className="dd-stat__label">Vắng không phép</span>
              </div>
              <div className="dd-stat dd-stat--gray">
                <span className="dd-stat__value">{stats.missing}</span>
                <span className="dd-stat__label">Chưa điểm danh</span>
              </div>
              {MEAL_SESSIONS.map((s) => (
                <div key={s} className="dd-stat dd-stat--blue">
                  <span className="dd-stat__value">{stats.meals[s]}</span>
                  <span className="dd-stat__label">Suất {MEAL_SESSION_LABELS[s].toLowerCase()}</span>
                </div>
              ))}
            </div>
          )}

          <div className="card">
            <div className="card__header">
              <div className="card__title">
                {sheet?.className || 'Danh sách trẻ'} · {formatDate(date)}
              </div>
              {editable && stats.missing > 0 && (
                <button className="btn btn--sm btn--outline-primary" onClick={markAllPresent}>
                  <CheckCheck size={15} /> Đánh dấu trẻ còn lại có mặt
                </button>
              )}
            </div>
            {error ? (
              <ErrorState error={error} onRetry={reload} />
            ) : (
              <div className="table-wrap dd-table-wrap">
                <table className="table">
                  <thead>
                    <tr>
                      <th className="center" style={{ width: 44 }}>
                        #
                      </th>
                      <th>Trẻ</th>
                      <th>Điểm danh</th>
                      {MEAL_SESSIONS.map((s) => (
                        <th key={s} className="center">
                          {MEAL_SESSION_LABELS[s]}
                        </th>
                      ))}
                      <th>Cập nhật</th>
                      <th className="center">Thao tác</th>
                    </tr>
                  </thead>
                  <tbody>
                    {loading || !sheet ? (
                      <SkeletonRows rows={5} cols={5 + MEAL_SESSIONS.length} />
                    ) : rows.length === 0 ? (
                      <tr>
                        <td colSpan={5 + MEAL_SESSIONS.length}>
                          <EmptyState title="Lớp chưa có trẻ" description="Trẻ được xếp vào lớp sẽ hiển thị tại đây." />
                        </td>
                      </tr>
                    ) : (
                      rows.map((row, i) => {
                        const entry = draft[row.child.id] || { status: '', meals: {} };
                        const errs = rowErrors[row.child.id];
                        const once = row.mealPlan?.mealsPerDay === 1;
                        const absent = !entry.status || isAbsent(entry.status);
                        const canCorrect =
                          sheet.canRecord &&
                          sheet.locked &&
                          sheet.date === sheet.today &&
                          row.record &&
                          MEAL_SESSIONS.some((s) => row.record.meals?.[s]);
                        return (
                          <tr key={row.child.id} className={errs ? 'dd-row--error' : ''}>
                            <td className="center muted">{i + 1}</td>
                            <td>
                              <div className="fw-600">{row.child.fullName}</div>
                              <div className="row row--wrap dd-tags">
                                <span className="text-xs muted">{row.child.code}</span>
                                {once && <span className="chip chip--teal">1 bữa/ngày</span>}
                                {row.child.allergies.length > 0 && (
                                  <span className="chip chip--red" title={`Dị ứng: ${row.child.allergies.join(', ')}`}>
                                    Suất thay thế
                                  </span>
                                )}
                              </div>
                            </td>
                            <td>
                              {editable ? (
                                <div className="dd-seg" role="radiogroup" aria-label={`Điểm danh ${row.child.fullName}`}>
                                  {STATUS_ORDER.map((s) => (
                                    <label
                                      key={s}
                                      className={`dd-seg__item dd-seg__item--${s.toLowerCase()} ${entry.status === s ? 'is-on' : ''}`}
                                    >
                                      <input
                                        type="radio"
                                        className="sr-only"
                                        name={`att-${row.child.id}`}
                                        checked={entry.status === s}
                                        onChange={() => setStatus(row, s)}
                                      />
                                      {ATTENDANCE_STATUS_SHORT[s]}
                                    </label>
                                  ))}
                                </div>
                              ) : row.record ? (
                                <AttendanceStatusBadge status={row.record.status} />
                              ) : (
                                <NotRecordedBadge />
                              )}
                              {errs?.status && <div className="field__error">{errs.status}</div>}
                            </td>
                            {MEAL_SESSIONS.map((s) => (
                              <td key={s} className="center">
                                {editable && !once ? (
                                  <input
                                    type="checkbox"
                                    className="dd-check"
                                    checked={!!entry.meals[s]}
                                    disabled={absent}
                                    onChange={(e) => update(row.child.id, { meals: { ...entry.meals, [s]: e.target.checked } })}
                                    aria-label={`${MEAL_SESSION_LABELS[s]} – ${row.child.fullName}`}
                                  />
                                ) : entry.meals[s] ? (
                                  <span className="chip chip--green">Ăn</span>
                                ) : (
                                  <span className="muted">—</span>
                                )}
                              </td>
                            ))}
                            <td className="text-xs muted nowrap">{row.record ? formatDateTime(row.record.recordedAt) : '—'}</td>
                            <td className="center nowrap">
                              {editable && once && (
                                <button className="btn btn--sm" disabled={absent} onClick={() => setMealFor(row)}>
                                  <Utensils size={15} /> Chọn bữa
                                </button>
                              )}
                              {canCorrect && (
                                <button className="btn btn--sm btn--ghost" onClick={() => setCorrectFor(row)}>
                                  <MinusCircle size={15} /> Hủy suất
                                </button>
                              )}
                              {errs?.meals && <div className="field__error">{errs.meals}</div>}
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          <div className="page-actions">
            <Link className="btn" to="/attendance/meal-handover">
              <UtensilsCrossed size={16} /> Nhận suất ăn
            </Link>
            {editable && (
              <button className="btn btn--primary btn--lg" onClick={save} disabled={saving || !dirty}>
                {saving ? <Spinner small /> : <Save size={18} />} Lưu điểm danh
              </button>
            )}
          </div>
        </>
      )}

      <MealSessionModal
        open={!!mealFor}
        child={mealFor?.child}
        mealPlan={mealFor?.mealPlan}
        entry={mealFor ? draft[mealFor.child.id] : null}
        onClose={() => setMealFor(null)}
        onApply={(meals) => {
          update(mealFor.child.id, { meals: { ...allMeals(false), ...meals } });
          setMealFor(null);
        }}
      />
      <MealCorrectionModal
        open={!!correctFor}
        child={correctFor?.child}
        record={correctFor?.record}
        onClose={() => setCorrectFor(null)}
        onSubmit={submitCorrection}
      />
    </div>
  );
}
