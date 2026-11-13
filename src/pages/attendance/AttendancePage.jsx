import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Save, Lock, HeartPulse, CheckCircle2, BarChart3, ArrowRight } from '@/components/ui/icons';
import { SearchSubmit } from '@/components/ui/SearchSubmit';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { AttendanceRowBadge } from '@/components/attendance/AttendanceBadges';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/contexts/ToastContext';
import { Breadcrumb } from '@/components/ui/Breadcrumb';
import { ConfirmationModal } from '@/components/ui/ConfirmationModal';
import { Modal } from '@/components/ui/Modal';
import { LeaveConfirmModal } from '@/components/ui/LeaveConfirmModal';
import { useLeaveGuard } from '@/hooks/useLeaveGuard';
import { EmptyState, ErrorState, LoadingState, SubmitOverlay } from '@/components/ui/States';
import { DailyHealthPanel } from '@/components/DailyHealthPanel';
import { saveReception } from '@/services/receptionService';
import { ClassDateBar } from '@/components/attendance/ClassDateBar';
import { DayLockAlert } from '@/components/attendance/DayLockAlert';
import { useAttendanceClasses, useAttendanceYear, useClassAttendance, useClassMealCount } from '@/hooks/attendance/useAttendance';
import { ClassMealCard } from '@/components/attendance/ClassMealCard';
import { getClassAttendance, getDayInfo, saveClassAttendance } from '@/services/attendance/attendanceService';
import { createAttendanceRefresh, leaveStateChanged, reconcileAttendanceDraft } from '@/utils/attendance/reconcileAttendance';
import { ATTENDANCE_STATUS, isAbsent } from '@/models/attendance/attendanceConstants';
import { schoolToday } from '@/utils/attendance/attendanceTime';
import { attendanceCrumbs } from '@/utils/attendance/breadcrumbs';
import { normalizeText, formatDate, formatDateTime } from '@/utils/format';
import { ChildAvatar } from '@/components/ChildAvatar';
import { flagTone, healthFlag, healthReminder } from '@/utils/attendance/healthFlag';
import '@/styles/modules/attendance.css';

// ATT-02: có mặt là ăn đủ các bữa của nhóm tuổi; số suất do BE tính từ trạng thái, GV chỉ ghi Có mặt / Vắng
const toDraft = (sheet) =>
  Object.fromEntries((sheet?.children || []).map(({ child, record }) => [child.id, { childId: child.id, status: record?.status || '' }]));
const NOTHING_UNSAVED = { attendance: false, health: false };
const changed = (entry, record) => !!entry?.status && entry.status !== (record?.status || '');

export default function AttendancePage() {
  const { user } = useAuth();
  const [params, setParams] = useSearchParams();
  const today = schoolToday();
  const { defaultDate } = useAttendanceYear();
  const date = params.get('date') || defaultDate;
  const { classes, loading, error, reload } = useAttendanceClasses({ own: true });
  // Lớp trên URL không thuộc năm đang chọn ở header ⇒ lớp đầu tiên của năm đó
  const paramClass = params.get('classId');
  const classId = classes.some((c) => c.id === paramClass) ? paramClass : classes[0]?.id || '';
  // unsaved: { attendance, health } — bản nháp điểm danh / ghi nhận sức khỏe chưa lưu
  const [unsaved, setUnsaved] = useState(NOTHING_UNSAVED);
  const [busy, setBusy] = useState(false);
  const [pending, setPending] = useState(null);
  const saveDraft = useRef(null);
  const dirty = unsaved.attendance || unsaved.health;
  // Rời màn (menu, link, Back, đóng tab) khi còn nháp ⇒ hỏi; "Lưu" chỉ lưu được điểm danh, nháp sức khỏe phải lưu ở khung bên phải
  const guard = useLeaveGuard({ when: dirty, onSave: () => saveDraft.current?.() ?? false });
  const changeFilter = (key, value) => {
    if (busy) return;
    const apply = () => {
      const next = new URLSearchParams(params);
      next.set(key, value);
      setUnsaved(NOTHING_UNSAVED);
      setParams(next, { replace: true });
    };
    if (dirty) setPending(() => apply);
    else apply();
  };
  return (
    <div className="page">
      <Breadcrumb items={attendanceCrumbs()} />
      <div className="page__head">
        <h1 className="page__title">Điểm danh & sức khỏe</h1>
      </div>
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
            {/* Điểm danh xong thì sang đánh giá cùng lớp, ngày (hỏi nếu còn thay đổi chưa lưu) */}
            <Link className="btn" to={`/assessment/daily?classId=${classId}&date=${date}`}>
              Tiếp: Đánh giá hằng ngày <ArrowRight size={16} />
            </Link>
          </ClassDateBar>
          <ReceptionWorkbench
            key={`${user.id}:${classId}:${date}`}
            classId={classId}
            date={date}
            user={user}
            onUnsaved={setUnsaved}
            onBusy={setBusy}
            saveRef={saveDraft}
          />
        </>
      )}
      <LeaveConfirmModal
        {...guard.modal}
        canSave={unsaved.attendance && !unsaved.health}
        message={
          unsaved.health
            ? 'Ghi nhận sức khỏe đang nhập chưa được lưu. Bấm Hủy để quay lại lưu ở khung sức khỏe; Không lưu thì các thay đổi bị bỏ.'
            : 'Điểm danh có thay đổi chưa lưu. Lưu trước khi rời trang hoặc bỏ các thay đổi.'
        }
      />
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

