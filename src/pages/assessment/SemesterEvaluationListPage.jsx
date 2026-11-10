import { useEffect, useRef, useState } from 'react';
import { Breadcrumb } from '@/components/ui/Breadcrumb';
import { AssessmentFormHeading } from '@/components/assessment/AssessmentFormHeading';
import ThemeEvaluationPreviewModal from '@/components/assessment/ThemeEvaluationPreviewModal';
import { ConfirmationModal } from '@/components/ui/ConfirmationModal';
import { LeaveConfirmModal } from '@/components/ui/LeaveConfirmModal';
import { Modal } from '@/components/ui/Modal';
import { EmptyState, ErrorState, LoadingState } from '@/components/ui/States';
import { Printer, Download, Save } from '@/components/ui/icons';
import { useSchoolYear } from '@/contexts/SchoolYearContext';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/contexts/ToastContext';
import { useAsync } from '@/hooks/useAsync';
import { useLeaveGuard } from '@/hooks/useLeaveGuard';
import { useThemeClasses } from '@/hooks/assessment/useAssessment';
import { getSemesterAssessment, saveSemesterAssessment, confirmSemesterAssessment } from '@/services/assessment/assessmentService';
import { assessmentCrumbs, SECTIONS } from '@/utils/assessment/breadcrumbs';
import { semesterAssessmentFile, semesterAssessmentRows, semesterLabel } from '@/utils/assessment/semesterAssessmentDoc';
import { downloadXlsx } from '@/utils/exportXlsx';
import { formatDate, formatDateTime } from '@/utils/format';
import { semestersOf } from '@/utils/semesters';
import { PERMISSIONS } from '@/models/bePermissions';
import { hasBePermission } from '@/utils/bePermissions';
import '@/styles/modules/assessment.css';

