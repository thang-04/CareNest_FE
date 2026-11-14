import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { ChildAvatar } from '@/components/ChildAvatar';
import { Flag, Lock, Save, UserX } from '@/components/ui/icons';
import { useLeaveGuard } from '@/hooks/useLeaveGuard';
import { LeaveConfirmModal } from '@/components/ui/LeaveConfirmModal';
import { ConfirmationModal } from '@/components/ui/ConfirmationModal';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/contexts/ToastContext';
import { useDailyAssessment, useDailyAssessmentClasses } from '@/hooks/assessment/useAssessment';
import { DailyModeSelect } from '@/components/assessment/DailyModeSelect';
import { ClassCommentField } from '@/components/assessment/ClassComments';
import { saveDailyGeneral } from '@/services/assessment/assessmentService';
import { Breadcrumb } from '@/components/ui/Breadcrumb';
import { EmptyState, ErrorState, SkeletonRows, Spinner } from '@/components/ui/States';
import { StatusPage } from '@/components/ui/StatusPage';
import { AbsentRows, BehaviorsCell, HealthCell, MealsCell } from '@/components/assessment/DailyAssessmentCells';
import { Cell } from '@/components/ui/TableCell';
import { CLASS_COMMENT_MAX, DAILY_COMMENT_MAX, EMOTION, EMOTION_LABELS } from '@/models/assessment/assessmentConstants';
import { NAP, NAP_LABELS, PARTICIPATION, PARTICIPATION_LABELS } from '@/models/assessment/dailyObservationOptions';
import { createGeneralDraft, getGeneralDirtyIds, getGeneralSaveEntries, isGeneralRecorded } from '@/utils/assessment/dailyGeneralDraft';
import { DateInput } from '@/components/form/DateInput';
import { formatDate, formatDateTime, isIsoDate } from '@/utils/format';
import { todayIso } from '@/utils/assessment/assessmentPeriods';
import { assessmentCrumbs, SECTIONS } from '@/utils/assessment/breadcrumbs';
import '@/styles/modules/assessment.css';

const COLS = 9;
// Ô khác giá trị mặc định được tô nhẹ để giáo viên thấy ngay ngoại lệ
const tint = (tone) => (tone ? `dg-cell--${tone}` : '');

