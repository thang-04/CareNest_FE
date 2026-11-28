import { childNameWithHistory } from '@/utils/childHistory';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Save, Lock, HeartPulse, CheckCircle2, BarChart3, ArrowRight, AlertTriangle } from '@/components/ui/icons';
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
import { Button } from '@/components/ui/Button';
import { RadioGroup, SelectField } from '@/components';
import {
  correctMealParticipation,
  getClassAttendance,
  getDayInfo,
  markArrived,
  saveClassAttendance,
} from '@/services/attendance/attendanceService';
import {
  createAttendanceRefresh,
  leaveStateChanged,
  mealSessionsOf,
  reconcileAttendanceDraft,
} from '@/utils/attendance/reconcileAttendance';
import {
  ATTENDANCE_STATUS,
  LEAVE_PART,
  LEAVE_PART_TAGS,
  MEAL_SESSION,
  MEAL_SESSION_LABELS,
  MORNING_LEAVE_STATUS_LABELS,
  allMeals,
  eatsAny,
  isAbsent,
  mealsIn,
  mealsWhenPresent,
  sessionsAfterLeave,
} from '@/models/attendance/attendanceConstants';
import { schoolToday } from '@/utils/attendance/attendanceTime';
import { validateClassAttendance } from '@/utils/attendance/attendanceValidation';
import { attendanceCrumbs } from '@/utils/attendance/breadcrumbs';
import { normalizeText, formatDate, formatDateTime } from '@/utils/format';
import { ChildAvatar } from '@/components/ChildAvatar';
import { flagTone, healthFlag, healthReminder } from '@/utils/attendance/healthFlag';
import { readableClassDate } from '@/utils/historyDate';
import { TransferredHistoryPanel } from '@/components/TransferredHistoryPanel';
import { hasBePermission } from '@/utils/bePermissions';
import { PERMISSIONS } from '@/models/bePermissions';
import '@/styles/modules/attendance.css';
import { MealChoiceSelect } from '@/components/attendance/MealChoiceSelect';
import { mealChoiceOf, mealChoiceOptions } from '@/utils/attendance/mealChoice';
import { useDevClockMarks } from '@/hooks/useDevClockMarks';
import { dayTimeAt } from '@/utils/devClock';

// Bữa của lớp = bữa Hiệu trưởng cấu hình cho nhóm tuổi; Có mặt mặc định ăn đủ, giáo viên chọn bữa trẻ ăn.
const sessionsOf = (sheet) => mealSessionsOf(sheet);
const toDraft = (sheet) =>
  Object.fromEntries(
    (sheet?.children || []).map(({ child, record }) => [
      child.id,
      {
        childId: child.id,
        status: record?.status || '',
        meals: mealsIn(record?.meals, sessionsOf(sheet)),
        absentPart: record?.absentPart || undefined,
      },
    ]),
  );
const mealText = (meals, sessions) => mealChoiceOptions(sessions).find((option) => option.value === mealChoiceOf(meals, sessions))?.label;
const NOTHING_UNSAVED = { attendance: false, health: false };
// ATT-12, ATT-13: đơn nghỉ một buổi; trẻ nghỉ chiều GV vẫn điểm danh buổi sáng
const leavePart = (row) => (row.leaveRequest ? row.leaveRequest.part || LEAVE_PART.FULL_DAY : null);
const halfPart = (row) =>
  !row.leaveRequest?.noticeOnly && leavePart(row) && leavePart(row) !== LEAVE_PART.FULL_DAY ? leavePart(row) : undefined;
const isMorningUnexcused = (row) => row.record?.status === ATTENDANCE_STATUS.UNEXCUSED && !row.record?.absentPart;
const hasMorningAbsence = (row) => halfPart(row) === LEAVE_PART.MORNING || row.record?.absentPart === LEAVE_PART.MORNING;
const morningArrivalLabel = (row) => {
  if (row.record?.absentPartUnexcused) {
    return row.record.status === ATTENDANCE_STATUS.PRESENT ? 'Sáng vắng không phép · chiều có mặt' : 'Sáng vắng không phép · chưa đến';
  }
  return MORNING_LEAVE_STATUS_LABELS[row.record?.status] || 'Nghỉ sáng (có phép)';
};
// Trong khung nhận trẻ chiều của hôm nay, hoặc khi BGH đã mở lại ngày để sửa (GV quên bấm đúng giờ)
const canMarkArrived = (sheet, day, date) =>
  sheet.canRecord &&
  (!!day.unlock ||
    (date === day.today &&
      day.baseLocked &&
      day.now >= (sheet.afternoonStart || '13:30') &&
      day.now < (sheet.latestAfternoonArrival || '14:00')));
