import { test, expect } from '@playwright/test';
import { E2E, USERS, addTeamLeader, api, beReachable, cleanup, editHeaders, ids, newSession, sql, yearPlanBody } from '../support/realBe.mjs';

// Integration: danh mục Chương trình GDMN của Bộ (BE:EDU-28, specs/005-ministry-goal-catalog) và liên kết mục tiêu khi lưu kế hoạch năm.
test.describe.configure({ mode: 'serial' });

const CUR = '/education-plans/curriculum';
const GOALS = '/education-plans/goals';
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
  expect(counts).toEqual({ 'ag-2': [41, 77], 'ag-3': [84, 119], 'ag-4': [99, 121], 'ag-5': [103, 106] });
  const unknown = await api(USERS.vp, 'GET', `${CUR}/goals?ageGroupId=999999`);
  expect(unknown.status).toBe(404);
});

test('IT-18 lưu kế hoạch năm: giữ liên kết mục tiêu của Bộ; mục tiêu khác nhóm tuổi bị chặn (7030)', async () => {
  const { ageGroup } = ids();
  const own = (await api(USERS.vp, 'GET', `${CUR}/goals?ageGroupId=${ageGroup}`)).data[0];
  const other = (await api(USERS.vp, 'GET', `${CUR}/goals?ageGroupId=${ageId('ag-3')}`)).data[0];
  const s = newSession();
  const body = await yearPlanBody(`${E2E.titlePrefix} Kế hoạch năm (danh mục Bộ)`, { domainId: own.domainId });
  body.domains[0].rows[0] = { ...body.domains[0].rows[0], text: own.goalText, curriculumGoalId: own.id };
  const created = await api(USERS.teacher1, 'POST', GOALS, { body, headers: editHeaders(s, 0) });
  expect(created.status, created.desc).toBe(201);
  const row = created.data.domains.flatMap((d) => d.rows).find((r) => r.kind === 'goal');
  expect(row.curriculumGoalId).toBe(own.id);
  expect(row.curriculumGoalText).toBe(own.goalText);
  expect(row.curriculumSectionRef).toBe(own.sectionRef);

  body.domains[0].rows[0].curriculumGoalId = other.id;
  const wrong = await api(USERS.teacher1, 'PUT', `${GOALS}/${created.data.id}`, { body, headers: editHeaders(s, created.data.revision) });
  expect(wrong.status).toBe(400);
  expect(wrong.errorCode).toBe(7030);
  const kept = await api(USERS.vp, 'GET', `${GOALS}/${created.data.id}`);
  expect(kept.data.domains.flatMap((d) => d.rows).find((r) => r.kind === 'goal').curriculumGoalId).toBe(own.id);
  await api(USERS.teacher1, 'POST', `${GOALS}/${created.data.id}/finish-editing`, { headers: editHeaders(s, created.data.revision) });
});
