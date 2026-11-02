import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { ChildAvatar } from '@/components/ChildAvatar';
import { ChevronDown, Lock, Save, UserX } from '@/components/ui/icons';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/contexts/ToastContext';
import { useDailyAssessment, useDailyAssessmentClasses } from '@/hooks/assessment/useAssessment';
import { saveDailySkills } from '@/services/assessment/assessmentService';
import { Breadcrumb } from '@/components/ui/Breadcrumb';
import { SidePanel } from '@/components/ui/SidePanel';
import { StatusPage } from '@/components/ui/StatusPage';
import { DailyModeSelect } from '@/components/assessment/DailyModeSelect';
import { EmptyState, ErrorState, SkeletonRows, Spinner } from '@/components/ui/States';
import { CellPopover } from '@/components/assessment/DailyAssessmentCells';
import { Cell, focusCell } from '@/components/ui/TableCell';
import { PARTICIPATION_LABELS, YCCD_RESULT, YCCD_RESULT_LABELS } from '@/models/assessment/dailyObservationOptions';
import { DateInput } from '@/components/form/DateInput';
import { formatDate, formatDateTime, isIsoDate } from '@/utils/format';
import { addDays, isSchoolDay, todayIso } from '@/utils/assessment/assessmentPeriods';
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

const LEVEL_CLASS = { DAT: 'text-success', CAN_CO_GANG: 'text-warning fw-600', CHUA_DAT: 'text-danger fw-600' };
// Mức của MT ↔ danh sách của BE
const LISTS = { DAT: 'goalsMet', CAN_CO_GANG: 'goalsEffort', CHUA_DAT: 'goalsNotMet' };
const goalName = (g) => (g.goalNo ? `MT${g.goalNo}` : 'MT');

/** Kết quả đã ghi của một trẻ: { [activityKey]: { participation, results: { [goalId]: level } } }; MT chưa chấm thì trống. */
const fromRow = (r) => ({
  comment: r.comment || '',
  activities: Object.fromEntries(
    (r.activities || []).map((a) => [
      a.key,
      {
        participation: a.participation || '',
        results: Object.fromEntries(Object.entries(LISTS).flatMap(([level, list]) => (a[list] || []).map((id) => [id, level]))),
      },
    ]),
  ),
});
const toActivity = (key, act) => ({
  key,
  participation: act?.participation || null,
  ...Object.fromEntries(
    Object.entries(LISTS).map(([level, list]) => [
      list,
      Object.entries(act?.results || {})
        .filter(([, v]) => v === level)
        .map(([id]) => id),
    ]),
  ),
});

/**
 * #52 Đánh giá hằng ngày – Kiến thức kỹ năng (EDU-19): hoạt động và MT lấy từ giáo án tuần đã duyệt (lesson của BE), mỗi
 * hoạt động một cột, mỗi MT chọn Đạt / Cần cố gắng / Chưa đạt. Không tự điền Đạt: chỉ gửi những gì cô đã chọn.
 * Chưa có giáo án duyệt thì khóa phần này. Bấm tên trẻ để ghi mức tham gia và xem đủ MT từng hoạt động.
 */
