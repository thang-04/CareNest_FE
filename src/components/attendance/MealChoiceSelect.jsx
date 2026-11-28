import { SelectField } from '@/components';
import { mealChoiceOf, mealChoiceOptions, mealsOfChoice } from '@/utils/attendance/mealChoice';

/** Ô chọn bữa trẻ ăn: sessions = bữa còn được chọn, classSessions = mọi bữa của lớp. */
export function MealChoiceSelect({ meals, sessions, classSessions, onChange, ...control }) {
  return (
    <SelectField
      className="select dd-reception__meal-select"
      value={mealChoiceOf(meals, sessions)}
      options={mealChoiceOptions(sessions)}
      onChange={(event) => onChange(mealsOfChoice(event.target.value, classSessions))}
      {...control}
    />
  );
}
