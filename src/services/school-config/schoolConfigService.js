import { SCHOOL_CONFIG_API, USE_MOCK } from '@/config/env';
import { beClient } from '@/services/http/beClient';
import { schoolConfigMockRepository } from '@/services/school-config/mock/schoolConfigMockRepository';
import { createSchoolConfigApi, schoolConfigApi } from '@/services/school-config/api/schoolConfigApi';

// BE chưa có (Tài khoản nhân sự, Phân công PHT, Vai trò & quyền): khi nối thử vẫn dùng mock
const NOT_IN_BE = [
  'getStaffAccounts',
  'getStaffImpact',
  'saveStaffAccount',
  'updateStaffProfile',
  'setStaffStatus',
  'getViceAssignments',
  'saveViceAssignment',
  'getRolePermissions',
  'saveRolePermissions',
];

const devBeRepo = () => {
  const api = createSchoolConfigApi(beClient);
  return Object.fromEntries(
    Object.keys(schoolConfigMockRepository).map((name) => [
      name,
      NOT_IN_BE.includes(name) || !api[name] ? schoolConfigMockRepository[name].bind(schoolConfigMockRepository) : api[name],
    ]),
  );
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

/** Also for attendance / meal modules: the active cutoff of a school year. */
export const getCutoffSetting = (schoolYear) => repo.getCutoffSetting(schoolYear);
export const saveCutoffSetting = (schoolYear, form, user) => repo.saveCutoffSetting(schoolYear, form, user);

export const getCampusesWithStats = (schoolYear, user) => repo.getCampuses(schoolYear, user);
export const getCampusDetail = (id, schoolYear, user) => repo.getCampusDetail(id, schoolYear, user);
export const saveCampus = (id, form, user) => repo.saveCampus(id, form, user);
export const deleteCampus = (id, user) => repo.deleteCampus(id, user);

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