// ATT-08 (user chốt 26/11/2026): ngày mở lại, trẻ Có mặt chọn buổi trong một lần bấm
const PRESENT_PARTS = [
  { value: LEAVE_PART.FULL_DAY, label: 'Cả ngày' },
  { value: LEAVE_PART.MORNING, label: 'Chỉ sáng' },
  { value: LEAVE_PART.AFTERNOON, label: 'Chỉ chiều' },
];
// Buổi vắng ứng với buổi có mặt: chỉ sáng ⇒ vắng chiều, chỉ chiều ⇒ vắng sáng
const absentHalfOf = (presentPart) =>
  presentPart === LEAVE_PART.MORNING ? LEAVE_PART.AFTERNOON : presentPart === LEAVE_PART.AFTERNOON ? LEAVE_PART.MORNING : undefined;
const recordPresentPart = (record) =>
  record?.absentPart === LEAVE_PART.MORNING
    ? LEAVE_PART.AFTERNOON
    : record?.absentPart === LEAVE_PART.AFTERNOON
      ? LEAVE_PART.MORNING
      : LEAVE_PART.FULL_DAY;
const changed = (entry, record, sessions) =>
  !!entry?.status &&
  (entry.status !== (record?.status || '') ||
    (!!entry.presentPart && entry.presentPart !== recordPresentPart(record)) ||
    sessions.some((session) => !!entry.meals?.[session] !== !!record?.meals?.[session]));

