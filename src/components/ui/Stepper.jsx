import { useEffect, useRef } from 'react';
import { Check } from '@/components/ui/icons';

/**
 * Wizard header (Bước 1 → 2 → 3 → 4). Steps already reached are clickable.
 * <Stepper steps={['Thông tin chung', 'Chọn tài sản']} current={step} maxReached={max} onStepClick={goTo} />
 * completed (tùy chọn): các bước đã làm xong theo dữ liệu thật ⇒ chấm xanh lá có dấu tích, kể cả bước đang mở.
 */
export function Stepper({ steps, current, maxReached = current, onStepClick, completed }) {
  const ref = useRef(null);

  // Điện thoại: thanh bước cuộn ngang; đưa bước hiện tại vào giữa khung (không cuộn trang)
  useEffect(() => {
    const list = ref.current;
    const item = list?.querySelector('[aria-current="step"]')?.closest('li');
    if (!list || !item || list.scrollWidth <= list.clientWidth) return;
    list.scrollLeft = item.offsetLeft - (list.clientWidth - item.clientWidth) / 2;
  }, [current]);

  return (
    <ol className="stepper" ref={ref} style={{ '--steps': steps.length }}>
      {steps.map((label, i) => {
        const state = i === current ? 'current' : i < current || i <= maxReached ? 'done' : 'todo';
        const clickable = i !== current && i <= maxReached && !!onStepClick;
        const ok = completed?.has(i);
        const check = completed ? ok : state === 'done' && i < current;
        return (
          <li
            key={label}
            className={`stepper__item stepper__item--${state} ${i < current ? 'stepper__item--passed' : ''} ${ok ? 'stepper__item--ok' : ''}`}
          >
            <button
              type="button"
              className="stepper__btn"
              onClick={() => clickable && onStepClick(i)}
              disabled={!clickable}
              aria-current={i === current ? 'step' : undefined}
            >
              <span className="stepper__dot">{check ? <Check size={14} stroke={2.5} /> : i + 1}</span>
              <span className="stepper__label">{label}</span>
            </button>
          </li>
        );
      })}
    </ol>
  );
}
