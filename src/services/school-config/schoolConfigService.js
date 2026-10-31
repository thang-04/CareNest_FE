import { SCHOOL_CONFIG_API, USE_MOCK } from '@/config/env';
import { beClient } from '@/services/http/beClient';
import { schoolConfigMockRepository } from '@/services/school-config/mock/schoolConfigMockRepository';
import { grantWrites } from '@/models/school-config/schoolConfigConstants';
import { createSchoolConfigApi, schoolConfigApi } from '@/services/school-config/api/schoolConfigApi';

// BE chưa có (Tài khoản nhân sự, Vai trò & quyền): khi nối thử vẫn dùng mock
const NOT_IN_BE = [
  'getStaffAccounts',
  'getStaffImpact',
  'saveStaffAccount',
  'updateStaffProfile',
  'setStaffStatus',
  'getRolePermissions',
  'saveRolePermissions',
];

const VP_AREAS_KEY = 'carenest.dev.vpAreas';
const readVpAreas = () => {
  try {
    return JSON.parse(localStorage.getItem(VP_AREAS_KEY)) || {};
  } catch {
    return {};
  }
};
const withVpAreas = (assignment, areas = {}) => ({
  ...assignment,
  areas,
  sharedService: grantWrites(areas.menu, assignment.campusId),
  areasV2: true,
  staffArea: true,
  areaActions: true,
  teamLeaderArea: true,
});

const devBeRepo = () => {
  const api = createSchoolConfigApi(beClient);
  const repo = Object.fromEntries(
    Object.keys(schoolConfigMockRepository).map((name) => [
      name,
      NOT_IN_BE.includes(name) || !api[name] ? schoolConfigMockRepository[name].bind(schoolConfigMockRepository) : api[name],
    ]),
  );
  // Phân công PHT: điểm trường lưu ở BE; quyền theo chức năng BE chưa có nên còn lưu demo trên trình duyệt
  repo.getViceAssignments = async (schoolYear, user) => {
    const data = await api.getViceAssignments(schoolYear, user);
    const areas = readVpAreas()[schoolYear] || {};
    return {
      ...data,
      rows: data.rows.map((r) => ({ ...r, assignment: r.assignment && withVpAreas(r.assignment, areas[r.user.id]) })),
    };
  };
  repo.saveViceAssignment = async (schoolYear, userId, form, user) => {
    const result = await api.saveViceAssignment(schoolYear, userId, { campusId: form.campusId || null }, user);
    const all = readVpAreas();
    all[schoolYear] = { ...all[schoolYear], [userId]: form.areas || {} };
    try {
      localStorage.setItem(VP_AREAS_KEY, JSON.stringify(all));
    } catch {
      /* chỉ là demo quyền, không lưu được thì bỏ qua */
    }
    return result;
  };
  return repo;
};

/** Facade of school configuration: UI only calls these functions. */
const repo = SCHOOL_CONFIG_API ? devBeRepo() : USE_MOCK ? schoolConfigMockRepository : schoolConfigApi;

export const getSchoolYears = (user) => repo.getSchoolYears(user);
export const getSchoolYearById = (id, user) => repo.getSchoolYearById(id, user);
export const saveSchoolYear = (id, form, user) => repo.saveSchoolYear(id, form, user);
/** payload: { confirmName } – năm học phải đủ các bước bắt buộc (getYearReadiness). */
export const activateSchoolYear = (id, payload, user) => repo.activateSchoolYear(id, payload, user);
export const getYearReadiness = (id, user) => repo.getYearReadiness(id, user);
/** Xếp lớp năm học mới: items [{ childId, action, toClassId }]. */
export const getPlacements = (yearId, user) => repo.getPlacements(yearId, user);
export const savePlacements = (yearId, payload, user) => repo.savePlacements(yearId, payload, user);
export const autoPlace = (yearId, user, scope) => repo.autoPlace(yearId, user, scope);
export const closeSchoolYear = (id, user) => repo.closeSchoolYear(id, user);
export const deleteSchoolYear = (id, user) => repo.deleteSchoolYear(id, user);

export const getStructure = (filters, user) => repo.getStructure(filters, user);
export const getAgeGroups = () => repo.getAgeGroups();
export const saveAgeGroup = (id, form, user) => repo.saveAgeGroup(id, form, user);
export const deleteAgeGroup = (id, user) => repo.deleteAgeGroup(id, user);
export const saveClass = (id, form, user) => repo.saveClass(id, form, user);
export const deleteClass = (id, user) => repo.deleteClass(id, user);
/** payload: { sourceYearId, classIds? } -> { copied: string[], skipped: { name, reason }[] } */
export const copyClasses = (targetYearId, payload, user) => repo.copyClasses(targetYearId, payload, user);

/**
 * Thiết lập năm học: payload { sourceYearId, parts } -> { copiedClasses, withoutRoom, teacherClasses, teamLeaders,
 * vicePrincipals, cutoffTime, semesterCopied, skipped: [{ part, name, reason }] }.
 * Phân công PHT chưa có ở BE nên chép ở đây qua get/saveViceAssignment (PHT đã khóa tài khoản bị bỏ, kèm lý do).
 */
