import { useCallback, useMemo, useState } from 'react';
import { Download, Save, Wand2 } from '@/components/ui/icons';
import { Breadcrumb } from '@/components/ui/Breadcrumb';
import { ConfirmationModal } from '@/components/ui/ConfirmationModal';
import { LeaveConfirmModal } from '@/components/ui/LeaveConfirmModal';
import { EmptyState, ErrorState, SkeletonRows, Spinner } from '@/components/ui/States';
import { Tabs } from '@/components/ui/Tabs';
import { VersionHistory } from '@/components/assessment/VersionHistory';
import { useAuth } from '@/contexts/AuthContext';
import { useSchoolYear } from '@/contexts/SchoolYearContext';
import { useToast } from '@/contexts/ToastContext';
import { useLeaveGuard } from '@/hooks/useLeaveGuard';
import { useClassRatings } from '@/hooks/assessment/useAssessment';
import { useDraftBackup } from '@/hooks/assessment/useDraftBackup';
import { saveClassRatings } from '@/services/assessment/assessmentService';
import {
  CLASS_RATING_CRITERIA,
  CLASS_RATING_LEVEL_LABELS,
  CLASS_RATING_LEVELS,
  CLASS_RATING_PERIOD,
  CLASS_RATING_PERIOD_LABELS,
} from '@/models/assessment/assessmentConstants';
import { isLeader } from '@/utils/assessment/assessmentPermissions';
import { assessmentCrumbs, SECTIONS } from '@/utils/assessment/breadcrumbs';
import { exportWithPreview } from '@/components/ui/ExportPreview';
import { formatDate, formatDateTime } from '@/utils/format';
import '@/styles/modules/assessment.css';

const PERIODS = Object.values(CLASS_RATING_PERIOD).map((key) => ({ key, label: CLASS_RATING_PERIOD_LABELS[key] }));
const FIELDS = [...CLASS_RATING_CRITERIA.map((c) => c.key), 'overall'];
const NOTE_MAX = 500;
const label = (level) => CLASS_RATING_LEVEL_LABELS[level] || '';

/**
 * Xếp loại nhóm lớp học kỳ I, II, cuối năm (sổ chỉ đạo chuyên môn mục 7, BE OBS-24). Một bảng cho cả trường: HT chấm
 * mọi lớp, PHT lớp điểm trường mình (BE trả canEdit từng lớp); GV xem lớp mình. Sửa nhiều ô rồi lưu một lần; đang sửa
 * thì giữ ẩn trên máy và có Lịch sử phiên bản như kế hoạch giáo dục.
 */
