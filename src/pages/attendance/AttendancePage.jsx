import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Search, Save, Lock, HeartPulse, CheckCircle2, BarChart3 } from '@/components/ui/icons';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/contexts/ToastContext';
import { Breadcrumb } from '@/components/ui/Breadcrumb';
import { ConfirmationModal } from '@/components/ui/ConfirmationModal';
import { Modal } from '@/components/ui/Modal';
import { EmptyState, ErrorState, LoadingState, SubmitOverlay } from '@/components/ui/States';
import { DailyHealthPanel } from '@/components/DailyHealthPanel';
import { MealCorrectionModal } from '@/components/attendance/MealCorrectionModal';
import { USE_MOCK } from '@/config/env';
import { saveReception } from '@/services/receptionService';
import { ClassDateBar } from '@/components/attendance/ClassDateBar';
import { DayLockAlert } from '@/components/attendance/DayLockAlert';
import { useAttendanceClasses, useClassAttendance } from '@/hooks/attendance/useAttendance';
import { getDayInfo, saveClassAttendance, correctMealAfterLock } from '@/services/attendance/attendanceService';
import { ATTENDANCE_STATUS, DEFAULT_MEAL_SESSIONS, allMeals, eatsAny, isAbsent, mealsIn } from '@/models/attendance/attendanceConstants';
import { schoolToday } from '@/utils/attendance/attendanceTime';
import { attendanceCrumbs } from '@/utils/attendance/breadcrumbs';
import { normalizeText, formatDate } from '@/utils/format';
import { ChildAvatar } from '@/components/ChildAvatar';
import { formatTemperature, symptomLabels } from '@/utils/dailyHealthValidation';
import { temperatureLevel } from '@/utils/attendance/temperatureLevels';
import '@/styles/modules/attendance.css';

// Bữa của lớp = bữa Hiệu trưởng cấu hình cho nhóm tuổi; Có mặt mặc định ăn đủ các bữa đó
const sessionsOf = (sheet) => sheet?.mealSessions || DEFAULT_MEAL_SESSIONS;
const toDraft = (sheet) =>
  Object.fromEntries(
    (sheet?.children || []).map(({ child, record }) => [
      child.id,
      { childId: child.id, status: record?.status || '', meals: mealsIn(record?.meals, sessionsOf(sheet)) },
    ]),
  );
const changed = (entry, record, sessions) =>
  !!entry?.status &&
  (entry.status !== (record?.status || '') || sessions.some((session) => !!entry.meals[session] !== !!record?.meals?.[session]));

/**
 * Thẻ trên dòng trẻ (một thẻ ngắn): "38 °C · Cần chú ý" / "Cần chú ý" / "38 °C"; không có lần ghi nhận thì không hiện.
 * full = nội dung đầy đủ cho tooltip (mức, biểu hiện, ghi chú); chi tiết xem ở khung sức khỏe bên phải.
 */
const healthFlag = (latest, full = false) => {
  if (!latest) return '';
  const noted = latest.observation === 'NOTED';
  const level = temperatureLevel(latest.temperature);
  const temp = Number.isFinite(latest.temperature) ? formatTemperature(latest.temperature) : '';
  if (!full) return [temp, noted ? 'Cần chú ý' : ''].filter(Boolean).join(' · ');
  const parts = noted ? ['Cần chú ý'] : [];
  if (temp) parts.push(`${temp}${level?.chip ? ` ${level.label}` : ''}`);
  const signs = symptomLabels(latest.symptoms);
  if (signs) parts.push(signs);
  if (latest.note) parts.push(latest.note);
  return parts.join(' · ');
};

