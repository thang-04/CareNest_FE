import { useMemo, useState } from 'react';
import { Search, X } from '@/components/ui/icons';
import { Modal } from '@/components/ui/Modal';
import { SearchSelect } from '@/components/ui/SearchSelect';
import { dishTypeClass } from '@/utils/menu-planning/dishTypeClass';
import { DISH_TYPE_LABELS } from '@/models/menu-planning/menuPlanningConstants';
import { normalizeText } from '@/utils/format';

const TYPE_ORDER = Object.keys(DISH_TYPE_LABELS);

/**
 * Chọn nhiều món cho một bữa của mẫu ngày: món đã chọn ở trên (bỏ từng món hoặc tất cả), danh sách nhóm theo loại món,
 * nhãn chất gây dị ứng theo danh mục món (NUT-23). `onSave(dishes)` nhận danh sách món đã chọn của bữa.
 */
export function AddDishesModal({ title, subtitle, dishes, selectedIds, onSave, onClose }) {
  const [picked, setPicked] = useState(() => selectedIds.map(String));
  const [keyword, setKeyword] = useState('');
  const [type, setType] = useState('');
  const byId = useMemo(() => Object.fromEntries(dishes.map((d) => [String(d.id), d])), [dishes]);
  const groups = useMemo(() => {
    const q = normalizeText(keyword);
    const list = dishes.filter((d) => (!type || d.type === type) && (!q || normalizeText(d.name).includes(q)));
    return TYPE_ORDER.concat([''])
      .map((t) => ({
        type: t,
        items: list.filter((d) => (t ? d.type === t : !TYPE_ORDER.includes(d.type))),
      }))
      .filter((g) => g.items.length);
  }, [dishes, keyword, type]);
  const toggle = (id) => setPicked((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]));

  return (
    <Modal
      open
      size="lg"
      title={subtitle ? `${title} · ${subtitle}` : title}
      onClose={onClose}
      footer={
        <>
          <button type="button" className="btn" onClick={onClose}>
            Hủy
          </button>
          <button type="button" className="btn btn--primary" onClick={() => onSave(picked.map((id) => byId[id]).filter(Boolean))}>
            Lưu {picked.length} món
          </button>
        </>
      }
    >
      <div className="td-pick">
        <div className="td-pick__chosen">
          <div className="td-pick__chosen-head">
            <b>Đã chọn {picked.length}</b>
            {picked.length > 0 && (
              <button type="button" className="btn btn--ghost btn--sm" onClick={() => setPicked([])}>
                Bỏ chọn tất cả
              </button>
            )}
          </div>
          {picked.length ? (
            <div className="td-pick__chips">
              {picked.map((id) => (
                <span key={id} className="td-pick__chip">
                  {byId[id]?.name || 'Món đã xóa'}
                  <button type="button" aria-label={`Bỏ ${byId[id]?.name || 'món'}`} onClick={() => toggle(id)}>
                    <X size={14} />
                  </button>
                </span>
              ))}
            </div>
          ) : (
            <p className="text-sm muted">Chưa chọn món nào.</p>
          )}
        </div>
        <div className="td-pick__filters">
          <label className="td-search">
            <Search size={16} className="muted" />
            <input
              className="input"
              autoFocus
              placeholder="Tìm món ăn"
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
              aria-label="Tìm món ăn"
            />
          </label>
          <SearchSelect
            options={[{ value: '', label: 'Tất cả loại món' }, ...TYPE_ORDER.map((t) => ({ value: t, label: DISH_TYPE_LABELS[t] }))]}
            value={type}
            onChange={setType}
            ariaLabel="Loại món"
          />
        </div>
        <div className="td-pick__list" role="group" aria-label="Món ăn">
          {groups.length === 0 && <p className="text-sm muted td-pick__empty">Không tìm thấy món nào.</p>}
          {groups.map((g) => (
            <section key={g.type || 'other'}>
              <h4 className="td-pick__group">{DISH_TYPE_LABELS[g.type] || 'Món khác'}</h4>
              {g.items.map((d) => (
                <label key={d.id} className={`td-pick__row ${dishTypeClass(d.type)}`}>
                  <input type="checkbox" checked={picked.includes(String(d.id))} onChange={() => toggle(String(d.id))} />
                  <span className="td-grow">{d.name}</span>
                  {d.allergens?.length > 0 && <span className="chip chip--orange">Có {d.allergens.join(', ').toLowerCase()}</span>}
                </label>
              ))}
            </section>
          ))}
        </div>
      </div>
    </Modal>
  );
}
