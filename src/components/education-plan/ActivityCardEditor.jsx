import { useState } from 'react';
import { Modal } from '@/components/ui/Modal';
import { ConfirmationModal } from '@/components/ui/ConfirmationModal';
import { FormField } from '@/components/form/FormField';
import { Trash2 } from '@/components/ui/icons';
import { CARD_NAME_MAX, contentLinesOf, newCard, weekRows } from '@/models/education-plan/classPlan';

/**
 * Hộp thoại thẻ hoạt động (BE:EDU-78, FR-001…FR-003, FR-005): loại giờ, tên, MT (nhiều), nội dung của các MT đã chọn.
 * card = null ⇒ thẻ mới (MT đang đứng chọn sẵn: defaultGoalIds). goals: MT của chủ đề [{ id, no, text }];
 * contentsOf(goal) → chuỗi nội dung (bản chụp) của MT. usedCells: số ô tuần đang dùng thẻ (hỏi khi xóa).
 */
export default function ActivityCardEditor({
  card = null,
  goals,
  contentsOf,
  defaultGoalIds = [],
  defaultName = '',
  defaultSlot = '',
  usedCells = 0,
  origin,
  onSave,
  onDelete,
  onClose,
}) {
  const [slot, setSlot] = useState(card?.slot || defaultSlot);
  const [name, setName] = useState(card?.name ?? defaultName);
  const [goalIds, setGoalIds] = useState(() => (card?.goalIds || defaultGoalIds).map(String));
  const [refs, setRefs] = useState(() => card?.contentRefs || []);
  const [tried, setTried] = useState(false);
  const [askDelete, setAskDelete] = useState(false);
  // Thẻ cũ "chưa rõ loại giờ" lưu lại được khi chưa đổi; thẻ mới bắt buộc chọn (FR-005, clarify 12/11)
  const slotOk = !!slot || (card?.legacy && !card.slot);
  const errors = {
    slot: slotOk ? '' : 'Chọn loại giờ',
    name: !name.trim() ? 'Nhập tên hoạt động' : name.length > CARD_NAME_MAX ? `Tối đa ${CARD_NAME_MAX} ký tự` : '',
    goals: goalIds.length ? '' : 'Chọn ít nhất một MT',
  };
  const invalid = Object.values(errors).some(Boolean);
  const toggleGoal = (id) => {
    const on = goalIds.includes(id);
    setGoalIds(on ? goalIds.filter((x) => x !== id) : [...goalIds, id]);
    if (on) setRefs(refs.filter((r) => !r.startsWith(`${id}:`)));
  };
  const toggleRef = (ref) => setRefs(refs.includes(ref) ? refs.filter((r) => r !== ref) : [...refs, ref]);
  const save = () => {
    setTried(true);
    if (invalid) return;
    const fields = { slot, name: name.trim(), goalIds, contentRefs: refs };
    if (!card) onSave(newCard({ ...fields, origin }));
    else {
      const next = { ...card, ...fields };
      // Đổi sang loại giờ hợp lệ ⇒ không còn là thẻ "chưa rõ" của dữ liệu cũ
      if (card.legacy && slot) delete next.legacy;
      onSave(next);
    }
  };
  const err = (key) => (tried ? errors[key] : '');
  return (
    <>
      <Modal
        open
        title={card ? 'Sửa hoạt động' : 'Thêm hoạt động'}
        onClose={onClose}
        footer={
          <>
            {card && onDelete && (
              <button type="button" className="btn btn--outline-danger" onClick={() => setAskDelete(true)}>
                <Trash2 size={16} aria-hidden /> Xóa
              </button>
            )}
            <button type="button" className="btn" onClick={onClose}>
              Hủy
            </button>
            <button type="button" className="btn btn--primary" onClick={save}>
              Lưu
            </button>
          </>
        }
      >
        <div className="stack">
          <FormField label="Loại giờ" required error={err('slot')}>
            <select className="input" value={slot} onChange={(e) => setSlot(e.target.value)}>
              <option value="">{card?.legacy && !card.slot ? 'Chưa rõ loại giờ' : 'Chọn loại giờ'}</option>
              {weekRows().map((r) => (
                <option key={r.key} value={r.key}>
                  {r.label}
                </option>
              ))}
            </select>
          </FormField>
          {card?.legacy && !card.slot && !slot && <p className="text-danger text-sm text-right">Chưa rõ loại giờ</p>}
          <FormField label="Tên hoạt động" required error={err('name')}>
            <input className="input" value={name} maxLength={CARD_NAME_MAX + 50} onChange={(e) => setName(e.target.value)} />
          </FormField>
          <fieldset className="ga-edit-fieldset stack">
            <legend className="field__label">
              Mục tiêu<span className="req">*</span>
            </legend>
            {goals.map((g) => {
              const id = String(g.id);
              const on = goalIds.includes(id);
              const lines = on ? contentLinesOf(contentsOf(g)) : [];
              return (
                <div key={id} className="stack">
                  <label className="checkbox">
                    <input type="checkbox" checked={on} onChange={() => toggleGoal(id)} />
                    <span>
                      <span className="ga-goal-code">MT{g.no}</span> {g.text}
                    </span>
                  </label>
                  {/* Nội dung gắn thẻ là tùy chọn (Q3), chỉ trong các MT đã chọn */}
                  {lines.map((text, i) => (
                    <label key={i} className="checkbox text-sm ga-goal-table__pad">
                      <input type="checkbox" checked={refs.includes(`${id}:${i}`)} onChange={() => toggleRef(`${id}:${i}`)} />
                      <span>{text}</span>
                    </label>
                  ))}
                </div>
              );
            })}
            {err('goals') && (
              <span className="field__error" role="alert">
                {err('goals')}
              </span>
            )}
          </fieldset>
        </div>
      </Modal>
      <ConfirmationModal
        open={askDelete}
        danger
        title="Xóa hoạt động"
        message={`Xóa "${card?.name || ''}"?${usedCells ? ` ${usedCells} ô kế hoạch tuần đang dùng hoạt động này (ô vẫn giữ chữ).` : ''}`}
        confirmLabel="Xóa"
        onConfirm={() => {
          setAskDelete(false);
          onDelete(card);
        }}
        onClose={() => setAskDelete(false)}
      />
    </>
  );
}