/** Màu thẻ: theo mức thân nhiệt; có dấu hiệu mà thân nhiệt bình thường / thấp / chưa đo thì đỏ; không dấu hiệu, bình thường thì xám. */
const flagChip = (latest) => {
  const level = temperatureLevel(latest?.temperature);
  if (level?.chip && level.key !== 'LOW') return level.chip;
  if (latest?.observation === 'NOTED') return 'chip--red';
  return level?.chip || 'chip--gray';
};

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
  // Lớp đông: trẻ đang chọn (vd. sau "Lưu & trẻ tiếp theo") luôn nằm trong khung nhìn của bảng
  useEffect(() => {
    if (!selectedId) return;
    document.querySelector(`.dd-reception__table tr[data-child="${selectedId}"]`)?.scrollIntoView({ block: 'nearest' });
  }, [selectedId]);
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
  const [leaveFor, setLeaveFor] = useState(null);
  const [confirmArrival, setConfirmArrival] = useState(null);
  const initialized = useRef(false);
  const submitRef = useRef(false);
  const rows = useMemo(() => sheet?.children || [], [sheet]);
  const sessions = sessionsOf(sheet);
  const allIn = allMeals(true, sessions);
  const noneIn = allMeals(false, sessions);
  const dirtyRows = rows.filter((row) => changed(draft[row.child.id], row.record, sessions));
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
        (filter === 'NOTED'
          ? row.healthSummary?.flagged
          : filter === 'MISSING'
            ? !entry?.status
            : filter === 'PRESENT'
              ? entry?.status === 'PRESENT'
              : isAbsent(entry?.status)))
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
  const setStatus = (row, present, confirmed = false) => {
    const current = draft[row.child.id];
    if (present && row.leaveRequest && current?.status !== 'PRESENT' && !confirmed) {
      setConfirmArrival(row);
      return;
    }
    const status = present
      ? ATTENDANCE_STATUS.PRESENT
      : row.leaveRequest
        ? ATTENDANCE_STATUS.EXCUSED
        : isAbsent(current?.status)
          ? current.status
          : ATTENDANCE_STATUS.UNEXCUSED;
    update(row, {
      status,
      meals: present ? (current?.status === 'PRESENT' ? current.meals : allIn) : noneIn,
      confirmedLeaveRequestId: present && row.leaveRequest ? row.leaveRequest.id : null,
    });
  };
  const markAllPresent = () => {
    setConfirmAll(false);
    if (!editable || busy) return;
    setDraft((current) => {
      const next = { ...current };
      rows.forEach((row) => {
        if (current[row.child.id]?.status || row.record || row.leaveRequest) return;
        next[row.child.id] = { childId: row.child.id, status: ATTENDANCE_STATUS.PRESENT, meals: allIn };
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
    const needsAttendance = changed(entry, selected?.record, sessions);
    if (needsAttendance && !editable) throw new Error('Điểm danh đã khóa. Bản nháp chưa lưu không thể ghi nhận sức khỏe.');
    submitRef.current = true;
    let attendanceSaved = false;
    let healthSaved = false;
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
      healthSaved = true;
      return result.health;
    } catch (err) {
      attendanceSaved = !!err.attendanceSaved;
      healthSaved = !!err.healthSaved;
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
      }
      if ((attendanceSaved && needsAttendance) || healthSaved) {
        const fresh = await reload({ silent: true });
        if (fresh && attendanceSaved && needsAttendance) setDraft((current) => ({ ...current, [selectedId]: toDraft(fresh)[selectedId] }));
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
      {/* Ngày đang mở: giờ khóa hiện ở chip "Đang mở" của bảng; chỉ báo khi không phải ngày học hoặc đã khóa */}
      {(!sheet.schoolDay || day.locked) && <DayLockAlert sheet={{ ...sheet, ...day }} />}
      <div className="dd-reception__summary" aria-live="polite">
        <span className="chip chip--blue">Sĩ số: {sheet.receptionStats?.total ?? rows.length}</span>
        <span className="chip chip--green">Có mặt đã lưu: {sheet.receptionStats?.present ?? '—'}</span>
        <span className="chip chip--gray">Vắng đã lưu: {sheet.receptionStats?.absent ?? '—'}</span>
        {sheet.receptionStats?.missing ? (
          // Bấm để lọc nhanh trẻ chưa điểm danh (lớp đông)
          <button className="btn btn--sm btn--ghost" type="button" onClick={() => setFilter('MISSING')}>
            <span className="chip chip--gray">Chưa điểm danh: {sheet.receptionStats.missing}</span>
          </button>
        ) : (
          <span className="chip chip--gray">Chưa điểm danh: {sheet.receptionStats?.missing ?? '—'}</span>
        )}
        {!!sheet.receptionStats?.noted && (
          <button className="btn btn--sm btn--ghost" type="button" onClick={() => setFilter('NOTED')}>
            <span className="chip chip--red">
              <HeartPulse size={14} /> Có dấu hiệu cần lưu ý: {sheet.receptionStats.noted}
            </span>
          </button>
        )}
        {!!dirtyRows.length && <span className="chip chip--orange">{dirtyRows.length} trẻ có thay đổi chưa lưu</span>}
      </div>
      <div className="dd-reception">
        <section className="card dd-reception__list" aria-labelledby="attendance-list-heading">
          <div className="card__header">
            <h2 className="card__title" id="attendance-list-heading">
              Điểm danh & báo ăn
            </h2>
            <span
              className={`chip ${day.locked ? 'chip--gray' : 'chip--blue'}`}
              title={
                day.locked
                  ? undefined
                  : `Điểm danh và báo ăn trước ${day.cutoff || sheet.cutoff} hôm nay. Sau giờ này dữ liệu bị khóa và sĩ số suất ăn được gửi Phó hiệu trưởng xác nhận.`
              }
            >
              {day.locked ? <Lock size={14} /> : <ClockIcon />}{' '}
              {day.locked ? 'Đã khóa' : `Đang mở (khóa lúc ${day.cutoff || sheet.cutoff})`}
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
                <option value="NOTED">Có dấu hiệu cần lưu ý</option>
              </select>
            </label>
            {editable && (
              <button
                className="btn dd-reception__mark-all"
                type="button"
                title="Chỉ chọn trẻ chưa điểm danh; giữ nguyên trẻ Vắng. Chưa tự lưu."
                disabled={busy || !rows.some((row) => !draft[row.child.id]?.status && !row.record && !row.leaveRequest)}
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
                  <th className="dd-reception__col-status">Điểm danh</th>
                  <th className="center dd-reception__col-meal">Tham gia ăn</th>
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
                        data-child={row.child.id}
                        className={`dd-reception__row ${selectedId === row.child.id ? 'dd-reception__row--selected' : ''}`}
                        onClick={() => selectChild(row.child.id)}
                      >
                        <td>
                          {/* Ảnh | tên trên, mã · trạng thái lưu và thẻ sức khỏe cùng một dòng dưới — hàng thấp, lớp đông vẫn thấy nhiều trẻ */}
                          <div className="dd-reception__who">
                            <ChildAvatar child={row.child} />
                            <button
                              className="dd-reception__child"
                              type="button"
                              disabled={busy}
                              aria-pressed={selectedId === row.child.id}
                              onClick={() => selectChild(row.child.id)}
                            >
                              <strong>{row.child.fullName}</strong>
                            </button>
                            <div className="dd-reception__tags">
                              <span className="muted text-xs nowrap">
                                {row.child.code} ·{' '}
                                {changed(entry, row.record, sessions) ? 'Chưa lưu' : row.record ? 'Đã lưu' : 'Chưa điểm danh'}
                              </span>
                              {healthFlag(row.healthSummary?.latest) && (
                                // Thẻ ngắn: thân nhiệt (màu theo mức) và/hoặc "Cần chú ý"; chi tiết ở tooltip và khung sức khỏe
                                <button
                                  className="btn btn--sm btn--ghost dd-reception__flag"
                                  type="button"
                                  disabled={busy}
                                  title={healthFlag(row.healthSummary.latest, true)}
                                  aria-label={`${healthFlag(row.healthSummary.latest, true)}: ${row.child.fullName}. Mở sức khỏe`}
                                  onClick={() => selectChild(row.child.id)}
                                >
                                  <span className={`chip ${flagChip(row.healthSummary.latest)}`}>
                                    {healthFlag(row.healthSummary.latest)}
                                  </span>
                                </button>
                              )}
                              {entry.status === 'PRESENT' && row.record?.status === 'PRESENT' && row.healthSummary?.reminder && (
                                <button
                                  className="btn btn--sm btn--ghost dd-reception__flag"
                                  type="button"
                                  disabled={busy}
                                  title={row.healthSummary.reminder}
                                  aria-label={`${row.healthSummary.reminder}: ${row.child.fullName}. Mở sức khỏe`}
                                  onClick={() => selectChild(row.child.id)}
                                >
                                  <span className="chip chip--orange">
                                    <HeartPulse size={14} /> {row.healthSummary.reminder}
                                  </span>
                                </button>
                              )}
                              {row.leaveRequest && (
                                <button className="btn btn--sm btn--ghost" type="button" disabled={busy} onClick={() => setLeaveFor(row)}>
                                  {entry.status === 'EXCUSED' ? 'Vắng có phép · Phụ huynh báo nghỉ' : 'Phụ huynh báo nghỉ'}
                                </button>
                              )}
                            </div>
                          </div>
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
                          <div className="dd-reception__mealcell">
                            {editable ? (
                              <label className="dd-reception__meal">
                                <input
                                  type="checkbox"
                                  role="switch"
                                  className="dd-check"
                                  aria-label={`Tham gia ăn: ${row.child.fullName}`}
                                  disabled={busy || entry.status !== 'PRESENT'}
                                  checked={eatsAny(entry.meals, sessions)}
                                  onChange={(event) => update(row, { meals: event.target.checked ? allIn : noneIn })}
                                />
                                <span className="text-xs">{eatsAny(entry.meals, sessions) ? 'Có' : 'Không'}</span>
                              </label>
                            ) : (
                              <span>{eatsAny(entry.meals, sessions) ? 'Có' : '—'}</span>
                            )}
                            {sheet.canRecord &&
                              day.locked &&
                              date === day.today &&
                              row.record?.status === 'PRESENT' &&
                              eatsAny(row.record.meals, sessions) && (
                                <button className="btn btn--sm btn--ghost" disabled={busy} onClick={() => setCorrectFor(row)}>
                                  Hủy suất
                                </button>
                              )}
                          </div>
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
            {editable && (
              <div className="dd-health__actions">
                <button
                  className="btn"
                  disabled={busy || !selected || !changed(draft[selectedId], selected.record, sessions)}
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
            attendanceDirty={changed(draft[selectedId], selected.record, sessions)}
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
      <Modal
        open={!!leaveFor}
        title="Thông tin báo nghỉ"
        size="sm"
        onClose={() => setLeaveFor(null)}
        footer={
          <button className="btn" type="button" onClick={() => setLeaveFor(null)}>
            Đóng
          </button>
        }
      >
        {leaveFor && (
          <>
            <p>
              <strong>{leaveFor.child.fullName}</strong>
            </p>
            <p>
              {formatDate(leaveFor.leaveRequest.fromDate)} – {formatDate(leaveFor.leaveRequest.toDate)}
            </p>
            <p>{leaveFor.leaveRequest.reason || 'Không có ghi chú.'}</p>
            <p className="muted text-sm">Báo nghỉ đã gửi, không cần duyệt.</p>
          </>
        )}
      </Modal>
      <ConfirmationModal
        open={!!confirmArrival}
        title="Trẻ vẫn đến lớp?"
        message={
          confirmArrival
            ? `${confirmArrival.child.fullName} đã có báo nghỉ từ phụ huynh. Chỉ đổi sang Có mặt khi trẻ thực tế đến lớp. Tham gia ăn được bật đủ các bữa của nhóm tuổi; kiểm tra lại trước khi lưu.`
            : ''
        }
        confirmLabel="Xác nhận trẻ có mặt"
        onClose={() => setConfirmArrival(null)}
        onConfirm={() => {
          if (confirmArrival) setStatus(confirmArrival, true, true);
          setConfirmArrival(null);
        }}
      />
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
        message="Áp dụng cho toàn bộ lớp, kể cả trẻ ngoài bộ lọc hiện tại. Giữ nguyên các lựa chọn Có mặt/Vắng đã có; bật tham gia ăn đủ các bữa của nhóm tuổi. Đây chỉ là bản nháp, chưa lưu và chưa ghi nhận sức khỏe."
        confirmLabel="Chọn Có mặt"
        onClose={() => setConfirmAll(false)}
        onConfirm={markAllPresent}
      />
      <MealCorrectionModal
        open={!!correctFor}
        child={correctFor?.child}
        record={correctFor?.record}
        sessions={sessions}
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
