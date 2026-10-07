const ROOT = [{ label: 'Trang chủ', to: '/' }, { label: 'Cấu hình trường' }];

const crumbs = (label, to) => (last) => [...ROOT, { label, to }, ...(last ? [{ label: last }] : [])];

export const yearCrumbs = crumbs('Năm học', '/school/years');
export const classCrumbs = crumbs('Nhóm tuổi & lớp', '/school/classes');
export const cutoffCrumbs = crumbs('Giờ chốt điểm danh', '/school/cutoff');
export const campusCrumbs = crumbs('Điểm trường', '/school/campuses');
export const vpCrumbs = crumbs('Phân công Phó hiệu trưởng', '/school/vice-principals');
export const roleCrumbs = crumbs('Vai trò & quyền', '/school/roles');
export const teacherCrumbs = crumbs('Phân công giáo viên', '/school/teachers');
