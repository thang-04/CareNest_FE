import { useEffect, useRef, useState } from 'react';
import FloatingPanel from '@/components/education-plan/FloatingPanel';
import { CheckCheck, ChevronDown, X } from '@/components/ui/icons';
import { MEAL_SESSION_SHORT } from '@/models/school-config/schoolConfigConstants';
import { HEALTH_SYMPTOMS } from '@/utils/dailyHealthValidation';
import { BEHAVIORS, EATING, EATING_LABELS, POSITIVE_BEHAVIORS, YCCD_RESULT } from '@/models/assessment/dailyObservationOptions';

const FOCUSABLE = 'button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea:not(:disabled)';

/**
 * Nút trong ô bảng mở khung nhỏ (vẽ ra ngoài bảng nên không bị cắt ở mép). Esc hoặc bấm ra ngoài để đóng;
 * mở thì đưa con trỏ vào khung, đóng thì trả con trỏ về nút.
 */
export function CellPopover({ label, text, title, icon, tone, disabled, minWidth = 240, children }) {
  const [open, setOpen] = useState(false);
  const btnRef = useRef(null);
  const panelRef = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    panelRef.current?.querySelector(FOCUSABLE)?.focus();
    const onKey = (e) => {
      // Esc đóng khung; Enter trong ô ghi chú = xong, đóng khung (giá trị đã giữ, bấm Lưu để ghi nhận)
      const done = e.key === 'Enter' && e.target.matches?.('input[type="text"], input:not([type])') && panelRef.current?.contains(e.target);
      if (e.key !== 'Escape' && !done) return;
      e.preventDefault();
      e.stopPropagation();
      setOpen(false);
      btnRef.current?.focus();
    };
    const onDown = (e) => {
      if (!panelRef.current?.contains(e.target) && !btnRef.current?.contains(e.target)) setOpen(false);
    };
    document.addEventListener('keydown', onKey, true);
    document.addEventListener('mousedown', onDown);
    return () => {
      document.removeEventListener('keydown', onKey, true);
      document.removeEventListener('mousedown', onDown);
    };
  }, [open]);

  return (
    <>
      <button
        ref={btnRef}
        type="button"
        className={`dg-cell-btn ${icon ? 'dg-cell-btn--icon' : ''} ${tone ? `dg-cell-btn--${tone}` : ''}`}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label={label}
        title={icon ? label : title || text}
        disabled={disabled}
        onClick={() => setOpen((v) => !v)}
      >
        {icon || (
          <>
            <span className="dg-cell-btn__text">{text}</span>
            <ChevronDown size={12} />
          </>
        )}
      </button>
      {open && (
        <FloatingPanel anchorRef={btnRef} panelRef={panelRef} minWidth={minWidth}>
          <div className="dg-pop" role="dialog" aria-label={label}>
            {children}
          </div>
        </FloatingPanel>
      )}
    </>
  );
}

/** Nhóm nút chọn một giá trị (segmented nhỏ). */
export function Seg({ value, options, onChange, disabled, label, tone }) {
  return (
    <div className="dg-seg" role="radiogroup" aria-label={label}>
      {Object.entries(options).map(([k, v]) => (
        <button
          key={k}
          type="button"
          role="radio"
          aria-checked={value === k}
          className={`dg-seg__opt ${value === k ? `dg-seg__opt--on ${tone?.(k) || ''}` : ''}`}
          disabled={disabled}
          onClick={() => onChange(k)}
        >
          {v}
        </button>
      ))}
    </div>
  );
}

const toggle = (list, k) => (list.includes(k) ? list.filter((x) => x !== k) : [...list, k]);

/** Danh sách ô tích trong khung mở. */
function TickList({ options, selected, onToggle, tone }) {
  return (
    <div className="dg-pop__ticks">
      {Object.entries(options).map(([k, v]) => (
        <label key={k} className={`dg-tick ${selected.includes(k) ? tone?.(k) || '' : ''}`}>
          <input type="checkbox" checked={selected.includes(k)} onChange={() => onToggle(k)} />
          {v}
        </label>
      ))}
    </div>
  );
}

