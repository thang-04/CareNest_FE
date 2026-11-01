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

/**
 * Cả ngày theo từng bữa (màn PHT / HT): mỗi lớp số suất của từng bữa và tổng các bữa trong ngày.
 * Khác dayRegister (một suất/ngày cho bếp): ở đây cộng mọi bữa để thấy tổng suất cả ngày. Chỉ cộng số BE trả theo bữa.
 */
export function dayBySession(counts) {
  const sessions = (counts || []).map((c) => c.session);
  const byClass = new Map();
  (counts || []).forEach((c) =>
    (c.classes || []).forEach((l) => {
      const row = byClass.get(l.classId) || { ...l, normal: 0, substitute: 0, meals: {} };
      row.meals[c.session] = { normal: l.normal, substitute: l.substitute };
      row.normal += l.normal;
      row.substitute += l.substitute;
      byClass.set(l.classId, row);
    }),
  );
  const rows = [...byClass.values()];
  const sum = (key) => rows.reduce((s, r) => s + (r[key] || 0), 0);
  return { sessions, rows, normal: sum('normal'), substitute: sum('substitute'), total: sum('normal') + sum('substitute') };
}
