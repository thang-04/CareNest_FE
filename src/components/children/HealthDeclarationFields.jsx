import { useState } from 'react';
import { Plus, X } from '@/components/ui/icons';
import { FormField } from '@/components/form/FormField';
import { IntakeSheet, IntakeChoiceRow } from './IntakeSheet';
import { ALLERGY_STATE_LABELS, DECLARATION_STATE, DIET_STATE_LABELS, NOTE_STATE_LABELS } from '@/models/children/childrenConstants';
import { MEDICAL_HISTORY_ITEMS, MEDICAL_HISTORY_STATE_LABELS, emptyMedicalHistory } from '@/models/children/childProfile';
import { todayInput } from '@/utils/format';

function StateRadios({ name, labels, value, onChange, states = Object.values(DECLARATION_STATE) }) {
  return (
    <div className="row row--wrap gap-5">
      {states.map((s) => (
        <label key={s} className="radio">
          <input type="radio" name={name} checked={value === s} onChange={() => onChange(s)} />
          {labels[s]}
        </label>
      ))}
    </div>
  );
}

const ALL_STATES = Object.values(DECLARATION_STATE);
// Tiền sử chỉ Có/Không, không còn Chưa cung cấp (user chốt 2026-10-22): phiếu khám điền sẵn từ đây.
const HISTORY_STATES = [DECLARATION_STATE.REPORTED, DECLARATION_STATE.NONE_REPORTED];
const options = (labels, states) => states.map((s) => ({ value: s, label: labels[s] }));

function FieldError({ error }) {
  return error ? (
    <span className="field__error" role="alert">
      {error}
    </span>
  ) : null;
}

/**
 * Enrollment health declaration (SRS #30, UC 5.2): what the parent reported, "none reported",
 * or "not provided" – never assumed and never a diagnosis. dateOfBirth: chặn ngày tiếp xúc trước ngày sinh.
 * sheet: bảng TT | nội dung | kết quả như bước 1 tiếp nhận (IntakeSheet); mặc định nhóm fieldset (màn Khai báo sức khỏe hồ sơ trẻ).
 */
