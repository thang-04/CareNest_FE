import { useEffect, useMemo, useState } from 'react';
import { CheckCircle2, Download, Save } from '@/components/ui/icons';
import { Breadcrumb } from '@/components/ui/Breadcrumb';
import { ConfirmationModal } from '@/components/ui/ConfirmationModal';
import { LeaveConfirmModal } from '@/components/ui/LeaveConfirmModal';
import { EmptyState, ErrorState, LoadingState, Spinner } from '@/components/ui/States';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/contexts/ToastContext';
import { useLeaveGuard } from '@/hooks/useLeaveGuard';
import { useDailyAssessmentClasses, useThemeEvaluation, useThemeList } from '@/hooks/assessment/useAssessment';
import { confirmThemeEvaluation, saveThemeEvaluation } from '@/services/assessment/assessmentService';
import { assessmentCrumbs, SECTIONS } from '@/utils/assessment/breadcrumbs';
import { downloadXlsx } from '@/utils/exportXlsx';
import { formatDate, formatDateTime } from '@/utils/format';
import '@/styles/modules/assessment.css';

const NOTE_MAX = 1000;
const STATUS_LABELS = { NONE: 'Chưa đánh giá', DRAFT: 'Đang đánh giá', CONFIRMED: 'Đã xác nhận' };
const PERIOD_LABELS = { UPCOMING: 'Chưa bắt đầu', ONGOING: 'Đang diễn ra', ENDED: 'Đã kết thúc' };
const mark = (met) => (met === true ? '+' : met === false ? '−' : '');
// Ô bấm lần lượt: Đạt → Chưa đạt → bỏ sửa tay (về kết quả hệ thống tính)
const nextValue = (met) => (met === true ? false : met === false ? null : true);

/**
 * Đánh giá cuối chủ đề của lớp mẫu giáo (BE OBS-27), theo mẫu "Bảng đánh giá sự phát triển của trẻ": hàng là trẻ, cột là
 * MT của chủ đề; hệ thống điền từ Kiến thức kỹ năng hằng ngày, GV sửa ô, ghi lưu ý, xác nhận. Số Đ/KĐ, tỷ lệ do BE tính.
 */
