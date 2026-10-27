import { readDb, writeDb, clone, delay, ApiError } from '@/mocks/mockDatabase';
import { EDU_SEED_VERSION, ensureEduDemo } from '@/mocks/educationPlanSeed';
import { EDU_STATUS } from '@/models/education-plan/educationPlanConstants';

/*
 * Fake backend for yearly goals, theme plans and lesson plans.
 * Status changes are decided by the pages for now; this layer stores records and blocks
 * deleting anything that has already been sent. Backend must own the approval flow.
 */
const COLLECTIONS = { goals: 'eduGoals', themes: 'eduThemes', lessons: 'eduLessons' };

// Trình duyệt còn bộ dữ liệu demo cũ (hoặc chưa có): nạp bộ demo kế hoạch giáo dục hiện hành
const ensureSeeded = (db) => {
  ensureEduDemo(db);
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

// BE:EDU-10 — khóa "Đang sửa" của kế hoạch năm; tự nhả sau 30 phút không lưu
const EDIT_LOCK_MS = 30 * 60 * 1000;
const stamp = () => {
  const d = new Date();
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
};
const lockedByOther = (goal, user) =>
  goal.status === EDU_STATUS.EDITING && goal.editing?.userId !== user.id && Date.now() - (goal.editingAt || 0) < EDIT_LOCK_MS;
const releaseLock = ({ editing, editingAt, editingFrom, ...goal }) => ({ ...goal, status: editingFrom || EDU_STATUS.DRAFT });

const editGoal = (apply) => async (id, user) => {
  await delay();
  return writeDb((db) => {
    const list = ensureSeeded(db).eduGoals;
    const i = list.findIndex((x) => x.id === id);
    if (i === -1) throw new ApiError(404, 'Không tìm thấy kế hoạch');
    list[i] = apply(list[i], user);
    return clone(list[i]);
  });
};

// Lưu: trang soạn gửi status Nháp; đang giữ khóa thì vẫn là Đang sửa (BE:EDU-10), gửi / ban hành thì nhả khóa
const saveGoal = async (item) => {
  await delay();
  if (!item?.id) throw new ApiError(400, 'Thiếu mã bản ghi');
  return writeDb((db) => {
    const list = ensureSeeded(db).eduGoals;
    const prev = list.find((x) => x.id === item.id);
    const { editing, editingAt, editingFrom, ...rest } = clone(item);
    const draftLike = rest.status === EDU_STATUS.DRAFT || rest.status === EDU_STATUS.REJECTED;
    const keep = prev?.status === EDU_STATUS.EDITING && draftLike;
    const next = keep
      ? { ...rest, status: EDU_STATUS.EDITING, editing: prev.editing, editingFrom: prev.editingFrom, editingAt: Date.now() }
      : rest;
    return clone(upsert(list, next));
  });
};

export const educationPlanMockRepository = {
  async getAll() {
    await delay();
    const db = readDb();
    if (db.eduSeedVersion !== EDU_SEED_VERSION) writeDb(ensureSeeded);
    const fresh = readDb();
    return { goals: clone(fresh.eduGoals), themes: clone(fresh.eduThemes), lessons: clone(fresh.eduLessons) };
  },
  saveGoal,
  startEditingGoal: editGoal((goal, user) => {
    if (lockedByOther(goal, user)) throw new ApiError(409, `Kế hoạch đang được ${goal.editing.name} sửa`);
    if (goal.status === EDU_STATUS.PENDING_VP) return goal;
    if (goal.status !== EDU_STATUS.DRAFT && goal.status !== EDU_STATUS.REJECTED && goal.status !== EDU_STATUS.EDITING)
      throw new ApiError(409, 'Kế hoạch không sửa được ở trạng thái này');
    const mine = goal.status === EDU_STATUS.EDITING && goal.editing?.userId === user.id;
    const from = goal.status === EDU_STATUS.EDITING ? goal.editingFrom : goal.status;
    return {
      ...goal,
      status: EDU_STATUS.EDITING,
      editingFrom: from,
      editing: mine ? goal.editing : { userId: user.id, name: user.fullName, at: stamp() },
      editingAt: Date.now(),
    };
  }),
  finishEditingGoal: editGoal((goal, user) =>
    goal.status === EDU_STATUS.EDITING && goal.editing?.userId === user.id ? releaseLock(goal) : goal,
  ),
  deleteGoal: remove('goals'),
  saveTheme: save('themes'),
  deleteTheme: remove('themes'),
  saveLesson: save('lessons'),
  deleteLesson: remove('lessons'),
};
