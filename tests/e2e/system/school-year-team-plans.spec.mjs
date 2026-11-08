import { test, expect } from '@playwright/test';
import { USERS, E2E, api, cleanup, addTeamLeader, newSession, editHeaders, yearPlanBody, devPassword } from '../support/realBe.mjs';
import { login, pickYear, spaGo } from '../support/ui.mjs';

test.describe.configure({ mode: 'serial' });
let annual;
let team;
const session = newSession();
const goals = '/education-plans/goals';

test.beforeAll(() => {
  devPassword();
  cleanup();
  addTeamLeader('teacher1');
});
test.afterAll(() => {
  if (process.env.E2E_DEV_PASSWORD) cleanup();
});

test('Q01/Q03 PHT có nút lập năm học và cột nhánh trắng, Enter thêm nhánh', async ({ page }) => {
  const body = await yearPlanBody(`${E2E.titlePrefix} annual table`);
  body.planLevel = 'SCHOOL_YEAR';
  body.themes[0].endDate = '2027-09-17';
  body.domains[0].rows[0].contents[0].themeKeys = [];
  body.branchTemplates = [{ key: 'b1', themeKey: 't1', name: 'Nhánh gợi ý' }];
  const result = await api(USERS.vp, 'POST', goals, { body, headers: editHeaders(session, 0) });
  expect(result.status).toBe(201);
  annual = result.data;
  expect(
    (await api(USERS.vp, 'POST', `${goals}/${annual.id}/finish-editing`, { headers: editHeaders(session, annual.revision) })).status,
  ).toBe(200);
  let browserSession;
  page.on('request', (request) => {
    if (request.url().includes(`/goals/${annual.id}/start-editing`)) browserSession = request.headers()['x-edit-session'];
  });
  await login(page, USERS.vp);
  await spaGo(page, '/education/school-year-plans');
  await pickYear(page, E2E.schoolYear);
  await expect(page.getByRole('link', { name: 'Lập kế hoạch năm học', exact: true }).first()).toBeVisible();
  await spaGo(page, `/education/school-year-plans/${annual.id}/edit`);
  const cell = page.locator('.ga-branch-template-cell').first();
  await expect(cell).toHaveCSS('background-color', 'rgb(255, 255, 255)');
  const input = cell.getByRole('textbox', { name: /^Thêm chủ đề nhánh \/ dự án/ });
  await input.fill('Nhánh thêm bằng Enter');
  await cell
    .getByRole('textbox', { name: /^Chủ đề nhánh \/ dự án/ })
    .last()
    .press('Enter');
  await expect(cell.locator('.ga-branch-template-item')).toHaveCount(2);
  await expect(cell.locator('input[type=date]').first()).toHaveAttribute('min', '2027-09-06');
  await expect(cell.locator('input[type=date]').first()).toHaveAttribute('max', '2027-09-17');
  if (browserSession)
    await api(USERS.vp, 'POST', `${goals}/${annual.id}/finish-editing`, { headers: editHeaders(browserSession, annual.revision) });
});

test('Q05/Q12 annual PHT→HT, TEAM kế thừa có cột map và ô cố định xám', async ({ page }) => {
  expect(annual).toBeTruthy();
  let result = await api(USERS.vp, 'POST', `${goals}/${annual.id}/start-editing`, { headers: editHeaders(session, annual.revision) });
  expect(result.status).toBe(200);
  annual = (await api(USERS.vp, 'GET', `${goals}/${annual.id}`)).data;
  result = await api(USERS.vp, 'POST', `${goals}/${annual.id}/submit`, { headers: editHeaders(session, annual.revision) });
  expect(result.status).toBe(200);
  result = await api(USERS.principal, 'POST', `${goals}/${annual.id}/issue`);
  expect(result.status).toBe(200);
  const body = await yearPlanBody(`${E2E.titlePrefix} inherited team`);
  body.planLevel = 'TEAM';
  body.curriculumSourcePlanId = annual.id;
  delete body.domains;
  delete body.themes;
  delete body.breaks;
  const created = await api(USERS.teacher1, 'POST', goals, { body, headers: editHeaders(newSession(), 0) });
  expect(created.status).toBe(201);
  team = created.data;
  expect(team.curriculumSourcePlanId).toBe(annual.id);
  await login(page, USERS.teacher1);
  await spaGo(page, `/education/goals/${team.id}/edit`);
  await expect(page.locator('.ga-theme-table, .ga-goal-table').first()).toBeVisible();
  const fixed = page
    .locator('.ga-curriculum-fixed td')
    .filter({ hasNot: page.locator('input[type=checkbox]') })
    .first();
  await expect(fixed.locator('textarea:not([readonly]):not([disabled]), input:not([readonly]):not([disabled])')).toHaveCount(0);
  await expect(fixed).not.toHaveCSS('background-color', 'rgb(255, 255, 255)');
});

test('EDU-57 PHT không xóa được TEAM qua API', async () => {
  expect(team).toBeTruthy();
  const rejected = await api(USERS.vp, 'DELETE', `${goals}/${team.id}`, { headers: editHeaders(newSession(), team.revision) });
  expect(rejected.status).toBe(403);
  expect((await api(USERS.vp, 'GET', `${goals}/${team.id}`)).status).toBe(200);
});
