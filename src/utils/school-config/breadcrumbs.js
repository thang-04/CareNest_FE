const ROOT = [{ label: 'Trang chủ', to: '/' }, { label: 'Cấu hình trường' }];

const crumbs = (label, to) => (last) => [...ROOT, { label, to }, ...(last ? [{ label: last }] : [])];

export const yearCrumbs = crumbs('Năm học', '/school/years');
export const placementCrumbs = crumbs('Xếp lớp năm học mới', '/school/placement');
export const classCrumbs = crumbs('Nhóm tuổi & lớp', '/school/classes');
export const roomCrumbs = crumbs('Phòng ban', '/school/rooms');
export const staffCrumbs = crumbs('Tài khoản nhân sự', '/school/staff');
export const cutoffCrumbs = crumbs('Cấu hình thời gian', '/school/cutoff');
export const campusCrumbs = crumbs('Điểm trường', '/school/campuses');
export const vpCrumbs = crumbs('Phân công Phó hiệu trưởng', '/school/vice-principals');
export const roleCrumbs = crumbs('Vai trò & quyền', '/school/roles');
export const permissionCrumbs = crumbs('Vai trò & quyền', '/school/roles');
export const teacherCrumbs = crumbs('Phân công giáo viên', '/school/teachers');
