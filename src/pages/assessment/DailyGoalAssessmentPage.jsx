import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { ChildAvatar } from '@/components/ChildAvatar';
import { ChevronDown, ClipboardCheck, Info, Lock, Save, UserX } from '@/components/ui/icons';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/contexts/ToastContext';
import { useMasterData } from '@/hooks/useMasterData';
import { useAssessmentClasses, useDailyDaySheet } from '@/hooks/assessment/useAssessment';
import { saveDailyDay } from '@/services/assessment/assessmentService';
import { Breadcrumb } from '@/components/ui/Breadcrumb';
import { SidePanel } from '@/components/ui/SidePanel';
import { StatusPage } from '@/components/ui/StatusPage';
import { DailyModeSelect } from '@/components/assessment/DailyModeSelect';
import { EmptyState, ErrorState, SkeletonRows, Spinner } from '@/components/ui/States';
import { BehaviorsCell, CellPopover, HealthCell, MealsCell } from '@/components/assessment/DailyAssessmentCells';
import { Cell, focusCell } from '@/components/ui/TableCell';
import { EMOTION, EMOTION_LABELS } from '@/models/assessment/assessmentConstants';
import {
  EATING,
  NAP,
  NAP_LABELS,
  PARTICIPATION,
  PARTICIPATION_LABELS,
  YCCD_RESULT,
  YCCD_RESULT_LABELS,
} from '@/models/assessment/dailyObservationOptions';
import { formatDate, formatDateTime } from '@/utils/format';
import { addDays, isSchoolDay, todayIso, unlockDeadline } from '@/utils/assessment/assessmentPeriods';
import { validateDailyEntry, hasErrors } from '@/utils/assessment/assessmentValidation';
import { assessmentCrumbs, SECTIONS } from '@/utils/assessment/breadcrumbs';
import '@/styles/modules/assessment.css';
// Bảng cùng kiểu bảng mục tiêu năm học / giáo án (Tiền 20/10)
import '@/styles/modules/education-plan.css';