export default function SemesterEvaluationListPage() {
  const { user } = useAuth();
  const toast = useToast();
  const { schoolYear, schoolYears } = useSchoolYear();
  const year = schoolYears.find((y) => String(y.id) === String(schoolYear));
  const semesters = semestersOf(year).filter((s) => s.key !== 'YEAR');
  const { classes, loading: classesLoading, error: classesError } = useThemeClasses();
  const [picked, setPicked] = useState('');
  const classId = classes.find((c) => String(c.classId) === String(picked))?.classId || classes[0]?.classId;
  const [selectedSemester, setSemester] = useState(1);
  const validSemester = semesters.find((s) => s.key === `S${selectedSemester}`);
  const {
    data: board,
    loading,
    error,
    reload,
    setData,
  } = useAsync(() => getSemesterAssessment({ classId, semester: selectedSemester }), [classId, selectedSemester, schoolYear], {
    enabled: !!classId && !!validSemester,
  });
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const scope = `${schoolYear}:${classId}:${selectedSemester}`;
  const scopeRef = useRef(scope);
  scopeRef.current = scope;
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [preview, setPreview] = useState(null);
  const [detail, setDetail] = useState(null);
  const [search, setSearch] = useState({ draft: '', applied: '' });
  const canEdit = !!board?.canEdit && hasBePermission(user, PERMISSIONS.ASSESSMENT_RECORD);
  const canConfirm = !!board?.canConfirm && hasBePermission(user, PERMISSIONS.ASSESSMENT_CONFIRM);
  useEffect(() => {
    setNote(board?.note || '');
    setDetail(null);
  }, [board]);
  const dirty = !!board && canEdit && note !== (board.note || '');
  const run = async (confirm = false) => {
    if (!board || busy) return false;
    const requestScope = scope;
    setBusy(true);
    try {
      const saved = await (confirm ? confirmSemesterAssessment : saveSemesterAssessment)({
        classId: board.classId,
        semester: board.semester,
        note,
      });
      if (!mounted.current || scopeRef.current !== requestScope) return false;
      setData(saved);
      setNote(saved.note || '');
      setConfirmOpen(false);
      toast.success(confirm ? 'Đã xác nhận đánh giá học kỳ.' : 'Đã lưu đánh giá học kỳ.');
      return true;
    } catch (e) {
      toast.error(e);
      return false;
    } finally {
      setBusy(false);
    }
  };
  const guard = useLeaveGuard({ when: dirty || busy, onSave: () => run() });
  const visible = (board?.rows || []).filter((r) => r.fullName.toLocaleLowerCase('vi').includes(search.applied.toLocaleLowerCase('vi')));
  const missing = (board?.rows || []).filter((r) => r.domains.some((d) => d.met === null)).length;
  const cell = (r, d) => r.domains.find((c) => c.domainId === d.domainId);
  return (
    <div className="page">
      <Breadcrumb items={assessmentCrumbs(SECTIONS.semester)} />
      <h1 className="page__title">Đánh giá học kỳ</h1>
      <div className="card">
        <div className="filter-bar">
          <div className="field">
            <label className="field__label" htmlFor="semester-class">
              Lớp
            </label>
            <select
              id="semester-class"
              className="select"
              value={classId || ''}
              disabled={busy || classesLoading}
              onChange={(e) => guard.leave(() => setPicked(e.target.value))}
            >
              {classes.map((c) => (
                <option key={c.classId} value={c.classId}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <label className="field__label" htmlFor="semester-period">
              Học kỳ
            </label>
            <select
              id="semester-period"
              className="select"
              value={validSemester ? selectedSemester : ''}
              disabled={busy}
              onChange={(e) => guard.leave(() => setSemester(Number(e.target.value)))}
            >
              {!validSemester && <option value="">Chọn học kỳ</option>}
              {semesters.map((s) => (
                <option key={s.key} value={s.key === 'S1' ? 1 : 2}>
                  {s.label}
                </option>
              ))}
            </select>
          </div>
          {validSemester && (
            <span className="muted text-sm">
              {formatDate(validSemester.start)} – {formatDate(validSemester.end)}
            </span>
          )}
          <form
            className="row gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              setSearch((current) => ({ ...current, applied: current.draft.trim() }));
            }}
          >
            <input
              className="input"
              aria-label="Tìm tên trẻ"
              placeholder="Tìm tên trẻ"
              value={search.draft}
              onChange={(e) => {
                const draft = e.target.value;
                setSearch((current) => ({ ...current, draft }));
              }}
            />
            <button className="btn" type="submit">
              Tìm
            </button>
          </form>
          <div className="spacer" />
          {board && (
            <>
              <button className="btn" disabled={dirty || busy} onClick={() => setPreview(semesterAssessmentFile(board))}>
                <Printer size={16} /> Xem trước & In
              </button>
              <button
                className="btn"
                disabled={dirty || busy}
                onClick={() => downloadXlsx(semesterAssessmentRows(board), `danh-gia-hoc-ky-${board.semester}.xlsx`, { headerRow: 3 })}
              >
                <Download size={16} /> Xuất Excel
              </button>
            </>
          )}
        </div>
        {classesError ? (
          <ErrorState error={classesError} />
        ) : classesLoading ? (
          <LoadingState />
        ) : !classId ? (
          <EmptyState title="Chưa có lớp trong phạm vi" />
        ) : !validSemester ? (
          <EmptyState
            title="Chưa cấu hình thời gian học kỳ"
            description="Hiệu trưởng đặt ngày học kỳ tại Cấu hình thời gian của năm học."
          />
        ) : error ? (
          <ErrorState error={error} onRetry={reload} />
        ) : loading || !board ? (
          <LoadingState />
        ) : (
          <div className="card__body">
            <span className={`chip ${board.status === 'CONFIRMED' ? 'chip--green' : ''}`}>
              {board.status === 'CONFIRMED' ? 'Đã xác nhận' : 'Chưa xác nhận'}
            </span>
            {board.confirmedAt && (
              <span className="muted text-sm">
                {' '}
                {board.confirmedByName} · {formatDateTime(board.confirmedAt)}
              </span>
            )}
            <AssessmentFormHeading title="BẢNG TỔNG HỢP ĐÁNH GIÁ SỰ PHÁT TRIỂN CỦA TRẺ">
              {semesterLabel(board.semester)} · {board.className} · Năm học {board.yearName}
            </AssessmentFormHeading>
            {!board.domains.length ? (
              <EmptyState
                title="Chưa có mục tiêu trong học kỳ"
                description="Kiểm tra kế hoạch năm học đã duyệt và mục tiêu gắn chủ đề trong kỳ."
              />
            ) : (
              <div className="table-wrap">
                <table className="table table--grid table--compact dg-theme-table dg-semester-table">
                  <colgroup>
                    <col className="dg-eval-index-col" />
                    <col className="dg-semester-name-col" />
                    <col span={board.domains.length * 2} />
                  </colgroup>
                  <thead>
                    <tr>
                      <th rowSpan={2} className="num">
                        STT
                      </th>
                      <th rowSpan={2}>Họ tên trẻ</th>
                      {board.domains.map((d) => (
                        <th key={d.domainId ?? 'none'} colSpan={2} className="center">
                          {d.name}
                        </th>
                      ))}
                    </tr>
                    <tr>
                      {board.domains.flatMap((d) => [
                        <th key={`${d.domainId}-yes`} className="center">
                          Đạt
                        </th>,
                        <th key={`${d.domainId}-no`} className="center">
                          Chưa đạt
                        </th>,
                      ])}
                    </tr>
                  </thead>
                  <tbody>
                    {!visible.length ? (
                      <tr>
                        <td colSpan={2 + board.domains.length * 2}>
                          <EmptyState title="Không có trẻ phù hợp" />
                        </td>
                      </tr>
                    ) : (
                      visible.map((r, i) => (
                        <tr key={r.childId}>
                          <td className="num">{i + 1}</td>
                          <td>{r.fullName}</td>
                          {board.domains.flatMap((d) =>
                            [true, false].map((option) => (
                              <td key={`${d.domainId}-${option}`} className="center">
                                <button
                                  // Dấu ✓ xanh (Đạt) / đỏ (Chưa đạt) như phiếu đánh giá cuối năm
                                  className={`dg-theme-cell ${option ? '' : 'is-not-met'}`}
                                  type="button"
                                  disabled={busy}
                                  aria-label={`${r.fullName} · ${d.name} · Xem căn cứ`}
                                  onClick={() => setDetail({ child: r.fullName, domain: cell(r, d) })}
                                >
                                  {cell(r, d)?.met === option ? '✓' : ''}
                                </button>
                              </td>
                            )),
                          )}
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            )}
            <p className="muted text-sm mt-8">
              Bấm ô đánh giá để xem các mục tiêu làm căn cứ. {missing > 0 ? `${missing} trẻ còn mục tiêu chưa có kết quả.` : ''}
            </p>
            <div className="field mt-16">
              <label className="field__label" htmlFor="semester-note">
                Một số lưu ý
              </label>
              {canEdit ? (
                <textarea
                  id="semester-note"
                  className="textarea"
                  rows={3}
                  maxLength={1000}
                  value={note}
                  disabled={busy}
                  onChange={(e) => setNote(e.target.value)}
                />
              ) : (
                <div className="text-sm">{board.note || '—'}</div>
              )}
            </div>
            {(canEdit || hasBePermission(user, PERMISSIONS.ASSESSMENT_CONFIRM)) && (
              <div className="row gap-2 mt-16">
                <div className="spacer" />
                {canEdit && (
                  <button className="btn" disabled={busy || (!dirty && board.status !== 'NONE')} onClick={() => run()}>
                    <Save size={16} /> Lưu
                  </button>
                )}
                {hasBePermission(user, PERMISSIONS.ASSESSMENT_CONFIRM) && (
                  <button className="btn btn--primary" disabled={busy || !canConfirm} onClick={() => setConfirmOpen(true)}>
                    Xác nhận
                  </button>
                )}
              </div>
            )}
            {hasBePermission(user, PERMISSIONS.ASSESSMENT_CONFIRM) && !board.canConfirm && (
              <p className="muted text-sm">Chỉ xác nhận sau khi học kỳ kết thúc và các mục tiêu đã có đủ kết quả.</p>
            )}
          </div>
        )}
      </div>
      <ConfirmationModal
        open={confirmOpen}
        title="Xác nhận đánh giá học kỳ?"
        message="Kết quả, lĩnh vực và mục tiêu sẽ được chốt cho cả lớp; sau xác nhận không chỉnh sửa."
        onConfirm={() => run(true)}
        onClose={() => !busy && setConfirmOpen(false)}
      />
      <LeaveConfirmModal {...guard.modal} canSave message="Đánh giá học kỳ có lưu ý chưa lưu." />
      {preview && <ThemeEvaluationPreviewModal file={preview} onClose={() => setPreview(null)} />}
      {detail && (
        <Modal open title={`${detail.child} · ${detail.domain?.name || 'Lĩnh vực'}`} onClose={() => setDetail(null)} size="lg">
          <div className="table-wrap">
            <table className="table table--grid">
              <thead>
                <tr>
                  <th>Mục tiêu</th>
                  <th className="center">Chủ đề Đạt / Chủ đề có kết quả</th>
                  <th>Kết quả</th>
                </tr>
              </thead>
              <tbody>
                {detail.domain?.goals.map((g) => (
                  <tr key={g.goalId}>
                    <td>
                      MT{g.goalNo} · {g.text}
                    </td>
                    <td className="center">
                      {g.metActivities}/{g.assessedActivities}
                    </td>
                    <td>{g.met === null ? 'Chưa có kết quả' : g.met ? 'Đạt' : 'Chưa đạt'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Modal>
      )}
    </div>
  );
}
