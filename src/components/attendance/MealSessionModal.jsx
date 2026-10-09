import { useEffect, useState } from 'react';
import { Utensils } from '@/components/ui/icons';
import { Modal } from '@/components/ui/Modal';
import { MEAL_SESSIONS, MEAL_SESSION_LABELS, isAbsent } from '@/models/attendance/attendanceConstants';
import { validateAttendanceEntry } from '@/utils/attendance/attendanceValidation';

/**
 * #65 Meal Session Selection (UC 6.14): choose the meal session(s) of one child for the day.
 * Returns the selection to the attendance sheet; nothing is saved until the sheet is saved.
 */
export function MealSessionModal({ open, child, mealPlan, entry, onApply, onClose }) {
  const mealsPerDay = mealPlan?.mealsPerDay || MEAL_SESSIONS.length;
  const single = mealsPerDay === 1;
  const [meals, setMeals] = useState(entry?.meals || {});
  const [error, setError] = useState('');

  useEffect(() => {
    if (open) {
      setMeals(entry?.meals || {});
      setError('');
    }
  }, [open, entry]);

  const absent = isAbsent(entry?.status);
  const apply = () => {
    const errs = validateAttendanceEntry({ status: entry.status, meals }, { mealsPerDay });
    if (errs.meals || errs.status) {
      setError(errs.meals || errs.status);
      return;
    }
    onApply(meals);
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={`Chọn bữa ăn – ${child?.fullName || ''}`}
      footer={
        <>
          <button className="btn" onClick={onClose}>
            Quay lại
          </button>
          <button className="btn btn--primary" onClick={apply} disabled={absent}>
            <Utensils size={16} /> Áp dụng bữa ăn
          </button>
        </>
      }
    >
      {absent ? (
        <div className="alert alert--warning">Trẻ đang được điểm danh vắng nên không thể đăng ký suất ăn.</div>
      ) : (
        <>
          <p className="text-2 mt-8 mb-12">
            {single ? (
              <>
                Trẻ ăn <b>1 bữa/ngày</b>
                {mealPlan?.note ? ` (${mealPlan.note})` : ''}. Chọn bữa trẻ ăn hôm nay.
              </>
            ) : (
              'Chọn các bữa trẻ ăn tại trường hôm nay.'
            )}
          </p>
          <fieldset className="dd-sessions">
            <legend className="sr-only">Bữa ăn</legend>
            {single && (
              <label className="radio dd-session">
                <input type="radio" name="dd-session" checked={MEAL_SESSIONS.every((s) => !meals[s])} onChange={() => setMeals({})} />
                Không ăn hôm nay
              </label>
            )}
            {MEAL_SESSIONS.map((s) =>
              single ? (
                <label key={s} className="radio dd-session">
                  <input
                    type="radio"
                    name="dd-session"
                    checked={!!meals[s]}
                    onChange={() => setMeals(Object.fromEntries(MEAL_SESSIONS.map((x) => [x, x === s])))}
                  />
                  {MEAL_SESSION_LABELS[s]}
                </label>
              ) : (
                <label key={s} className="checkbox dd-session">
                  <input type="checkbox" checked={!!meals[s]} onChange={(e) => setMeals({ ...meals, [s]: e.target.checked })} />
                  {MEAL_SESSION_LABELS[s]}
                </label>
              ),
            )}
          </fieldset>
          {error && (
            <div className="field__error mt-8" role="alert">
              {error}
            </div>
          )}
          {(child?.allergies || []).length > 0 && (
            <div className="alert alert--info mt-12">
              Trẻ có ghi nhận dị ứng ({child.allergies.join(', ')}): bếp sẽ chuẩn bị <b>suất thay thế</b>.
            </div>
          )}
        </>
      )}
    </Modal>
  );
}