const lastSchoolDay = () => {
  let d = todayIso();
  while (!isSchoolDay(d)) d = addDays(d, -1);
  return d;
};
const hhmm = (d) => `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;

/** Kết quả một giờ cho mọi MT của giờ: Đạt (mặc định) / Cần cố gắng / Chưa đạt. */
const resultOf = (ids, level) => ({
  criteriaMet: level === YCCD_RESULT.DAT ? ids : [],
  criteriaEffort: level === YCCD_RESULT.CAN_CO_GANG ? ids : [],
  criteriaNotMet: level === YCCD_RESULT.CHUA_DAT ? ids : [],
});
const levelOf = (act) =>
  act.criteriaNotMet.length ? YCCD_RESULT.CHUA_DAT : act.criteriaEffort?.length ? YCCD_RESULT.CAN_CO_GANG : YCCD_RESULT.DAT;
const LEVEL_CLASS = { DAT: 'text-success', CAN_CO_GANG: 'text-warning fw-600', CHUA_DAT: 'text-danger fw-600' };

/** Giá trị đang nhập của một trẻ cho cả ngày: nhóm ngày, cờ, nhận xét và kết quả từng giờ (chưa ghi thì mặc định Đạt). */
const fromRow = (r, sheet) => {
  const o = r.observation;
  return {
    // Ô Sức khỏe: theo khám sức khỏe mới nhất khi cô chưa sửa (server tính sẵn)
    healthSigns: r.health?.signs || [],
    healthNote: r.health?.note || '',
    healthOverridden: !!r.health?.overridden,
    // Bữa cô đã tắt "Tham gia ăn" khi điểm danh luôn là Không ăn
    meals: Object.fromEntries(
      sheet.mealSessions.map((m) => [m, r.skippedMeals?.includes(m) ? EATING.KHONG_AN : o?.meals?.[m] || EATING.AN_HET]),
    ),
    nap: o?.nap || NAP.NGU_TOT,
    emotion: o?.emotion || EMOTION.HAPPY,
    behaviors: o?.behaviors || [],
    behaviorNote: o?.behaviorNote || '',
    comment: r.comment || '',
    activities: Object.fromEntries(
      sheet.activities.map(({ activity, criteria }) => {
        const a = r.assessments[activity];
        const ids = criteria.map((c) => c.id);
        return [
          activity,
          {
            participation: a?.participation || PARTICIPATION.BINH_THUONG,
            ...(a
              ? { criteriaMet: a.criteriaMet || [], criteriaEffort: a.criteriaEffort || [], criteriaNotMet: a.criteriaNotMet || [] }
              : resultOf(ids, YCCD_RESULT.DAT)),
          },
        ];
      }),
    ),
  };
};

const recordedOf = (r) => (r.observation?.recordedBy ? r.observation : Object.values(r.assessments).find(Boolean) || null);

/**
 * #52 Đánh giá hằng ngày (UC 4.4, GBR-OBS-01..05): một bảng cho cả ngày, cùng kiểu bảng mục tiêu năm / giáo án (Tiền 20/10).
 * Mỗi giờ có MT trong kế hoạch ngày đã duyệt là một cột chỉ ghi Đạt / Chưa đạt, mặc định cả lớp Đạt: cô chỉ bấm trẻ chưa đạt.
 * Nhóm ngày, cờ (1 lần / ngày), nhận xét ghi một lần; bấm tên trẻ để ghi chi tiết cả ngày. Lưu khi bấm "Lưu đánh giá".
 */
export default function DailyGoalAssessmentPage() {
  const { user } = useAuth();
  const toast = useToast();
  const md = useMasterData();
  const { classes, loading: classesLoading, error: classesError } = useAssessmentClasses();
  const [search] = useSearchParams();
  const [classId, setClassId] = useState(search.get('classId') || '');
  const [date, setDate] = useState(() => search.get('date') || lastSchoolDay());
  const currentClassId = classId || classes[0]?.id || '';
  const params = useMemo(() => ({ classId: currentClassId, date }), [currentClassId, date]);
  const { sheet, loading, error, reload } = useDailyDaySheet(params);

  const [drafts, setDrafts] = useState({});
  const [dirty, setDirty] = useState(new Set());
  const [rowErrors, setRowErrors] = useState({});
  const [savedAt, setSavedAt] = useState({});
  const [saveState, setSaveState] = useState({ phase: 'idle', at: null });
  const [openChild, setOpenChild] = useState(null);
  const inFlight = useRef(false);
  const latest = useRef({});

  // Bảng mới (đổi lớp / ngày) thì nạp lại bản đang nhập
  useEffect(() => {
    if (!sheet) return;
    setDrafts(Object.fromEntries(sheet.rows.map((r) => [r.child.id, fromRow(r, sheet)])));
    setDirty(new Set());
    setRowErrors({});
    setSavedAt({});
    setSaveState({ phase: 'idle', at: null });
  }, [sheet]);

  const rowState = (r) => {
    if (!r.present) return 'absent';
    const rec = recordedOf(r);
    if (rec?.recordedBy && rec.recordedBy !== user.id) return 'other';
    if (sheet.locked) return 'locked';
    return 'editable';
  };

  const touch = (ids) => setDirty((prev) => new Set([...prev, ...ids]));
  const clearError = (childId) =>
    setRowErrors((prev) => {
      if (!prev[childId]) return prev;
      const next = { ...prev };
      delete next[childId];
      return next;
    });
  const update = (childId, patch) => {
    setDrafts((prev) => ({ ...prev, [childId]: { ...prev[childId], ...patch } }));
    touch([childId]);
    clearError(childId);
  };
  const updateActivity = (childId, activity, patch) => {
    setDrafts((prev) => ({
      ...prev,
      [childId]: {
        ...prev[childId],
        activities: { ...prev[childId].activities, [activity]: { ...prev[childId].activities[activity], ...patch } },
      },
    }));
    touch([childId]);
    clearError(childId);
  };
  /** Chọn kết quả ô giờ: Đạt / Cần cố gắng / Chưa đạt (cho mọi MT của giờ). */
  const setResult = (childId, a, level) =>
    updateActivity(
      childId,
      a.activity,
      resultOf(
        a.criteria.map((c) => c.id),
        level,
      ),
    );

  const editableRows = (sheet?.rows || []).filter((r) => r.present && rowState(r) === 'editable');
  // Mặc định cả lớp Đạt: lần lưu nào cũng ghi kèm các trẻ chưa có bản ghi (với giá trị mặc định), để cô chỉ cần bấm trẻ chưa đạt
  const pendingIds = (ids) => [
    ...new Set([...ids, ...editableRows.filter((r) => !recordedOf(r) && !savedAt[r.child.id]).map((r) => r.child.id)]),
  ];
  const markAllPresent = () => touch(editableRows.map((r) => r.child.id));

  const goalActs = sheet?.plan ? sheet.activities.filter((a) => a.criteria.length) : [];
  const entriesOf = (ids) =>
    ids.map((childId) => {
      const d = drafts[childId];
      // Gửi mọi giờ có MT (mặc định Đạt) và các giờ cô đã ghi mức tham gia ở khung chi tiết
      const acts = sheet.activities.filter(
        (a) => a.criteria.length || d.activities[a.activity].participation !== PARTICIPATION.BINH_THUONG,
      );
      return { childId, ...d, activities: Object.fromEntries(acts.map((a) => [a.activity, d.activities[a.activity]])) };
    });
  const dirtyIds = [...dirty];
  const key = sheet ? JSON.stringify(entriesOf(dirtyIds)) : '';
  latest.current = { key, dirtyIds, entriesOf, pendingIds };
  // Lưu khi cô bấm "Lưu đánh giá" (Cần chốt 21/10: không tự lưu), giống màn Hoạt động chung
  const save = async () => {
    const { dirtyIds: changed, entriesOf: build, key: k, pendingIds: pending } = latest.current;
    if (!changed.length || inFlight.current) return;
    const ids = pending(changed);
    const entries = build(ids);
    const local = {};
    entries.forEach((e) => {
      const errs = validateDailyEntry(e);
      Object.values(e.activities).forEach((a) => Object.assign(errs, validateDailyEntry({ ...e, ...a })));
      if (hasErrors(errs)) local[e.childId] = errs;
    });
    if (hasErrors(local)) {
      setRowErrors(local);
      setSaveState((s) => ({ ...s, phase: 'error' }));
      return;
    }
    inFlight.current = true;
    setSaveState((s) => ({ ...s, phase: 'saving' }));
    try {
      await saveDailyDay({ classId: currentClassId, date, entries }, user);
      const at = new Date();
      setSavedAt((prev) => ({ ...prev, ...Object.fromEntries(ids.map((id) => [id, at.toISOString()])) }));
      // Không sửa thêm trong lúc lưu thì bỏ khỏi danh sách chờ lưu
      if (latest.current.key === k) setDirty(new Set());
      setSaveState({ phase: 'saved', at });
      toast.success(`Đã lưu đánh giá của ${ids.length} trẻ.`);
    } catch (err) {
      if (err.details) setRowErrors(err.details);
      setSaveState((s) => ({ ...s, phase: 'error' }));
      toast.error(err.message, 'Không lưu được đánh giá');
    } finally {
      inFlight.current = false;
    }
  };
  // Đóng tab / tải lại khi còn thay đổi chưa lưu: trình duyệt hỏi lại
  useEffect(() => {
    const warn = (e) => {
      if (latest.current.dirtyIds.length) e.preventDefault();
    };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, []);
  const saving = saveState.phase === 'saving';

  const presentRows = sheet?.rows.filter((r) => r.present) || [];
  const presentCount = presentRows.length;
  const assessedCount = presentRows.filter((r) => recordedOf(r) || savedAt[r.child.id]).length;
  const absentRows = sheet?.rows.filter((r) => r.attendanceStatus && !r.present) || [];
  const unmarkedRows = sheet?.attendanceTaken ? sheet.rows.filter((r) => !r.attendanceStatus) : [];
  // Chỉ có dòng vắng do phụ huynh báo nghỉ, chưa ai được điểm danh Có mặt: coi như lớp chưa điểm danh
  const attendanceTaken = !!sheet?.attendanceTaken && (presentCount > 0 || unmarkedRows.length === 0);
  const cols = 2 + goalActs.length;
  const namesOf = (list) =>
    list
      .slice(0, 3)
      .map((r) => r.child.fullName)
      .join(', ') + (list.length > 3 ? ` +${list.length - 3}` : '');
  const panelRow = openChild && sheet?.rows.find((r) => r.child.id === openChild);
  // Tên giờ học "Môn: nội dung"; giờ khác lấy các dòng của ô kế hoạch tuần (chỉ hiện khi rê chuột / ở khung chi tiết)
  const HOC_HEAD = /^1\. Hoạt động học: /;
  const actTitle = (a) =>
    HOC_HEAD.test(a.dayPart?.title || '')
      ? a.dayPart.title.replace(HOC_HEAD, '')
      : String(a.topic || '')
          .split('\n')
          .filter(Boolean)
          .join(' · ') || a.activity;
  const resultCell = (r, a, d, disabled) => {
    const level = levelOf(d.activities[a.activity]);
    const label = YCCD_RESULT_LABELS[level];
    return (
      <select
        className={`select dg-select ${LEVEL_CLASS[level]}`}
        value={level}
        disabled={disabled}
        title={`${a.activity}: ${actTitle(a)}\n${a.criteria.map((c) => `${c.name}: ${c.description}`).join('\n')}`}
        aria-label={`${a.activity} của ${r.child.fullName}: ${label.toLowerCase()}`}
        onChange={(e) => setResult(r.child.id, a, e.target.value)}
      >
        {Object.entries(YCCD_RESULT_LABELS).map(([k, v]) => (
          <option key={k} value={k}>
            {v}
          </option>
        ))}
      </select>
    );
  };
  const select = (value, options, onChange, label, disabled) => (
    <select className="ga-cell-input" value={value} disabled={disabled} onChange={(e) => onChange(e.target.value)} aria-label={label}>
      {Object.entries(options).map(([k, v]) => (
        <option key={k} value={k}>
          {v}
        </option>
      ))}
    </select>
  );

  return (
    <div className="page">
      <Breadcrumb items={assessmentCrumbs(SECTIONS.daily)} />
      {/* Bỏ khung tiêu đề lớn trên cùng (Tiền 20/10); tiêu đề vẫn có cho trình đọc màn hình */}
      <h1 className="sr-only">Đánh giá hằng ngày</h1>

      {classesError ? (
        <ErrorState error={classesError} />
      ) : !classesLoading && classes.length === 0 ? (
        <StatusPage kind="403" title="Bạn chưa được phân công lớp" description="Chỉ giáo viên của lớp mới ghi nhận đánh giá hằng ngày." />
      ) : (
        <div className="card">
          <div className="filter-bar">
            <div className="field">
              <label className="field__label" htmlFor="dg-class">
                Lớp
              </label>
              <select id="dg-class" className="select" value={currentClassId} onChange={(e) => setClassId(e.target.value)}>
                {classes.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="field">
              <label className="field__label" htmlFor="dg-date">
                Ngày
              </label>
              <input
                id="dg-date"
                type="date"
                className="input"
                value={date}
                max={todayIso()}
                onChange={(e) => e.target.value && setDate(e.target.value)}
              />
            </div>
            <DailyModeSelect mode="skills" classId={currentClassId} date={date} />
            <div className="spacer" />
            {sheet && (
              <div className="text-sm text-2 dg-filter-count">
                Đã ghi nhận <b>{assessedCount}</b>/{presentCount} trẻ có mặt
                {!sheet.locked && presentCount > 0 && (
                  <>
                    {' · '}
                    {saving
                      ? 'Đang lưu…'
                      : dirtyIds.length
                        ? `${dirtyIds.length} trẻ có thay đổi chưa lưu`
                        : saveState.at
                          ? `Đã lưu lúc ${hhmm(saveState.at)}`
                          : 'Chưa có thay đổi'}
                  </>
                )}
              </div>
            )}
          </div>

          {/* Khóa sau 23:59:59 của chính ngày đó; quên thì PHT điểm trường / Hiệu trưởng mở lại */}
          {sheet && sheet.locked && (
            <div className="alert alert--warning dg-alert-inset">
              <Lock size={18} />
              <div>
                Ngày {formatDate(date)} đã khóa. Nếu cần đánh giá bổ sung, gửi mail cho Phó hiệu trưởng điểm trường hoặc Hiệu trưởng để mở
                lại ngày này.
              </div>
            </div>
          )}
          {sheet?.unlock && (
            <div className="alert alert--info dg-alert-inset">
              <Lock size={18} />
              <div>
                Ngày {formatDate(date)} đã được {sheet.unlock.unlockedByName} mở lại, đánh giá được đến{' '}
                <strong>{formatDateTime(unlockDeadline(sheet.unlock.validUntil))}</strong>.
              </div>
            </div>
          )}
          {/* Chỉ nhắc khi ngày chưa có giáo án duyệt (không có cột giờ để chấm) */}
          {sheet && attendanceTaken && !sheet.plan && (
            <div className="alert alert--info dg-alert-inset">
              <Info size={18} />
              <div>Ngày này chưa có giáo án tuần đã duyệt nên chưa có giờ để chấm; vẫn ghi cờ, nhận xét và sức khỏe, ăn, ngủ.</div>
            </div>
          )}
          {/* Chỉ đánh giá trẻ đã điểm danh Có mặt: trẻ vắng / chưa điểm danh chỉ nêu tên ở một dòng */}
          {sheet && attendanceTaken && (absentRows.length > 0 || unmarkedRows.length > 0) && (
            <p className="muted text-sm dg-absent-line">
              <UserX size={14} /> {absentRows.length > 0 && `Vắng ${absentRows.length} trẻ: ${namesOf(absentRows)}`}
              {absentRows.length > 0 && unmarkedRows.length > 0 && ' · '}
              {unmarkedRows.length > 0 && `${unmarkedRows.length} trẻ chưa điểm danh: ${namesOf(unmarkedRows)}`}
            </p>
          )}

          {error ? (
            <ErrorState error={error} onRetry={reload} />
          ) : (
            <div className="card__body">
              <div className="table-wrap">
                <table className="table ga-plan-table ga-goal-table dg-day-table dg-day-table--skills" onMouseDown={focusCell}>
                  {/* Độ rộng cột dùng lại lớp của bảng mục tiêu năm: Trẻ 190px, Nhận xét 96px, các giờ chia đều; cờ cắm ở màn Hoạt động chung */}
                  <colgroup>
                    <col className="ga-goal-table__group" />
                    {goalActs.map((a) => (
                      <col key={a.activity} />
                    ))}
                    <col className="dg-skill-note" />
                  </colgroup>
                  <thead>
                    <tr>
                      <th className="cell--fixed">Trẻ</th>
                      {goalActs.map((a) => (
                        <th key={a.activity}>
                          {/* Sổ xuống xem nội dung giờ và các MT trong ngày của giờ đó (Tiền 21/10) */}
                          <span className="dg-head-goal">
                            {a.activity}
                            <CellPopover label={`Xem mục tiêu trong ngày – ${a.activity}`} icon={<ChevronDown size={14} />} minWidth={280}>
                              <div className="dg-pop__title">{actTitle(a)}</div>
                              {a.criteria.map((c) => (
                                <div key={c.id} className="text-sm">
                                  <span className="fw-600">{c.name}</span>: {c.description}
                                </div>
                              ))}
                            </CellPopover>
                          </span>
                        </th>
                      ))}
                      <th>Nhận xét</th>
                    </tr>
                  </thead>
                  <tbody>
                    {loading || classesLoading || !sheet ? (
                      <SkeletonRows rows={5} cols={cols} />
                    ) : sheet.rows.length === 0 ? (
                      <tr>
                        <td colSpan={cols}>
                          <EmptyState title="Lớp chưa có trẻ" description="Trẻ được xếp vào lớp sẽ hiển thị tại đây." />
                        </td>
                      </tr>
                    ) : !attendanceTaken ? (
                      <tr>
                        <td colSpan={cols}>
                          <EmptyState
                            icon={UserX}
                            title={`Lớp chưa điểm danh ngày ${formatDate(sheet.date)}`}
                            description="Điểm danh trước, chỉ trẻ có mặt mới được đánh giá."
                            action={
                              <Link className="btn btn--primary" to={`/attendance?classId=${sheet.cls.id}&date=${sheet.date}`}>
                                Điểm danh ngay
                              </Link>
                            }
                          />
                        </td>
                      </tr>
                    ) : presentRows.length === 0 ? (
                      <tr>
                        <td colSpan={cols}>
                          <EmptyState icon={UserX} title="Không có trẻ có mặt" description="Cả lớp vắng hoặc chưa điểm danh ngày này." />
                        </td>
                      </tr>
                    ) : (
                      presentRows.map((r) => {
                        const id = r.child.id;
                        const state = rowState(r);
                        const d = drafts[id] || fromRow(r, sheet);
                        const disabled = state !== 'editable';
                        const errs = rowErrors[id] || {};
                        const firstError = Object.values(errs)[0];
                        const name = r.child.fullName;
                        const rec = recordedOf(r);
                        return (
                          <tr
                            key={id}
                            title={
                              savedAt[id] || rec
                                ? `Đã ghi nhận ${formatDateTime(savedAt[id] || rec.updatedAt || rec.recordedAt)}`
                                : 'Chưa ghi nhận'
                            }
                          >
                            <td className="cell--fixed">
                              <div className="ga-goal-table__pad dg-child">
                                <ChildAvatar child={r.child} size="sm" />
                                <div className="dg-child__info">
                                  <button type="button" className="dg-link-btn fw-600" onClick={() => setOpenChild(id)}>
                                    {name}
                                  </button>
                                  <div className="muted text-xs">{r.child.code}</div>
                                  {state === 'other' && (
                                    <div className="muted text-xs">
                                      Do {md.userById(rec.recordedBy)?.fullName || 'giáo viên khác'} ghi nhận
                                    </div>
                                  )}
                                  {firstError && <div className="field__error">{firstError}</div>}
                                </div>
                              </div>
                            </td>
                            {goalActs.map((a) => (
                              <td key={a.activity} className="dg-day-cell">
                                {resultCell(r, a, d, disabled)}
                              </td>
                            ))}
                            <td>
                              <Cell
                                editable={!disabled}
                                value={d.comment}
                                label={`Nhận xét trong ngày cho ${name}`}
                                placeholder="Tùy chọn"
                                onChange={(v) => update(id, { comment: v })}
                              />
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {sheet && presentCount > 0 && !sheet.locked && (
        <div className="page-actions">
          <button className="btn" onClick={markAllPresent} disabled={saving || editableRows.length === 0}>
            <ClipboardCheck size={16} /> Ghi nhận cả lớp với giá trị mặc định
          </button>
          <div className="row gap-2">
            {dirtyIds.length > 0 && (
              <button className="btn" onClick={() => reload()} disabled={saving}>
                Hủy thay đổi
              </button>
            )}
            <button className="btn btn--primary" onClick={save} disabled={saving || dirtyIds.length === 0}>
              {saving ? <Spinner small /> : <Save size={16} />} Lưu đánh giá{dirtyIds.length ? ` (${dirtyIds.length})` : ''}
            </button>
          </div>
        </div>
      )}

      {/* Chi tiết cả ngày của một trẻ: mọi giờ (kể cả giờ chưa có MT), MT của giờ, mức tham gia, cờ, nhận xét */}
      <SidePanel
        open={!!panelRow}
        title={panelRow ? `${panelRow.child.fullName} · ${formatDate(sheet.date)}` : ''}
        onClose={() => setOpenChild(null)}
      >
        {panelRow &&
          (() => {
            const id = panelRow.child.id;
            const d = drafts[id] || fromRow(panelRow, sheet);
            const disabled = rowState(panelRow) !== 'editable';
            return (
              <div className="table-wrap">
                <table className="table ga-plan-table ga-goal-table" onMouseDown={focusCell}>
                  <thead>
                    <tr>
                      <th className="cell--fixed">Giờ</th>
                      <th>Kết quả</th>
                      <th>Tham gia</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sheet.activities.map((a) => (
                      <tr key={a.activity}>
                        <td className="cell--fixed">
                          <div className="ga-goal-table__pad">
                            <div className="fw-600">{a.activity}</div>
                            {actTitle(a) !== a.activity && <div className="text-xs">{actTitle(a)}</div>}
                            {a.criteria.map((c) => (
                              <div key={c.id} className="text-xs muted">
                                {c.name}: {c.description}
                              </div>
                            ))}
                          </div>
                        </td>
                        <td>
                          {a.criteria.length ? (
                            resultCell(panelRow, a, d, disabled)
                          ) : (
                            <div className="ga-goal-table__pad muted text-xs">Chưa có MT</div>
                          )}
                        </td>
                        <td>
                          {sheet.plan ? (
                            select(
                              d.activities[a.activity].participation,
                              PARTICIPATION_LABELS,
                              (v) => updateActivity(id, a.activity, { participation: v }),
                              `Mức tham gia ${a.activity} của ${panelRow.child.fullName}`,
                              disabled,
                            )
                          ) : (
                            <div className="ga-goal-table__pad muted">—</div>
                          )}
                        </td>
                      </tr>
                    ))}
                    {/* Nhóm ngày (điền sẵn mặc định), chỉ mở khi cần sửa */}
                    {[
                      [
                        'Sức khỏe',
                        <HealthCell
                          key="h"
                          health={panelRow.health}
                          draft={d}
                          name={panelRow.child.fullName}
                          disabled={disabled}
                          onChange={(patch) => update(id, patch)}
                        />,
                      ],
                      [
                        'Ăn',
                        <MealsCell
                          key="m"
                          draft={d}
                          row={panelRow}
                          sessions={sheet.mealSessions}
                          name={panelRow.child.fullName}
                          disabled={disabled}
                          onChange={(patch) => update(id, patch)}
                        />,
                      ],
                      [
                        'Ngủ trưa',
                        select(d.nap, NAP_LABELS, (v) => update(id, { nap: v }), `Ngủ trưa của ${panelRow.child.fullName}`, disabled),
                      ],
                      [
                        'Cảm xúc',
                        select(
                          d.emotion,
                          EMOTION_LABELS,
                          (v) => update(id, { emotion: v }),
                          `Cảm xúc của ${panelRow.child.fullName}`,
                          disabled,
                        ),
                      ],
                      [
                        'Hành vi',
                        <BehaviorsCell
                          key="b"
                          draft={d}
                          name={panelRow.child.fullName}
                          disabled={disabled}
                          onChange={(patch) => update(id, patch)}
                        />,
                      ],
                    ].map(([label, el]) => (
                      <tr key={label}>
                        <td className="cell--fixed">
                          <div className="ga-goal-table__pad fw-600">{label}</div>
                        </td>
                        <td colSpan={2}>{el}</td>
                      </tr>
                    ))}
                    <tr>
                      <td className="cell--fixed">
                        <div className="ga-goal-table__pad fw-600">Nhận xét trong ngày</div>
                      </td>
                      <td colSpan={2}>
                        <Cell
                          editable={!disabled}
                          value={d.comment}
                          label={`Nhận xét trong ngày cho ${panelRow.child.fullName}`}
                          placeholder="Tùy chọn"
                          onChange={(v) => update(id, { comment: v })}
                        />
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            );
          })()}
      </SidePanel>
    </div>
  );
}
