/*
 * Giáo viên demo bổ sung (tên hư cấu, email @example.com) để mỗi điểm trường có 30 giáo viên,
 * dùng thử phân trang, ô tìm và hộp chọn giáo viên / tổ trưởng. Phần lớn chưa có lớp.
 */
const FAMILY = ['Nguyễn', 'Trần', 'Lê', 'Phạm', 'Hoàng', 'Vũ', 'Đặng', 'Bùi', 'Đỗ', 'Ngô', 'Dương', 'Lý', 'Phan', 'Đinh', 'Mai'];
const WOMEN = [
  'Thị Thu Hằng',
  'Ngọc Lan',
  'Thanh Thủy',
  'Minh Phương',
  'Thu Trang',
  'Hồng Nhung',
  'Kim Oanh',
  'Bảo Yến',
  'Diệu Linh',
  'Thị Hạnh',
  'Phương Thảo',
  'Quỳnh Anh',
  'Mỹ Duyên',
  'Thanh Hương',
  'Ngọc Ánh',
  'Thùy Dung',
  'Hải Yến',
  'Minh Nguyệt',
];
const MEN = ['Văn Hùng', 'Đức Thắng', 'Quang Huy', 'Minh Khoa', 'Văn Long', 'Thanh Tùng'];
const COLORS = ['#1f6feb', '#e0598b', '#12b886', '#ae3ec9', '#1098ad', '#f08c00', '#5c7cfa', '#d6336c'];
const TARGET_PER_CAMPUS = 30;

const pad = (n, w = 2) => String(n).padStart(w, '0');

/**
 * SĐT giáo viên mẫu thứ n: đầu số 08 để không trùng SĐT phụ huynh mẫu (cùng công thức nhưng đầu 09) — SĐT là tên đăng nhập,
 * không dùng chung giữa nhân sự và phụ huynh (FE-BUG-261021-seed-guardian-staff-phone-overlap).
 */
export const teacherPhoneOf = (n) => `08${pad((n * 37) % 100)} ${pad((n * 53) % 1000, 3)} ${pad((n * 71) % 1000, 3)}`;
/** Công thức cũ (trùng phụ huynh mẫu), chỉ để nâng cấp DB demo đã lưu. */
export const legacyTeacherPhoneOf = (n) => `09${pad((n * 37) % 100)} ${pad((n * 53) % 1000, 3)} ${pad((n * 71) % 1000, 3)}`;

/** Giáo viên cần thêm cho từng điểm trường (giữ nguyên người đang có). */
export const buildExtraTeachers = (users, campusIds = ['c1', 'c2']) => {
  const names = new Set(users.map((u) => u.fullName));
  const pool = [];
  FAMILY.forEach((family, fi) => {
    // Xen kẽ nữ / nam (đa số nữ như thực tế mầm non)
    const given = fi % 4 === 3 ? MEN[fi % MEN.length] : WOMEN[(fi * 5) % WOMEN.length];
    pool.push(`${family} ${given}`);
  });
  WOMEN.forEach((given, gi) => pool.push(`${FAMILY[(gi * 7 + 3) % FAMILY.length]} ${given}`));
  MEN.forEach((given, gi) => pool.push(`${FAMILY[(gi * 4 + 6) % FAMILY.length]} ${given}`));
  WOMEN.forEach((given, gi) => pool.push(`${FAMILY[(gi * 11 + 9) % FAMILY.length]} ${given}`));
  const freeNames = pool.filter((n) => !names.has(n) && names.add(n));
  let n = 0;
  return campusIds.flatMap((campusId) => {
    const have = users.filter((u) => u.campusId === campusId && ['TEACHER', 'TEAM_LEADER'].includes(u.role)).length;
    return Array.from({ length: Math.max(0, TARGET_PER_CAMPUS - have) }, () => {
      n += 1;
      return {
        id: `u_gv${pad(n, 3)}`,
        fullName: freeNames[n - 1] || `Giáo viên ${pad(n, 3)}`,
        role: 'TEACHER',
        email: `giaovien${pad(n, 3)}@example.com`,
        phone: teacherPhoneOf(n),
        campusId,
        locationIds: [],
        avatarColor: COLORS[n % COLORS.length],
      };
    });
  });
};