export function HealthDeclarationFields({ value, onChange, errors = {}, dateOfBirth, sheet = false }) {
  const [item, setItem] = useState('');
  const set = (block, patch) => onChange({ ...value, [block]: { ...value[block], ...patch } });
  // Khai báo cũ chưa có tiền sử ⇒ chưa chọn, phải chọn Có/Không khi lưu.
  const history = value.medicalHistory || emptyMedicalHistory();
  const setHistory = (key, patch) => onChange({ ...value, medicalHistory: { ...history, [key]: { ...history[key], ...patch } } });
  const addItem = () => {
    const text = item.trim();
    if (!text) return;
    if (!value.allergies.items.some((x) => x.toLowerCase() === text.toLowerCase()))
      set('allergies', { items: [...value.allergies.items, text] });
    setItem('');
  };

  // Chi tiết khi chọn "Có" — dùng chung cho bảng (sheet) và nhóm fieldset.
  const allergyDetail = value.allergies.state === DECLARATION_STATE.REPORTED && (
    <div>
      <label className="field__label" htmlFor="tr-allergy-item">
        Chất gây dị ứng
      </label>
      <div className="row gap-2 tr-state-text">
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
      <div className="row row--wrap mt-8 gap-2">
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
  );
  const dietDetail = value.diet.state === DECLARATION_STATE.REPORTED && (
    <textarea
      className="textarea"
      rows={2}
      maxLength={500}
      aria-label="Mô tả chế độ ăn"
      placeholder="Ví dụ: ăn chay, không ăn thịt bò…"
      value={value.diet.text}
      onChange={(e) => set('diet', { text: e.target.value })}
    />
  );
  const otherDetail = value.otherNotes.state === DECLARATION_STATE.REPORTED && (
    <textarea
      className="textarea"
      rows={2}
      maxLength={500}
      aria-label="Thông tin sức khỏe khác"
      placeholder="Thông tin phụ huynh cung cấp, ví dụ: đang dùng kính"
      value={value.otherNotes.text}
      onChange={(e) => set('otherNotes', { text: e.target.value })}
    />
  );
  const historyDetail = (it) => {
    const v = history[it.key];
    if (v.state !== DECLARATION_STATE.REPORTED) return null;
    return (
      <>
        {it.withText && (
          <input
            className="input"
            maxLength={300}
            aria-label={it.textLabel}
            placeholder={`${it.textLabel}, ví dụ: Hen phế quản`}
            value={v.text}
            onChange={(e) => setHistory(it.key, { text: e.target.value })}
          />
        )}
        {it.dateLabel && (
          <FormField label={it.dateLabel} required error={errors[`medicalHistory.${it.key}Date`]}>
            <input
              type="date"
              className="input"
              value={v.contactDate || ''}
              min={dateOfBirth || undefined}
              max={todayInput()}
              onChange={(e) => setHistory(it.key, { contactDate: e.target.value })}
            />
          </FormField>
        )}
      </>
    );
  };

  if (sheet)
    return (
      <div className="tr-intake stack gap-5">
        <div className="tr-intake-cols">
          <section aria-label="Dị ứng và chế độ ăn">
            <IntakeSheet title="I. Dị ứng và chế độ ăn">
              <IntakeChoiceRow
                label="Dị ứng thực phẩm / thuốc"
                required
                name="tr-allergy"
                options={options(ALLERGY_STATE_LABELS, ALL_STATES)}
                value={value.allergies.state}
                onChange={(state) => set('allergies', { state })}
                error={errors.allergies}
              >
                {allergyDetail || null}
              </IntakeChoiceRow>
              <IntakeChoiceRow
                label="Chế độ ăn"
                required
                name="tr-diet"
                options={options(DIET_STATE_LABELS, ALL_STATES)}
                value={value.diet.state}
                onChange={(state) => set('diet', { state })}
                error={errors.diet}
              >
                {dietDetail || null}
              </IntakeChoiceRow>
              <IntakeChoiceRow
                label="Thông tin sức khỏe khác"
                name="tr-other"
                options={options(NOTE_STATE_LABELS, ALL_STATES)}
                value={value.otherNotes.state}
                onChange={(state) => set('otherNotes', { state })}
                error={errors.otherNotes}
              >
                {otherDetail || null}
              </IntakeChoiceRow>
            </IntakeSheet>
          </section>
          <section aria-label="Tiền sử">
            <IntakeSheet title="II. Tiền sử">
              {MEDICAL_HISTORY_ITEMS.map((it) => (
                <IntakeChoiceRow
                  key={it.key}
                  label={it.label}
                  required
                  name={`tr-history-${it.key}`}
                  options={options(MEDICAL_HISTORY_STATE_LABELS, HISTORY_STATES)}
                  value={history[it.key].state}
                  onChange={(state) => setHistory(it.key, { state })}
                  error={errors[`medicalHistory.${it.key}`]}
                >
                  {historyDetail(it)}
                </IntakeChoiceRow>
              ))}
            </IntakeSheet>
          </section>
        </div>
      </div>
    );

  return (
    <div className="stack gap-4">
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
        {allergyDetail && <div className="mt-12">{allergyDetail}</div>}
        <FieldError error={errors.allergies} />
      </fieldset>

      <fieldset className="tr-fieldset">
        <legend className="field__label">
          Chế độ ăn<span className="req">*</span>
        </legend>
        <StateRadios name="tr-diet" labels={DIET_STATE_LABELS} value={value.diet.state} onChange={(state) => set('diet', { state })} />
        {dietDetail && <div className="mt-12">{dietDetail}</div>}
        <FieldError error={errors.diet} />
      </fieldset>

      <fieldset className="tr-fieldset">
        <legend className="field__label">Thông tin sức khỏe khác</legend>
        <StateRadios
          name="tr-other"
          labels={NOTE_STATE_LABELS}
          value={value.otherNotes.state}
          onChange={(state) => set('otherNotes', { state })}
        />
        {otherDetail && <div className="mt-12">{otherDetail}</div>}
        <FieldError error={errors.otherNotes} />
      </fieldset>

      <h3 className="subsection-title">Tiền sử</h3>
      {MEDICAL_HISTORY_ITEMS.map((it) => {
        const detail = historyDetail(it);
        return (
          <fieldset key={it.key} className="tr-fieldset">
            <legend className="field__label">
              {it.label}
              <span className="req">*</span>
            </legend>
            <StateRadios
              name={`tr-history-${it.key}`}
              states={HISTORY_STATES}
              labels={MEDICAL_HISTORY_STATE_LABELS}
              value={history[it.key].state}
              onChange={(state) => setHistory(it.key, { state })}
            />
            {detail && <div className="stack gap-3 mt-12">{detail}</div>}
            <FieldError error={errors[`medicalHistory.${it.key}`]} />
          </fieldset>
        );
      })}
    </div>
  );
}