function ReceptionWorkbench({ classId, date, user, onUnsaved, onBusy, saveRef }) {
  const { year, yearReadOnly } = useAttendanceYear();
  const [search] = useSearchParams();
  const toast = useToast();
  const { sheet, setSheet, loading, error, reload } = useClassAttendance(classId, date, { live: false });
  const meal = useClassMealCount(classId, date);
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
  const [confirmAll, setConfirmAll] = useState(false);
  const [leaveFor, setLeaveFor] = useState(null);
  const initialized = useRef(false);
  const submitRef = useRef(false);
  const rows = useMemo(() => sheet?.children || [], [sheet]);
  const dirtyRows = rows.filter((row) => !row.leaveRequest && changed(draft[row.child.id], row.record));
  const busy = saving || healthBusy;
  const latest = useRef({});
  latest.current = { sheet, busy, user, toast };
  const reconciliation = useRef(null);
  useEffect(() => {
    onUnsaved({ attendance: dirtyRows.length > 0, health: healthDirty });
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
    // Mở từ màn khác (vd. Đón trẻ → "Xem sức khỏe") thì chọn sẵn trẻ đó
    const wanted = search.get('childId');
    setSelectedId(sheet.children.find((c) => c.child.id === wanted)?.child.id || sheet.children[0]?.child.id || '');
  }, [sheet, search]);
  useEffect(() => {
    const controller = createAttendanceRefresh({
      read: () => getClassAttendance(classId, date, latest.current.user),
      busy: () => !initialized.current || submitRef.current || latest.current.busy,
      apply: (fresh, savedIds) => {
        const previous = latest.current.sheet;
        setDraft((current) => reconcileAttendanceDraft(current, previous, fresh, savedIds));
        latest.current.sheet = fresh;
        setSheet(fresh);
        if (leaveStateChanged(previous, fresh)) {
          latest.current.toast.info('Đơn nghỉ đã thay đổi. Đã cập nhật trẻ liên quan; giữ các thay đổi chưa lưu của trẻ khác.');
        }
      },
    });
    reconciliation.current = controller;
    const refresh = () => {
      controller.refresh().catch(() => null);
    };
    const timer = setInterval(refresh, 30000);
    window.addEventListener('focus', refresh);
    return () => {
      controller.dispose();
      clearInterval(timer);
      window.removeEventListener('focus', refresh);
    };
  }, [classId, date, user?.id, setSheet]);
  useEffect(() => {
    let cancelled = false;
    const refresh = async () => {
      try {
        const info = await getDayInfo(date, classId, user);
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
  }, [date, classId, user]);
  const day = clock || sheet;
  useEffect(() => {
    if (!day?.unlock) return;
    const remaining = Date.parse(day.unlock.validUntil) - Date.parse(day.serverTime);
    const timer = setTimeout(() => setClock((current) => ({ ...(current || day), locked: true, unlock: null })), Math.max(0, remaining));
    return () => clearTimeout(timer);
  }, [day]);
  // Ngày cũ sửa được khi PHT đã mở lại riêng lớp cho ngày đó
  const editable = !!sheet?.canRecord && day?.schoolDay && !day.locked && (date === day.today || !!day.unlock);
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
    if (!editable || busy || row.leaveRequest) return;
    setDraft((current) => ({ ...current, [row.child.id]: { ...current[row.child.id], ...patch } }));
    setRowErrors((current) => ({ ...current, [row.child.id]: null }));
    selectChild(row.child.id);
  };
  const setStatus = (row, present) => {
    if (row.leaveRequest) return;
    update(row, { status: present ? ATTENDANCE_STATUS.PRESENT : ATTENDANCE_STATUS.UNEXCUSED });
  };
  const markAllPresent = () => {
    setConfirmAll(false);
    if (!editable || busy) return;
    setDraft((current) => {
      const next = { ...current };
      rows.forEach((row) => {
        if (current[row.child.id]?.status || row.record || row.leaveRequest) return;
        next[row.child.id] = { childId: row.child.id, status: ATTENDANCE_STATUS.PRESENT };
      });
      return next;
    });
    toast.info('Đã chọn Có mặt cho các trẻ chưa điểm danh. Kiểm tra lại trước khi bấm Lưu điểm danh.');
  };
  // Trả true khi lưu xong (hộp hỏi rời màn dùng để quyết định có chuyển trang không)
  const save = async () => {
    if (submitRef.current || !editable) return false;
    const entries = dirtyRows.map((row) => draft[row.child.id]);
    if (!entries.length) return true;
    reconciliation.current?.invalidate();
    submitRef.current = true;
    setSaving(true);
    setRowErrors({});
    try {
      await saveClassAttendance({ classId, date, entries }, user);
      const fresh = await reconciliation.current
        ?.refresh({ force: true, savedIds: entries.map((entry) => entry.childId) })
        .catch(() => null);
      if (!fresh) {
        setDraft((current) => ({ ...current, ...Object.fromEntries(entries.map((entry) => [entry.childId, entry])) }));
        setSheet((current) => ({
          ...current,
          children: current.children.map((row) => {
            const saved = entries.find((entry) => entry.childId === row.child.id);
            return saved ? { ...row, record: { ...row.record, ...saved } } : row;
          }),
        }));
      }
      toast.success('Đã lưu các thay đổi điểm danh.');
      // Số suất đổi theo điểm danh vừa lưu (BE tính lại)
      meal.reload({ silent: true });
      return true;
    } catch (err) {
      setRowErrors(err.details || {});
      toast.error(err, 'Chưa lưu được điểm danh');
      await reconciliation.current?.refresh({ force: true }).catch(() => null);
      const info = await getDayInfo(date, classId, user).catch(() => null);
      if (info) setClock(info);
      return false;
    } finally {
      submitRef.current = false;
      setSaving(false);
    }
  };
  saveRef.current = () => save();
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
    reconciliation.current?.invalidate();
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
      if (attendanceSaved) meal.reload({ silent: true });
      healthSaved = true;
      return result.health;
    } catch (err) {
      attendanceSaved = !!err.attendanceSaved;
      healthSaved = !!err.healthSaved;
      if (err.receptionStage === 'attendance') setRowErrors(err.details || {});
      if (err.receptionStage === 'attendance') await reconciliation.current?.refresh({ force: true }).catch(() => null);
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
        await reconciliation.current
          ?.refresh({ force: true, savedIds: attendanceSaved && needsAttendance ? [selectedId] : [] })
          .catch(() => null);
      }
      const info = await getDayInfo(date, classId, user).catch(() => null);
      if (info) setClock(info);
      submitRef.current = false;
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
          <button
            className="btn btn--sm"
            onClick={() => reconciliation.current?.refresh({ force: true }).catch(() => null)}
            disabled={busy}
          >
            Thử tải lại
          </button>
        </div>
      )}
      {/* Ngày đang mở: giờ khóa hiện ở chip "Đang mở" của bảng; chỉ báo khi không phải ngày học hoặc đã khóa */}
      {/* Năm chọn ở header đã kết thúc: sổ điểm danh chỉ xem, không mở lại được */}
      {yearReadOnly ? (
        <div className="alert alert--info mb-12" role="status">
          Năm học {year?.label || year?.id} đã kết thúc – chỉ xem điểm danh, báo ăn và sức khỏe.
        </div>
      ) : (
        (!sheet.schoolDay || day.locked || day.unlock) && <DayLockAlert sheet={{ ...sheet, ...day }} />
      )}
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
      <ClassMealCard data={meal.data} loading={meal.loading} error={meal.error} onRetry={meal.reload} />
      <div className="dd-reception">
        <section className="card dd-reception__list" aria-labelledby="attendance-list-heading">
          <div className="card__header">
            <h2 className="card__title" id="attendance-list-heading">
              Điểm danh & báo ăn
            </h2>
            <span
              title={
                day.locked
                  ? undefined
                  : day.unlock
                    ? `Được ${day.unlock.unlockedByName} mở lại đến ${formatDateTime(day.unlock.validUntil)}`
                    : `Điểm danh và báo ăn trước ${day.cutoff || sheet.cutoff} hôm nay. Sau giờ này dữ liệu bị khóa và sĩ số suất ăn được gửi Phó hiệu trưởng xác nhận.`
              }
            >
              <StatusBadge
                tone={day.locked ? 'gray' : 'blue'}
                icon={day.locked ? Lock : CheckCircle2}
                label={
                  day.locked
                    ? 'Đã khóa'
                    : day.unlock
                      ? `Mở lại đến ${formatDateTime(day.unlock.validUntil)}`
                      : `Đang mở (khóa lúc ${day.cutoff || sheet.cutoff})`
                }
              />
            </span>
          </div>
          <div className="dd-reception__filters">
            <SearchSubmit value={query} placeholder="Tìm tên hoặc mã trẻ" onSearch={setQuery} />
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
            <table className="table table--grid">
              <thead>
                <tr>
                  <th>Trẻ</th>
                  <th className="dd-reception__col-status">Điểm danh</th>
                </tr>
              </thead>
              <tbody>
                {!visibleRows.length ? (
                  <tr>
                    <td colSpan={2}>
                      <EmptyState
                        title={rows.length ? 'Không tìm thấy trẻ' : 'Lớp chưa có trẻ'}
                        description="Thử đổi bộ lọc hoặc tìm kiếm."
                      />
                    </td>
                  </tr>
                ) : (
                  visibleRows.map((row) => {
                    const entry = draft[row.child.id] || { status: '' };
                    const absent = isAbsent(entry.status);
                    const reminder = healthReminder(row);
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
                            <ChildAvatar child={row.child} size="sm" />
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
                              <span className="muted text-xs nowrap">{row.child.code}</span>
                              {/* Chỉ báo dòng cần chú ý; dòng đã lưu không gắn badge để danh sách đỡ rối */}
                              {(changed(entry, row.record) || !row.record) && (
                                <AttendanceRowBadge status={changed(entry, row.record) ? 'UNSAVED' : 'NONE'} />
                              )}
                              {healthFlag(row.healthSummary?.latest) && (
                                // Thẻ ngắn: thân nhiệt (màu theo mức) và/hoặc "Cần chú ý"; chi tiết ở tooltip và khung sức khỏe
                                <button
                                  className="dd-reception__flag"
                                  type="button"
                                  disabled={busy}
                                  title={healthFlag(row.healthSummary.latest, true)}
                                  aria-label={`${healthFlag(row.healthSummary.latest, true)}: ${row.child.fullName}. Mở sức khỏe`}
                                  onClick={() => selectChild(row.child.id)}
                                >
                                  <StatusBadge
                                    tone={flagTone(row.healthSummary.latest)}
                                    icon={HeartPulse}
                                    label={healthFlag(row.healthSummary.latest)}
                                  />
                                </button>
                              )}
                              {/* Nhắc bổ sung kiểm tra cho trẻ đã lưu Có mặt. */}
                              {reminder && (
                                <button
                                  className="dd-reception__flag"
                                  type="button"
                                  disabled={busy}
                                  title={reminder}
                                  aria-label={`${reminder}: ${row.child.fullName}. Mở sức khỏe`}
                                  onClick={() => selectChild(row.child.id)}
                                >
                                  <StatusBadge tone="orange" icon={HeartPulse} label={reminder} />
                                </button>
                              )}
                              {row.leaveRequest && (
                                <button
                                  className="dd-reception__flag dd-reception__flag--text"
                                  type="button"
                                  disabled={busy}
                                  onClick={() => setLeaveFor(row)}
                                >
                                  {entry.status === 'EXCUSED' ? 'Vắng có phép · Phụ huynh báo nghỉ' : 'Phụ huynh báo nghỉ'}
                                </button>
                              )}
                            </div>
                          </div>
                        </td>
                        <td>
                          {editable && !row.leaveRequest ? (
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
                            <AttendanceRowBadge status={entry.status === 'PRESENT' ? 'PRESENT' : absent ? 'ABSENT' : 'NONE'} />
                          )}
                          {rowErrors[row.child.id]?.status && <p className="field__error">{rowErrors[row.child.id].status}</p>}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
          <p className="muted text-xs dd-reception__note">
            Trẻ có mặt được tính suất đủ các bữa của nhóm tuổi; số suất do hệ thống tính từ điểm danh.
          </p>
          <div className="dd-reception__footer">
            {editable && (
              // Một nút lưu cho cả lớp; lưu riêng một trẻ kèm sức khỏe nằm ở khung bên phải
              <div className="dd-health__actions dd-reception__save">
                {!!sheet.receptionStats?.missing && <span className="muted">Còn {sheet.receptionStats.missing} trẻ chưa điểm danh</span>}
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
            <p className="muted text-sm">Phụ huynh cần hủy đơn trước giờ chốt để giáo viên điểm danh lại.</p>
          </>
        )}
      </Modal>
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
        message="Áp dụng cho toàn bộ lớp, kể cả trẻ ngoài bộ lọc hiện tại. Giữ nguyên các lựa chọn Có mặt/Vắng đã có. Đây chỉ là bản nháp, chưa lưu và chưa ghi nhận sức khỏe."
        confirmLabel="Chọn Có mặt"
        onClose={() => setConfirmAll(false)}
        onConfirm={markAllPresent}
      />
    </>
  );
}
