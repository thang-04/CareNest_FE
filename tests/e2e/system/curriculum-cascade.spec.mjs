import { test, expect } from '@playwright/test';
import { USERS, E2E, api, sql, cleanup, ids, newSession, editHeaders, yearPlanBody, devPassword, addTeamLeader, suspendOtherTeamLeads } from '../support/realBe.mjs';
import { login, spaGo, saveStatus } from '../support/ui.mjs';

test.describe.configure({ mode: 'serial' });
test.setTimeout(180_000);
const goalsPath = '/education-plans/goals';
let annual;
let selected;
let suggestion;

test.beforeAll(async () => {
  devPassword();
  if (!process.env.E2E_PG_DB?.startsWith('carenest_014_e2e_')) throw new Error('Cần database riêng carenest_014_e2e_*');
  sql("insert into school_years(name,start_date,end_date) values ('2027-2028','2027-09-01','2028-05-31') on conflict(name) do nothing;" +
    "insert into classrooms(campus_id,school_year_id,name,age_group_id) select c.id,y.id,'Lớp B1',g.id from campuses c cross join school_years y cross join age_groups g where c.code='CS-B' and y.name='2027-2028' and g.code='ag-4' on conflict(school_year_id,campus_id,name) do nothing;");
  cleanup();
  addTeamLeader('teacher1');
  suspendOtherTeamLeads('teacher1');
  const body = await yearPlanBody(`${E2E.titlePrefix} 014 curriculum cascade`);
  body.planLevel = 'SCHOOL_YEAR';
  body.themes[0].endDate = '2027-09-17';
  body.domains[0].rows[0].contents[0].themeKeys = [];
  const catalog = await api(USERS.vp, 'GET', `/education-plans/curriculum/goals?ageGroupId=${ids().ageGroup}`);
  selected = catalog.data.find((g) => g.domainId !== body.domains[0].domainId && g.subDomainId && g.expectedResultId);
  const contents = await api(USERS.vp, 'GET', `/education-plans/curriculum/contents?ageGroupId=${ids().ageGroup}`);
  suggestion = contents.data.find((c) => c.domainId === selected.domainId && c.subDomainId === selected.subDomainId && !selected.contents.includes(c.text));
  expect(selected).toBeTruthy();
  expect(suggestion).toBeTruthy();
  const session = newSession();
  const created = await api(USERS.vp, 'POST', goalsPath, { body, headers: editHeaders(session, 0) });
  expect(created.status, created.desc).toBe(201);
  annual = created.data;
  const finish = await api(USERS.vp, 'POST', `${goalsPath}/${annual.id}/finish-editing`, { headers: editHeaders(session, annual.revision) });
  expect(finish.status, finish.desc).toBe(200);
});

test.afterAll(() => {
  if (process.env.E2E_PG_DB?.startsWith('carenest_014_e2e_')) cleanup();
});

test('EDU-61: lấy nguyên văn nguồn, lọc đích, lưu API và mở lại', async ({ page }) => {
  await login(page, USERS.vp);
  await spaGo(page, `/education/school-year-plans/${annual.id}/edit`);
  await page.getByRole('button', { name: 'Lấy và nhập nội dung kế hoạch năm học' }).click();
  await page.getByRole('menuitem', { name: 'Lấy từ Chương trình của Bộ' }).click();
  const dialog = page.getByRole('dialog', { name: 'Lấy từ Chương trình của Bộ' });
  await dialog.locator('label.ga-cur-row', { hasText: selected.goalText }).first().locator('input').check();
  await dialog.getByRole('button', { name: /Thêm 1 mục tiêu/ }).click();
  await expect(dialog).toBeHidden();
  await page.getByRole('button', { name: 'Lấy và nhập nội dung kế hoạch năm học' }).click();
  await page.getByRole('menuitem', { name: 'Lấy từ Chương trình của Bộ' }).click();
  await dialog.getByRole('tab', { name: /Gợi ý nội dung/ }).click();
  await dialog.locator('#cur-domain').selectOption({ label: selected.domainName });
  await dialog.locator('#cur-sub').selectOption({ label: selected.subDomain });
  const target = dialog.locator('#cur-target');
  const value = await target.locator('option', { hasText: selected.goalText }).first().getAttribute('value');
  await target.selectOption(value);
  await dialog.locator('label.ga-cur-row', { hasText: suggestion.text }).first().locator('input').check();
  await dialog.getByRole('button', { name: /Thêm 1 nội dung/ }).click();
  await dialog.getByRole('button', { name: 'Đóng', exact: true }).last().click();
  const goalInputs = await page.locator('textarea').all();
  let goalInput;
  for (const input of goalInputs) if (await input.inputValue() === selected.goalText) { goalInput = input; break; }
  expect(goalInput).toBeTruthy();
  await goalInput.click();
  await page.getByRole('option', { name: selected.goalText, exact: true }).click();
  await page.getByRole('button', { name: 'Lưu', exact: true }).first().click();
  await expect(saveStatus(page)).toHaveText(/Đã lưu lúc/);
  const saved = (await api(USERS.vp, 'GET', `${goalsPath}/${annual.id}`)).data;
  const row = saved.domains.flatMap((d) => d.rows).find((r) => r.curriculumGoalId === selected.id);
  expect(row.text).toBe(selected.goalText);
  expect(row.curriculumSectionRef).toBe(selected.sectionRef);
  expect(row.contents.map((c) => c.text)).toEqual([...selected.contents, suggestion.text]);
  await page.reload();
  await expect.poll(() => page.locator('textarea').evaluateAll((els) => els.map((el) => el.value))).toContain(selected.goalText);
  await expect.poll(() => page.locator('textarea').evaluateAll((els) => els.map((el) => el.value))).toContain(suggestion.text);
});