/** #52 Đánh giá hằng ngày – Hoạt động chung (GBR-OBS-01..05): giáo viên của lớp; dữ liệu và luật theo BE. */
export default function DailyAssessmentPage() {
  const { user } = useAuth();
  const toast = useToast();
  const { classes, loading: classesLoading, error: classesError } = useDailyAssessmentClasses();
  const [search] = useSearchParams();
  const [classId, setClassId] = useState(search.get('classId') || '');
  const [date, setDate] = useState(() => search.get('date') || '');
  // Chưa chọn ngày: BE trả ngày học gần nhất theo ngày nghỉ trong cấu hình năm học (lễ, Tết…)
  const currentClassId = classes.some((c) => c.id === classId) ? classId : classes[0]?.id || '';
  const params = useMemo(() => ({ classId: currentClassId, date: date || undefined }), [currentClassId, date]);
  const { sheet, loading, error, reload } = useDailyAssessment(params);
  const shownDate = date || sheet?.date || '';

  const [drafts, setDrafts] = useState({});
  const [loadedSheet, setLoadedSheet] = useState(null);
  const [saveError, setSaveError] = useState(null);
  const [saving, setSaving] = useState(false);
  const [classComment, setClassComment] = useState('');

  // Phiếu mới (đổi lớp / ngày hoặc vừa lưu) thì nạp lại bản đang nhập
  useEffect(() => {
    if (!sheet) return;
    setDrafts(Object.fromEntries(sheet.rows.map((r) => [r.childId, createGeneralDraft(r, sheet.mealSessions)])));
    setLoadedSheet(sheet);
    setClassComment(sheet.classComment?.text || '');
    setSaveError(null);
  }, [sheet]);

  // Chỉ ghi khi BE cho phép: giáo viên lớp, năm học đang hoạt động, ngày chưa khóa (hoặc đã được mở lại)
  const writable = !!sheet && sheet.canRecord && !sheet.locked && !sheet.yearReadOnly;
  const dirty = loadedSheet === sheet ? getGeneralDirtyIds(sheet?.rows || [], sheet?.mealSessions || [], drafts) : new Set();
  const changedEntries = getGeneralSaveEntries(sheet?.rows || [], sheet?.mealSessions || [], drafts, dirty);
  // Không có gì mới (cả lớp đã lưu): cô vẫn bấm Lưu được để xác nhận lại cả lớp như đang hiện
  const saveEntries =
    changedEntries.length || !writable
      ? changedEntries
      : (sheet?.rows || []).map((r) => ({ childId: r.childId, ...(drafts[r.childId] || createGeneralDraft(r, sheet.mealSessions)) }));
  const classCommentDirty = !!sheet && loadedSheet === sheet && classComment !== (sheet.classComment?.text || '');
  const canSave = saveEntries.length > 0 || classCommentDirty;
  const hasChanges = dirty.size > 0 || classCommentDirty;

  // Còn thay đổi chưa lưu: hỏi khi rời màn, đổi chế độ, đổi lớp hoặc ngày
  const guard = useLeaveGuard({ when: writable && hasChanges, onSave: () => save() });
  const [pendingChange, setPendingChange] = useState(null);
  const confirmChange = (apply) => (writable && hasChanges ? setPendingChange(() => apply) : apply());

  const update = (childId, patch) => {
    setDrafts((prev) => ({ ...prev, [childId]: { ...prev[childId], ...patch } }));
    setSaveError(null);
  };

  // BE cắt khoảng trắng đầu / cuối rồi mới đếm
  const classCommentTooLong = classComment.trim().length > CLASS_COMMENT_MAX;
  const save = async () => {
    if (saving || !writable || loading || classesLoading || error || !canSave || classCommentTooLong) return false;
    setSaving(true);
    setSaveError(null);
    try {
      await saveDailyGeneral(
        {
          classId: currentClassId,
          date: sheet.date,
          entries: saveEntries,
          ...(classCommentDirty ? { classComment } : {}),
        },
        user,
      );
      toast.success(
        saveEntries.length
          ? `Đã lưu đánh giá của ${saveEntries.length} trẻ${classCommentDirty ? ' và nhận xét chung của lớp' : ''}.`
          : 'Đã lưu nhận xét chung của lớp.',
      );
      await reload({ silent: true });
      return true;
    } catch (err) {
      setSaveError(err);
      // Lỗi theo ô đã hiện đỏ dưới ô đó; chỉ báo toast khi lỗi không gắn được vào ô nào
      if (!err.details?.comment && !err.details?.classComment) toast.error(err, 'Không lưu được đánh giá');
      return false;
    } finally {
      setSaving(false);
    }
  };

  const recordedCount = sheet?.rows.filter(isGeneralRecorded).length || 0;
  const commentError = saveError?.details?.comment;
  const classCommentError = classCommentTooLong
    ? `Nhận xét chung của lớp tối đa ${CLASS_COMMENT_MAX} ký tự`
    : saveError?.details?.classComment;
  // Lỗi không gắn được vào một ô (trẻ chưa có mặt, ngày đã khóa…): hiện ở đầu bảng
  const formError = saveError && !commentError && !classCommentError ? saveError.message : null;

  return (
    <div className="page">
      <Breadcrumb items={assessmentCrumbs(SECTIONS.daily)} />
      <div className="page__head">
        <h1 className="page__title">Đánh giá hằng ngày</h1>
      </div>

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
              {/* GV chỉ dạy một lớp: hiện tên lớp, không bắt chọn */}
              {classes.length === 1 ? (
                <span id="dg-class" className="fw-600">
                  {classes[0].name}
                </span>
              ) : (
                <select
                  id="dg-class"
                  className="select"
                  value={currentClassId}
                  onChange={(e) => {
                    const next = e.target.value;
                    confirmChange(() => setClassId(next));
                  }}
                >
                  {classes.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              )}
            </div>
            <div className="field">
              <label className="field__label" htmlFor="dg-date">
                Ngày
              </label>
              <DateInput
                id="dg-date"
                value={shownDate}
                min={sheet?.yearStart || undefined}
                max={sheet?.today || todayIso()}
                onChange={(v) => isIsoDate(v) && confirmChange(() => setDate(v))}
              />
            </div>
            <DailyModeSelect mode="general" classId={currentClassId} date={shownDate} />
            <div className="spacer" />
            {sheet && sheet.rows.length > 0 && (
              <div className="text-sm text-2 dg-filter-count">
                Đã ghi nhận <b>{recordedCount}</b>/{sheet.rows.length} trẻ có mặt
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
          ) : (
            <div className="table-wrap dg-roll-wrap dg-sheet-wrap">
              <table className="table table--grid dg-sheet dg-roll">
                <thead>
                  <tr className="dg-head-cols">
                    <th className="dg-col-child dg-sticky-col cell--fixed">Trẻ</th>
                    <th>Sức khỏe</th>
                    <th>Ăn</th>
                    <th>Ngủ trưa</th>
                    <th>Cảm xúc</th>
                    <th>Hành vi</th>
                    <th>Tham gia</th>
                    <th className="center">Cờ</th>
                    <th className="dg-col-note">Nhận xét</th>
                  </tr>
                </thead>
                <tbody>
                  {loading || classesLoading || !sheet ? (
                    <SkeletonRows rows={5} cols={COLS} />
                  ) : !sheet.attendanceTaken ? (
                    <tr>
                      <td colSpan={COLS}>
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
                      </td>
                    </tr>
                  ) : sheet.rows.length === 0 && !sheet.absentChildren?.length ? (
                    <tr>
                      <td colSpan={COLS}>
                        <EmptyState icon={UserX} title="Không có trẻ có mặt" description="Cả lớp vắng ngày này." />
                      </td>
                    </tr>
                  ) : (
                    sheet.rows.map((r) => {
                      const id = r.childId;
                      const d = drafts[id] || createGeneralDraft(r, sheet.mealSessions);
                      const disabled = !writable || saving;
                      const name = r.fullName;
                      const commentTooLong = (d.comment || '').length > DAILY_COMMENT_MAX;
                      const commentInvalid = commentTooLong || (!!commentError && dirty.has(id) && !!d.comment.trim());
                      // Viền trái của dòng: chưa lưu / đã ghi nhận / chưa đánh giá
                      const status = dirty.has(id)
                        ? ['dirty', 'Đã thay đổi, chưa lưu']
                        : isGeneralRecorded(r)
                          ? ['saved', 'Đã ghi nhận']
                          : ['new', 'Chưa đánh giá'];
                      return (
                        <tr key={id} className={`dg-row dg-row--${status[0]}`} title={status[1]}>
                          <td className="dg-col-child dg-sticky-col cell--fixed">
                            <div className="dg-child">
                              <ChildAvatar child={r} size="sm" />
                              <div className="dg-child__info">
                                <span className="fw-600">{name}</span>
                              </div>
                            </div>
                          </td>
                          <td className={`dg-col-health ${tint(d.healthSigns.length ? 'bad' : '')}`}>
                            <HealthCell
                              health={r.health}
                              draft={d}
                              name={name}
                              disabled={disabled}
                              onChange={(patch) => update(id, patch)}
                            />
                          </td>
                          <td className="dg-col-meals">
                            <MealsCell
                              draft={d}
                              row={r}
                              sessions={sheet.mealSessions}
                              name={name}
                              disabled={disabled}
                              onChange={(patch) => update(id, patch)}
                            />
                          </td>
                          <td className={`dg-col-nap ${tint(d.nap === NAP.KHONG_NGU ? 'bad' : d.nap !== NAP.NGU_TOT ? 'warn' : '')}`}>
                            <select
                              className="select dg-select"
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
                          <td className={tint(d.emotion === EMOTION.SAD || d.emotion === EMOTION.UPSET ? 'warn' : '')}>
                            <select
                              className="select dg-select"
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
                          <td>
                            <BehaviorsCell draft={d} name={name} disabled={disabled} onChange={(patch) => update(id, patch)} />
                          </td>
                          <td className={tint(d.participation === PARTICIPATION.CHUA_TICH_CUC ? 'warn' : '')}>
                            <select
                              className="select dg-select"
                              value={d.participation}
                              disabled={disabled}
                              onChange={(e) => update(id, { participation: e.target.value })}
                              aria-label={`Mức tham gia cả ngày của ${name}`}
                            >
                              <option value="">—</option>
                              {Object.entries(PARTICIPATION_LABELS).map(([k, v]) => (
                                <option key={k} value={k}>
                                  {v}
                                </option>
                              ))}
                            </select>
                          </td>
                          <td className="center">
                            <button
                              type="button"
                              className={`dg-flag ${d.flag ? 'dg-flag--on' : ''}`}
                              aria-pressed={d.flag}
                              aria-label={`Cờ bé ngoan hôm nay cho ${name}`}
                              title={`${d.flag ? 'Bỏ' : 'Cắm'} cờ bé ngoan (1 cờ / ngày)`}
                              disabled={disabled}
                              onClick={() => update(id, { flag: !d.flag })}
                            >
                              <Flag size={16} />
                            </button>
                          </td>
                          <td className="dg-col-note">
                            {/* Cùng ô nhận xét như màn Kiến thức kỹ năng (tự giãn dòng, BE giới hạn độ dài) */}
                            <Cell
                              editable={!disabled}
                              value={d.comment}
                              label={`Nhận xét trong ngày cho ${name}`}
                              onChange={(v) => update(id, { comment: v })}
                            />
                            {commentInvalid && (
                              <div className="field__error">
                                {commentTooLong ? `Nhận xét tối đa ${DAILY_COMMENT_MAX} ký tự` : commentError}
                              </div>
                            )}
                          </td>
                        </tr>
                      );
                    })
                  )}
                  {!loading && !classesLoading && sheet?.attendanceTaken && (
                    <AbsentRows items={sheet.absentChildren} colSpan={COLS} firstClass="dg-col-child dg-sticky-col cell--fixed" />
                  )}
                </tbody>
              </table>
            </div>
          )}
          {sheet && !loading && !error && (
            <ClassCommentField
              value={classComment}
              onChange={(value) => {
                setClassComment(value);
                setSaveError(null);
              }}
              comment={sheet.classComment}
              disabled={!writable || saving || classesLoading}
              error={classCommentError}
            />
          )}
        </div>
      )}

      {writable && (
        <div className="page-actions">
          {/* Chuyển Hoạt động chung / Kiến thức kỹ năng bằng ô "Nội dung đánh giá" (user chốt 12/11/2026 bỏ nút Sang) */}
          <div className="spacer" />
          <div className="row gap-2">
            {(dirty.size > 0 || classCommentDirty) && (
              <button className="btn" onClick={() => reload()} disabled={saving}>
                Hủy thay đổi
              </button>
            )}
            <button
              className="btn btn--primary"
              onClick={save}
              disabled={saving || loading || classesLoading || !!error || !canSave || classCommentTooLong}
            >
              {saving ? <Spinner small /> : <Save size={16} />} Lưu đánh giá{saveEntries.length ? ` (${saveEntries.length})` : ''}
            </button>
          </div>
        </div>
      )}
      <LeaveConfirmModal
        {...guard.modal}
        canSave
        message="Đánh giá hằng ngày có thay đổi chưa lưu. Lưu trước khi rời màn hoặc bỏ các thay đổi."
      />
      <ConfirmationModal
        open={!!pendingChange}
        title="Đổi lớp hoặc ngày?"
        message="Các đánh giá chưa lưu sẽ bị bỏ."
        confirmLabel="Bỏ thay đổi và chuyển"
        onClose={() => setPendingChange(null)}
        onConfirm={() => {
          pendingChange?.();
          setPendingChange(null);
        }}
      />
    </div>
  );
}
