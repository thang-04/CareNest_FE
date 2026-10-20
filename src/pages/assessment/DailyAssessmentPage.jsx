import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { ChildAvatar } from '@/components/ChildAvatar';
import { ClipboardCheck, Flag, Lock, Save, UserX } from '@/components/ui/icons';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/contexts/ToastContext';
import { useMasterData } from '@/hooks/useMasterData';
import { useAssessmentClasses, useDailySheet } from '@/hooks/assessment/useAssessment';
import { DailyModeSelect } from '@/components/assessment/DailyModeSelect';
import { saveDailyAssessments } from '@/services/assessment/assessmentService';
import { Breadcrumb } from '@/components/ui/Breadcrumb';
import { EmptyState, ErrorState, SkeletonRows, Spinner } from '@/components/ui/States';
import { StatusPage } from '@/components/ui/StatusPage';
import { BehaviorsCell, HealthCell, MealsCell } from '@/components/assessment/DailyAssessmentCells';
import { EMOTION, EMOTION_LABELS } from '@/models/assessment/assessmentConstants';
import { EATING, NAP, NAP_LABELS, PARTICIPATION, PARTICIPATION_LABELS } from '@/models/assessment/dailyObservationOptions';
import { formatDate, formatDateTime } from '@/utils/format';
import { addDays, isSchoolDay, todayIso, unlockDeadline } from '@/utils/assessment/assessmentPeriods';
import { validateDailyEntry, hasErrors } from '@/utils/assessment/assessmentValidation';
import { assessmentCrumbs, SECTIONS } from '@/utils/assessment/breadcrumbs';
import '@/styles/modules/assessment.css';
// Bảng cùng kiểu bảng mục tiêu năm / màn Kiến thức kỹ năng (Tiền 21/10)
import '@/styles/modules/education-plan.css';
import { Cell, focusCell } from '@/components/ui/TableCell';

const lastSchoolDay = () => {
  let d = todayIso();
  while (!isSchoolDay(d)) d = addDays(d, -1);
  return d;
};

/** Giá trị đang nhập của một trẻ: nhóm ngày (sức khỏe, ăn ngủ, cảm xúc – hành vi) + hoạt động đang chọn. */
const fromRow = (r, mealSessions) => {
  const o = r.observation;
  const a = r.assessment;
  return {
    // Ô Sức khỏe: theo khám sức khỏe mới nhất khi cô chưa sửa (server tính sẵn)
    healthSigns: r.health?.signs || [],
    healthNote: r.health?.note || '',
    healthOverridden: !!r.health?.overridden,
    // Bữa cô đã tắt "Tham gia ăn" khi điểm danh luôn là Không ăn
    meals: Object.fromEntries(mealSessions.map((m) => [m, r.skippedMeals?.includes(m) ? EATING.KHONG_AN : o?.meals?.[m] || EATING.AN_HET])),
    nap: o?.nap || NAP.NGU_TOT,
    emotion: o?.emotion || a?.emotion || EMOTION.HAPPY,
    behaviors: o?.behaviors || [],
    behaviorNote: o?.behaviorNote || '',
    participation: a?.participation || PARTICIPATION.BINH_THUONG,
    criteriaMet: a?.criteriaMet || [],
    criteriaNotMet: a?.criteriaNotMet || [],
    // Cờ của ngày: cô đã quyết thì giữ, chưa thì theo gợi ý (đủ 4 tiêu chí)
    flag: r.flag ?? !!r.flagSuggestion?.eligible,
    comment: a?.comment || '',
  };
};

const COLS = 9;