export default function ThemeEvaluationPage() {
  const { user } = useAuth();
  const toast = useToast();
  const { classes, loading: classesLoading, error: classesError } = useDailyAssessmentClasses();
  const [classId, setClassId] = useState('');
  const [themeId, setThemeId] = useState('');
  const currentClassId = classId || classes[0]?.id || '';
  const { themes, loading: themesLoading, error: themesError } = useThemeList(currentClassId);
  // Mặc định chủ đề đã kết thúc gần nhất, chưa có thì chủ đề đang diễn ra
  const defaultTheme = [...themes].reverse().find((t) => t.period === 'ENDED') || themes.find((t) => t.period === 'ONGOING') || themes[0];
  const currentThemeId = themeId || defaultTheme?.themeId || '';
  const { evaluation: ev, loading, error, reload } = useThemeEvaluation(currentClassId, currentThemeId);

  // Ô sửa trên màn: key `${childId}:${goalId}` → true / false / null (null = bỏ sửa tay)
  const [edits, setEdits] = useState({});
  const [note, setNote] = useState('');
  const [loadedFrom, setLoadedFrom] = useState(null);
  const [busy, setBusy] = useState('');
  const [confirmOpen, setConfirmOpen] = useState(false);
  useEffect(() => {
    setEdits({});
    setNote(ev?.note || '');
    setLoadedFrom(ev || null);
  }, [ev]);

  const changed = !!ev && loadedFrom === ev && (Object.keys(edits).length > 0 || (note || '') !== (ev.note || ''));
  const guard = useLeaveGuard({ when: changed, onSave: () => save() });

  const valueOf = (childId, cell) => {
    const key = `${childId}:${cell.goalId}`;
    return key in edits ? edits[key] : cell.met;
  };
  const toggle = (childId, cell) =>
    setEdits((all) => {
      const key = `${childId}:${cell.goalId}`;
      const next = nextValue(key in all ? all[key] : cell.met);
      return { ...all, [key]: next };
    });
  const cellsBody = () =>
    Object.entries(edits).map(([key, met]) => {
      const [childId, goalId] = key.split(':').map(Number);
      return { childId, goalId, met };
    });

  const run = async (kind, fn, message) => {
    if (note.length > NOTE_MAX) {
      toast.error(`Lưu ý tối đa ${NOTE_MAX} ký tự.`, 'Chưa lưu được');
      return false;
    }
    setBusy(kind);
    try {
      await fn({ classId: Number(currentClassId), themeId: Number(currentThemeId), note, cells: cellsBody() }, user);
      toast.success(message);
      await reload({ silent: true });
      return true;
    } catch (err) {
      toast.error(err, 'Chưa lưu được đánh giá cuối chủ đề');
      return false;
    } finally {
      setBusy('');
      setConfirmOpen(false);
    }
  };
  const save = () => run('save', saveThemeEvaluation, 'Đã lưu đánh giá cuối chủ đề.');

  const exportExcel = () => {
    if (!ev) return;
    const head = ['STT', 'Họ và tên', ...ev.goals.map((g) => String(g.goalNo ?? '')), 'Đ', 'KĐ'];
    downloadXlsx(
      [
        ['BẢNG ĐÁNH GIÁ SỰ PHÁT TRIỂN CỦA TRẺ'],
        [`Chủ đề: ${ev.themeName}`],
        [`(Từ ngày ${formatDate(ev.startDate)} đến ngày ${formatDate(ev.endDate)}) – Lớp ${ev.className}`],
        head,
        ...ev.rows.map((r, i) => [i + 1, r.fullName, ...r.cells.map((c) => mark(c.met)), r.met, r.notMet]),
        ['', 'Tổng số trẻ đạt', ...ev.goals.map((g) => g.metChildren)],
        ['', 'Tỷ lệ (%)', ...ev.goals.map((g) => (g.rate == null ? '' : g.rate))],
        [],
        [`Tổng số trẻ được đánh giá: ${ev.assessedChildren}`],
        [`Số trẻ đạt ${ev.passPercent}% trở lên: ${ev.passedChildren} trẻ`],
        [`Số trẻ đạt dưới ${ev.passPercent}%: ${ev.notPassedChildren} trẻ`],
        [`Một số lưu ý: ${ev.note || ''}`],
      ],
      `danh-gia-cuoi-chu-de-${ev.className}-${ev.themeName}.xlsx`.replace(/\s+/g, '-'),
      { headerRow: 3 },
    );
  };

  const goalTitle = useMemo(() => Object.fromEntries((ev?.goals || []).map((g) => [g.goalId, g.text])), [ev]);

  return (
    <div className="page">
      <Breadcrumb items={assessmentCrumbs(SECTIONS.themes)} />
      <h1 className="page__title">Đánh giá cuối chủ đề</h1>
      <div className="card">
        <div className="filter-bar">
          {classes.length > 1 && (
            <div className="field">
              <span className="field__label">Lớp</span>
              <select
                className="select"
                aria-label="Lớp"
                value={currentClassId}
                onChange={(e) =>
                  guard.leave(() => {
                    setClassId(e.target.value);
                    setThemeId('');
                  })
                }
              >
                {classes.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
          )}
          {themes.length > 0 && (
            <div className="field">
              <span className="field__label">Chủ đề</span>
              <select
                className="select"
                aria-label="Chủ đề"
                value={currentThemeId}
                onChange={(e) => guard.leave(() => setThemeId(e.target.value))}
              >
                {themes.map((t) => (
                  <option key={t.themeId} value={t.themeId}>
                    {t.name} ({formatDate(t.startDate)} – {formatDate(t.endDate)}) · {STATUS_LABELS[t.status] || ''}
                  </option>
                ))}
              </select>
            </div>
          )}
          <div className="spacer" />
          {ev && (
            <button className="btn" onClick={exportExcel}>
              <Download size={16} /> Xuất Excel
            </button>
          )}
        </div>

        {classesError || themesError ? (
          <ErrorState error={classesError || themesError} />
        ) : classesLoading || themesLoading ? (
          <LoadingState />
        ) : !currentClassId ? (
          <EmptyState title="Bạn chưa được phân công lớp" description="Đánh giá cuối chủ đề theo lớp giáo viên phụ trách." />
        ) : themes.length === 0 ? (
          <EmptyState
            title="Chưa có chủ đề để đánh giá"
            description="Lớp mẫu giáo cần kế hoạch năm học đã duyệt có chủ đề (từ ngày – đến ngày) và mục tiêu tích cho chủ đề."
          />
        ) : error ? (
          <ErrorState error={error} onRetry={reload} />
        ) : loading || !ev ? (
          <LoadingState />
        ) : (
          <>
            <div className="card__body">
              <div className="row row--wrap gap-2">
                <span className="chip">{PERIOD_LABELS[ev.period]}</span>
                <span className={`chip ${ev.status === 'CONFIRMED' ? 'chip--green' : ''}`}>{STATUS_LABELS[ev.status]}</span>
                {ev.confirmedAt && (
                  <span className="muted text-sm">
                    Xác nhận bởi {ev.confirmedByName || '—'} · {formatDateTime(ev.confirmedAt)}
                  </span>
                )}
              </div>
              {ev.canEdit && (
                <p className="muted text-sm mt-8">
                  Hệ thống điền từ Kiến thức kỹ năng hằng ngày (lần chấm cuối trong chủ đề). Bấm vào ô để đổi: + Đạt → − Chưa đạt → về kết
                  quả hệ thống. Ô sửa tay có viền đậm.
                </p>
              )}
            </div>
            {ev.goals.length === 0 ? (
              <EmptyState title="Chủ đề chưa có mục tiêu" description="Kế hoạch năm học chưa tích mục tiêu nào cho chủ đề này." />
            ) : (
              <div className="table-wrap">
                <table className="table table--grid table--compact dg-theme-table">
                  <thead>
                    <tr>
                      <th className="num">STT</th>
                      <th>Họ và tên</th>
                      {ev.goals.map((g) => (
                        <th key={g.goalId} className="center" title={g.text}>
                          {g.goalNo}
                        </th>
                      ))}
                      <th className="num">Đ</th>
                      <th className="num">KĐ</th>
                    </tr>
                  </thead>
                  <tbody>
                    {ev.rows.length === 0 ? (
                      <tr>
                        <td colSpan={ev.goals.length + 4}>
                          <EmptyState title="Chưa có trẻ trong thời gian chủ đề" />
                        </td>
                      </tr>
                    ) : (
                      ev.rows.map((r, i) => (
                        <tr key={r.childId}>
                          <td className="num">{i + 1}</td>
                          <td className="nowrap">{r.fullName}</td>
                          {r.cells.map((c) => {
                            const value = valueOf(r.childId, c);
                            const edited = `${r.childId}:${c.goalId}` in edits;
                            const label = `${r.fullName} – MT ${goalTitle[c.goalId] || ''}: ${value === true ? 'Đạt' : value === false ? 'Chưa đạt' : 'chưa chấm'}`;
                            return (
                              <td key={c.goalId} className="center">
                                {ev.canEdit ? (
                                  <button
                                    type="button"
                                    className={`dg-theme-cell ${c.manual || edited ? 'is-manual' : ''} ${value === false ? 'is-not-met' : ''}`}
                                    aria-label={label}
                                    title={label}
                                    onClick={() => toggle(r.childId, c)}
                                  >
                                    {mark(value) || '·'}
                                  </button>
                                ) : (
                                  <span className={value === false ? 'text-danger' : ''} title={label}>
                                    {mark(value)}
                                  </span>
                                )}
                              </td>
                            );
                          })}
                          <td className="num">{r.met}</td>
                          <td className="num">{r.notMet}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                  <tfoot>
                    <tr>
                      <th colSpan={2}>Tổng số trẻ đạt</th>
                      {ev.goals.map((g) => (
                        <th key={g.goalId} className="center">
                          {g.metChildren}
                        </th>
                      ))}
                      <th colSpan={2} />
                    </tr>
                    <tr>
                      <th colSpan={2}>Tỷ lệ (%)</th>
                      {ev.goals.map((g) => (
                        <th key={g.goalId} className="center">
                          {g.rate == null ? '' : g.rate}
                        </th>
                      ))}
                      <th colSpan={2} />
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}
            <div className="card__body">
              <p className="text-sm">
                Tổng số trẻ được đánh giá: <strong>{ev.assessedChildren}</strong> · Số trẻ đạt {ev.passPercent}% trở lên:{' '}
                <strong>{ev.passedChildren}</strong> trẻ · Số trẻ đạt dưới {ev.passPercent}%: <strong>{ev.notPassedChildren}</strong> trẻ
              </p>
              <label className="field__label" htmlFor="theme-note">
                Một số lưu ý
              </label>
              {ev.canEdit ? (
                <textarea
                  id="theme-note"
                  className="textarea"
                  rows={3}
                  maxLength={NOTE_MAX}
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="Vd. Cô chú ý rèn những trẻ còn hạn chế, động viên khuyến khích trẻ."
                />
              ) : (
                <p className="text-sm">{ev.note || <span className="muted">—</span>}</p>
              )}
              {ev.canEdit && (
                <div className="row gap-2 mt-12 sc-end">
                  <button className="btn" onClick={save} disabled={!!busy || !changed}>
                    {busy === 'save' ? <Spinner small /> : <Save size={16} />} Lưu
                  </button>
                  <button
                    className="btn btn--primary"
                    onClick={() => setConfirmOpen(true)}
                    disabled={!!busy || !ev.canConfirm}
                    title={ev.canConfirm ? '' : 'Xác nhận được từ ngày kết thúc chủ đề'}
                  >
                    <CheckCircle2 size={16} /> Xác nhận
                  </button>
                </div>
              )}
            </div>
          </>
        )}
      </div>
      <ConfirmationModal
        open={confirmOpen}
        title="Xác nhận đánh giá cuối chủ đề?"
        message="Bảng sẽ được lưu cố định để in, ký và cho Ban giám hiệu xem. Đã xác nhận thì không sửa được."
        confirmLabel="Xác nhận"
        onConfirm={() => run('confirm', confirmThemeEvaluation, 'Đã xác nhận đánh giá cuối chủ đề.')}
        onClose={() => setConfirmOpen(false)}
      />
      <LeaveConfirmModal {...guard.modal} canSave message="Đánh giá cuối chủ đề có thay đổi chưa lưu." />
    </div>
  );
}
