import { USE_MOCK } from '@/config/env';
import { schoolConfigMockRepository } from '@/services/school-config/mock/schoolConfigMockRepository';
import { schoolConfigApi } from '@/services/school-config/api/schoolConfigApi';

/** Facade of school configuration: UI only calls these functions. */
const repo = USE_MOCK ? schoolConfigMockRepository : schoolConfigApi;

export const getSchoolYears = (user) => repo.getSchoolYears(user);
export const getSchoolYearById = (id, user) => repo.getSchoolYearById(id, user);
export const saveSchoolYear = (id, form, user) => repo.saveSchoolYear(id, form, user);
export const activateSchoolYear = (id, user) => repo.activateSchoolYear(id, user);
export const closeSchoolYear = (id, user) => repo.closeSchoolYear(id, user);
export const deleteSchoolYear = (id, user) => repo.deleteSchoolYear(id, user);

export const getStructure = (filters, user) => repo.getStructure(filters, user);
export const getAgeGroups = () => repo.getAgeGroups();
export const saveAgeGroup = (id, form, user) => repo.saveAgeGroup(id, form, user);
export const deleteAgeGroup = (id, user) => repo.deleteAgeGroup(id, user);
export const saveClass = (id, form, user) => repo.saveClass(id, form, user);
export const deleteClass = (id, user) => repo.deleteClass(id, user);

/** Also for attendance / meal modules: the active cutoff of a school year. */
export const getCutoffSetting = (schoolYear) => repo.getCutoffSetting(schoolYear);
export const saveCutoffSetting = (schoolYear, form, user) => repo.saveCutoffSetting(schoolYear, form, user);

export const getCampusesWithStats = (schoolYear, user) => repo.getCampuses(schoolYear, user);
export const getCampusDetail = (id, schoolYear, user) => repo.getCampusDetail(id, schoolYear, user);
export const saveCampus = (id, form, user) => repo.saveCampus(id, form, user);
export const deleteCampus = (id, user) => repo.deleteCampus(id, user);

export const getViceAssignments = (schoolYear, user) => repo.getViceAssignments(schoolYear, user);
export const saveViceAssignment = (schoolYear, userId, form, user) => repo.saveViceAssignment(schoolYear, userId, form, user);

export const getTeacherAssignments = (filters, user) => repo.getTeacherAssignments(filters, user);
export const saveClassTeachers = (classId, form, user) => repo.saveClassTeachers(classId, form, user);
export const saveTeamLeader = (payload, user) => repo.saveTeamLeader(payload, user);

export const getRolePermissions = (user) => repo.getRolePermissions(user);
export const saveRolePermissions = (role, payload, user) => repo.saveRolePermissions(role, payload, user);