// Thứ tự hiển thị đã chốt: Bình thường, Mệt mỏi, Sốt, Ho, Sổ mũi, Cảm cúm, Khác
const SIGN_ORDER = ['TIRED', 'FEVER', 'COUGH', 'RUNNY_NOSE', 'FLU', 'OTHER'];
const SIGN_OPTIONS = Object.fromEntries(SIGN_ORDER.map((k) => [k, HEALTH_SYMPTOMS[k]]));
const signsText = (signs) =>
  signs.length
    ? SIGN_ORDER.filter((k) => signs.includes(k))
        .map((k) => HEALTH_SYMPTOMS[k])
        .join(', ')
    : 'Bình thường';

/**
 * Sức khỏe trong ngày: Bình thường hoặc các biểu hiện (danh mục của sức khỏe trong ngày). BE điền sẵn theo sức khỏe
 * trong ngày (prefillSigns) khi cô chưa chỉnh; cô chọn lại thì giữ lựa chọn của cô. Không hiển thị thân nhiệt.
 */
export function HealthCell({ health, draft: d, name, disabled, onChange }) {
  const set = (healthSigns) => onChange({ healthSigns, healthOverridden: true });
  const prefill = health?.prefillSigns || [];
  return (
    <CellPopover
      label={`Sức khỏe của ${name}`}
      text={signsText(d.healthSigns)}
      title={d.healthNote ? `${signsText(d.healthSigns)}: ${d.healthNote}` : undefined}
      tone={d.healthSigns.length ? 'bad' : ''}
      disabled={disabled}
      minWidth={280}
    >
      <div className="dg-pop__title">
        {prefill.length ? `Sức khỏe trong ngày: ${signsText(prefill)}; sửa nếu cô thấy khác` : 'Sức khỏe trong ngày chưa ghi dấu hiệu'}
      </div>
      <label className={`dg-tick ${!d.healthSigns.length ? 'dg-tick--good' : ''}`}>
        <input type="checkbox" checked={!d.healthSigns.length} onChange={() => set([])} />
        Bình thường
      </label>
      <TickList
        options={SIGN_OPTIONS}
        selected={d.healthSigns}
        tone={() => 'dg-tick--bad'}
        onToggle={(k) => set(toggle(d.healthSigns, k))}
      />
      <input
        className="input dg-input"
        value={d.healthNote}
        maxLength={500}
        placeholder="Ghi chú điều quan sát được (không chẩn đoán)"
        aria-label={`Ghi chú sức khỏe của ${name}`}
        onChange={(e) => onChange({ healthNote: e.target.value })}
      />
    </CellPopover>
  );
}

/** "Ăn hết" khi mọi bữa ăn hết, ngược lại liệt kê bữa khác mặc định. */
export const mealsText = (meals, sessions) => {
  const off = sessions.filter((m) => meals[m] && meals[m] !== EATING.AN_HET);
  return off.length
    ? off.map((m) => `${MEAL_SESSION_SHORT[m]}: ${EATING_LABELS[meals[m]].toLowerCase()}`).join(', ')
    : EATING_LABELS.AN_HET;
};

const eatingTone = (k) => (k === EATING.AN_HET ? '' : k === EATING.AN_IT ? 'dg-seg__opt--warn' : 'dg-seg__opt--bad');