/** #52 Daily Assessment (UC 4.4, GBR-OBS-01..05) – teacher / team leader of the class. */
export default function DailyAssessmentPage() {
  const { user } = useAuth();
  const toast = useToast();
  const md = useMasterData();
  const { classes, loading: classesLoading, error: classesError } = useAssessmentClasses();
  const [search] = useSearchParams();
  const [classId, setClassId] = useState(search.get('classId') || '');
  const [date, setDate] = useState(() => search.get('date') || lastSchoolDay());
  // Hoạt động chung ghi theo giờ Hoạt động học; kiến thức kỹ năng từng giờ ở màn /assessment/daily/skills
  const activity = 'Hoạt động học';
  const currentClassId = classId || classes[0]?.id || '';
  const params = useMemo(() => ({ classId: currentClassId, date, activity }), [currentClassId, date, activity]);
  const { sheet, loading, error, reload } = useDailySheet(params);

  const [drafts, setDrafts] = useState({});
  const [dirty, setDirty] = useState(new Set());
  const [rowErrors, setRowErrors] = useState({});
  const [saving, setSaving] = useState(false);

  // A new sheet (class / date / activity changed or saved) resets the local edits.
  useEffect(() => {
    if (!sheet) return;
    setDrafts(Object.fromEntries(sheet.rows.map((r) => [r.child.id, fromRow(r, sheet.mealSessions)])));
    setDirty(new Set());
    setRowErrors({});
  }, [sheet]);

  const resetEdits = () => {
    setDirty(new Set());
    setRowErrors({});
  };

  const rowState = (r) => {
    if (!r.present) return 'absent';
    if (r.assessment && r.assessment.recordedBy !== user.id) return 'other';
    if (sheet.locked) return 'locked';
    return 'editable';
  };

  const update = (childId, patch) => {
    setDrafts((prev) => ({ ...prev, [childId]: { ...prev[childId], ...patch } }));
    setDirty((prev) => new Set(prev).add(childId));
    setRowErrors((prev) => {
      if (!prev[childId]) return prev;
      const next = { ...prev };
      delete next[childId];
      return next;
    });
  };

  const markAllPresent = () => {
    const ids = sheet.rows.filter((r) => r.present && !r.assessment).map((r) => r.child.id);
    setDirty((prev) => new Set([...prev, ...ids]));
  };

  const save = async () => {
    const entries = [...dirty].map((childId) => ({ childId, ...drafts[childId] }));
    const local = {};
    entries.forEach((e) => {
      const errors = validateDailyEntry(e);
      if (hasErrors(errors)) local[e.childId] = errors;
    });
    if (hasErrors(local)) {
      setRowErrors(local);
      toast.error('Một số dòng chưa hợp lệ. Kiểm tra các dòng được đánh dấu.', 'Chưa lưu được');
      return;
    }
    setSaving(true);
    try {
      const res = await saveDailyAssessments({ classId: currentClassId, date, activity: sheet.activity, entries }, user);
      toast.success(`Đã lưu ${res.saved} đánh giá. Phụ huynh của trẻ đã được thông báo.`);
      reload({ silent: true });
    } catch (err) {
      if (err.details) setRowErrors(err.details);
      toast.error(err, 'Không lưu được đánh giá');
    } finally {
      setSaving(false);
    }
  };

  const assessedCount = sheet?.rows.filter((r) => r.assessment).length || 0;
  const presentRows = sheet?.rows.filter((r) => r.present) || [];
  const presentCount = presentRows.length;
  const absentRows = sheet?.rows.filter((r) => r.attendanceStatus && !r.present) || [];
  const unmarkedRows = sheet?.attendanceTaken ? sheet.rows.filter((r) => !r.attendanceStatus) : [];
  // Chỉ có dòng vắng do phụ huynh báo nghỉ, chưa ai được điểm danh Có mặt: coi như lớp chưa điểm danh
  const attendanceTaken = !!sheet?.attendanceTaken && (presentCount > 0 || unmarkedRows.length === 0);
  // Tên trẻ vắng gọn một dòng: 3 tên đầu rồi "+n"
  const namesOf = (list) =>
    list
      .slice(0, 3)
      .map((r) => r.child.fullName)
      .join(', ') + (list.length > 3 ? ` +${list.length - 3}` : '');

  return (
    <div className="page">
      <Breadcrumb items={assessmentCrumbs(SECTIONS.daily)} />
      {/* Cùng kiểu màn Kiến thức kỹ năng: không có khung tiêu đề lớn (Tiền 21/10) */}
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
              <select
                id="dg-class"
                className="select"
                value={currentClassId}
                onChange={(e) => {
                  setClassId(e.target.value);
                  resetEdits();
                }}
              >
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
            {/* Thay ô chọn hoạt động: Hoạt động chung (màn này) / Kiến thức kỹ năng (bảng Đạt / Chưa đạt theo giờ) */}
            <DailyModeSelect mode="general" classId={currentClassId} date={date} />
            <div className="spacer" />
            {sheet && (
              <div className="text-sm text-2 dg-filter-count">
                Đã đánh giá <b>{assessedCount}</b>/{presentCount} trẻ có mặt
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
                <table className="table ga-plan-table ga-goal-table dg-day-table" onMouseDown={focusCell}>
                  {/* Trẻ 190px, Cờ 64px, Nhận xét 96px (ngắn lại); 6 cột chọn chia đều phần còn lại */}
                  <colgroup>
                    <col className="ga-goal-table__group" />
                    {[0, 1, 2, 3, 4, 5].map((i) => (
                      <col key={i} />
                    ))}
                    <col className="ga-goal-table__del" />
                    <col className="ga-goal-table__code" />
                  </colgroup>
                  <thead>
                    <tr>
                      <th className="cell--fixed">Trẻ</th>
                      <th>Sức khỏe</th>
                      <th>Ăn</th>
                      <th>Ngủ trưa</th>
                      <th>Cảm xúc</th>
                      <th>Hành vi</th>
                      <th>Tham gia</th>
                      <th className="center" title="Mỗi trẻ 1 cờ / ngày; tự gợi ý khi đủ tiêu chí, cô vẫn bỏ / cắm được">
                        Cờ
                      </th>
                      <th>Nhận xét</th>
                    </tr>
                  </thead>
                  <tbody>
                    {loading || classesLoading || !sheet ? (
                      <SkeletonRows rows={5} cols={COLS} />
                    ) : sheet.rows.length === 0 ? (
                      <tr>
                        <td colSpan={COLS}>
                          <EmptyState title="Lớp chưa có trẻ" description="Trẻ được xếp vào lớp sẽ hiển thị tại đây." />
                        </td>
                      </tr>
                    ) : !attendanceTaken ? (
                      <tr>
                        <td colSpan={COLS}>
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
                        <td colSpan={COLS}>
                          <EmptyState icon={UserX} title="Không có trẻ có mặt" description="Cả lớp vắng hoặc chưa điểm danh ngày này." />
                        </td>
                      </tr>
                    ) : (
                      presentRows.map((r) => {
                        const id = r.child.id;
                        const state = rowState(r);
                        const d = drafts[id] || fromRow(r, sheet.mealSessions);
                        const disabled = state !== 'editable';
                        const errs = rowErrors[id] || {};
                        const firstError = Object.values(errs)[0];
                        const name = r.child.fullName;
                        // Viền trái của dòng: lỗi / chưa lưu / đã ghi nhận / chưa đánh giá
                        const status = rowErrors[id]
                          ? ['error', 'Có lỗi, xem dòng chữ đỏ']
                          : dirty.has(id)
                            ? ['dirty', 'Đã thay đổi, chưa lưu']
                            : r.assessment
                              ? ['saved', `Đã ghi nhận ${formatDateTime(r.assessment.updatedAt || r.assessment.recordedAt)}`]
                              : ['new', 'Chưa đánh giá'];
                        return (
                          <tr key={id} title={status[1]}>
                            <td className="cell--fixed">
                              <div className="ga-goal-table__pad dg-child">
                                <ChildAvatar child={r.child} size="sm" />
                                <div className="dg-child__info">
                                  <Link to={`/assessment/children/${id}`} className="fw-600">
                                    {name}
                                  </Link>
                                  <div className="muted text-xs">
                                    {r.child.code}
                                    {r.assessment?.corrections?.length > 0 && ` · ${r.assessment.corrections.length} lần điều chỉnh`}
                                  </div>
                                  {state === 'other' && (
                                    <div className="muted text-xs">
                                      Do {md.userById(r.assessment.recordedBy)?.fullName || 'giáo viên khác'} ghi nhận
                                    </div>
                                  )}
                                  {firstError && <div className="field__error">{firstError}</div>}
                                </div>
                              </div>
                            </td>
                            <td className="dg-day-cell">
                              <HealthCell
                                health={r.health}
                                draft={d}
                                name={name}
                                disabled={disabled}
                                onChange={(patch) => update(id, patch)}
                              />
                            </td>
                            <td className="dg-day-cell">
                              <MealsCell
                                draft={d}
                                row={r}
                                sessions={sheet.mealSessions}
                                name={name}
                                disabled={disabled}
                                onChange={(patch) => update(id, patch)}
                              />
                            </td>
                            <td className="dg-day-cell">
                              <select
                                className="ga-cell-input"
                                value={d.nap}
                                disabled={disabled}
                                onChange={(e) => update(id, { nap: e.target.value })}
                                aria-label={`Ngủ trưa của ${name}`}
                              >
                                {Object.entries(NAP_LABELS).map(([k, v]) => (
                                  <option key={k} value={k}>
                                    {v}
                                  </option>
                                ))}
                              </select>
                            </td>
                            <td className="dg-day-cell">
                              <select
                                className="ga-cell-input"
                                value={d.emotion}
                                disabled={disabled}
                                onChange={(e) => update(id, { emotion: e.target.value })}
                                aria-label={`Cảm xúc của ${name}`}
                              >
                                {Object.entries(EMOTION_LABELS).map(([k, v]) => (
                                  <option key={k} value={k}>
                                    {v}
                                  </option>
                                ))}
                              </select>
                            </td>
                            <td className="dg-day-cell">
                              <BehaviorsCell draft={d} name={name} disabled={disabled} onChange={(patch) => update(id, patch)} />
                            </td>
                            <td className="dg-day-cell">
                              {sheet.plan ? (
                                <select
                                  className="ga-cell-input"
                                  value={d.participation}
                                  disabled={disabled}
                                  onChange={(e) => update(id, { participation: e.target.value })}
                                  aria-label={`Mức tham gia hoạt động của ${name}`}
                                >
                                  {Object.entries(PARTICIPATION_LABELS).map(([k, v]) => (
                                    <option key={k} value={k}>
                                      {v}
                                    </option>
                                  ))}
                                </select>
                              ) : (
                                <span className="muted text-xs">—</span>
                              )}
                            </td>
                            <td className="dg-day-cell center">
                              <button
                                type="button"
                                className={`dg-flag ${d.flag ? 'dg-flag--on' : ''}`}
                                aria-pressed={d.flag}
                                aria-label={`Cờ bé ngoan hôm nay cho ${name}`}
                                title={
                                  r.flagSuggestion?.eligible
                                    ? `${d.flag ? 'Bỏ' : 'Cắm'} cờ bé ngoan (đủ tiêu chí gợi ý cờ)`
                                    : `Chưa đủ tiêu chí gợi ý cờ: ${r.flagSuggestion?.reasons?.join('; ') || ''}. Cô vẫn ${d.flag ? 'bỏ' : 'cắm'} cờ được.`
                                }
                                disabled={disabled}
                                onClick={() => update(id, { flag: !d.flag })}
                              >
                                <Flag size={16} />
                              </button>
                            </td>
                            <td>
                              {/* Ô chữ như màn Kiến thức kỹ năng */}
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
          <button className="btn" onClick={markAllPresent} disabled={saving || presentCount === 0}>
            <ClipboardCheck size={16} /> Ghi nhận cả lớp với giá trị mặc định
          </button>
          <div className="row gap-2">
            {dirty.size > 0 && (
              <button className="btn" onClick={() => reload()} disabled={saving}>
                Hủy thay đổi
              </button>
            )}
            <button className="btn btn--primary" onClick={save} disabled={saving || dirty.size === 0}>
              {saving ? <Spinner small /> : <Save size={16} />} Lưu đánh giá{dirty.size ? ` (${dirty.size})` : ''}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
