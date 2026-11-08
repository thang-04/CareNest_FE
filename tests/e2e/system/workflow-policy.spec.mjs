import { test, expect } from '@playwright/test';
import { USERS, E2E, api, cleanup, ids, addTeamLeader, newSession, editHeaders, yearPlanBody } from '../support/realBe.mjs';
import { login } from '../support/ui.mjs';

test.describe.configure({ mode: 'serial' });
let original;
let policies;
const path = '/education-plans/workflow-policy';
test.beforeAll(async () => {
  cleanup(); ids(); addTeamLeader('teacher1');
  const response = await api(USERS.principal, 'GET', path);
  expect(response.status).toBe(200);
  original = response.data.policies;
  policies = structuredClone(original);
});
test.afterAll(async () => {
  if (original) {
    const current = await api(USERS.principal, 'GET', path);
    await api(USERS.principal, 'PUT', path, { body: { revision: current.data.revision, policies: original } });
  }
  cleanup();
});

test('WF-01 HT lưu policy bằng form và đọc lại từ BE thật sau reload', async ({ page }) => {
  await login(page, USERS.principal);
  await page.goto('/education/settings');
  await page.getByRole('button', { name: 'Chỉnh sửa', exact: true }).click();
  await page.getByRole('checkbox', { name: 'Giáo viên', exact: true }).first().check();
  await page.getByRole('checkbox', { name: /Tổ trưởng/, exact: false }).first().uncheck();
  const saved = page.waitForResponse(r => r.url().endsWith(path) && r.request().method() === 'PUT');
  await page.getByRole('button', { name: 'Lưu người tạo/duyệt', exact: true }).click();
  expect((await saved).status()).toBe(200);
  const actual = await api(USERS.principal, 'GET', path);
  expect(actual.data.policies.year.creators).toEqual(['TEACHER']);
  policies = actual.data.policies;
  await page.reload();
  await expect(page.getByText('3. Người tạo/duyệt', { exact: true })).toBeVisible();
});

test('WF-02 PHT không sửa được policy qua API hoặc form', async ({ page }) => {
  const current = await api(USERS.vp, 'GET', path);
  expect(current.data.canConfigure).toBe(false);
  expect((await api(USERS.vp, 'PUT', path, { body: { revision: current.data.revision, policies } })).status).toBe(403);
  await login(page, USERS.vp);
  await page.goto('/education/settings');
  await page.getByRole('button', { name: 'Chỉnh sửa', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Lưu người tạo/duyệt', exact: true })).toHaveCount(0);
});

test('WF-03 REVIEW đóng lease và cuối tự Ban hành qua browser với reviewer độc lập', async ({ page }) => {
  const current = await api(USERS.principal, 'GET', path);
  policies = { ...current.data.policies, year: { creators: ['TEAM_LEADER'], reviewers: ['VICE_PRINCIPAL'] } };
  expect((await api(USERS.principal, 'PUT', path, { body: { revision: current.data.revision, policies } })).status).toBe(200);
  const session = newSession();
  const created = await api(USERS.teacher1, 'POST', '/education-plans/goals', { body: await yearPlanBody(`${E2E.titlePrefix} WF-03`), headers: editHeaders(session, 0) });
  expect(created.status).toBe(201);
  const submitted = await api(USERS.teacher1, 'POST', `/education-plans/goals/${created.data.id}/submit`, { headers: editHeaders(session, created.data.revision) });
  expect(submitted.status).toBe(200);
  expect(submitted.data.status).toBe('REVIEW');
  expect(submitted.data.editing).toBeFalsy();
  await login(page, USERS.vp);
  await page.goto(`/education/goals/${created.data.id}`);
  const issue = page.waitForResponse(r => r.url().includes(`/goals/${created.data.id}/issue`) && r.request().method() === 'POST');
  await page.getByRole('button', { name: /Ban hành|Duyệt/, exact: false }).first().click();
  const dialog = page.getByRole('dialog');
  await dialog.getByRole('button', { name: /Ban hành|Duyệt/, exact: false }).click();
  const response = await issue;
  expect(response.status()).toBe(200);
  expect(response.request().headers()['x-edit-session']).toBeUndefined();
  const published = await api(USERS.vp, 'GET', `/education-plans/goals/${created.data.id}`);
  expect(published.data.status).toBe('APPROVED');
  expect(published.data.review.printSnapshot.slots.length).toBeGreaterThan(1);
});