test('EDU-61: bản mới giữ nguyên nguồn và không đổi bản đã ban hành', async () => {
  const session = newSession();
  const current = (await api(USERS.vp, 'GET', `${goalsPath}/${annual.id}`)).data;
  let lease;
  await expect.poll(async () => {
    lease = await api(USERS.vp, 'POST', `${goalsPath}/${annual.id}/start-editing`, { headers: editHeaders(session, current.revision) });
    return lease.status;
  }, { timeout: 25_000 }).toBe(200);
  const review = await api(USERS.vp, 'POST', `${goalsPath}/${annual.id}/submit`, { headers: editHeaders(session, lease.data.revision) });
  expect(review.status, review.desc).toBe(200);
  const issued = await api(USERS.principal, 'POST', `${goalsPath}/${annual.id}/issue`, { headers: editHeaders(session, review.data.revision) });
  expect(issued.status, issued.desc).toBe(200);
  const approved = (await api(USERS.vp, 'GET', `${goalsPath}/${annual.id}`)).data;
  const versionSession = newSession();
  const version = await api(USERS.vp, 'POST', `${goalsPath}/${annual.id}/versions`, { body: {}, headers: editHeaders(versionSession, approved.revision) });
  expect(version.status, version.desc).toBe(201);
  const copied = version.data.domains.flatMap((d) => d.rows).find((r) => r.curriculumGoalId === selected.id);
  expect(copied.text).toBe(selected.goalText);
  expect(copied.contents.map((c) => c.text)).toEqual([...selected.contents, suggestion.text]);
  const original = (await api(USERS.vp, 'GET', `${goalsPath}/${annual.id}`)).data;
  expect(original.status).toBe('APPROVED');
  expect(original.domains.flatMap((d) => d.rows).find((r) => r.curriculumGoalId === selected.id).text).toBe(selected.goalText);
});

test('EDU-61: kế hoạch tổ không sửa cây nguồn và vẫn phân bổ nội dung', async ({ page }) => {
  const body = await yearPlanBody(`${E2E.titlePrefix} 014 team readonly`);
  body.planLevel = 'TEAM';
  body.curriculumSourcePlanId = annual.id;
  delete body.domains;
  delete body.themes;
  delete body.breaks;
  const session = newSession();
  const created = await api(USERS.teacher1, 'POST', goalsPath, { body, headers: editHeaders(session, 0) });
  expect(created.status, created.desc).toBe(201);
  const finish = await api(USERS.teacher1, 'POST', `${goalsPath}/${created.data.id}/finish-editing`, { headers: editHeaders(session, created.data.revision) });
  expect(finish.status, finish.desc).toBe(200);
  await login(page, USERS.teacher1);
  await spaGo(page, `/education/goals/${created.data.id}/edit`);
  const tree = page.locator('.ga-curriculum-fixed');
  await expect(tree.locator('textarea, input, [role="combobox"]')).toHaveCount(0);
  await expect(tree.locator('.ga-theme-tick').first()).toBeEnabled();
  await expect(page.getByRole('button', { name: 'Lấy và nhập nội dung kế hoạch năm học' })).toHaveCount(0);
});
