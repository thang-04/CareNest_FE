import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Search, Save, Lock, HeartPulse, CheckCircle2, BarChart3, Utensils } from '@/components/ui/icons';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/contexts/ToastContext';
import { Breadcrumb } from '@/components/ui/Breadcrumb';
import { ConfirmationModal } from '@/components/ui/ConfirmationModal';
import { EmptyState, ErrorState, LoadingState, SubmitOverlay } from '@/components/ui/States';
import { DailyHealthPanel } from '@/components/DailyHealthPanel';
import { MealCorrectionModal } from '@/components/attendance/MealCorrectionModal';
import { USE_MOCK } from '@/config/env';
import { saveReception } from '@/services/receptionService';
import { ClassDateBar } from '@/components/attendance/ClassDateBar';
import { DayLockAlert } from '@/components/attendance/DayLockAlert';
import { useAttendanceClasses, useClassAttendance } from '@/hooks/attendance/useAttendance';
import { getDayInfo, saveClassAttendance, correctMealAfterLock } from '@/services/attendance/attendanceService';
import { ATTENDANCE_STATUS, MEAL_SESSIONS, allMeals, isAbsent } from '@/models/attendance/attendanceConstants';
import { schoolToday } from '@/utils/attendance/attendanceTime';
import { attendanceCrumbs } from '@/utils/attendance/breadcrumbs';
import { initials, avatarTone, normalizeText } from '@/utils/format';
import '@/styles/modules/attendance.css';

const toDraft = (sheet) =>
  Object.fromEntries(
    (sheet?.children || []).map(({ child, record }) => [
      child.id,
      { childId: child.id, status: record?.status || '', meals: { ...allMeals(false), ...record?.meals } },
    ]),
  );
const mealsFor = (row) =>
  row.mealPlan?.mealsPerDay === 1
    ? Object.fromEntries(MEAL_SESSIONS.map((session) => [session, session === row.mealPlan.defaultSession]))
    : allMeals(true);
const changed = (entry, record) =>
  !!entry?.status &&
  (entry.status !== (record?.status || '') || MEAL_SESSIONS.some((session) => !!entry.meals[session] !== !!record?.meals?.[session]));

export default function AttendancePage() {
  const { user } = useAuth();
  const [params, setParams] = useSearchParams();
  const today = schoolToday();
  const date = params.get('date') || today;
  const { classes, loading, error, reload } = useAttendanceClasses({ own: true });
  const classId = params.get('classId') || classes[0]?.id || '';
  const [unsaved, setUnsaved] = useState(false);
  const [busy, setBusy] = useState(false);
  const [pending, setPending] = useState(null);
  useEffect(() => {
    const prevent = (event) => {
      if (unsaved) {
        event.preventDefault();
        event.returnValue = '';
      }
    };
    window.addEventListener('beforeunload', prevent);
    return () => window.removeEventListener('beforeunload', prevent);
  }, [unsaved]);
  const changeFilter = (key, value) => {
    if (busy) return;
    const apply = () => {
      const next = new URLSearchParams(params);
      next.set(key, value);
      setUnsaved(false);
      setParams(next, { replace: true });
    };
    if (unsaved) setPending(() => apply);
    else apply();
  };
  return (
    <div className="page">
      <Breadcrumb items={attendanceCrumbs()} />
      <div className="page__head">
        <h1 className="page__title">Điểm danh & sức khỏe</h1>
        <p className="muted">Tiếp nhận từng trẻ và theo dõi sức khỏe trong ngày.</p>
      </div>
      {USE_MOCK && (
        <div className="alert alert--info mb-12">
          <HeartPulse size={18} />
          <div>Dữ liệu demo · Điểm danh và sức khỏe lưu riêng trên trình duyệt, chưa kết nối backend.</div>
        </div>
      )}
      {loading ? (
        <LoadingState />
      ) : error ? (
        <ErrorState error={error} onRetry={reload} />
      ) : !classes.length ? (
        <div className="card">
          <EmptyState title="Bạn chưa được phân công lớp" description="Liên hệ Phó hiệu trưởng để kiểm tra phân công." />
        </div>
      ) : (
        <>
          <ClassDateBar
            classes={classes}
            classId={classId}
            date={date}
            maxDate={today}
            onClassChange={(value) => changeFilter('classId', value)}
            onDateChange={(value) => changeFilter('date', value)}
          >
            <div className="spacer" />
            <Link className="btn" to={`/attendance/summary?classId=${classId}`}>
              <BarChart3 size={16} /> Tổng hợp lớp
            </Link>
          </ClassDateBar>
          <ReceptionWorkbench
            key={`${user.id}:${classId}:${date}`}
            classId={classId}
            date={date}
            user={user}
            onUnsaved={setUnsaved}
            onBusy={setBusy}
          />
        </>
      )}
      <ConfirmationModal
        open={!!pending}
        title="Đổi lớp hoặc ngày?"
        message="Các thay đổi chưa lưu sẽ bị bỏ."
        confirmLabel="Bỏ thay đổi và chuyển"
        onClose={() => setPending(null)}
        onConfirm={() => {
          pending?.();
          setPending(null);
        }}
      />
    </div>
  );
}