export default function AttendancePage() {
  const { user } = useAuth();
  const [params, setParams] = useSearchParams();
  const today = schoolToday();
  const { defaultDate } = useAttendanceYear();
  const { classes, loading, error, reload } = useAttendanceClasses({ own: true });
  // Lớp trên URL không thuộc năm đang chọn ở header ⇒ lớp đầu tiên của năm đó
  const paramClass = params.get('classId');
  const classId = classes.some((c) => c.id === paramClass) ? paramClass : classes[0]?.id || '';
  const selectedClass = classes.find((c) => c.id === classId);
  const date = readableClassDate(selectedClass, params.get('date')) || defaultDate;
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
      if (key === 'classId') {
        const pickedClass = classes.find((c) => c.id === value);
        if (pickedClass?.historicalReadOnly && pickedClass.lastReadableDate) next.set('date', pickedClass.lastReadableDate);
        // Từ lớp lịch sử sang lớp đang dạy: bỏ ngày cũ, mở ngày mặc định
        else if (selectedClass?.historicalReadOnly) next.delete('date');
      }
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
          {/* Trẻ chuyển đến: điểm danh, sức khỏe ở lớp cũ trong ngày (chỉ xem), cần quyền xem đánh giá */}
          {hasBePermission(user, PERMISSIONS.ASSESSMENT_VIEW) && (
            <TransferredHistoryPanel classId={classId} range={{ from: date, to: date }} date={date} sections={['attendance']} />
          )}
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
  const sessions = sessionsOf(sheet);
  const noneIn = allMeals(false, sessions);
  // Trẻ nghỉ sáng khi lớp/ngày chưa được mở lại: điểm danh theo đơn, GV chỉ đổi công tắc ăn bữa xế
  const reopened = !!(clock || sheet)?.unlock;
  // Đơn cả ngày (user chốt 26/11/2026): trẻ vẫn đến lớp thì GV ghi Có mặt ngay, kể cả trước giờ chốt; không khóa
  const leaveLocked = (row) => !!row.leaveRequest && !row.leaveRequest.noticeOnly && leavePart(row) === LEAVE_PART.MORNING && !reopened;
  // ATT-13: trẻ nghỉ sáng — trước giờ chốt GV vẫn gạt được công tắc ăn bữa xế (mặc định theo đơn), trạng thái giữ theo đơn
  const xeOnly = (row) => halfPart(row) === LEAVE_PART.MORNING && !reopened && !!row.record;
  // Bữa còn lại của trẻ nghỉ một buổi; mặc định ăn theo công tắc ăn của đơn
  const rowSessions = (row) =>
    sessionsAfterLeave(draft[row.child.id]?.presentPart ? absentHalfOf(draft[row.child.id].presentPart) : halfPart(row), sessions);
  // Sửa sau giờ chốt theo bản ghi đã lưu: buổi vắng không được chọn bữa
  const correctableSessions = (row) => sessionsAfterLeave(row.record?.absentPart, sessions);
  // Thẻ suất ăn đã trả trạng thái theo từng bữa. Khóa sớm ở UI để cô không
  // bấm nhầm; backend vẫn kiểm tra lại cả xác nhận và chữ ký phiếu bếp.
  const hasConfirmedMeal = (row) =>
    rowSessions(row).some((session) => meal.data?.meals?.some((count) => count.session === session && count.status === 'CONFIRMED'));
  const presentMeals = (row) => ({
    ...noneIn,
    ...(row.leaveRequest?.eats === false ? {} : mealsWhenPresent(row.child, rowSessions(row))),
  });
  const dirtyRows = rows.filter((row) => (!leaveLocked(row) || xeOnly(row)) && changed(draft[row.child.id], row.record, sessions));
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
  useDevClockMarks(
    [
      day?.cutoff && { label: `Chốt điểm danh & báo ăn ${formatDate(date)}`, at: dayTimeAt(date, day.cutoff) },
      day?.unlock?.validUntil && { label: 'Hết hạn mở lại điểm danh', at: day.unlock.validUntil },
    ].filter(Boolean),
  );
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
    if (!editable || busy || (leaveLocked(row) && !xeOnly(row))) return;
    setDraft((current) => ({ ...current, [row.child.id]: { ...current[row.child.id], ...patch } }));
    setRowErrors((current) => ({ ...current, [row.child.id]: null }));
    selectChild(row.child.id);
  };
  const setStatus = (row, present) => {
    if (leaveLocked(row)) return;
    const current = draft[row.child.id];
    // Trẻ có đơn nghỉ cả ngày chọn Vắng ⇒ trở lại Vắng có phép theo đơn
    const absentStatus =
      leavePart(row) === LEAVE_PART.FULL_DAY && !row.leaveRequest?.noticeOnly ? ATTENDANCE_STATUS.EXCUSED : ATTENDANCE_STATUS.UNEXCUSED;
    update(row, {
      status: present ? ATTENDANCE_STATUS.PRESENT : absentStatus,
      presentPart: undefined,
      meals: present ? (current?.status === ATTENDANCE_STATUS.PRESENT ? current.meals : presentMeals(row)) : noneIn,
    });
  };
  // Ngày mở lại: Có mặt Cả ngày / Chỉ sáng / Chỉ chiều; bữa mặc định theo buổi có mặt
  const setPart = (row, part) => {
    if (leaveLocked(row)) return;
    const current = draft[row.child.id];
    update(row, {
      status: ATTENDANCE_STATUS.PRESENT,
      presentPart: part,
      // Ngày đã mở lại chỉ sửa chuyên cần; suất ăn đã chốt giữ nguyên.
      meals: current?.meals || noneIn,
    });
  };
  // Sau giờ chốt chỉ được sửa nhầm công tắc ăn của hôm nay. API kiểm tra lại
  // sổ suất ăn chưa xác nhận và phiếu bếp chưa ký, nên không thể lách bằng UI.
  const correctMeal = async (row, meals) => {
    if (submitRef.current || date !== day?.today || !day?.baseLocked) return;
    submitRef.current = true;
    setSaving(true);
    try {
      const participates = eatsAny(meals, sessions);
      await correctMealParticipation({ classId, childId: row.child.id, date, participates, meals }, user);
      await reconciliation.current?.refresh({ force: true, savedIds: [row.child.id] });
      meal.reload({ silent: true });
      toast.success(`Đã cập nhật tham gia ăn cho ${row.child.fullName}.`);
    } catch (err) {
      toast.error(err, 'Chưa cập nhật được suất ăn');
    } finally {
      submitRef.current = false;
      setSaving(false);
    }
  };
  // ATT-13: trẻ nghỉ sáng đến lớp buổi chiều — GV bấm "Đã đến" (từ giờ chốt tới giờ đến muộn nhất, BE kiểm)
  const arrived = async (row) => {
    if (submitRef.current) return;
    submitRef.current = true;
    setSaving(true);
    try {
      await markArrived({ classId, childId: row.child.id, date }, user);
      toast.success(`Đã ghi ${row.child.fullName} đến lớp buổi chiều.`);
      await reconciliation.current?.refresh({ force: true, savedIds: [row.child.id] }).catch(() => null);
    } catch (err) {
      toast.error(err, 'Chưa ghi được Đã đến');
    } finally {
      submitRef.current = false;
      setSaving(false);
    }
  };
  const markAllPresent = () => {
    setConfirmAll(false);
    if (!editable || busy) return;
    setDraft((current) => {
      const next = { ...current };
      rows.forEach((row) => {
        if (current[row.child.id]?.status || row.record || leaveLocked(row)) return;
        next[row.child.id] = { childId: row.child.id, status: ATTENDANCE_STATUS.PRESENT, meals: presentMeals(row) };
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
    // Báo đỏ ngay dưới dòng trẻ (bữa không thuộc nhóm tuổi, trẻ vắng mà còn bật ăn) trước khi gửi BE
    const invalid = validateClassAttendance(entries, { sessions });
    if (Object.keys(invalid).length) {
      setRowErrors(invalid);
      return false;
    }
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
    const needsAttendance = changed(entry, selected?.record, sessions);
    if (needsAttendance && !editable) throw new Error('Điểm danh đã khóa. Bản nháp chưa lưu không thể ghi nhận sức khỏe.');
    const invalid = needsAttendance ? validateClassAttendance([entry], { sessions }) : {};
    if (Object.keys(invalid).length) {
      setRowErrors(invalid);
      throw new Error('Điểm danh của trẻ chưa hợp lệ. Kiểm tra dòng được đánh dấu.');
    }
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
                disabled={busy || !rows.some((row) => !draft[row.child.id]?.status && !row.record && !leaveLocked(row))}
                onClick={() => setConfirmAll(true)}
              >
                <CheckCircle2 size={16} /> Có mặt tất cả
              </button>
            )}
          </div>
          <div className="table-wrap dd-reception__table">
            <table className="table table--grid dd-roll">
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
                            {/* Tên và nhãn báo ăn / dị ứng cùng hàng; dòng dưới là mã, trạng thái lưu, sức khỏe */}
                            <span className="dd-reception__nameline">
                              <button
                                className="dd-reception__child"
                                type="button"
                                disabled={busy}
                                aria-pressed={selectedId === row.child.id}
                                onClick={() => selectChild(row.child.id)}
                              >
                                <strong>{childNameWithHistory(row.child.fullName, row.child.historyStatus)}</strong>
                              </button>
                              {/* CHD-13: trẻ không báo ăn ghi ở ô Trẻ; trẻ có ăn mà có dị ứng thì nhắc để GV biết suất thay thế */}
                              {row.child.mealRegistered === false ? (
                                <span className="dd-reception__mealtag">
                                  <StatusBadge tone="gray" label="Không báo ăn" />
                                </span>
                              ) : (
                                (row.child.hasAllergy || row.child.allergies?.length > 0) && (
                                  <span
                                    className="dd-reception__mealtag"
                                    title={row.child.allergies?.length ? `Dị ứng: ${row.child.allergies.join(', ')}` : 'Có dị ứng'}
                                  >
                                    <StatusBadge
                                      tone="orange"
                                      icon={AlertTriangle}
                                      label={row.child.allergies?.length ? `Dị ứng: ${row.child.allergies.join(', ')}` : 'Có dị ứng'}
                                    />
                                  </span>
                                )
                              )}
                            </span>
                            <div className="dd-reception__tags">
                              <span className="muted text-xs nowrap">{row.child.code}</span>
                              {/* Chỉ báo dòng cần chú ý; dòng đã lưu không gắn badge để danh sách đỡ rối */}
                              {(changed(entry, row.record, sessions) || !row.record) && (
                                <AttendanceRowBadge status={changed(entry, row.record, sessions) ? 'UNSAVED' : 'NONE'} />
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
                                  {row.leaveRequest.noticeOnly
                                    ? 'Báo nghỉ chiều sau giờ chốt'
                                    : halfPart(row)
                                      ? LEAVE_PART_TAGS[halfPart(row)]
                                      : entry.status === 'EXCUSED'
                                        ? 'Vắng có phép · Phụ huynh báo nghỉ'
                                        : row.record?.status === ATTENDANCE_STATUS.PRESENT
                                          ? 'Đến dù có đơn nghỉ'
                                          : 'Phụ huynh báo nghỉ'}
                                </button>
                              )}
                            </div>
                          </div>
                        </td>
                        <td>
                          {editable && !leaveLocked(row) ? (
                            <>
                              {reopened ? (
                                <SelectField
                                  className="select dd-reception__status-select"
                                  value={
                                    !entry.status
                                      ? ''
                                      : entry.status === 'PRESENT'
                                        ? entry.presentPart ||
                                          (row.record?.status === 'PRESENT' ? recordPresentPart(row.record) : LEAVE_PART.FULL_DAY)
                                        : 'ABSENT'
                                  }
                                  options={[
                                    ...PRESENT_PARTS.map((part) => ({
                                      value: part.value,
                                      label: `Có mặt · ${part.label}`,
                                    })),
                                    {
                                      value: 'ABSENT',
                                      label:
                                        leavePart(row) === LEAVE_PART.FULL_DAY && !row.leaveRequest?.noticeOnly ? 'Nghỉ có phép' : 'Vắng',
                                    },
                                  ]}
                                  onChange={(event) => {
                                    const part = event.target.value;
                                    if (part === 'ABSENT') setStatus(row, false);
                                    else setPart(row, part);
                                  }}
                                  disabled={busy}
                                  aria-label={`Điểm danh ${row.child.fullName}`}
                                />
                              ) : (
                                <RadioGroup
                                  name={`attendance-${row.child.id}`}
                                  value={entry.status === 'PRESENT' ? 'PRESENT' : 'ABSENT'}
                                  options={[
                                    { value: 'PRESENT', label: 'Có mặt', className: 'dd-seg__item dd-seg__item--present' },
                                    {
                                      value: 'ABSENT',
                                      label:
                                        leavePart(row) === LEAVE_PART.FULL_DAY && !row.leaveRequest?.noticeOnly ? 'Nghỉ có phép' : 'Vắng',
                                      className: 'dd-seg__item dd-seg__item--absent',
                                    },
                                  ]}
                                  onChange={(status) => setStatus(row, status === 'PRESENT')}
                                  disabled={busy}
                                  className="dd-seg dd-reception__status"
                                  aria-label={`Điểm danh ${row.child.fullName}`}
                                />
                              )}
                              {/* Ngày mở lại: nhãn buổi vắng sáng theo bản ghi đã lưu */}
                              {reopened && (hasMorningAbsence(row) || isMorningUnexcused(row)) && (
                                <div className="dd-reception__arrival">
                                  <StatusBadge
                                    tone={row.record?.status === 'PRESENT' ? 'green' : row.record?.status === 'UNEXCUSED' ? 'red' : 'gray'}
                                    label={morningArrivalLabel(row)}
                                  />
                                </div>
                              )}
                            </>
                          ) : hasMorningAbsence(row) || isMorningUnexcused(row) ? (
                            <div className="dd-reception__arrival">
                              <StatusBadge
                                tone={row.record?.status === 'PRESENT' ? 'green' : row.record?.status === 'UNEXCUSED' ? 'red' : 'gray'}
                                label={morningArrivalLabel(row)}
                              />
                              {/* ATT-03/B2: trường chỉ nhận trẻ trong khung buổi chiều đã cấu hình. */}
                              {canMarkArrived(sheet, day, date) &&
                                (row.record?.status === ATTENDANCE_STATUS.EXCUSED || isMorningUnexcused(row)) && (
                                  <Button
                                    size="sm"
                                    icon={CheckCircle2}
                                    disabled={busy}
                                    title={`Ghi trẻ đến lớp từ ${sheet.afternoonStart || '13:30'} đến trước ${sheet.latestAfternoonArrival || '14:00'}`}
                                    onClick={(event) => {
                                      event.stopPropagation();
                                      arrived(row);
                                    }}
                                  >
                                    Đã đến
                                  </Button>
                                )}
                            </div>
                          ) : (
                            <AttendanceRowBadge status={entry.status === 'PRESENT' ? 'PRESENT' : absent ? 'ABSENT' : 'NONE'} />
                          )}
                          {rowErrors[row.child.id]?.status && <p className="field__error">{rowErrors[row.child.id].status}</p>}
                        </td>
                        <td className="center">
                          <div className="dd-reception__mealcell">
                            {/* ATT-02a: chỉ trẻ có mặt mới có nút Tham gia ăn (mặc định bật); chưa điểm danh / vắng ⇒ "—".
                                CHD-13 (Cần chốt 18/11/2026): trẻ không báo ăn luôn "—", nhãn "Không báo ăn" ở ô Trẻ */}
                            {/* ATT-13: trẻ nghỉ sáng có bữa xế theo công tắc ăn của đơn, kể cả khi chưa đến */}
                            {halfPart(row) === LEAVE_PART.MORNING &&
                            !entry.presentPart &&
                            row.child.mealRegistered !== false &&
                            sessions.includes(MEAL_SESSION.AFTERNOON) ? (
                              editable && !day?.baseLocked ? (
                                // Trước giờ chốt: chỉ chọn bữa xế; sau giờ chốt khóa như mọi trẻ
                                <MealChoiceSelect
                                  aria-label={`Ăn bữa xế: ${row.child.fullName}`}
                                  disabled={busy}
                                  meals={entry.meals}
                                  sessions={[MEAL_SESSION.AFTERNOON]}
                                  classSessions={sessions}
                                  onChange={(meals) => update(row, { meals })}
                                />
                              ) : (
                                <span className="text-xs">{entry.meals?.[MEAL_SESSION.AFTERNOON] ? 'Ăn Xế' : 'Không ăn'}</span>
                              )
                            ) : entry.status !== ATTENDANCE_STATUS.PRESENT || row.child.mealRegistered === false ? (
                              <span className="muted">—</span>
                            ) : editable && !day?.baseLocked && !leaveLocked(row) ? (
                              <MealChoiceSelect
                                aria-label={`Tham gia ăn: ${row.child.fullName}`}
                                disabled={busy}
                                meals={entry.meals}
                                sessions={rowSessions(row)}
                                classSessions={sessions}
                                onChange={(meals) => update(row, { meals })}
                              />
                            ) : editable && day?.baseLocked && date === day?.today && !leaveLocked(row) ? (
                              <MealChoiceSelect
                                aria-label={`Sửa tham gia ăn: ${row.child.fullName}`}
                                disabled={busy || hasConfirmedMeal(row)}
                                meals={entry.meals}
                                sessions={correctableSessions(row)}
                                classSessions={sessions}
                                onChange={(meals) => correctMeal(row, meals)}
                              />
                            ) : (
                              <span className="text-xs">{mealText(entry.meals, rowSessions(row))}</span>
                            )}
                            {/* ATT-03/B2: sáng vắng không phép, bữa xế đã bỏ từ giờ chốt thì chiều đến cũng không có suất */}
                            {(isMorningUnexcused(row) || row.record?.absentPartUnexcused) &&
                              row.child.mealRegistered !== false &&
                              sessions.includes(MEAL_SESSION.AFTERNOON) &&
                              !row.record?.meals?.[MEAL_SESSION.AFTERNOON] && (
                                <span className="muted text-xs dd-reception__xe-off">Không có suất xế</span>
                              )}
                            {/* Nghỉ chiều: bữa xế tắt và khóa */}
                            {halfPart(row) === LEAVE_PART.AFTERNOON && sessions.includes(MEAL_SESSION.AFTERNOON) && (
                              <span className="muted text-xs dd-reception__xe-off">Xế: nghỉ chiều</span>
                            )}
                            {rowErrors[row.child.id]?.meals && <p className="field__error">{rowErrors[row.child.id].meals}</p>}
                          </div>
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
              {halfPart(leaveFor) && ` · ${LEAVE_PART_TAGS[halfPart(leaveFor)].split(' · ')[0]}`}
              {halfPart(leaveFor) &&
                leaveFor.leaveRequest.eats != null &&
                ` · Bé tham gia ăn: ${leaveFor.leaveRequest.eats ? 'Có' : 'Không'}${
                  leaveFor.leaveRequest.eatsMeals?.length
                    ? ` (${leaveFor.leaveRequest.eatsMeals.map((s) => MEAL_SESSION_LABELS[s] || s).join(', ')})`
                    : ''
                }`}
            </p>
            {leaveFor.leaveRequest.noticeOnly && (
              <p className="alert alert--info">
                Báo nghỉ chiều sau giờ chốt: chỉ thông báo cho lớp, không thay đổi điểm danh hoặc suất ăn đã chốt.
              </p>
            )}
            <p>{leaveFor.leaveRequest.reason || 'Không có ghi chú.'}</p>
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
        message="Áp dụng cho toàn bộ lớp, kể cả trẻ ngoài bộ lọc hiện tại. Giữ nguyên các lựa chọn Có mặt/Vắng đã có; bật tham gia ăn đủ các bữa của nhóm tuổi (trừ trẻ không báo ăn). Đây chỉ là bản nháp, chưa lưu và chưa ghi nhận sức khỏe."
        confirmLabel="Chọn Có mặt"
        onClose={() => setConfirmAll(false)}
        onConfirm={markAllPresent}
      />
    </>
  );
}
