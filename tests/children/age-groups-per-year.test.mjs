import assert from 'node:assert/strict';
import { beforeEach, test } from 'node:test';
const store = new Map();
globalThis.localStorage = {
  getItem: (k) => store.get(k) ?? null,
  setItem: (k, v) => store.set(k, String(v)),
  removeItem: (k) => store.delete(k),
};
globalThis.window = new EventTarget();
const { resetDb, readDb, writeDb } = await import('@/mocks/mockDatabase');
const config = await import('@/services/school-config/schoolConfigService');

let principal, active, planned;
beforeEach(async () => {
  resetDb();
  await config.getAgeGroups();
  const db = readDb();
  principal = db.users.find((u) => u.role === 'PRINCIPAL');
  active = db.schoolYears.find((y) => y.status === 'ACTIVE');
  planned = db.schoolYears.find((y) => y.status === 'PLANNED');
  if (!planned) {
    planned = { id: '2027-2028', name: '2027-2028', startDate: '2027-09-05', endDate: '2028-05-31', status: 'PLANNED', history: [] };
    writeDb((d) => {
      d.schoolYears.push(planned);
    });
  }
});

const groupIds = async (yearId) => (await config.getStructure({ schoolYear: yearId }, principal)).ageGroups.map((g) => g.id);

// Cần chốt 22/10/2026: mỗi năm học có danh sách nhóm tuổi riêng (Lỗi 2)
test('nhóm tuổi thêm ở năm sắp tới không hiện ở năm đang học', async () => {
  const added = await config.saveAgeGroup(
    null,
    {
      standardAgeGroupId: 'ag-0',
      name: 'Nhóm trẻ 3–12 tháng',
      shortName: '3–12 tháng',
      ageFromMonths: 3,
      ageToMonths: 13,
      mealSessions: ['LUNCH'],
      maxClassSize: 15,
    },
    principal,
    planned.id,
  );
  assert.ok((await groupIds(planned.id)).includes(added.id));
  assert.ok(!(await groupIds(active.id)).includes(added.id));
});

test('không thêm nhóm tuổi mới vào năm đang hoạt động', async () => {
  await assert.rejects(
    config.saveAgeGroup(
      null,
      {
        standardAgeGroupId: 'ag-0',
        name: 'Nhóm trẻ 3–12 tháng',
        shortName: '3–12 tháng',
        ageFromMonths: 3,
        ageToMonths: 13,
        mealSessions: ['LUNCH'],
        maxClassSize: 15,
      },
      principal,
      active.id,
    ),
    (err) => err.status === 409 && /Sắp diễn ra/.test(err.message),
  );
});

test('màn Nhóm tuổi chỉ hiện nút thêm ở năm sắp diễn ra', async () => {
  const { readFileSync } = await import('node:fs');
  const page = readFileSync('src/pages/school-config/AgeGroupsClassesPage.jsx', 'utf8');
  assert.match(page, /const canAddAgeGroup = editable && year\?\.status === YEAR_STATUS\.PLANNED/);
  assert.match(page, /\{canAddAgeGroup && \(/);
});

// Lỗi 1: xóa chỉ xét lớp, tổ trưởng của năm đang chọn; lỗi nêu năm học và người
test('xóa nhóm tuổi ở năm sắp tới không bị chặn bởi tổ trưởng năm đang học', async () => {
  const db = readDb();
  const group = db.ageGroups.find((g) => !db.classes.some((c) => c.ageGroupId === g.id && c.schoolYear === planned.id));
  const teacher = db.users.find((u) => u.role === 'TEACHER');
  writeDb((d) => {
    d.teamLeaderAssignments = d.teamLeaderAssignments.filter((a) => a.ageGroupId !== group.id);
    d.teamLeaderAssignments.push({ ageGroupId: group.id, userId: teacher.id, schoolYear: active.id });
    d.classes = d.classes.filter((c) => !(c.ageGroupId === group.id && c.schoolYear === active.id));
  });
  await config.deleteAgeGroup(group.id, principal, planned.id);
  assert.ok(!(await groupIds(planned.id)).includes(group.id));
  assert.ok((await groupIds(active.id)).includes(group.id));
  await assert.rejects(config.deleteAgeGroup(group.id, principal, active.id), (err) => {
    assert.match(err.message, new RegExp(`tổ trưởng ${teacher.fullName} ở năm học ${active.name}`));
    return true;
  });
});

test('menu "…" của bảng Nhóm tuổi có thao tác tổ trưởng như màn Phân công', async () => {
  const { readFileSync } = await import('node:fs');
  const page = readFileSync('src/pages/school-config/AgeGroupsClassesPage.jsx', 'utf8');
  const order = ["label: 'Thêm lớp'", "label: 'Lịch sử phân công'", "label: 'Gỡ tổ trưởng'", "label: 'Xóa nhóm tuổi'"].map((l) =>
    page.indexOf(l),
  );
  assert.ok(order.every((i) => i > 0));
  assert.deepEqual(
    [...order].sort((a, b) => a - b),
    order,
  );
});