export const copyYear = async (targetYearId, { sourceYearId, parts }, user) => {
  const beParts = parts.filter((p) => p !== 'VICE_PRINCIPALS');
  const result = beParts.length
    ? await repo.copyYear(targetYearId, { sourceYearId, parts: beParts }, user)
    : { copiedClasses: [], withoutRoom: [], teacherClasses: 0, teamLeaders: 0, cutoffTime: null, semesterCopied: false, skipped: [] };
  result.vicePrincipals = 0;
  if (!parts.includes('VICE_PRINCIPALS')) return result;
  const [source, target] = await Promise.all([repo.getViceAssignments(sourceYearId, user), repo.getViceAssignments(targetYearId, user)]);
  const assigned = new Set(target.rows.filter((r) => r.assignment).map((r) => r.user.id));
  for (const row of source.rows) {
    if (!row.assignment || assigned.has(row.user.id)) continue;
    if (row.user.status === 'INACTIVE') {
      result.skipped.push({ part: 'VICE_PRINCIPALS', name: row.user.fullName, reason: 'Tài khoản đã khóa / nghỉ việc' });
      continue;
    }
    try {
      await repo.saveViceAssignment(
        targetYearId,
        row.user.id,
        { campusId: row.assignment.campusId, areas: row.assignment.areas || {}, note: `Sao chép từ năm học ${source.year.name}` },
        user,
      );
      result.vicePrincipals += 1;
    } catch (err) {
      result.skipped.push({ part: 'VICE_PRINCIPALS', name: row.user.fullName, reason: err.message });
    }
  }
  return result;
};

/** Also for attendance / meal modules: the active cutoff of a school year. */
export const getCutoffSetting = (schoolYear) => repo.getCutoffSetting(schoolYear);
export const saveCutoffSetting = (schoolYear, form, user) => repo.saveCutoffSetting(schoolYear, form, user);
export const saveSemester = (schoolYear, form, user) => repo.saveSemester(schoolYear, form, user);

export const getCampusesWithStats = (schoolYear, user) => repo.getCampuses(schoolYear, user);
export const getCampusDetail = (id, schoolYear, user) => repo.getCampusDetail(id, schoolYear, user);
export const saveCampus = (id, form, user) => repo.saveCampus(id, form, user);
export const deleteCampus = (id, user) => repo.deleteCampus(id, user);
/** status: ACTIVE | INACTIVE (ngừng hoạt động). */
export const setCampusStatus = (id, status, user) => repo.setCampusStatus(id, status, user);

/** Staff accounts (PENDING BE: GET/POST /users, PUT /users/{id}, PATCH /users/{id}/role, PATCH /users/{id}/status). */
export const getStaffAccounts = (user) => repo.getStaffAccounts(user);
export const getStaffImpact = (id, form, user) => repo.getStaffImpact(id, form, user);
export const saveStaffAccount = (id, form, user) => repo.saveStaffAccount(id, form, user);
/** Sửa thông tin hồ sơ nhân sự (PHT được giao "Hồ sơ nhân sự · Được sửa"). */
export const updateStaffProfile = (id, form, user) => repo.updateStaffProfile(id, form, user);
export const setStaffStatus = (id, status, reason, user) => repo.setStaffStatus(id, status, reason, user);

export const getViceAssignments = (schoolYear, user) => repo.getViceAssignments(schoolYear, user);
export const saveViceAssignment = (schoolYear, userId, form, user) => repo.saveViceAssignment(schoolYear, userId, form, user);

export const getTeacherAssignments = (filters, user) => repo.getTeacherAssignments(filters, user);
export const saveClassTeachers = (classId, form, user) => repo.saveClassTeachers(classId, form, user);
export const saveTeamLeader = (payload, user) => repo.saveTeamLeader(payload, user);
/** Tổ trưởng nhóm tuổi toàn trường của năm học + giáo viên chọn được. */
export const getTeamLeaders = (filters, user) => repo.getTeamLeaders(filters, user);
/** Lịch sử phân công: [{ userId, fullName, homeroom, validFrom, validTo, current, assignedByName, assignedAt }], mới nhất trước. */
export const getClassTeacherHistory = (classId, user) => repo.getClassTeacherHistory(classId, user);
export const getTeamLeaderHistory = (ageGroupId, schoolYear, user) => repo.getTeamLeaderHistory(ageGroupId, schoolYear, user);

export const getRolePermissions = (user) => repo.getRolePermissions(user);
export const saveRolePermissions = (role, payload, user) => repo.saveRolePermissions(role, payload, user);

/*
 * Tài khoản nhân sự trên BE thật (API tài khoản của dev, G94-60): danh sách phân trang theo phạm vi người xem, tạo kèm
 * phân công, khóa / mở, cấp lại mật khẩu tạm. BE chưa có API sửa hồ sơ / đổi vai trò nên màn không cho làm hai việc đó.
 */
export const STAFF_ACCOUNTS_ON_BE = SCHOOL_CONFIG_API;
export const searchStaffAccounts = ({ role, status, campusId, q, page = 0, size = 10 } = {}) =>
  beClient.get('/accounts', {
    params: { role: role || undefined, status: status || undefined, campusId: campusId || undefined, q: q || undefined, page, size },
  });
/** Toàn bộ tài khoản trong phạm vi (xuất Excel, kiểm trùng khi nhập): đọc lần lượt từng trang 100. */
export const listAllStaffAccounts = async (filters = {}) => {
  const all = [];
  for (let page = 0; page < 50; page += 1) {
    const res = await searchStaffAccounts({ ...filters, page, size: 100 });
    all.push(...(res?.items || []));
    if (page + 1 >= (res?.totalPages || 0)) break;
  }
  return all;
};
export const createStaffAccount = (payload) => beClient.post('/accounts', payload);
export const setStaffAccountStatus = (id, status) => beClient.patch(`/accounts/${id}/status`, { status });
export const resetStaffPassword = (id, temporaryPassword) => beClient.post(`/accounts/${id}/temporary-password`, { temporaryPassword });
