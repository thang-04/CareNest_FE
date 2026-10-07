import { readDb, writeDb, clone, delay, ApiError } from '@/mocks/mockDatabase';
import { buildSeedEducationPlans } from '@/mocks/educationPlanSeed';
import { EDU_STATUS } from '@/models/education-plan/educationPlanConstants';

/*
 * Fake backend for yearly goals, theme plans and lesson plans.
 * Status changes are decided by the pages for now; this layer stores records and blocks
 * deleting anything that has already been sent. Backend must own the approval flow.
 */
const COLLECTIONS = { goals: 'eduGoals', themes: 'eduThemes', lessons: 'eduLessons' };

// Databases saved before this module existed have no education-plan data yet.
const ensureSeeded = (db) => {
  const seed = buildSeedEducationPlans();
  Object.values(COLLECTIONS).forEach((key) => {
    db[key] ||= clone(seed[key]);
  });
  return db;
};

const upsert = (list, item) => {
  const i = list.findIndex((x) => x.id === item.id);
  if (i === -1) list.unshift(item);
  else list[i] = item;
  return item;
};

const save = (kind) => async (item) => {
  await delay();
  if (!item?.id) throw new ApiError(400, 'Thiếu mã bản ghi');
  return writeDb((db) => clone(upsert(ensureSeeded(db)[COLLECTIONS[kind]], clone(item))));
};

const remove = (kind) => async (id) => {
  await delay();
  writeDb((db) => {
    const list = ensureSeeded(db)[COLLECTIONS[kind]];
    const found = list.find((x) => x.id === id);
    if (!found) throw new ApiError(404, 'Không tìm thấy bản ghi');
    if (found.status !== EDU_STATUS.DRAFT && found.status !== EDU_STATUS.REJECTED) {
      throw new ApiError(409, 'Chỉ xóa được bản nháp hoặc bản bị từ chối');
    }
    db[COLLECTIONS[kind]] = list.filter((x) => x.id !== id);
  });
};

export const educationPlanMockRepository = {
  async getAll() {
    await delay();
    const db = readDb();
    if (!db.eduGoals || !db.eduThemes || !db.eduLessons) writeDb(ensureSeeded);
    const fresh = readDb();
    return { goals: clone(fresh.eduGoals), themes: clone(fresh.eduThemes), lessons: clone(fresh.eduLessons) };
  },
  saveGoal: save('goals'),
  deleteGoal: remove('goals'),
  saveTheme: save('themes'),
  deleteTheme: remove('themes'),
  saveLesson: save('lessons'),
  deleteLesson: remove('lessons'),
};
