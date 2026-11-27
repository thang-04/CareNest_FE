/* ATT-02a: lựa chọn ăn của một trẻ = một tổ hợp các bữa còn được ăn trong ngày. BE kiểm bữa hợp lệ. */
const SHORT = { MORNING: 'Phụ sáng', LUNCH: 'Trưa', AFTERNOON: 'Xế' };
const NONE = 'NONE';

const subsets = (list) => list.reduce((all, item) => [...all, ...all.map((subset) => [...subset, item])], [[]]).filter((s) => s.length);

const labelOf = (chosen, sessions) => {
  if (sessions.length === 1) return `Ăn ${SHORT[sessions[0]]}`;
  if (chosen.length === sessions.length) return 'Ăn đủ';
  const names = chosen.map((s) => SHORT[s]).join(', ');
  return chosen.length === 1 ? `Chỉ ăn ${names}` : names;
};

/** Giá trị ô chọn ứng với các bữa đang bật. */
export const mealChoiceOf = (meals, sessions) => sessions.filter((s) => !!meals?.[s]).join('+') || NONE;

/** Ăn đủ đứng đầu, nhiều bữa trước ít bữa, Không ăn cuối. */
export const mealChoiceOptions = (sessions) => [
  ...subsets(sessions)
    .sort((a, b) => b.length - a.length || sessions.indexOf(a[0]) - sessions.indexOf(b[0]))
    .map((chosen) => ({ value: chosen.join('+'), label: labelOf(chosen, sessions) })),
  { value: NONE, label: 'Không ăn' },
];

/** Ghi rõ true/false cho mọi bữa của lớp để BE không hiểu thiếu là ăn đủ. */
export const mealsOfChoice = (value, classSessions) => {
  const chosen = value.split('+');
  return Object.fromEntries(classSessions.map((s) => [s, chosen.includes(s)]));
};
