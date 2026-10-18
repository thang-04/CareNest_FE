import { useState } from 'react';
import { Plus, X, Info } from '@/components/ui/icons';
import { ALLERGY_STATE_LABELS, DECLARATION_STATE, DIET_STATE_LABELS, NOTE_STATE_LABELS } from '@/models/children/childrenConstants';
import { MEDICAL_HISTORY_ITEMS, MEDICAL_HISTORY_STATE_LABELS, emptyMedicalHistory } from '@/models/children/childProfile';

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
  // Khai báo cũ chưa có tiền sử ⇒ coi như Chưa cung cấp.
  const history = value.medicalHistory || emptyMedicalHistory();
  const setHistory = (key, patch) => onChange({ ...value, medicalHistory: { ...history, [key]: { ...history[key], ...patch } } });
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
          Ghi đúng thông tin phụ huynh cung cấp. Nếu phụ huynh chưa cho biết, chọn <b>Chưa cung cấp</b> – không mặc định là không có. Thông
          tin dị ứng có hiệu lực ngay khi lưu: bếp và điểm danh dùng danh sách này.
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

      <div>
        <h3 className="subsection-title">Tiền sử</h3>
        <p className="muted text-sm">
          Như phần Tiền sử của phiếu khám sức khỏe; phiếu khám điền sẵn từ đây. Ghi đúng tên bệnh phụ huynh báo, không tự ghi chẩn đoán.
        </p>
      </div>
      {MEDICAL_HISTORY_ITEMS.map((it) => {
        const v = history[it.key];
        const error = errors[`medicalHistory.${it.key}`];
        return (
          <fieldset key={it.key} className="tr-fieldset">
            <legend className="field__label">{it.label}</legend>
            <StateRadios
              name={`tr-history-${it.key}`}
              labels={MEDICAL_HISTORY_STATE_LABELS}
              value={v.state}
              onChange={(state) => setHistory(it.key, { state })}
            />
            {it.withText && v.state === DECLARATION_STATE.REPORTED && (
              <input
                className="input mt-12"
                maxLength={300}
                aria-label={it.textLabel}
                placeholder={`${it.textLabel}, ví dụ: Hen phế quản`}
                value={v.text}
                onChange={(e) => setHistory(it.key, { text: e.target.value })}
              />
            )}
            {it.key === 'tbContact' && v.state === DECLARATION_STATE.REPORTED && (
              <div className="alert alert--info mt-12">
                <Info size={18} />
                <div>
                  Khi lưu, hệ thống báo Hiệu trưởng, Phó hiệu trưởng điểm trường và giáo viên lớp để trao đổi với phụ huynh về việc đưa trẻ
                  đi khám sàng lọc. Bác sĩ xem lại ở đợt khám tới.
                </div>
              </div>
            )}
            {error && (
              <span className="field__error" role="alert">
                {error}
              </span>
            )}
          </fieldset>
        );
      })}
    </div>
  );
}