export default function ClassRatingsPage() {
  const { user } = useAuth();
  const { schoolYear } = useSchoolYear();
  const toast = useToast();
  const leader = isLeader(user);
  const [period, setPeriod] = useState(CLASS_RATING_PERIOD.SEMESTER_1);
  const [campusId, setCampusId] = useState('');
  const { ratings, loading, error, reload } = useClassRatings({ schoolYear, period, campusId: campusId || undefined });
  const rows = useMemo(() => ratings?.rows || [], [ratings]);
  const campuses = ratings?.campuses || [];
  const multiCampus = leader && campuses.length > 1;
  const campusName = (id) => campuses.find((c) => String(c.id) === String(id))?.name || '';

  // Bản đang sửa: classId -> { levels, note }; chỉ gửi các lớp có thay đổi
  const [drafts, setDrafts] = useState({});
  const [saving, setSaving] = useState(false);
  const [pending, setPending] = useState(null);
  const valueOf = (r) => drafts[r.classId] || { levels: r.levels || {}, note: r.note || '' };
  const changed = rows.filter((r) => {
    const d = drafts[r.classId];
    return d && (FIELDS.some((f) => (d.levels[f] || null) !== (r.levels?.[f] || null)) || d.note.trim() !== (r.note || ''));
  });
  const editable = rows.filter((r) => r.canEdit);
  const rated = rows.filter((r) => r.levels?.overall).length;

  const setField = (r, patch) =>
    setDrafts((all) => {
      const cur = all[r.classId] || { levels: { ...(r.levels || {}) }, note: r.note || '' };
      return { ...all, [r.classId]: { levels: { ...cur.levels, ...patch.levels }, note: patch.note ?? cur.note } };
    });
  // Ít thao tác: điền "Tốt" vào tiêu chí còn trống của lớp được chấm; xếp loại chung người chấm tự chọn (OBS-24)
  const fillEmpty = () =>
    setDrafts((all) => {
      const next = { ...all };
      editable.forEach((r) => {
        const cur = next[r.classId] || { levels: { ...(r.levels || {}) }, note: r.note || '' };
        const criteria = CLASS_RATING_CRITERIA.map((c) => [c.key, cur.levels[c.key] || 'TOT']);
        next[r.classId] = { ...cur, levels: { ...cur.levels, ...Object.fromEntries(criteria) } };
      });
      return next;
    });

  const save = async () => {
    if (!changed.length || saving) return false;
    if (changed.some((r) => valueOf(r).note.length > NOTE_MAX)) {
      toast.error(`Ghi chú tối đa ${NOTE_MAX} ký tự.`, 'Chưa lưu được xếp loại');
      return false;
    }
    setSaving(true);
    try {
      await saveClassRatings(
        {
          period,
          items: changed.map((r) => {
            const v = valueOf(r);
            return { classId: r.classId, levels: Object.fromEntries(FIELDS.map((f) => [f, v.levels[f] || null])), note: v.note };
          }),
        },
        user,
      );
      toast.success(`Đã lưu xếp loại ${changed.length} lớp.`);
      backup.clear();
      setDrafts({});
      await reload({ silent: true });
      return true;
    } catch (err) {
      toast.error(err, 'Chưa lưu được xếp loại');
      return false;
    } finally {
      setSaving(false);
    }
  };

  // Bản giữ trên máy: các lớp được chấm, classId -> { levels, note }
  const snapshot = (pick) => (editable.length ? Object.fromEntries(editable.map((r) => [r.classId, pick(r)])) : null);
  const savedDoc = snapshot((r) => ({ levels: r.levels || {}, note: r.note || '' }));
  const currentDoc = snapshot(valueOf);
  const backup = useDraftBackup({
    userId: user?.id,
    docKey: schoolYear ? `class-ratings:${schoolYear}:${period}:${campusId || 'all'}` : null,
    doc: currentDoc,
    saved: savedDoc,
    base: editable.map((r) => `${r.classId}@${r.ratedAt || ''}`).join(','),
    enabled: changed.length > 0,
  });
  const linesOf = useCallback(
    (doc) =>
      rows
        .filter((r) => doc?.[r.classId])
        .flatMap((r) => {
          const v = doc[r.classId];
          const levels = FIELDS.map(
            (f) => `${f === 'overall' ? 'Chung' : CLASS_RATING_CRITERIA.find((c) => c.key === f).label}: ${label(v.levels?.[f]) || '—'}`,
          );
          return [`${r.className} – ${levels.join('; ')}`, ...(v.note ? [`${r.className} – Ghi chú: ${v.note}`] : [])];
        }),
    [rows],
  );

  const guard = useLeaveGuard({ when: changed.length > 0, onSave: save });
  // Đổi kỳ / điểm trường khi còn thay đổi chưa lưu: hỏi trước
  // Không còn thay đổi thật: vẫn bỏ các ô đã sửa rồi đổi lại (drafts theo lớp, không theo kỳ) trước khi đổi kỳ
  const confirmChange = (apply) => {
    if (changed.length) setPending(() => apply);
    else {
      setDrafts({});
      apply();
    }
  };

  const exportExcel = () => {
    const title = `Xếp loại nhóm lớp – ${CLASS_RATING_PERIOD_LABELS[period]}${campusId ? ` – ${campusName(campusId)}` : ''}`;
    exportWithPreview(
      [
        [title],
        ['STT', 'Tên nhóm, lớp', ...CLASS_RATING_CRITERIA.map((c) => c.label), 'Xếp loại chung', 'Ghi chú'],
        ...rows.map((r, i) => [
          i + 1,
          multiCampus ? `${r.className} (${campusName(r.campusId)})` : r.className,
          // Xuất đúng những gì đang thấy trên bảng (kể cả ô vừa sửa chưa lưu)
          ...FIELDS.map((f) => label(valueOf(r).levels[f])),
          valueOf(r).note,
        ]),
      ],
      `xep-loai-nhom-lop-${period.toLowerCase()}.xlsx`,
    );
  };

  const levelCell = (r, field) => {
    const value = valueOf(r).levels[field] || '';
    if (!r.canEdit) return <td key={field}>{label(value) || <span className="muted">—</span>}</td>;
    const name = field === 'overall' ? 'Xếp loại chung' : CLASS_RATING_CRITERIA.find((c) => c.key === field).label;
    return (
      <td key={field}>
        <select
          className="select"
          aria-label={`${name} – ${r.className}`}
          value={value}
          onChange={(e) => setField(r, { levels: { [field]: e.target.value || null } })}
        >
          <option value="">—</option>
          {CLASS_RATING_LEVELS.map((l) => (
            <option key={l} value={l}>
              {label(l)}
            </option>
          ))}
        </select>
      </td>
    );
  };

  return (
    <div className="page">
      <Breadcrumb items={assessmentCrumbs(SECTIONS.classRatings)} />
      <div className="page__head">
        <h1 className="page__title">Xếp loại nhóm lớp</h1>
        <button className="btn" onClick={exportExcel} disabled={!rows.length}>
          <Download size={16} /> Xuất Excel
        </button>
      </div>
      <div className="card">
        <div className="filter-bar">
          <Tabs items={PERIODS} value={period} onChange={(v) => confirmChange(() => setPeriod(v))} ariaLabel="Kỳ xếp loại" />
          {multiCampus && (
            <select
              className="select"
              aria-label="Điểm trường"
              value={campusId}
              onChange={(e) => {
                const next = e.target.value;
                confirmChange(() => setCampusId(next));
              }}
            >
              <option value="">Tất cả điểm trường</option>
              {campuses.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          )}
          <div className="spacer" />
          {!loading && rows.length > 0 && (
            <span className="muted text-sm">
              Đã xếp loại {rated}/{rows.length} lớp
            </span>
          )}
          {editable.length > 0 && (
            <VersionHistory
              drafts={backup.drafts}
              saved={savedDoc}
              current={currentDoc}
              unsaved={changed.length > 0}
              linesOf={linesOf}
              onUse={(entry, doc) => {
                setDrafts(doc || {});
                if (entry) backup.used(entry);
              }}
            />
          )}
          {editable.length > 0 && (
            <button className="btn" onClick={fillEmpty} title="Điền Tốt vào các tiêu chí còn trống; xếp loại chung bạn tự chọn">
              <Wand2 size={16} /> Điền &quot;Tốt&quot; vào tiêu chí trống
            </button>
          )}
        </div>
        {/* Kỳ chưa mở chấm (BE OBS-24): HK theo ngày học kỳ, cuối năm từ tháng cuối năm học */}
        {leader && !loading && rows.length > 0 && editable.length === 0 && (
          <div className="alert alert--info mb-12">
            {ratings?.openFrom
              ? `${CLASS_RATING_PERIOD_LABELS[period]} xếp loại được từ ngày ${formatDate(ratings.openFrom)}.`
              : 'Chưa đặt ngày học kỳ ở Cấu hình thời gian nên chưa xếp loại được kỳ này.'}
          </div>
        )}
        {error ? (
          <ErrorState error={error} onRetry={reload} />
        ) : (
          <div className="table-wrap">
            <table className="table table--grid table--compact dg-rating-table">
              <thead>
                <tr>
                  <th className="num">STT</th>
                  <th>Nhóm, lớp</th>
                  {CLASS_RATING_CRITERIA.map((c) => (
                    <th key={c.key}>{c.label}</th>
                  ))}
                  <th>Xếp loại chung</th>
                  <th>Ghi chú</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <SkeletonRows rows={6} cols={FIELDS.length + 3} />
                ) : rows.length === 0 ? (
                  <tr>
                    <td colSpan={FIELDS.length + 3}>
                      <EmptyState
                        title="Chưa có lớp để xếp loại"
                        description={leader ? 'Năm học chưa có lớp nào.' : 'Bạn chưa được phân công lớp trong năm học này.'}
                      />
                    </td>
                  </tr>
                ) : (
                  rows.map((r, i) => {
                    const v = valueOf(r);
                    return (
                      <tr key={r.classId}>
                        <td className="num">{i + 1}</td>
                        <td>
                          <div className="fw-600">{r.className}</div>
                          {multiCampus && !campusId && <div className="text-xs text-2">{campusName(r.campusId)}</div>}
                          {r.ratedAt && (
                            <div className="text-xs muted" title={r.ratedByName || ''}>
                              {formatDateTime(r.ratedAt)}
                            </div>
                          )}
                        </td>
                        {FIELDS.map((f) => levelCell(r, f))}
                        <td>
                          {r.canEdit ? (
                            <input
                              className="input"
                              aria-label={`Ghi chú – ${r.className}`}
                              maxLength={NOTE_MAX}
                              value={v.note}
                              onChange={(e) => setField(r, { note: e.target.value })}
                            />
                          ) : (
                            r.note || <span className="muted">—</span>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {editable.length > 0 && (
        <div className="page-actions">
          <div className="spacer" />
          <div className="row gap-2">
            {changed.length > 0 && (
              <button className="btn" onClick={() => setDrafts({})} disabled={saving}>
                Hủy thay đổi
              </button>
            )}
            <button className="btn btn--primary" onClick={save} disabled={saving || !changed.length}>
              {saving ? <Spinner small /> : <Save size={16} />} Lưu xếp loại{changed.length ? ` (${changed.length} lớp)` : ''}
            </button>
          </div>
        </div>
      )}

      <LeaveConfirmModal
        {...guard.modal}
        canSave
        message="Xếp loại nhóm lớp có thay đổi chưa lưu."
        onDiscard={() => {
          backup.clear({ pause: true });
          guard.modal.onDiscard();
        }}
      />
      <ConfirmationModal
        open={!!pending}
        title="Bỏ các thay đổi chưa lưu?"
        message="Đổi kỳ hoặc điểm trường sẽ bỏ các ô vừa sửa."
        confirmLabel="Bỏ thay đổi và chuyển"
        onClose={() => setPending(null)}
        onConfirm={() => {
          backup.clear();
          setDrafts({});
          pending?.();
          setPending(null);
        }}
      />
    </div>
  );
}
