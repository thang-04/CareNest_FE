export const NO_CLASS = 'none';

const hasAccount = (child) => child.guardianCount > 0;

/**
 * Gom trẻ của một điểm trường theo lớp: sĩ số và số bé đã có tài khoản phụ huynh.
 * Lớp lấy từ cấu trúc trường (giữ thứ tự), cộng lớp chỉ thấy qua trẻ; trẻ chưa xếp lớp gom vào "Chưa xếp lớp".
 */
export const groupChildrenByClass = (children = [], classrooms = [], classroomName = (id) => `Lớp #${id}`) => {
  const groups = new Map(classrooms.map((c) => [String(c.id), { id: String(c.id), name: c.name, children: [] }]));
  children.forEach((child) => {
    const key = child.classroomId ? String(child.classroomId) : NO_CLASS;
    if (!groups.has(key)) {
      groups.set(key, { id: key, name: key === NO_CLASS ? 'Chưa xếp lớp' : classroomName(child.classroomId), children: [] });
    }
    groups.get(key).children.push(child);
  });
  return [...groups.values()]
    .filter((g) => g.children.length)
    .map((g) => {
      const withAccount = g.children.filter(hasAccount).length;
      return { ...g, total: g.children.length, withAccount, missing: g.children.length - withAccount };
    });
};

/** Bé chưa có tài khoản phụ huynh lên đầu, rồi theo tên. */
export const sortMissingFirst = (children) =>
  [...children].sort((a, b) => Number(hasAccount(a)) - Number(hasAccount(b)) || a.fullName.localeCompare(b.fullName, 'vi'));

export const missingAccount = (child) => !hasAccount(child);
