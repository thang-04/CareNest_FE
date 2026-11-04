import { useEffect, useMemo, useState } from 'react';
import { Printer, Save } from '@/components/ui/icons';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/contexts/ToastContext';
import { useYearEndSheet } from '@/hooks/assessment/useAssessment';
import { saveYearEndSheet } from '@/services/assessment/assessmentService';
import { EmptyState, ErrorState, LoadingState, Spinner } from '@/components/ui/States';
import ThemeEvaluationPreviewModal from '@/components/assessment/ThemeEvaluationPreviewModal';
import { yearEndSheetFile } from '@/utils/assessment/yearEndSheetDoc';
import { formatDate } from '@/utils/format';

const NOTE_FIELDS = [
  ['forChild', 'Đối với trẻ'],
  ['forTeacher', 'Đối với giáo viên'],
  ['forSchool', 'Đối với nhà trường'],
  ['forParent', 'Đối với cha mẹ / người chăm sóc trẻ'],
];
const NOTE_MAX = 1000;
const emptyNotes = { forChild: '', forTeacher: '', forSchool: '', forParent: '' };
const notesOf = (sheet) => Object.fromEntries(NOTE_FIELDS.map(([k]) => [k, sheet?.notes?.[k] || '']));
const REVERT = 'auto';

/**
 * Phiếu đánh giá sự phát triển của trẻ cuối năm (BE OBS-28): MT kế hoạch năm theo lĩnh vực, ô Đạt / Chưa đạt điền sẵn từ
 * cuối chủ đề, GV sửa tay; cân nặng – chiều cao từ phần sức khỏe; 4 lưu ý. sheetRef.current = { dirty, save } để màn đánh
 * giá lưu phiếu trước khi xác nhận.
 */
