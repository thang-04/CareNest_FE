/**
 * Nhãn điểm trường trong ô chọn: tên ngắn; hai điểm trường cùng năm trùng tên ngắn thì ghi kèm mã ("CS-A – Cơ sở 1").
 * list: các điểm trường đang hiện trong cùng ô chọn.
 */
export const campusOptionLabel = (campus, list = []) => {
  const short = campus.shortName || campus.name;
  const same = list.filter((c) => (c.shortName || c.name) === short).length > 1;
  return same && campus.code ? `${campus.code} – ${short}` : short;
};
