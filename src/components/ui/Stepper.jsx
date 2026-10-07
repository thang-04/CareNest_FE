import { Check } from 'lucide-react';

/**
 * Wizard header (Bước 1 → 2 → 3 → 4). Steps already reached are clickable.
 * <Stepper steps={['Thông tin chung', 'Chọn tài sản']} current={step} maxReached={max} onStepClick={goTo} />
 */
export function Stepper({ steps, current, maxReached = current, onStepClick }) {
  return (
    <ol className="stepper" style={{ gridTemplateColumns: `repeat(${steps.length}, 1fr)` }}>
      {steps.map((label, i) => {
        const state = i === current ? 'current' : i < current || i <= maxReached ? 'done' : 'todo';
        const clickable = i !== current && i <= maxReached && !!onStepClick;
        return (
          <li key={label} className={`stepper__item stepper__item--${state} ${i < current ? 'stepper__item--passed' : ''}`}>
            <button
              type="button"
              className="stepper__btn"
              onClick={() => clickable && onStepClick(i)}
              disabled={!clickable}
              aria-current={i === current ? 'step' : undefined}
            >
              <span className="stepper__dot">{state === 'done' && i < current ? <Check size={18} strokeWidth={2.5} /> : i + 1}</span>
              <span className="stepper__label">{label}</span>
            </button>
          </li>
        );
      })}
    </ol>
  );
}
