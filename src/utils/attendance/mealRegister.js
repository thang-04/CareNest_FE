/**
 * Sổ báo ăn ngày từ số suất theo bữa của BE (BA: một suất/ngày, "Ăn" = mọi bữa của nhóm tuổi).
 * Bữa phụ chỉ có ở một số nhóm tuổi nên mỗi lớp lấy dòng ở bữa đầu tiên có lớp đó; không cộng dồn các bữa.
 * counts: [{ classes: [{ classId, className, present, absent, missing, normal, substitute }] }] theo thứ tự bữa.
 */
export function dayRegister(counts) {
  const byClass = new Map();
  (counts || []).forEach((c) => (c.classes || []).forEach((l) => byClass.has(l.classId) || byClass.set(l.classId, l)));
  const rows = [...byClass.values()];
  const sum = (key) => rows.reduce((s, l) => s + (l[key] || 0), 0);
  return {
    rows,
    servings: sum('normal') + sum('substitute'),
    substitute: sum('substitute'),
    present: sum('present'),
    absent: sum('absent'),
    missing: sum('missing'),
  };
}
