import { Check, AlertTriangle, X } from '@/components/ui/icons';

/**
 * Horizontal process timeline shown on every detail page
 * (e.g. Tạo phiếu → Bàn giao → Xác nhận nhận → Hoàn thành).
 *
 * steps: [{ label, sub?, done?, warn? }]   cancelled: grey out unfinished steps.
 * The first step that is not done becomes "current".
 */
export function ProgressSteps({ steps, cancelled = false }) {
  const currentIndex = steps.findIndex((s) => !s.done);
  return (
    <div className="timeline" style={{ gridTemplateColumns: `repeat(${steps.length}, 1fr)` }}>
      {steps.map((step, i) => {
        const state =
          cancelled && !step.done ? 'cancel' : step.done ? 'done' : step.warn ? 'warn' : i === currentIndex ? 'current' : 'todo';
        return (
          <div key={step.label} className={`timeline__step timeline__step--${state}`}>
            <div className="timeline__dot">
              {state === 'done' ? (
                <Check size={16} />
              ) : state === 'warn' ? (
                <AlertTriangle size={15} />
              ) : state === 'cancel' ? (
                <X size={15} />
              ) : (
                i + 1
              )}
            </div>
            <div className="timeline__label">{step.label}</div>
            {step.sub && <div className="timeline__sub">{step.sub}</div>}
          </div>
        );
      })}
    </div>
  );
}