export function YearEndSheetCard({ evaluation, child, comment, sheetRef, onDirtyChange }) {
  const { user } = useAuth();
  const toast = useToast();
  const { sheet, loading, error, reload } = useYearEndSheet(evaluation.id);
  const [edits, setEdits] = useState({});
  const [notes, setNotes] = useState(emptyNotes);
  const [busy, setBusy] = useState(false);
  const [preview, setPreview] = useState(null);

  // Tải phiếu (mở trẻ khác / sau khi lưu): bỏ chỉnh sửa tạm, lấy lưu ý đã lưu
  useEffect(() => {
    setEdits({});
    setNotes(notesOf(sheet));
  }, [sheet]);

  const saved = useMemo(() => notesOf(sheet), [sheet]);
  const dirty = Object.keys(edits).length > 0 || NOTE_FIELDS.some(([k]) => notes[k] !== saved[k]);

  const save = async ({ silent = false } = {}) => {
    const long = NOTE_FIELDS.find(([k]) => notes[k].trim().length > NOTE_MAX);
    if (long) {
      toast.error(`${long[1]}: tối đa ${NOTE_MAX} ký tự.`, 'Chưa lưu được phiếu');
      return false;
    }
    setBusy(true);
    try {
      await saveYearEndSheet(
        evaluation.id,
        {
          goals: Object.entries(edits).map(([goalId, v]) => ({ goalId: Number(goalId), met: v === REVERT ? null : v })),
          ...Object.fromEntries(NOTE_FIELDS.map(([k]) => [k, notes[k]])),
        },
        user,
      );
      if (!silent) toast.success('Đã lưu phiếu đánh giá. Phiếu chốt khi cô xác nhận đánh giá cuối năm.');
      await reload({ silent: true });
      return true;
    } catch (err) {
      toast.error(err, 'Chưa lưu được phiếu');
      return false;
    } finally {
      setBusy(false);
    }
  };
  if (sheetRef) sheetRef.current = { dirty: !!sheet?.canEdit && dirty, save: () => save({ silent: true }) };
  const pendingEdit = !!sheet?.canEdit && dirty;
  useEffect(() => {
    onDirtyChange?.(pendingEdit);
  }, [pendingEdit, onDirtyChange]);

  if (loading) return <LoadingState />;
  if (error) return <ErrorState error={error} onRetry={reload} />;
  if (!sheet) return null;

  const valueOf = (g) => {
    if (!(g.goalId in edits)) return g.met;
    return edits[g.goalId] === REVERT ? g.auto : edits[g.goalId];
  };
  const manualOf = (g) => {
    if (!(g.goalId in edits)) return g.manual;
    const v = edits[g.goalId];
    return v !== REVERT && v !== g.auto;
  };
  // Bấm ô đang chọn: về kết quả hệ thống (tổng hợp cuối chủ đề); bấm ô kia: sửa tay
  const pick = (g, met) => setEdits((prev) => ({ ...prev, [g.goalId]: valueOf(g) === met ? REVERT : met }));

  const all = sheet.domains.flatMap((d) => d.goals);
  const met = all.filter((g) => valueOf(g) === true).length;
  const notMet = all.filter((g) => valueOf(g) === false).length;
  const m = sheet.measurement;
  const openPreview = () =>
    setPreview(
      yearEndSheetFile({
        sheet: {
          ...sheet,
          notes,
          domains: sheet.domains.map((d) => ({ ...d, goals: d.goals.map((g) => ({ ...g, met: valueOf(g) })) })),
        },
        ev: evaluation,
        child,
        comment,
      }),
    );

  return (
    <div className="card mt-16">
      <div className="card__header">
        <div className="card__title">Phiếu đánh giá sự phát triển của trẻ</div>
        <button type="button" className="btn btn--sm" onClick={openPreview}>
          <Printer size={16} aria-hidden /> Xem trước &amp; In
        </button>
      </div>
      <div className="card__body">
        <p className="text-sm">
          {m ? (
            <>
              Cân nặng: <strong>{m.weightKg ?? '—'}</strong> kg · Chiều cao: <strong>{m.heightCm ?? '—'}</strong> cm
              <span className="muted"> (cân đo ngày {formatDate(m.date)})</span>
            </>
          ) : (
            <span className="muted">Trẻ chưa có lần cân đo nào ở phần sức khỏe.</span>
          )}
        </p>
        {sheet.canEdit && (
          <p className="muted text-sm">
            Hệ thống điền từ bảng đánh giá cuối chủ đề (chủ đề gần nhất có mục tiêu). Bấm ô để sửa tay; bấm lại ô đang chọn để về kết quả hệ
            thống. Ô sửa tay có viền đậm.
          </p>
        )}
        {all.length === 0 ? (
          <EmptyState title="Chưa có mục tiêu" description="Kế hoạch năm học đã duyệt của nhóm tuổi chưa có mục tiêu nào." />
        ) : (
          <div className="table-wrap">
            <table className="table table--grid table--compact dg-theme-table dg-year-sheet">
              <thead>
                <tr>
                  <th className="num">TT</th>
                  <th>Mục tiêu giáo dục</th>
                  <th className="center">Đạt</th>
                  <th className="center">Chưa đạt</th>
                </tr>
              </thead>
              <tbody>
                {sheet.domains.map((d) => [
                  <tr key={`d-${d.domainId ?? 'none'}`} className="dg-year-sheet__domain">
                    <th colSpan={4}>{(d.name || 'Mục tiêu khác').toUpperCase()}</th>
                  </tr>,
                  ...d.goals.map((g, i) => {
                    const value = valueOf(g);
                    const manual = manualOf(g);
                    return (
                      <tr key={g.goalId}>
                        <td className="num">{i + 1}</td>
                        <td className="dg-year-sheet__goal">
                          {g.text}
                          {g.source && !manual && <div className="muted text-xs">Theo chủ đề: {g.source}</div>}
                          {manual && <div className="muted text-xs">Cô sửa tay</div>}
                        </td>
                        {[true, false].map((option) => (
                          <td key={String(option)} className="center">
                            {sheet.canEdit ? (
                              <button
                                type="button"
                                className={`dg-theme-cell ${manual && value === option ? 'is-manual' : ''} ${option ? '' : 'is-not-met'}`}
                                aria-pressed={value === option}
                                aria-label={`${g.text}: ${option ? 'Đạt' : 'Chưa đạt'}`}
                                onClick={() => pick(g, option)}
                                disabled={busy}
                              >
                                {value === option ? '✓' : '·'}
                              </button>
                            ) : (
                              <span className={option ? 'text-success' : 'text-danger'}>{value === option ? '✓' : ''}</span>
                            )}
                          </td>
                        ))}
                      </tr>
                    );
                  }),
                ])}
              </tbody>
            </table>
          </div>
        )}
        <div className="dg-theme-summary">
          <p className="text-sm">
            Đạt: <strong>{met}</strong> · Chưa đạt: <strong>{notMet}</strong> · Chưa có kết quả:{' '}
            <strong>{all.length - met - notMet}</strong> mục tiêu
          </p>
          <div className="field__label">Một số lưu ý để điều chỉnh kế hoạch giáo dục năm học / độ tuổi tiếp theo</div>
          {NOTE_FIELDS.map(([key, label]) => (
            <div key={key} className="dg-year-sheet__note">
              <label className="text-sm" htmlFor={`year-note-${key}`}>
                {label}
              </label>
              {sheet.canEdit ? (
                <textarea
                  id={`year-note-${key}`}
                  className="textarea"
                  rows={2}
                  maxLength={NOTE_MAX}
                  value={notes[key]}
                  onChange={(e) => setNotes((prev) => ({ ...prev, [key]: e.target.value }))}
                  disabled={busy}
                />
              ) : (
                <div id={`year-note-${key}`} className="text-sm">
                  {saved[key] || <span className="muted">—</span>}
                </div>
              )}
            </div>
          ))}
          {sheet.canEdit && (
            <div className="row gap-2 mt-12">
              <button type="button" className="btn" onClick={() => save()} disabled={busy || !dirty}>
                {busy ? <Spinner small /> : <Save size={16} />} Lưu phiếu
              </button>
              {dirty && <span className="muted text-sm">Phiếu có chỉnh sửa chưa lưu.</span>}
            </div>
          )}
        </div>
      </div>
      {preview && <ThemeEvaluationPreviewModal file={preview} onClose={() => setPreview(null)} />}
    </div>
  );
}
