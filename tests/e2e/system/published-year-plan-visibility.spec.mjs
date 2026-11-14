import { test, expect } from '@playwright/test';
import {
  USERS,
  E2E,
  api,
  sql,
  cleanup,
  addTeamLeader,
  suspendOtherTeamLeads,
  newSession,
  editHeaders,
  yearPlanBody,
  devPassword,
} from '../support/realBe.mjs';
import { login, spaGo } from '../support/ui.mjs';

test.describe.configure({ mode: 'serial' });
let annual;
let team;
const goals = '/education-plans/goals';

test.beforeAll(() => {
  devPassword();
  // Bộ này chỉ chạy trên database kiểm thử riêng để không đụng phân công đang dùng.
  if (!process.env.E2E_PG_DB?.startsWith('carenest_013_e2e_')) throw new Error('Cần database riêng carenest_013_e2e_*');
  sql(
    "insert into school_years(name,start_date,end_date) values ('2027-2028','2027-09-01','2028-05-31') on conflict(name) do nothing;" +
      "insert into classrooms(campus_id,school_year_id,name,age_group_id) select c.id,y.id,'Lớp B1',g.id from campuses c cross join school_years y cross join age_groups g where c.code='CS-B' and y.name='2027-2028' and g.code='ag-4' on conflict(school_year_id,campus_id,name) do nothing;",
  );
  cleanup();
  addTeamLeader('teacher1');
  suspendOtherTeamLeads('teacher1');
});

test.afterAll(() => {
  if (process.env.E2E_PG_DB?.startsWith('carenest_013_e2e_')) cleanup();
});

test('EDU-60: Keycloak chặn năm nháp và cho tổ trưởng đọc sau ban hành', async () => {
  const body = await yearPlanBody(`${E2E.titlePrefix} 013 published visibility`);
  body.planLevel = 'SCHOOL_YEAR';
  body.themes[0].endDate = '2027-09-17';
  body.domains[0].rows[0].contents[0].themeKeys = [];
  body.branchTemplates = [{ key: 'b1', themeKey: 't1', name: 'Nhánh kế thừa E2E 013' }];
  const session = newSession();
  const created = await api(USERS.vp, 'POST', goals, { body, headers: editHeaders(session, 0) });
  expect(created.status).toBe(201);
  annual = created.data;
  expect((await api(USERS.teacher1, 'GET', `${goals}/${annual.id}`)).status).toBe(403);
  const list = await api(USERS.teacher1, 'GET', `${goals}?planLevel=SCHOOL_YEAR&size=200`);
  expect(list.status).toBe(200);
  expect(list.data.items.some((item) => item.id === annual.id)).toBe(false);
  expect((await api(USERS.vp, 'POST', `${goals}/${annual.id}/submit`, { headers: editHeaders(session, annual.revision) })).status).toBe(
    200,
  );
  expect((await api(USERS.teacher1, 'GET', `${goals}/${annual.id}`)).status).toBe(403);
  annual = (await api(USERS.vp, 'GET', `${goals}/${annual.id}`)).data;
  const published = await api(USERS.principal, 'POST', `${goals}/${annual.id}/issue`, { headers: editHeaders(session, annual.revision) });
  expect(published.status, JSON.stringify({ errorCode: published.errorCode, desc: published.desc })).toBe(200);
  expect((await api(USERS.teacher1, 'GET', `${goals}/${annual.id}`)).status).toBe(200);
});

test('TEAM: tick qua trình duyệt, lưu server và mở lại giữ liên kết', async ({ page }) => {
  const body = await yearPlanBody(`${E2E.titlePrefix} 013 browser save`);
  body.planLevel = 'TEAM';
  body.curriculumSourcePlanId = annual.id;
  delete body.domains;
  delete body.themes;
  delete body.breaks;
  const session = newSession();
  const created = await api(USERS.teacher1, 'POST', goals, { body, headers: editHeaders(session, 0) });
  expect(created.status).toBe(201);
  team = created.data;
  expect(
    (await api(USERS.teacher1, 'POST', `${goals}/${team.id}/finish-editing`, { headers: editHeaders(session, team.revision) })).status,
  ).toBe(200);
  await login(page, USERS.teacher1);
  await spaGo(page, `/education/goals/${team.id}/edit`);
  const tick = page.locator('.ga-curriculum-fixed .ga-theme-tick').first();
  await expect(tick).toBeEnabled();
  await tick.focus();
  await page.keyboard.press('Space');
  await page.getByRole('button', { name: 'Lưu', exact: true }).first().click();
  await expect
    .poll(async () => {
      const saved = await api(USERS.teacher1, 'GET', `${goals}/${team.id}`);
      return saved.data.domains[0].rows.find((row) => row.kind === 'goal').contents[0].themeIds.length;
    })
    .toBe(1);
  await page.reload();
  await expect(page.locator('.ga-curriculum-fixed .ga-theme-tick').first()).toHaveAttribute('aria-pressed', 'true');
  const select = page.locator('.ga-theme-goal-preview select');
  await expect(select).toHaveCount(1);
  await select.selectOption({ label: 'Trẻ tự phục vụ (E2E)' });
  const detail = page.locator('.ga-theme-goal-preview [role=status]');
  await expect(detail).toContainText('Trẻ tự phục vụ (E2E)');
  await expect(detail).toContainText('Tự cất đồ dùng (E2E)');
  await expect(page.locator('.ga-theme-edit-fixed').first()).toContainText('Nhánh kế thừa E2E 013');
  await expect(page.locator('.ga-theme-edit-fixed input, .ga-theme-edit-fixed textarea, .ga-theme-edit-fixed button')).toHaveCount(0);
  const colors = await page
    .locator('.ga-theme-edit-fixed th, .ga-theme-edit-fixed td')
    .evaluateAll((cells) => cells.map((cell) => getComputedStyle(cell).backgroundColor));
  expect(new Set(colors).size).toBe(1);
  expect(colors[0]).not.toBe('rgb(255, 255, 255)');
});