/** Ăn theo từng bữa của nhóm tuổi; bữa cô đã tắt "Tham gia ăn" khi điểm danh thì khóa ở Không ăn. */
export function MealsCell({ draft: d, row, sessions, name, disabled, onChange }) {
  const values = sessions.map((m) => d.meals[m]);
  const tone = values.includes(EATING.KHONG_AN) ? 'bad' : values.includes(EATING.AN_IT) ? 'warn' : '';
  return (
    <CellPopover label={`Ăn của ${name}`} text={mealsText(d.meals, sessions)} tone={tone} disabled={disabled} minWidth={300}>
      {sessions.map((m) => {
        const skipped = row.skippedMeals?.includes(m);
        return (
          <div key={m} className="dg-pop__line">
            <span className="dg-pop__label">{MEAL_SESSION_SHORT[m]}</span>
            <Seg
              label={`Bữa ${MEAL_SESSION_SHORT[m]} của ${name}`}
              value={d.meals[m]}
              options={EATING_LABELS}
              disabled={skipped}
              tone={eatingTone}
              onChange={(v) => onChange({ meals: { ...d.meals, [m]: v } })}
            />
            {skipped && <span className="muted text-xs">Không ăn hôm nay (điểm danh)</span>}
          </div>
        );
      })}
    </CellPopover>
  );
}

/** Hành vi, thái độ: không tích = Bình thường. */
export function BehaviorsCell({ draft: d, name, disabled, onChange }) {
  const concern = d.behaviors.some((b) => !POSITIVE_BEHAVIORS.includes(b));
  const text = d.behaviors.length ? d.behaviors.map((b) => BEHAVIORS[b]).join(', ') : 'Bình thường';
  return (
    <CellPopover label={`Hành vi của ${name}`} text={text} tone={concern ? 'warn' : d.behaviors.length ? 'good' : ''} disabled={disabled}>
      <div className="dg-pop__title">Hành vi, thái độ trong ngày (không tích = bình thường)</div>
      <TickList
        options={BEHAVIORS}
        selected={d.behaviors}
        tone={(k) => (POSITIVE_BEHAVIORS.includes(k) ? 'dg-tick--good' : 'dg-tick--warn')}
        onToggle={(k) => onChange({ behaviors: toggle(d.behaviors, k) })}
      />
      <input
        className="input dg-input"
        value={d.behaviorNote}
        maxLength={500}
        placeholder="Điểm nổi bật trong ngày (tùy chọn)"
        aria-label={`Điểm nổi bật trong ngày của ${name}`}
        onChange={(e) => onChange({ behaviorNote: e.target.value })}
      />
    </CellPopover>
  );
}

/** Mục tiêu của hoạt động: bấm lần lượt chưa đánh giá → Đạt → Chưa đạt → chưa đánh giá. */
export function GoalChips({ criteria, draft: d, disabled, name, onChange }) {
  const cycle = (id) => {
    const met = d.criteriaMet.filter((x) => x !== id);
    const notMet = d.criteriaNotMet.filter((x) => x !== id);
    if (d.criteriaMet.includes(id)) onChange({ criteriaMet: met, criteriaNotMet: [...notMet, id] });
    else if (d.criteriaNotMet.includes(id)) onChange({ criteriaMet: met, criteriaNotMet: notMet });
    else onChange({ criteriaMet: [...met, id], criteriaNotMet: notMet });
  };
  return (
    <div className="dg-criteria" role="group" aria-label={`Mục tiêu của ${name}`}>
      {criteria.map((c) => {
        const result = d.criteriaMet.includes(c.id) ? YCCD_RESULT.DAT : d.criteriaNotMet.includes(c.id) ? YCCD_RESULT.CHUA_DAT : null;
        return (
          <button
            key={c.id}
            type="button"
            className={`dg-crit ${result === YCCD_RESULT.DAT ? 'dg-crit--on' : result ? 'dg-crit--bad' : ''}`}
            aria-label={`${c.name} ${result === YCCD_RESULT.DAT ? 'đạt' : result ? 'chưa đạt' : 'chưa đánh giá'}`}
            title={`${c.name}: ${c.description}`}
            disabled={disabled}
            onClick={() => cycle(c.id)}
          >
            {result === YCCD_RESULT.DAT ? <CheckCheck size={12} /> : result && <X size={12} />}
            {c.name}
          </button>
        );
      })}
    </div>
  );
}
