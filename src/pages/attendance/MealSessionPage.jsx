import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { ArrowLeft, Save, Utensils, ClipboardList } from '@/components/ui/icons';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/contexts/ToastContext';
import { Breadcrumb } from '@/components/ui/Breadcrumb';
import { EmptyState, ErrorState, LoadingState, SkeletonRows, Spinner } from '@/components/ui/States';
import { AttendanceStatusBadge, NotRecordedBadge } from '@/components/attendance/AttendanceBadges';
import { ClassDateBar } from '@/components/attendance/ClassDateBar';
import { DayLockAlert } from '@/components/attendance/DayLockAlert';
import { useAttendanceClasses, useClassAttendance } from '@/hooks/attendance/useAttendance';
import { saveClassAttendance } from '@/services/attendance/attendanceService';
import { ATTENDANCE_STATUS, MEAL_SESSIONS, MEAL_SESSION_LABELS, allMeals } from '@/models/attendance/attendanceConstants';
import { validateClassAttendance } from '@/utils/attendance/attendanceValidation';
import { schoolToday } from '@/utils/attendance/attendanceTime';
import { attendanceCrumbs } from '@/utils/attendance/breadcrumbs';
import { formatDate } from '@/utils/format';
import '@/styles/modules/attendance.css';

const NONE = 'NONE';
const selectedOf = (meals) => MEAL_SESSIONS.find((s) => meals?.[s]) || NONE;

/** #65 Meal Session Selection (UC 6.14) for the children who eat once a day, for today. */
export default function MealSessionPage() {
  const { user } = useAuth();
  const toast = useToast();
  const [params, setParams] = useSearchParams();
  const today = schoolToday();
  const { classes, loading: loadingClasses, error: classError, reload: reloadClasses } = useAttendanceClasses({ own: true });
  const classId = params.get('classId') || classes[0]?.id || '';
  const [choice, setChoice] = useState({});
  const [dirty, setDirty] = useState(false);
  const { sheet, loading, error, reload } = useClassAttendance(classId, today, { live: !dirty });
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);

  const rows = (sheet?.children || []).filter((r) => r.mealPlan?.mealsPerDay === 1);

  useEffect(() => {
    setChoice(Object.fromEntries((sheet?.children || []).map((r) => [r.child.id, selectedOf(r.record?.meals)])));
    setDirty(false);
    setErrors({});
  }, [sheet]);

  const editable = !!sheet && sheet.canRecord && sheet.schoolDay && !sheet.locked;

  const save = async () => {
    const entries = rows
      .filter((r) => r.record?.status === ATTENDANCE_STATUS.PRESENT)
      .map((r) => ({
        childId: r.child.id,
        status: r.record.status,
        meals: { ...allMeals(false), ...(choice[r.child.id] !== NONE ? { [choice[r.child.id]]: true } : {}) },
      }));
    if (!entries.length) return;
    const errs = validateClassAttendance(entries, Object.fromEntries(rows.map((r) => [r.child.id, r.mealPlan])));
    setErrors(errs);
    if (Object.keys(errs).length) return;
    setSaving(true);
    try {
      await saveClassAttendance({ classId, date: today, entries }, user);
      toast.success('Đã lưu bữa ăn của trẻ ăn 1 bữa/ngày.', 'Lưu thành công');
      setDirty(false);
      reload({ silent: true });
    } catch (err) {
      if (err.details) setErrors(err.details);
      toast.error(err.message, 'Không lưu được bữa ăn');
    } finally {
      setSaving(false);
    }
  };

  if (loadingClasses) return <LoadingState />;

  return (
    <div className="page">
      <Breadcrumb items={attendanceCrumbs('Chọn bữa ăn')} />
      <h1 className="page__title">Chọn bữa ăn cho trẻ ăn 1 bữa/ngày</h1>
      {classError ? (
        <ErrorState error={classError} onRetry={reloadClasses} />
      ) : classes.length === 0 ? (
        <div className="card">
          <EmptyState icon={ClipboardList} title="Bạn chưa được phân công lớp" description="Chỉ giáo viên của lớp chọn bữa ăn cho trẻ." />
        </div>
      ) : (
        <>
          <ClassDateBar classes={classes} classId={classId} onClassChange={(v) => setParams({ classId: v }, { replace: true })} />
          <DayLockAlert sheet={sheet} />
          <div className="card">
            <div className="card__header">
              <div className="card__title">
                {sheet?.className || 'Lớp'} · {formatDate(today)}
              </div>
            </div>
            {error ? (
              <ErrorState error={error} onRetry={reload} />
            ) : (
              <div className="table-wrap dd-table-wrap">
                <table className="table">
                  <thead>
                    <tr>
                      <th>Trẻ</th>
                      <th>Điểm danh hôm nay</th>
                      <th>Bữa ăn hôm nay</th>
                    </tr>
                  </thead>
                  <tbody>
                    {loading || !sheet ? (
                      <SkeletonRows rows={3} cols={3} />
                    ) : rows.length === 0 ? (
                      <tr>
                        <td colSpan={3}>
                          <EmptyState
                            icon={Utensils}
                            title="Lớp không có trẻ ăn 1 bữa/ngày"
                            description="Các trẻ còn lại được báo ăn trên màn hình điểm danh."
                          />
                        </td>
                      </tr>
                    ) : (
                      rows.map((r) => {
                        const present = r.record?.status === ATTENDANCE_STATUS.PRESENT;
                        const err = errors[r.child.id]?.meals;
                        return (
                          <tr key={r.child.id} className={err ? 'dd-row--error' : ''}>
                            <td>
                              <div className="fw-600">{r.child.fullName}</div>
                              <div className="text-xs muted">{r.mealPlan.note || '1 bữa/ngày'}</div>
                            </td>
                            <td>{r.record ? <AttendanceStatusBadge status={r.record.status} /> : <NotRecordedBadge />}</td>
                            <td>
                              {!present ? (
                                <span className="muted text-sm">
                                  {r.record ? 'Trẻ vắng – không báo ăn' : 'Điểm danh trẻ trước khi chọn bữa'}
                                </span>
                              ) : editable ? (
                                <div className="dd-seg" role="radiogroup" aria-label={`Bữa ăn của ${r.child.fullName}`}>
                                  {[...MEAL_SESSIONS, NONE].map((s) => (
                                    <label key={s} className={`dd-seg__item ${choice[r.child.id] === s ? 'is-on' : ''}`}>
                                      <input
                                        type="radio"
                                        className="sr-only"
                                        name={`meal-${r.child.id}`}
                                        checked={choice[r.child.id] === s}
                                        onChange={() => {
                                          setChoice({ ...choice, [r.child.id]: s });
                                          setDirty(true);
                                        }}
                                      />
                                      {s === NONE ? 'Không ăn' : MEAL_SESSION_LABELS[s]}
                                    </label>
                                  ))}
                                </div>
                              ) : (
                                <span className="text-sm">
                                  {choice[r.child.id] === NONE ? 'Không ăn' : MEAL_SESSION_LABELS[choice[r.child.id]]}
                                </span>
                              )}
                              {err && <div className="field__error">{err}</div>}
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
            <Link className="btn" to={`/attendance?classId=${classId}`}>
              <ArrowLeft size={16} /> Quay lại điểm danh
            </Link>
            {editable && rows.length > 0 && (
              <button className="btn btn--primary btn--lg" onClick={save} disabled={saving || !dirty}>
                {saving ? <Spinner small /> : <Save size={18} />} Lưu bữa ăn
              </button>
            )}
          </div>
        </>
      )}
    </div>
  );
}