export default function DailyGoalAssessmentPage() {
  const { user } = useAuth();
  const toast = useToast();
  const { classes, loading: classesLoading, error: classesError } = useDailyAssessmentClasses();
  const [search] = useSearchParams();
  const [classId, setClassId] = useState(search.get('classId') || '');
  const [date, setDate] = useState(() => search.get('date') || lastSchoolDay());
  const currentClassId = classes.some((c) => c.id === classId) ? classId : classes[0]?.id || '';
  const params = useMemo(() => ({ classId: currentClassId, date }), [currentClassId, date]);
  const { sheet, loading, error, reload } = useDailyAssessment(params);

  const [drafts, setDrafts] = useState({});
  // { [childId]: Set(activityKey | '_comment') } — chỉ gửi phần cô đã sửa
  const [dirty, setDirty] = useState({});
  const [saveError, setSaveError] = useState(null);
  const [saveState, setSaveState] = useState({ phase: 'idle', at: null });
  const [openChild, setOpenChild] = useState(null);
  const inFlight = useRef(false);

  useEffect(() => {
    if (!sheet) return;
    setDrafts(Object.fromEntries(sheet.rows.map((r) => [r.childId, fromRow(r)])));
    setDirty({});
    setSaveError(null);
    setSaveState({ phase: 'idle', at: null });
  }, [sheet]);

  const lesson = sheet?.lesson || null;
  const activities = lesson?.activities || [];
  const writable = !!sheet && sheet.canRecord && !sheet.locked && !sheet.yearReadOnly && !!lesson;
  const dirtyIds = Object.keys(dirty);

  const touch = (childId, part) => {
    setDirty((prev) => ({ ...prev, [childId]: new Set([...(prev[childId] || []), part]) }));
    setSaveError(null);
  };
  const setComment = (childId, comment) => {
    setDrafts((prev) => ({ ...prev, [childId]: { ...prev[childId], comment } }));
    touch(childId, '_comment');
  };
  const updateActivity = (childId, key, patch) => {
    setDrafts((prev) => {
      const acts = prev[childId].activities;
      const act = acts[key] || { participation: '', results: {} };
      return { ...prev, [childId]: { ...prev[childId], activities: { ...acts, [key]: { ...act, ...patch(act) } } } };
    });
    touch(childId, key);
  };
  const setResult = (childId, key, goalId, level) =>
    updateActivity(childId, key, (act) => {
      const results = { ...act.results };
      if (level) results[goalId] = level;
      else delete results[goalId];
      return { results };
    });

  const save = async () => {
    if (!dirtyIds.length || inFlight.current) return;
    const entries = dirtyIds.map((childId) => {
      const parts = dirty[childId];
      const d = drafts[childId];
      return {
        childId,
        // null = giữ nhận xét đang có (dùng chung với view Hoạt động chung)
        comment: parts.has('_comment') ? d.comment : null,
        activities: [...parts].filter((k) => k !== '_comment').map((k) => toActivity(k, d.activities[k])),
      };
    });
    inFlight.current = true;
    setSaveState((s) => ({ ...s, phase: 'saving' }));
    try {
      await saveDailySkills({ classId: currentClassId, date: sheet.date, entries }, user);
      setSaveState({ phase: 'saved', at: new Date() });
      toast.success(`Đã lưu đánh giá của ${entries.length} trẻ.`);
      reload({ silent: true });
    } catch (err) {
      setSaveError(err);
      setSaveState((s) => ({ ...s, phase: 'error' }));
      toast.error(err, 'Không lưu được đánh giá');
    } finally {
      inFlight.current = false;
    }
  };
  // Đóng tab / tải lại khi còn thay đổi chưa lưu: trình duyệt hỏi lại
  const hasDirty = dirtyIds.length > 0;
  useEffect(() => {
    if (!hasDirty) return undefined;
    const warn = (e) => e.preventDefault();
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [hasDirty]);
  const saving = saveState.phase === 'saving';

  const rows = sheet?.rows || [];
  const recordedCount = rows.filter((r) => r.recorded).length;
  const commentError = saveError?.details?.comment;
  const formError = saveError && !commentError ? saveError.message : null;
  const panelRow = openChild && rows.find((r) => r.childId === openChild);

  const actTitle = (a) => [a.label, a.topic].filter(Boolean).join(': ');
  const goalSelect = (r, a, g, d, disabled) => {
    const level = d.activities[a.key]?.results[g.id] || '';
    return (
      <div key={g.id} className="dg-pop__line" title={`${goalName(g)}: ${g.text}`}>
        <span className="dg-pop__label">{goalName(g)}</span>
        <select
          className={`select dg-select ${LEVEL_CLASS[level] || ''}`}
          value={level}
          disabled={disabled}
          aria-label={`${goalName(g)} – ${a.label} của ${r.fullName}`}
          onChange={(e) => setResult(r.childId, a.key, g.id, e.target.value)}
        >
          <option value="">Chưa đánh giá</option>
          {Object.values(YCCD_RESULT).map((k) => (
            <option key={k} value={k}>
              {YCCD_RESULT_LABELS[k]}
            </option>
          ))}
        </select>
      </div>
    );
  };

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
              <DateInput
                id="dg-date"
                value={date}
                min={sheet?.yearStart || undefined}
                max={sheet?.today || todayIso()}
                onChange={(v) => isIsoDate(v) && setDate(v)}
              />
            </div>
            <DailyModeSelect mode="skills" classId={currentClassId} date={date} />
            <div className="spacer" />
            {sheet && rows.length > 0 && (
              <div className="text-sm text-2 dg-filter-count">
                Đã ghi nhận <b>{recordedCount}</b>/{rows.length} trẻ có mặt
                {writable && (
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

          {sheet?.yearReadOnly ? (
            <div className="alert alert--info dg-alert-inset">
              <Lock size={18} />
              <div>Lớp thuộc năm học đã kết thúc hoặc chưa bắt đầu, chỉ xem được.</div>
            </div>
          ) : sheet?.locked ? (
            <div className="alert alert--warning dg-alert-inset">
              <Lock size={18} />
              <div>
                Ngày {formatDate(sheet.date)} đã khóa. Nếu cần đánh giá bổ sung, gửi mail cho Phó hiệu trưởng điểm trường hoặc Hiệu trưởng
                để mở lại ngày này.
              </div>
            </div>
          ) : (
            sheet?.unlock && (
              <div className="alert alert--info dg-alert-inset">
                <Lock size={18} />
                <div>
                  Ngày {formatDate(sheet.date)} đã được {sheet.unlock.unlockedByName} mở lại, đánh giá được đến{' '}
                  <strong>{formatDateTime(sheet.unlock.validUntil)}</strong>.
                </div>
              </div>
            )
          )}
          {formError && (
            <div className="alert alert--danger dg-alert-inset" role="alert">
              {formError}
            </div>
          )}

          {error ? (
            <ErrorState error={error} onRetry={reload} />
          ) : loading || classesLoading || !sheet ? (
            <div className="card__body">
              <table className="table">
                <tbody>
                  <SkeletonRows rows={5} cols={4} />
                </tbody>
              </table>
            </div>
          ) : !sheet.attendanceTaken ? (
            <EmptyState
              icon={UserX}
              title={`Lớp chưa điểm danh ngày ${formatDate(sheet.date)}`}
              description="Điểm danh trước, chỉ trẻ có mặt mới được đánh giá."
              action={
                <Link className="btn btn--primary" to={`/attendance?classId=${sheet.classId}&date=${sheet.date}`}>
                  Điểm danh ngay
                </Link>
              }
            />
          ) : !lesson ? (
            <EmptyState
              icon={Lock}
              title="Chưa có giáo án tuần đã duyệt cho ngày này"
              description="Kiến thức kỹ năng chấm theo mục tiêu của giáo án đã duyệt; khi giáo án được duyệt, các hoạt động và mục tiêu sẽ hiện tại đây."
            />
          ) : rows.length === 0 ? (
            <EmptyState icon={UserX} title="Không có trẻ có mặt" description="Cả lớp vắng ngày này." />
          ) : (
            <div className="card__body">
              <div className="table-wrap">
                <table className="table ga-plan-table ga-goal-table dg-day-table dg-day-table--skills" onMouseDown={focusCell}>
                  {/* Độ rộng cột dùng lại lớp của bảng mục tiêu năm: Trẻ, các hoạt động chia đều, Nhận xét */}
                  <colgroup>
                    <col className="ga-goal-table__group" />
                    {activities.map((a) => (
                      <col key={a.key} />
                    ))}
                    <col className="dg-skill-note" />
                  </colgroup>
                  <thead>
                    <tr>
                      <th className="cell--fixed">Trẻ</th>
                      {activities.map((a) => (
                        <th key={a.key}>
                          {/* Sổ xuống xem nội dung hoạt động và các MT trong ngày của hoạt động đó (Tiền 21/10) */}
                          <span className="dg-head-goal">
                            {a.label}
                            <CellPopover label={`Xem mục tiêu trong ngày – ${a.label}`} icon={<ChevronDown size={14} />} minWidth={280}>
                              <div className="dg-pop__title">{actTitle(a)}</div>
                              {a.goals.map((g) => (
                                <div key={g.id} className="text-sm">
                                  <span className="fw-600">{goalName(g)}</span>: {g.text}
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
                    {rows.map((r) => {
                      const id = r.childId;
                      const d = drafts[id] || fromRow(r);
                      const disabled = !writable || saving;
                      const commentInvalid = !!commentError && !!dirty[id]?.has('_comment');
                      return (
                        <tr key={id} title={r.recorded ? 'Đã ghi nhận' : 'Chưa ghi nhận'}>
                          <td className="cell--fixed">
                            <div className="ga-goal-table__pad dg-child">
                              <ChildAvatar child={r} size="sm" />
                              <div className="dg-child__info">
                                <button type="button" className="dg-link-btn fw-600" onClick={() => setOpenChild(id)}>
                                  {r.fullName}
                                </button>
                              </div>
                            </div>
                          </td>
                          {activities.map((a) => (
                            <td key={a.key} className="dg-day-cell">
                              {a.goals.map((g) => goalSelect(r, a, g, d, disabled))}
                            </td>
                          ))}
                          <td>
                            <Cell
                              editable={!disabled}
                              value={d.comment}
                              label={`Nhận xét trong ngày cho ${r.fullName}`}
                              placeholder="Tùy chọn"
                              onChange={(v) => setComment(id, v)}
                            />
                            {commentInvalid && <div className="field__error">{commentError}</div>}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {writable && rows.length > 0 && (
        <div className="page-actions">
          <div className="spacer" />
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

      {/* Chi tiết cả ngày của một trẻ: mọi hoạt động của giáo án, MT, mức tham gia, nhận xét */}
      <SidePanel
        open={!!panelRow}
        title={panelRow ? `${panelRow.fullName} · ${formatDate(sheet.date)}` : ''}
        onClose={() => setOpenChild(null)}
      >
        {panelRow &&
          (() => {
            const id = panelRow.childId;
            const d = drafts[id] || fromRow(panelRow);
            const disabled = !writable || saving;
            return (
              <div className="table-wrap">
                <table className="table ga-plan-table ga-goal-table" onMouseDown={focusCell}>
                  <thead>
                    <tr>
                      <th className="cell--fixed">Hoạt động</th>
                      <th>Kết quả</th>
                      <th>Tham gia</th>
                    </tr>
                  </thead>
                  <tbody>
                    {activities.map((a) => (
                      <tr key={a.key}>
                        <td className="cell--fixed">
                          <div className="ga-goal-table__pad">
                            <div className="fw-600">{a.label}</div>
                            {a.topic && <div className="text-xs">{a.topic}</div>}
                            {a.goals.map((g) => (
                              <div key={g.id} className="text-xs muted">
                                {goalName(g)}: {g.text}
                              </div>
                            ))}
                          </div>
                        </td>
                        <td>{a.goals.map((g) => goalSelect(panelRow, a, g, d, disabled))}</td>
                        <td>
                          <select
                            className="ga-cell-input"
                            value={d.activities[a.key]?.participation || ''}
                            disabled={disabled}
                            aria-label={`Mức tham gia ${a.label} của ${panelRow.fullName}`}
                            onChange={(e) => updateActivity(id, a.key, () => ({ participation: e.target.value }))}
                          >
                            <option value="">—</option>
                            {Object.entries(PARTICIPATION_LABELS).map(([k, v]) => (
                              <option key={k} value={k}>
                                {v}
                              </option>
                            ))}
                          </select>
                        </td>
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
                          label={`Nhận xét trong ngày cho ${panelRow.fullName}`}
                          placeholder="Tùy chọn"
                          onChange={(v) => setComment(id, v)}
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
