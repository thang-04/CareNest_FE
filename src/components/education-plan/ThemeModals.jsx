import { useMemo, useState } from 'react';
import { Download, Plus } from '@/components/ui/icons';
import { useEducationPlan } from '@/hooks/education-plan/useEducationPlan';
import { AGE_GROUPS, DOMAIN_SHORT } from '@/models/education-plan/educationPlanConstants';
import { EmptyState, Modal } from '@/components/education-plan/eduUi';

/** Picks yearly goals to add to a theme plan. */
export function PickGoalsModal({ goal, rows, onClose, onPick }) {
  const [picked, setPicked] = useState([]);
  const used = (code) => rows.filter((r) => r.goalCode === code).length;
  const toggle = (c) => setPicked((p) => (p.includes(c) ? p.filter((x) => x !== c) : [...p, c]));

  return (
    <Modal
      title="Thêm mục tiêu từ mục tiêu năm học"
      width={760}
      onClose={onClose}
      footer={
        <>
          <button type="button" className="btn" onClick={onClose}>
            Hủy
          </button>
          <button type="button" className="btn btn--primary" disabled={!picked.length} onClick={() => onPick(picked)}>
            <Plus size={16} aria-hidden /> Thêm {picked.length || ''} mục tiêu
          </button>
        </>
      }
    >
      <p className="muted text-xs">Từ: {goal.title}. Mỗi mục tiêu được chọn tạo một dòng có mã YCCĐ riêng.</p>
      <div className="ga-pick-list">
        {goal.domains.map((d) => (
          <div key={d.name} className="mb-8">
            <div className="fw-600" style={{ padding: '4px 8px' }}>
              {DOMAIN_SHORT[d.name] || d.name}
            </div>
            {d.items.map((it) => (
              <label key={it.code} className="ga-goal-check">
                <input type="checkbox" checked={picked.includes(it.code)} onChange={() => toggle(it.code)} />
                <span className="ga-goal-code">{it.code}</span>
                <span className="text-sm">
                  {it.text}
                  {used(it.code) > 0 && <span className="muted text-xs"> · đã dùng {used(it.code)} lần</span>}
                </span>
              </label>
            ))}
          </div>
        ))}
      </div>
    </Modal>
  );
}

/** Copies goals and content from another theme plan (other age group / other school year). */
export function ImportThemeRowsModal({ themes, excludeId, defaultAgeGroupId, onClose, onImport }) {
  const { schoolYears } = useEducationPlan();
  const [year, setYear] = useState('');
  const [ageGroupId, setAgeGroupId] = useState(defaultAgeGroupId || '');
  const sources = useMemo(
    () =>
      themes.filter(
        (t) => t.id !== excludeId && (!year || t.schoolYear === year) && (!ageGroupId || t.ageGroupId === ageGroupId) && t.rows?.length,
      ),
    [themes, excludeId, year, ageGroupId],
  );
  const [sourceId, setSourceId] = useState('');
  const source = sources.find((t) => t.id === sourceId) || sources[0];
  const [picked, setPicked] = useState([]);
  const rows = source?.rows || [];
  const all = rows.length > 0 && rows.every((r) => picked.includes(r.id));

  return (
    <Modal
      title="Lấy mục tiêu từ kế hoạch chủ đề có sẵn"
      width={760}
      onClose={onClose}
      footer={
        <>
          <button type="button" className="btn" onClick={onClose}>
            Hủy
          </button>
          <button
            type="button"
            className="btn btn--primary"
            disabled={!picked.length}
            onClick={() =>
              onImport(
                rows.filter((r) => picked.includes(r.id)),
                source,
              )
            }
          >
            <Download size={16} aria-hidden /> Thêm {picked.length || ''} mục tiêu
          </button>
        </>
      }
    >
      <div className="grid-2" style={{ gap: 12 }}>
        <div className="field">
          <label className="field__label" htmlFor="it-year">
            Năm học
          </label>
          <select
            id="it-year"
            className="select"
            value={year}
            onChange={(e) => {
              setYear(e.target.value);
              setSourceId('');
              setPicked([]);
            }}
          >
            <option value="">Tất cả năm học</option>
            {schoolYears.map((y) => (
              <option key={y}>{y}</option>
            ))}
          </select>
        </div>
        <div className="field">
          <label className="field__label" htmlFor="it-age">
            Nhóm tuổi
          </label>
          <select
            id="it-age"
            className="select"
            value={ageGroupId}
            onChange={(e) => {
              setAgeGroupId(e.target.value);
              setSourceId('');
              setPicked([]);
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
      {!source ? (
        <EmptyState title="Không có kế hoạch chủ đề phù hợp" desc="Thử chọn năm học hoặc nhóm tuổi khác." />
      ) : (
        <>
          <div className="field">
            <label className="field__label" htmlFor="it-src">
              Kế hoạch chủ đề
            </label>
            <select
              id="it-src"
              className="select"
              value={source.id}
              onChange={(e) => {
                setSourceId(e.target.value);
                setPicked([]);
              }}
            >
              {sources.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name} · {t.schoolYear} · {t.code}
                </option>
              ))}
            </select>
          </div>
          <div className="row" style={{ justifyContent: 'space-between' }}>
            <span className="muted text-xs">{rows.length} mục tiêu</span>
            <button type="button" className="btn btn--sm" onClick={() => setPicked(all ? [] : rows.map((r) => r.id))}>
              {all ? 'Bỏ chọn tất cả' : 'Chọn tất cả'}
            </button>
          </div>
          <div className="ga-pick-list">
            {rows.map((r) => (
              <label key={r.id} className="ga-goal-check">
                <input
                  type="checkbox"
                  checked={picked.includes(r.id)}
                  onChange={() => setPicked((p) => (p.includes(r.id) ? p.filter((x) => x !== r.id) : [...p, r.id]))}
                />
                <span className="ga-goal-code">{r.code}</span>
                <span className="text-sm">{r.requirement}</span>
              </label>
            ))}
          </div>
          <p className="muted text-xs">
            Mục tiêu được gắn vào mục tiêu năm học cùng lĩnh vực của nhóm tuổi bạn và cấp mã YCCĐ mới. Nội dung, phương pháp được chép theo,
            bạn vẫn sửa được.
          </p>
        </>
      )}
    </Modal>
  );
}
