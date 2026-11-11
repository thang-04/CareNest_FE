import { test, expect } from '@playwright/test';
import { USERS, addTeamLeader, api, beReachable, cleanup, sql } from '../support/realBe.mjs';

// Integration: danh mục Chương trình GDMN của Bộ (BE:EDU-28, specs/005-ministry-goal-catalog) và liên kết mục tiêu khi lưu kế hoạch năm.
test.describe.configure({ mode: 'serial' });

const CUR = '/education-plans/curriculum';
const ageId = (code) => Number(sql(`select id from age_groups where code = '${code}'`));

test.beforeAll(async () => {
  test.skip(!(await beReachable()), 'BE thật không chạy');
  cleanup();
  addTeamLeader('teacher1');
});

test.afterAll(() => {
  if (process.env.E2E_KEEP_DATA !== '1') cleanup();
});

test('IT-17 nguồn và danh mục của Bộ: mọi vai trò kế hoạch đọc được, đủ số mục theo nhóm tuổi', async () => {
  const sources = await api(USERS.teacher2, 'GET', `${CUR}/sources`);
  expect(sources.status, sources.desc).toBe(200);
  expect(sources.data[0].documentNo).toBe('01/VBHN-BGDĐT');
  const counts = {};
  for (const code of ['ag-2', 'ag-3', 'ag-4', 'ag-5']) {
    const goals = await api(USERS.vp, 'GET', `${CUR}/goals?ageGroupId=${ageId(code)}`);
    const contents = await api(USERS.teacher1, 'GET', `${CUR}/contents?ageGroupId=${ageId(code)}`);
    expect(goals.status, goals.desc).toBe(200);
    expect(contents.status, contents.desc).toBe(200);
    counts[code] = [goals.data.length, contents.data.length];
  }
  // Khớp BE:EduCurriculumServiceIntegrationTest (bộ dữ liệu Bộ sau khi sửa tách mục)
  expect(counts).toEqual({ 'ag-2': [41, 82], 'ag-3': [84, 119], 'ag-4': [99, 143], 'ag-5': [107, 150] });
  const unknown = await api(USERS.vp, 'GET', `${CUR}/goals?ageGroupId=999999`);
  expect(unknown.status).toBe(404);
});