function ReceptionWorkbench({ classId, date, user, onUnsaved, onBusy }) {
  const toast = useToast();
  const { sheet, setSheet, loading, error, reload } = useClassAttendance(classId, date, { live: false });
  const [draft, setDraft] = useState({});
  const [selectedId, setSelectedId] = useState('');
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState('ALL');
  const [saving, setSaving] = useState(false);
  const [healthBusy, setHealthBusy] = useState(false);
  const [healthDirty, setHealthDirty] = useState(false);
  const [pendingId, setPendingId] = useState(null);
  const [rowErrors, setRowErrors] = useState({});
  const [clock, setClock] = useState(null);
  const [correctFor, setCorrectFor] = useState(null);
  const [confirmAll, setConfirmAll] = useState(false);
  const initialized = useRef(false);
  const submitRef = useRef(false);
  const rows = useMemo(() => sheet?.children || [], [sheet]);
  const dirtyRows = rows.filter((row) => changed(draft[row.child.id], row.record));
  const busy = saving || healthBusy;
  useEffect(() => {
    onUnsaved(healthDirty || dirtyRows.length > 0);
  }, [healthDirty, dirtyRows.length, onUnsaved]);
  useEffect(() => {
    onBusy(busy);
    return () => onBusy(false);
  }, [busy, onBusy]);
  const reportDirty = useCallback((value) => setHealthDirty(value), []);
  const reportBusy = useCallback((value) => setHealthBusy(value), []);
  useEffect(() => {
    if (!sheet || initialized.current) return;
    initialized.current = true;
    setDraft(toDraft(sheet));
    setSelectedId(sheet.children[0]?.child.id || '');
  }, [sheet]);
  useEffect(() => {
    let cancelled = false;
    const refresh = async () => {
      try {
        const info = await getDayInfo(date);
        if (!cancelled) setClock(info);
      } catch {
        /* Repository chặn lưu nếu giờ khóa thay đổi khi đang nhập. */
      }
    };
    refresh();
    const timer = setInterval(refresh, 30000);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [date]);
  const day = clock || sheet;
  const editable = !!sheet?.canRecord && day?.schoolDay && !day.locked && date === day.today;
  const selected = rows.find((row) => row.child.id === selectedId);
  const visibleRows = rows.filter((row) => {
    const entry = draft[row.child.id];
    return (
      normalizeText(`${row.child.fullName} ${row.child.code}`).includes(normalizeText(query)) &&
      (filter === 'ALL' ||
        (filter === 'MISSING' ? !entry?.status : filter === 'PRESENT' ? entry?.status === 'PRESENT' : isAbsent(entry?.status)))
    );
  });
  const selectChild = (id) => {
    if (busy || id === selectedId) return;
    if (healthDirty) setPendingId(id);
    else setSelectedId(id);
  };
  const update = (row, patch) => {
    if (!editable || busy) return;
    setDraft((current) => ({ ...current, [row.child.id]: { ...current[row.child.id], ...patch } }));
    setRowErrors((current) => ({ ...current, [row.child.id]: null }));
    selectChild(row.child.id);
  };
  const setStatus = (row, present) => {
    const current = draft[row.child.id];
    const status = present ? ATTENDANCE_STATUS.PRESENT : isAbsent(current?.status) ? current.status : ATTENDANCE_STATUS.UNEXCUSED;
    update(row, { status, meals: present ? (current?.status === 'PRESENT' ? current.meals : mealsFor(row)) : allMeals(false) });
  };
  const markAllPresent = () => {
    setConfirmAll(false);
    if (!editable || busy) return;
    setDraft((current) => {
      const next = { ...current };
      rows.forEach((row) => {
        if (current[row.child.id]?.status) return;
        next[row.child.id] = { childId: row.child.id, status: ATTENDANCE_STATUS.PRESENT, meals: mealsFor(row) };
      });
      return next;
    });
    toast.info('Đã chọn Có mặt cho các trẻ chưa điểm danh. Kiểm tra lại trước khi bấm Lưu điểm danh.');
  };
  const save = async (singleId) => {
    if (submitRef.current || !editable) return;
    const entries = dirtyRows.filter((row) => !singleId || row.child.id === singleId).map((row) => draft[row.child.id]);
    if (!entries.length) return;
    submitRef.current = true;
    setSaving(true);
    setRowErrors({});
    try {
      await saveClassAttendance({ classId, date, entries }, user);
      const fresh = await reload({ silent: true });
      if (fresh) {
        const saved = toDraft(fresh);
        setDraft((current) => ({ ...current, ...Object.fromEntries(entries.map((entry) => [entry.childId, saved[entry.childId]])) }));
      }
      toast.success(singleId ? 'Đã lưu điểm danh của trẻ. Có thể ghi nhận sức khỏe bên phải.' : 'Đã lưu các thay đổi điểm danh và báo ăn.');
    } catch (err) {
      setRowErrors(err.details || {});
      toast.error(err.message, 'Chưa lưu được điểm danh');
      const info = await getDayInfo(date).catch(() => null);
      if (info) setClock(info);
    } finally {
      submitRef.current = false;
      setSaving(false);
    }
  };
  const nextChild = () => {
    const index = rows.findIndex((row) => row.child.id === selectedId);
    const next = rows.slice(index + 1).find((row) => !row.record) || rows[index + 1];
    setHealthDirty(false);
    if (next) setSelectedId(next.child.id);
    else toast.info('Đã đến cuối danh sách. Bạn có thể chọn trẻ khác để tiếp tục.');
  };
  const saveSelectedReception = async (health) => {
    if (submitRef.current) throw new Error('Đang lưu điểm danh, vui lòng chờ.');
    const entry = draft[selectedId];
    const needsAttendance = changed(entry, selected?.record);
    if (needsAttendance && !editable) throw new Error('Điểm danh đã khóa. Bản nháp chưa lưu không thể ghi nhận sức khỏe.');
    submitRef.current = true;
    let attendanceSaved = false;
    setRowErrors({});
    try {
      const result = await saveReception(
        {
          attendance: needsAttendance ? { classId, date, entries: [entry] } : null,
          health,
        },
        user,
      );
      attendanceSaved = result.attendanceSaved;
      return result.health;
    } catch (err) {
      attendanceSaved = !!err.attendanceSaved;
      if (err.receptionStage === 'attendance') setRowErrors(err.details || {});
      throw err;
    } finally {
      if (attendanceSaved && needsAttendance) {
        // Chỉ cập nhật trẻ vừa lưu, không làm mất bản nháp của các trẻ còn lại.
        setSheet((current) => ({
          ...current,
          children: current.children.map((row) => (row.child.id === selectedId ? { ...row, record: { ...row.record, ...entry } } : row)),
        }));
        setDraft((current) => ({ ...current, [selectedId]: entry }));
        const fresh = await reload({ silent: true });
        if (fresh) setDraft((current) => ({ ...current, [selectedId]: toDraft(fresh)[selectedId] }));
      }
      const info = await getDayInfo(date).catch(() => null);
      if (info) setClock(info);
      submitRef.current = false;
    }
  };
  const submitCorrection = async (form) => {
    setSaving(true);
    try {
      await correctMealAfterLock({ childId: correctFor.child.id, date, ...form }, user);
      const fresh = await reload({ silent: true });
      if (fresh) setDraft(toDraft(fresh));
      setCorrectFor(null);
      toast.success('Đã hủy suất ăn và thông báo cho bếp.');
    } catch (err) {
      toast.error(err.message, 'Không điều chỉnh được');
      throw err;
    } finally {
      setSaving(false);
    }
  };
  if (loading || !initialized.current) {
    if (error) return <ErrorState error={error} onRetry={reload} />;
    return <LoadingState />;
  }
  return (
    <>
      {error && (
        <div className="alert alert--danger mb-12" role="alert">
          Chưa làm mới được danh sách: {error.message}. Bản nháp sức khỏe vẫn được giữ.
          <button className="btn btn--sm" onClick={() => reload({ silent: true })} disabled={busy}>
            Thử tải lại
          </button>
        </div>
      )}
      <DayLockAlert sheet={{ ...sheet, ...day }} />
      <div className="dd-reception__summary" aria-live="polite">
        <span className="chip chip--blue">Sĩ số: {sheet.receptionStats?.total ?? rows.length}</span>
        <span className="chip chip--green">Có mặt đã lưu: {sheet.receptionStats?.present ?? '—'}</span>
        <span className="chip chip--gray">Vắng đã lưu: {sheet.receptionStats?.absent ?? '—'}</span>
        <span className="chip chip--gray">Chưa điểm danh: {sheet.receptionStats?.missing ?? '—'}</span>
        {!!dirtyRows.length && <span className="chip chip--orange">{dirtyRows.length} trẻ có thay đổi chưa lưu</span>}
      </div>
      <div className="dd-reception">
        <section className="card dd-reception__list" aria-labelledby="attendance-list-heading">
          <div className="card__header">
            <h2 className="card__title" id="attendance-list-heading">
              Điểm danh & báo ăn
            </h2>
            <span className={`chip ${day.locked ? 'chip--gray' : 'chip--blue'}`}>
              {day.locked ? <Lock size={14} /> : <ClockIcon />} {day.locked ? 'Đã khóa' : 'Đang mở'}
            </span>
          </div>
          <div className="dd-reception__filters">
            <label className="search-box">
              <Search size={16} />
              <span className="sr-only">Tìm tên hoặc mã trẻ</span>
              <input className="input" value={query} placeholder="Tìm tên hoặc mã trẻ" onChange={(event) => setQuery(event.target.value)} />
            </label>
            <label>
              <span className="sr-only">Lọc điểm danh</span>
              <select className="select" value={filter} onChange={(event) => setFilter(event.target.value)}>
                <option value="ALL">Tất cả</option>
                <option value="MISSING">Chưa điểm danh</option>
                <option value="PRESENT">Có mặt</option>
                <option value="ABSENT">Vắng</option>
              </select>
            </label>
            {editable && (
              <button
                className="btn dd-reception__mark-all"
                type="button"
                title="Chỉ chọn trẻ chưa điểm danh; giữ nguyên trẻ Vắng. Chưa tự lưu."
                disabled={busy || !rows.some((row) => !draft[row.child.id]?.status)}
                onClick={() => setConfirmAll(true)}
              >
                <CheckCircle2 size={16} /> Có mặt tất cả
              </button>
            )}
          </div>
          <div className="table-wrap dd-reception__table">
            <table className="table">
              <thead>
                <tr>
                  <th>Trẻ</th>
                  <th>Điểm danh</th>
                  <th className="center">Tham gia ăn</th>
                </tr>
              </thead>
              <tbody>
                {!visibleRows.length ? (
                  <tr>
                    <td colSpan={3}>
                      <EmptyState
                        title={rows.length ? 'Không tìm thấy trẻ' : 'Lớp chưa có trẻ'}
                        description="Thử đổi bộ lọc hoặc tìm kiếm."
                      />
                    </td>
                  </tr>
                ) : (
                  visibleRows.map((row) => {
                    const entry = draft[row.child.id] || { status: '', meals: {} };
                    const absent = isAbsent(entry.status);
                    return (
                      <tr
                        key={row.child.id}
                        className={`dd-reception__row ${selectedId === row.child.id ? 'dd-reception__row--selected' : ''}`}
                        onClick={() => selectChild(row.child.id)}
                      >
                        <td>
                          <button
                            className="dd-reception__child"
                            type="button"
                            disabled={busy}
                            aria-pressed={selectedId === row.child.id}
                            onClick={() => selectChild(row.child.id)}
                          >
                            <span className={`avatar avatar--sm avatar--tone-${avatarTone(row.child.fullName)}`} aria-hidden="true">
                              {initials(row.child.fullName)}
                            </span>
                            <span>
                              <strong>{row.child.fullName}</strong>
                              <span className="muted text-xs">{row.child.code}</span>
                              <span className="text-xs">
                                {changed(entry, row.record) ? 'Chưa lưu' : row.record ? 'Đã lưu' : 'Chưa điểm danh'}
                              </span>
                            </span>
                          </button>
                        </td>
                        <td>
                          {editable ? (
                            <div className="dd-seg dd-reception__status" role="radiogroup" aria-label={`Điểm danh ${row.child.fullName}`}>
                              {[true, false].map((present) => (
                                <label
                                  key={String(present)}
                                  className={`dd-seg__item dd-seg__item--${present ? 'present' : 'absent'} ${(present ? entry.status === 'PRESENT' : absent) ? 'is-on' : ''}`}
                                >
                                  <input
                                    type="radio"
                                    className="sr-only"
                                    name={`attendance-${row.child.id}`}
                                    checked={present ? entry.status === 'PRESENT' : absent}
                                    disabled={busy}
                                    onChange={() => setStatus(row, present)}
                                  />
                                  {present ? 'Có mặt' : 'Vắng'}
                                </label>
                              ))}
                            </div>
                          ) : (
                            <span className={`chip ${entry.status === 'PRESENT' ? 'chip--green' : 'chip--gray'}`}>
                              {entry.status === 'PRESENT' ? 'Có mặt' : absent ? 'Vắng' : 'Chưa điểm danh'}
                            </span>
                          )}
                          {rowErrors[row.child.id]?.status && <p className="field__error">{rowErrors[row.child.id].status}</p>}
                        </td>
                        <td className="center">
                          {editable ? (
                            <label className="dd-reception__meal">
                              <input
                                type="checkbox"
                                role="switch"
                                className="dd-check"
                                aria-label={`Tham gia ăn: ${row.child.fullName}`}
                                disabled={busy || entry.status !== 'PRESENT'}
                                checked={MEAL_SESSIONS.some((session) => entry.meals[session])}
                                onChange={(event) => update(row, { meals: event.target.checked ? mealsFor(row) : allMeals(false) })}
                              />
                              <span className="text-xs">{MEAL_SESSIONS.some((session) => entry.meals[session]) ? 'Có' : 'Không'}</span>
                            </label>
                          ) : (
                            <span>{MEAL_SESSIONS.some((session) => entry.meals[session]) ? 'Có' : '—'}</span>
                          )}
                          {sheet.canRecord &&
                            day.locked &&
                            date === day.today &&
                            row.record?.status === 'PRESENT' &&
                            MEAL_SESSIONS.some((session) => row.record.meals?.[session]) && (
                              <button className="btn btn--sm btn--ghost" disabled={busy} onClick={() => setCorrectFor(row)}>
                                Hủy suất
                              </button>
                            )}
                          {rowErrors[row.child.id]?.meals && <p className="field__error">{rowErrors[row.child.id].meals}</p>}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
          <div className="dd-reception__footer">
            <p className="muted text-sm">
              <HeartPulse size={16} /> Chọn trẻ để kiểm tra sức khỏe bên phải.
            </p>
            {editable && (
              <div className="dd-health__actions">
                <button
                  className="btn"
                  disabled={busy || !selected || !changed(draft[selectedId], selected.record)}
                  onClick={() => save(selectedId)}
                >
                  <CheckCircle2 size={16} /> Lưu trẻ đang chọn
                </button>
                <button className="btn btn--primary" disabled={busy || !dirtyRows.length} onClick={() => save()}>
                  <Save size={16} /> Lưu điểm danh
                </button>
              </div>
            )}
            {saving && <SubmitOverlay state="sending" />}
          </div>
        </section>
        {selected ? (
          <DailyHealthPanel
            key={selectedId}
            child={selected.child}
            classId={classId}
            className={sheet.className}
            date={date}
            user={user}
            presentSaved={selected.record?.status === 'PRESENT' && draft[selectedId]?.status === 'PRESENT'}
            presentDraft={draft[selectedId]?.status === 'PRESENT'}
            canDraft={editable}
            attendanceDirty={changed(draft[selectedId], selected.record)}
            parentBusy={saving}
            onSave={saveSelectedReception}
            onDirty={reportDirty}
            onBusy={reportBusy}
            onNext={nextChild}
          />
        ) : (
          <section className="card">
            <EmptyState title="Chọn trẻ trong danh sách" description="Ghi nhận và xem lịch sử sức khỏe của trẻ tại đây." />
          </section>
        )}
      </div>
      <div className="mt-16">
        <Link className="btn" to="/attendance/meal-handover">
          <Utensils size={16} /> Nhận suất ăn
        </Link>
      </div>
      <ConfirmationModal
        open={pendingId !== null}
        title="Chuyển sang trẻ khác?"
        message="Ghi nhận sức khỏe đang nhập chưa được lưu."
        confirmLabel="Bỏ thay đổi và chuyển"
        onClose={() => setPendingId(null)}
        onConfirm={() => {
          setSelectedId(pendingId);
          setHealthDirty(false);
          setPendingId(null);
        }}
      />
      <ConfirmationModal
        open={confirmAll}
        title="Chọn Có mặt cho tất cả trẻ chưa điểm danh?"
        message="Áp dụng cho toàn bộ lớp, kể cả trẻ ngoài bộ lọc hiện tại. Giữ nguyên các lựa chọn Có mặt/Vắng đã có; bật tham gia ăn theo đăng ký của từng trẻ. Đây chỉ là bản nháp, chưa lưu và chưa ghi nhận sức khỏe."
        confirmLabel="Chọn Có mặt"
        onClose={() => setConfirmAll(false)}
        onConfirm={markAllPresent}
      />
      <MealCorrectionModal
        open={!!correctFor}
        child={correctFor?.child}
        record={correctFor?.record}
        onClose={() => {
          if (!saving) setCorrectFor(null);
        }}
        onSubmit={submitCorrection}
      />
    </>
  );
}

function ClockIcon() {
  return <CheckCircle2 size={14} />;
}
