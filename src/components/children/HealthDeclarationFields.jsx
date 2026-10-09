import { useState } from 'react';
import { Plus, X, Info } from '@/components/ui/icons';
import { ALLERGY_STATE_LABELS, DECLARATION_STATE, DIET_STATE_LABELS, NOTE_STATE_LABELS } from '@/models/children/childrenConstants';

function StateRadios({ name, labels, value, onChange }) {
  return (
    <div className="row row--wrap" style={{ gap: 20 }}>
      {Object.values(DECLARATION_STATE).map((s) => (
        <label key={s} className="radio">
          <input type="radio" name={name} checked={value === s} onChange={() => onChange(s)} />
          {labels[s]}
        </label>
      ))}
    </div>
  );
}

/**
 * Enrollment health declaration (SRS #30, UC 5.2): what the parent reported, "none reported",
 * or "not provided" – never assumed and never a diagnosis.
 */
export function HealthDeclarationFields({ value, onChange, errors = {} }) {
  const [item, setItem] = useState('');
  const set = (block, patch) => onChange({ ...value, [block]: { ...value[block], ...patch } });
  const addItem = () => {
    const text = item.trim();
    if (!text) return;
    if (!value.allergies.items.some((x) => x.toLowerCase() === text.toLowerCase()))
      set('allergies', { items: [...value.allergies.items, text] });
    setItem('');
  };

  return (
    <div className="stack" style={{ gap: 18 }}>
      <div className="alert alert--info">
        <Info size={18} />
        <div>
          Ghi đúng thông tin phụ huynh cung cấp. Nếu phụ huynh chưa cho biết, chọn <b>Chưa cung cấp</b> – không mặc định là không có. Dị ứng
          thực phẩm chỉ được bếp dùng sau khi Hiệu trưởng xác nhận.
        </div>
      </div>

      <fieldset className="tr-fieldset">
        <legend className="field__label">
          Dị ứng thực phẩm / thuốc<span className="req">*</span>
        </legend>
        <StateRadios
          name="tr-allergy"
          labels={ALLERGY_STATE_LABELS}
          value={value.allergies.state}
          onChange={(state) => set('allergies', { state })}
        />
        {value.allergies.state === DECLARATION_STATE.REPORTED && (
          <div className="mt-12">
            <label className="field__label" htmlFor="tr-allergy-item">
              Chất gây dị ứng
            </label>
            <div className="row" style={{ gap: 8, maxWidth: 480 }}>
              <input
                id="tr-allergy-item"
                className="input"
                placeholder="Ví dụ: Tôm"
                value={item}
                maxLength={60}
                onChange={(e) => setItem(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    addItem();
                  }
                }}
              />
              <button type="button" className="btn" onClick={addItem} disabled={!item.trim()}>
                <Plus size={15} /> Thêm
              </button>
            </div>
            <div className="row row--wrap mt-8" style={{ gap: 8 }}>
              {value.allergies.items.map((x) => (
                <span key={x} className="chip chip--red">
                  {x}
                  <button
                    type="button"
                    className="tr-chip-remove"
                    aria-label={`Bỏ ${x}`}
                    onClick={() => set('allergies', { items: value.allergies.items.filter((i) => i !== x) })}
                  >
                    <X size={12} />
                  </button>
                </span>
              ))}
            </div>
          </div>
        )}
        {errors.allergies && (
          <span className="field__error" role="alert">
            {errors.allergies}
          </span>
        )}
      </fieldset>

      <fieldset className="tr-fieldset">
        <legend className="field__label">
          Chế độ ăn<span className="req">*</span>
        </legend>
        <StateRadios name="tr-diet" labels={DIET_STATE_LABELS} value={value.diet.state} onChange={(state) => set('diet', { state })} />
        {value.diet.state === DECLARATION_STATE.REPORTED && (
          <textarea
            className="textarea mt-12"
            rows={2}
            maxLength={500}
            aria-label="Mô tả chế độ ăn"
            placeholder="Ví dụ: ăn chay, không ăn thịt bò…"
            value={value.diet.text}
            onChange={(e) => set('diet', { text: e.target.value })}
          />
        )}
        {errors.diet && (
          <span className="field__error" role="alert">
            {errors.diet}
          </span>
        )}
      </fieldset>

      <fieldset className="tr-fieldset">
        <legend className="field__label">Thông tin sức khỏe khác</legend>
        <StateRadios
          name="tr-other"
          labels={NOTE_STATE_LABELS}
          value={value.otherNotes.state}
          onChange={(state) => set('otherNotes', { state })}
        />
        {value.otherNotes.state === DECLARATION_STATE.REPORTED && (
          <textarea
            className="textarea mt-12"
            rows={2}
            maxLength={500}
            aria-label="Thông tin sức khỏe khác"
            placeholder="Thông tin phụ huynh cung cấp, ví dụ: đang dùng kính"
            value={value.otherNotes.text}
            onChange={(e) => set('otherNotes', { text: e.target.value })}
          />
        )}
        {errors.otherNotes && (
          <span className="field__error" role="alert">
            {errors.otherNotes}
          </span>
        )}
      </fieldset>
    </div>
  );
}
