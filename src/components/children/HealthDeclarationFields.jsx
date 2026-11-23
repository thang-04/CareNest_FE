import { useId } from 'react';
import { FormField } from '@/components/form/FormField';
import { DateInput } from '@/components/form/DateInput';
import { Checkbox } from '@/components';
import { ChipListInput } from './ChipListInput';
import { IntakeSheet, IntakeChoiceRow } from './IntakeSheet';
import { ALLERGY_STATE_LABELS, DECLARATION_STATE, DIET_STATE_LABELS, NOTE_STATE_LABELS } from '@/models/children/childrenConstants';
import {
  HISTORY_TEXT_MAX,
  MEDICAL_HISTORY_ITEMS,
  MEDICAL_HISTORY_STATE_LABELS,
  cleanHistoryItem,
  emptyMedicalHistory,
  joinHistoryText,
  splitHistoryText,
} from '@/models/children/childProfile';
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
// Ô chi tiết chỉ hiện khi chọn "Có" nên lỗi của dòng lúc đó là lỗi của chính ô này: viền đỏ như ô trong FormField.
const invalidProps = (base, error) => ({ className: error ? `${base} is-invalid` : base, 'aria-invalid': error ? true : undefined });

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
  const mealHintId = useId();
  const set = (block, patch) => onChange({ ...value, [block]: { ...value[block], ...patch } });
  // Khai báo cũ chưa có tiền sử ⇒ chưa chọn, phải chọn Có/Không khi lưu.
  const history = value.medicalHistory || emptyMedicalHistory();
  const setHistory = (key, patch) => onChange({ ...value, medicalHistory: { ...history, [key]: { ...history[key], ...patch } } });

  // Chi tiết khi chọn "Có" — dùng chung cho bảng (sheet) và nhóm fieldset.
  const allergyDetail = value.allergies.state === DECLARATION_STATE.REPORTED && (
    <div>
      <label className="field__label" htmlFor="tr-allergy-item">
        Chất gây dị ứng
      </label>
      <ChipListInput
        id="tr-allergy-item"
        items={value.allergies.items}
        onChange={(items) => set('allergies', { items })}
        placeholder="Ví dụ: Tôm"
        maxItemLength={60}
        error={errors.allergies}
      />
    </div>
  );
  const dietDetail = value.diet.state === DECLARATION_STATE.REPORTED && (
    <textarea
      {...invalidProps('textarea', errors.diet)}
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
      {...invalidProps('textarea', errors.otherNotes)}
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
          <ChipListInput
            id={`tr-history-${it.key}-item`}
            ariaLabel={it.textLabel}
            tone="gray"
            items={splitHistoryText(v.text)}
            onChange={(items) => setHistory(it.key, { text: joinHistoryText(items) })}
            placeholder={`${it.textLabel}, ví dụ: Hen phế quản`}
            maxItemLength={HISTORY_TEXT_MAX}
            maxTotalLength={HISTORY_TEXT_MAX}
            sanitize={cleanHistoryItem}
            error={errors[`medicalHistory.${it.key}`]}
          />
        )}
        {it.dateLabel && (
          <FormField label={it.dateLabel} required error={errors[`medicalHistory.${it.key}Date`]}>
            <DateInput
              value={v.contactDate || ''}
              min={dateOfBirth || undefined}
              max={todayInput()}
              onChange={(next) => setHistory(it.key, { contactDate: next })}
            />
          </FormField>
        )}
      </>
    );
  };

  // CHD-13: thiếu cờ ⇒ báo ăn. Bỏ tích chỉ ẩn dị ứng/chế độ ăn, dữ liệu đã gõ vẫn giữ để tích lại.
  const mealRegistered = value.mealRegistered !== false;
  const mealToggle = (
    <div className="stack gap-1">
      <label className="checkbox">
        <Checkbox
          checked={mealRegistered}
          aria-describedby={mealHintId}
          onChange={(e) => onChange({ ...value, mealRegistered: e.target.checked })}
        />
        Báo ăn
      </label>
      <p id={mealHintId} className="field__hint">
        Trẻ ăn ở trường. Bỏ tích: không khai dị ứng, chế độ ăn và trẻ không có suất ăn.
      </p>
    </div>
  );
  const otherNotesRow = (
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
  );

  if (sheet)
    return (
      <div className="tr-intake stack gap-5">
        {mealToggle}
        <div className="tr-intake-cols">
          {mealRegistered && (
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
              </IntakeSheet>
            </section>
          )}
          <section aria-label="Tiền sử và sức khỏe khác">
            <IntakeSheet title={`${mealRegistered ? 'II' : 'I'}. Tiền sử và sức khỏe khác`}>
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
              {otherNotesRow}
            </IntakeSheet>
          </section>
        </div>
      </div>
    );

  return (
    <div className="stack gap-4">
      {mealToggle}
      {mealRegistered && (
        <>
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
        </>
      )}

      <h3 className="subsection-title">Tiền sử và sức khỏe khác</h3>
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
    </div>
  );
}
