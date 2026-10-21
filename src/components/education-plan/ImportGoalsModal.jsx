import { useMemo, useState } from 'react';
import { Download } from '@/components/ui/icons';
import { useEducationPlan } from '@/hooks/education-plan/useEducationPlan';
import { AGE_GROUPS } from '@/models/education-plan/educationPlanConstants';
import { EmptyState, Modal } from '@/components/education-plan/eduUi';

/** Chọn mục tiêu (kèm nội dung, dấu tích chủ đề) từ kế hoạch năm học khác để thêm vào kế hoạch đang soạn. */
export default function ImportGoalsModal({ goals, excludeId, defaultAgeGroupId, onClose, onImport }) {
  const { schoolYears } = useEducationPlan();
  // Default to the previous school year (list is newest first)
  const [year, setYear] = useState(schoolYears[1] || schoolYears[0]);
  const [ageGroupId, setAgeGroupId] = useState(defaultAgeGroupId || '');
  const sources = useMemo(
    () => goals.filter((g) => g.id !== excludeId && g.schoolYear === year && (!ageGroupId || g.ageGroupId === ageGroupId)),
    [goals, excludeId, year, ageGroupId],
  );
  const [sourceId, setSourceId] = useState('');
  const source = sources.find((g) => g.id === sourceId) || sources[0];
  const [picked, setPicked] = useState({});

  const key = (di, ii) => `${source?.id}:${di}:${ii}`;
  const allKeys = source ? source.domains.flatMap((d, di) => d.items.map((_, ii) => key(di, ii))) : [];
  const count = allKeys.filter((k) => picked[k]).length;

  const toggle = (k) => setPicked((p) => ({ ...p, [k]: !p[k] }));
  const toggleDomain = (di) => {
    const keys = source.domains[di].items.map((_, ii) => key(di, ii));
    const on = !keys.every((k) => picked[k]);
    setPicked((p) => ({ ...p, ...Object.fromEntries(keys.map((k) => [k, on])) }));
  };
  const toggleAll = () => {
    const on = count !== allKeys.length;
    setPicked((p) => ({ ...p, ...Object.fromEntries(allKeys.map((k) => [k, on])) }));
  };

  const confirm = () => {
    const domains = source.domains
      .map((d, di) => ({ name: d.name, items: d.items.filter((_, ii) => picked[key(di, ii)]) }))
      .filter((d) => d.items.length);
    onImport(domains, source);
  };

  return (
    <Modal
      title="Lấy mục tiêu từ kế hoạch có sẵn"
      width={760}
      onClose={onClose}
      footer={
        <>
          <button className="btn" onClick={onClose}>
            Hủy
          </button>
          <button className="btn btn--primary" disabled={!count} onClick={confirm}>
            <Download size={16} aria-hidden /> Thêm {count || ''} mục tiêu
          </button>
        </>
      }
    >
      <div className="grid-2 gap-3">
        <div className="field">
          <label className="field__label" htmlFor="imp-year">
            Năm học
          </label>
          <select
            id="imp-year"
            className="select"
            value={year}
            onChange={(e) => {
              setYear(e.target.value);
              setSourceId('');
              setPicked({});
            }}
          >
            {schoolYears.map((y) => (
              <option key={y}>{y}</option>
            ))}
          </select>
        </div>
        <div className="field">
          <label className="field__label" htmlFor="imp-age">
            Nhóm tuổi
          </label>
          <select
            id="imp-age"
            className="select"
            value={ageGroupId}
            onChange={(e) => {
              setAgeGroupId(e.target.value);
              setSourceId('');
              setPicked({});
            }}
          >
            <option value="">Tất cả nhóm tuổi</option>
            {AGE_GROUPS.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {sources.length === 0 ? (
        <EmptyState title="Không có bộ mục tiêu phù hợp" desc="Thử chọn năm học hoặc nhóm tuổi khác." />
      ) : (
        <>
          {sources.length > 1 && (
            <div className="field">
              <label className="field__label" htmlFor="imp-src">
                Bộ mục tiêu
              </label>
              <select
                id="imp-src"
                className="select"
                value={source.id}
                onChange={(e) => {
                  setSourceId(e.target.value);
                  setPicked({});
                }}
              >
                {sources.map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.title}
                  </option>
                ))}
              </select>
            </div>
          )}
          <div className="row row--between">
            <span className="fw-600">{source.title}</span>
            <button type="button" className="btn btn--sm" onClick={toggleAll}>
              {count === allKeys.length ? 'Bỏ chọn tất cả' : 'Chọn tất cả'}
            </button>
          </div>
          <div className="ga-pick-list">
            {source.domains.map((d, di) => {
              const keys = d.items.map((_, ii) => key(di, ii));
              const all = keys.every((k) => picked[k]);
              return (
                <div key={d.name} className="mb-8">
                  <label className="ga-goal-check ga-goal-check--head">
                    <input type="checkbox" checked={all} onChange={() => toggleDomain(di)} />
                    <span className="fw-600">{d.name}</span>
                  </label>
                  {d.items.map((it, ii) => (
                    <label key={it.id} className="ga-goal-check ga-goal-check--child">
                      <input type="checkbox" checked={!!picked[key(di, ii)]} onChange={() => toggle(key(di, ii))} />
                      <span className="ga-goal-code">{it.code}</span>
                      <span className="text-sm">{it.text}</span>
                    </label>
                  ))}
                </div>
              );
            })}
          </div>
          <p className="muted text-xs">
            Mục tiêu được thêm vào cuối lĩnh vực cùng tên, kèm nội dung và dấu tích chủ đề (khớp theo tên viết tắt). Nếu kế hoạch đang soạn
            chưa có chủ đề, bảng chủ đề và đợt nghỉ của kế hoạch nguồn được chép theo. Mục tiêu trùng nội dung sẽ bỏ qua.
          </p>
        </>
      )}
    </Modal>
  );
}
