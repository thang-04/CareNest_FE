import { useState } from 'react';
import { Button, SelectField, StatusBadge } from '@/components';
import { Plus, Trash2 } from '@/components/ui/icons';
import { AddDishesModal } from '@/components/menu-planning/AddDishesModal';
import { MEAL_SESSION_LABELS } from '@/models/menu-planning/menuPlanningConstants';
import { ROUNDING_STEPS, verdictOf } from '@/utils/menu-planning/dayBalance';

const VERDICTS = [
  ['Lượng', 'quantityStatus'],
  ['Chất', 'qualityStatus'],
  ['Tiền', 'moneyStatus', 'money'],
];

/**
 * Cột trái: món trong ngày theo bữa (đổi món ghi vào kế hoạch tuần nháp), ba kết luận của nhóm tuổi đang xem, nút làm tròn
 * và dựng lại từ công thức. `onChangeDishes` / `onRound` / `onReset` không truyền ⇒ ẩn thao tác tương ứng.
 */
export function BalanceSidebar({ meals, dishes, evaluation, busy, locked, onChangeDishes, onRound, onReset }) {
  const [adding, setAdding] = useState(null);
  const [step, setStep] = useState(ROUNDING_STEPS[0]);
  const current = meals.find((m) => m.session === adding);

  return (
    <aside className="td-bal__side">
      <section className="card">
        <div className="card__header">
          <h2 className="card__title">Món trong ngày</h2>
        </div>
        <div className="card__body">
          {meals.map((meal) => (
            <div key={meal.session} className="td-bal__meal">
              <div className="td-bal__meal-head">
                <b>{MEAL_SESSION_LABELS[meal.session] || meal.session}</b>
                {onChangeDishes && (
                  <Button
                    variant="icon"
                    aria-label={`Chọn món ${MEAL_SESSION_LABELS[meal.session]}`}
                    disabledReason={locked || undefined}
                    onClick={() => setAdding(meal.session)}
                  >
                    <Plus size={16} />
                  </Button>
                )}
              </div>
              {meal.items.length === 0 ? (
                <p className="text-sm muted">Chưa có món.</p>
              ) : (
                <ol className="td-bal__dishes">
                  {meal.items.map((item) => (
                    <li key={item.dishId}>
                      <span>{item.dishName || 'Món đã xóa'}</span>
                      {onChangeDishes && (
                        <Button
                          variant="icon"
                          aria-label={`Bỏ ${item.dishName}`}
                          disabledReason={locked || undefined}
                          onClick={() =>
                            onChangeDishes(
                              meal.session,
                              meal.items.filter((i) => i.dishId !== item.dishId),
                            )
                          }
                        >
                          <Trash2 size={14} />
                        </Button>
                      )}
                    </li>
                  ))}
                </ol>
              )}
            </div>
          ))}
        </div>
      </section>
      {evaluation && (
        <section className="card">
          <div className="card__body td-bal__verdicts">
            {VERDICTS.map(([label, key, kind]) => (
              <div key={key}>
                <span>{label}</span>
                <StatusBadge {...verdictOf(evaluation[key], kind)} />
              </div>
            ))}
          </div>
        </section>
      )}
      {onRound && (
        <section className="card">
          <div className="card__body td-bal__actions">
            <label className="text-sm">
              Bước làm tròn kg / lít
              <SelectField className="select" value={String(step)} onChange={(e) => setStep(Number(e.target.value))}>
                {ROUNDING_STEPS.map((value) => (
                  <option key={value} value={String(value)}>
                    {value.toLocaleString('vi-VN')}
                  </option>
                ))}
              </SelectField>
            </label>
            <Button variant="primary" disabled={busy} onClick={() => onRound(step)}>
              Làm tròn số
            </Button>
            <Button disabled={busy} onClick={onReset}>
              Về công thức món
            </Button>
          </div>
        </section>
      )}
      {current && (
        <AddDishesModal
          title="Chọn món"
          subtitle={MEAL_SESSION_LABELS[current.session]}
          dishes={dishes}
          selectedIds={current.items.map((i) => i.dishId)}
          hideKcal
          onSave={(picked) => {
            setAdding(null);
            onChangeDishes(
              current.session,
              picked.map((d) => ({ dishId: String(d.id), dishName: d.name || '', dishType: d.type || '' })),
            );
          }}
          onClose={() => setAdding(null)}
        />
      )}
    </aside>
  );
}
