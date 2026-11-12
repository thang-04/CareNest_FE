import { useEffect, useState } from 'react';
import { Download } from '@/components/ui/icons';
import { EmptyState, Modal } from '@/components/education-plan/eduUi';
import { ErrorState, LoadingState } from '@/components/ui/States';
import { cardText } from '@/models/education-plan/classPlan';

/*
 * Lấy hoạt động từ kế hoạch chủ đề đã ban hành của chính lớp ở năm trước, cùng tên chủ đề (Tiền 13/11/2026).
 * load() ⇒ [{ key, label, cards }]; chọn một nguồn, tích thẻ (mặc định tất cả) rồi onImport(source, cards).
 * Ghép MT/nội dung theo chữ do trang làm (mapActivityCards); hộp này chỉ chọn.
 */
export default function ImportActivitiesModal({ load, onImport, onClose }) {
  const [state, setState] = useState({ loading: true, error: null, sources: [] });
  const [sourceKey, setSourceKey] = useState('');
  const [picked, setPicked] = useState(null);

  useEffect(() => {
    let alive = true;
    load()
      .then((sources) => alive && setState({ loading: false, error: null, sources }))
      .catch((error) => alive && setState({ loading: false, error, sources: [] }));
    return () => {
      alive = false;
    };
  }, [load]);

  const source = state.sources.find((s) => s.key === sourceKey) || state.sources[0] || null;
  const selected = picked && picked.key === source?.key ? picked.ids : (source?.cards || []).map((c) => c.id);
  const toggle = (id) => setPicked({ key: source.key, ids: selected.includes(id) ? selected.filter((x) => x !== id) : [...selected, id] });

  return (
    <Modal
      open
      size="xl"
      title="Lấy hoạt động năm trước"
      onClose={onClose}
      footer={
        <>
          <button type="button" className="btn" onClick={onClose}>
            Hủy
          </button>
          <button
            type="button"
            className="btn btn--primary"
            disabled={!source || !selected.length}
            onClick={() =>
              onImport(
                source,
                source.cards.filter((c) => selected.includes(c.id)),
              )
            }
          >
            <Download size={16} aria-hidden /> Thêm {selected.length || ''} hoạt động
          </button>
        </>
      }
    >
      {state.loading ? (
        <LoadingState text="Đang tìm kế hoạch chủ đề năm trước…" />
      ) : state.error ? (
        <ErrorState error={state.error} />
      ) : !state.sources.length ? (
        <EmptyState title="Chưa có kế hoạch chủ đề cùng tên đã ban hành của lớp ở năm trước" />
      ) : (
        <div className="stack">
          {state.sources.length > 1 && (
            <div className="field">
              <label className="field__label" htmlFor="act-src">
                Lấy từ
              </label>
              <select id="act-src" className="input" value={source.key} onChange={(e) => setSourceKey(e.target.value)}>
                {state.sources.map((s) => (
                  <option key={s.key} value={s.key}>
                    {s.label}
                  </option>
                ))}
              </select>
            </div>
          )}
          {state.sources.length === 1 && <p className="muted text-sm">{source.label}</p>}
          <fieldset className="ga-edit-fieldset stack">
            <legend className="field__label">Hoạt động ({source.cards.length})</legend>
            {source.cards.map((c) => (
              <label key={c.id} className="checkbox">
                <input type="checkbox" checked={selected.includes(c.id)} onChange={() => toggle(c.id)} />
                <span>{cardText(c)}</span>
              </label>
            ))}
          </fieldset>
          <p className="muted text-sm">
            Hoạt động được gắn vào mục tiêu và nội dung có cùng câu chữ trong chủ đề năm nay; hoạt động không có mục tiêu tương ứng sẽ được
            bỏ qua và báo lại.
          </p>
        </div>
      )}
    </Modal>
  );
}
