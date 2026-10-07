import { readDb, writeDb, clone, delay, ApiError } from './mockDatabase';
import { buildSeedSchool } from './schoolSeed';
import { ROLES } from '@/models/User';

/** Databases saved before the school structure existed get the seed once. */
export const ensureSchoolSeeded = () => {
  const db = readDb();
  if (db.classes && db.children) return db;
  writeDb((d) => {
    const seed = buildSeedSchool();
    d.classes ||= clone(seed.classes);
    d.children ||= clone(seed.children);
  });
  return readDb();
};

/**
 * Classes a user may see. Principal: all; VP: own campus; teacher & team leader: own classes
 * (team leaders also see classes of their age group); kitchen: own campus.
 */
export const visibleClasses = (db, user) => {
  const all = db.classes || [];
  if (!user) return [];
  if (user.role === ROLES.PRINCIPAL) return all;
  if ([ROLES.VICE_PRINCIPAL, ROLES.KITCHEN_STAFF].includes(user.role)) return all.filter((c) => c.campusId === user.campusId);
  if (user.role === ROLES.TEAM_LEADER)
    return all.filter((c) => c.teacherIds.includes(user.id) || (c.ageGroupId === user.ageGroupId && c.campusId === user.campusId));
  return all.filter((c) => c.teacherIds.includes(user.id));
};

export const schoolMockRepository = {
  async getClasses(filters = {}, user) {
    await delay(120);
    const db = ensureSchoolSeeded();
    let list = filters.all ? db.classes : visibleClasses(db, user);
    if (filters.campusId) list = list.filter((c) => c.campusId === filters.campusId);
    if (filters.ageGroupId) list = list.filter((c) => c.ageGroupId === filters.ageGroupId);
    return clone(list);
  },

  async getClassById(id) {
    await delay(80);
    const db = ensureSchoolSeeded();
    const found = db.classes.find((c) => c.id === id);
    if (!found) throw new ApiError(404, 'Không tìm thấy lớp');
    return clone(found);
  },

  async getChildren(filters = {}, user) {
    await delay(150);
    const db = ensureSchoolSeeded();
    // Child data: team leaders see only the classes they teach (SRS 4.4 footnote 2), not the whole age group.
    const classScope =
      user?.role === ROLES.TEAM_LEADER ? db.classes.filter((c) => c.teacherIds.includes(user.id)) : visibleClasses(db, user);
    const allowed = new Set(classScope.map((c) => c.id));
    const seeAll = user?.role === ROLES.PRINCIPAL;
    const sameCampus = [ROLES.VICE_PRINCIPAL].includes(user?.role);
    let list = db.children.filter(
      (ch) => seeAll || allowed.has(ch.classId) || (sameCampus && !ch.classId && ch.campusId === user.campusId),
    );
    if (filters.classId) list = list.filter((ch) => ch.classId === filters.classId);
    if (filters.campusId) list = list.filter((ch) => ch.campusId === filters.campusId);
    if (filters.status) list = list.filter((ch) => ch.status === filters.status);
    return clone(list);
  },

  async getChildById(id, user) {
    await delay(100);
    const list = await this.getChildren({}, user);
    const child = list.find((c) => c.id === id);
    if (!child) throw new ApiError(404, 'Không tìm thấy trẻ hoặc bạn không có quyền xem');
    return child;
  },
};
