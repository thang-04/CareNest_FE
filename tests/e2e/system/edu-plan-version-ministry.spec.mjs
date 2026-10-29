import { test, expect } from '@playwright/test';
import {
  E2E,
  USERS,
  addTeamLeader,
  api,
  beReachable,
  cleanup,
  editHeaders,
  ids,
  newSession,
  suspendOtherTeamLeads,
  yearPlanBody,
} from '../support/realBe.mjs';
import { login, review, saveStatus } from '../support/ui.mjs';

// System: sửa kế hoạch đã ban hành bằng phiên bản điều chỉnh (BE:EDU-25, specs/004) rồi lấy mục tiêu, gợi ý nội dung
// từ Chương trình GDMN của Bộ (BE:EDU-28, specs/005) và gửi / ban hành; nhãn "Theo Bộ" mở đúng mục ở trang nguồn.
test.describe.configure({ mode: 'serial' });
test.setTimeout(180_000);

const GOALS = '/education-plans/goals';
const CUR = '/education-plans/curriculum';
let v1;
let v2Id;
let ministryGoal;
let suggestion;
const plan = async (id) => (await api(USERS.vp, 'GET', `${GOALS}/${id}`)).data;
const goalRows = (p) => p.domains.flatMap((d) => d.rows).filter((r) => r.kind === 'goal');
const leave = async (page, id) => {
  await page.goto('/');
  await expect.poll(async () => (await plan(id)).status, { timeout: 20_000 }).not.toBe('EDITING');
};

test.beforeAll(async () => {
  test.skip(!(await beReachable()), 'BE thật không chạy');
  cleanup();
  const { ageGroup } = ids();
  addTeamLeader('teacher1');
  suspendOtherTeamLeads('teacher1');
  // Tiền điều kiện: kế hoạch năm đã ban hành (lập, gửi, ban hành qua API)
  const tl = newSession();
  const created = await api(USERS.teacher1, 'POST', GOALS, {
    body: await yearPlanBody(`${E2E.titlePrefix} Kế hoạch năm học 2027 – 2028 (phiên bản)`),
    headers: editHeaders(tl, 0),
  });
  expect(created.status, created.desc).toBe(201);
  const sub = await api(USERS.teacher1, 'POST', `${GOALS}/${created.data.id}/submit`, { body: {}, headers: editHeaders(tl, created.data.revision) });
  expect(sub.status, sub.desc).toBe(200);
  const vp = newSession();
  const lease = await api(USERS.vp, 'POST', `${GOALS}/${created.data.id}/start-editing`, { headers: editHeaders(vp, sub.data.revision) });
  const issued = await api(USERS.vp, 'POST', `${GOALS}/${created.data.id}/issue`, { body: {}, headers: editHeaders(vp, lease.data.revision) });
  expect(issued.data.status, issued.desc).toBe('APPROVED');
  v1 = issued.data;
  // Mục tiêu đầu tiên của Bộ ở lĩnh vực chưa có mục tiêu tự gõ (lĩnh vực có mục tiêu ngoài lĩnh vực con thì EDU-24 không ghép
  // lĩnh vực con vào được) và một gợi ý nội dung cùng lĩnh vực
  const typed = new Set(v1.domains.filter((d) => d.rows.length).map((d) => d.domainId));
  ministryGoal = (await api(USERS.vp, 'GET', `${CUR}/goals?ageGroupId=${ageGroup}`)).data.find((g) => !typed.has(g.domainId));
  suggestion = (await api(USERS.vp, 'GET', `${CUR}/contents?ageGroupId=${ageGroup}`)).data.find(
    (c) => c.domainName === ministryGoal.domainName && !ministryGoal.contents.includes(c.text),
  );
});

test.afterAll(() => {
  if (process.env.E2E_KEEP_DATA !== '1') cleanup();
});

test('ST-13 bản đã ban hành: Tổ trưởng tạo phiên bản điều chỉnh, bản cũ giữ nguyên', async ({ page }) => {
  await login(page, USERS.teacher1);
  await page.goto(`/education/goals/${v1.id}`);
  await page.getByRole('button', { name: 'Tạo phiên bản điều chỉnh' }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Tạo phiên bản' }).click();
  await page.waitForURL((u) => /\/education\/goals\/\d+\/edit$/.test(u.pathname) && !u.pathname.includes(`/${v1.id}/`));
  v2Id = Number(page.url().match(/goals\/(\d+)\/edit/)[1]);
  const v2 = await plan(v2Id);
  expect(v2.versionNo).toBe(2);
  expect(goalRows(v2).map((r) => r.text)).toEqual(goalRows(v1).map((r) => r.text));
  expect((await plan(v1.id)).status).toBe('APPROVED');
  await leave(page, v2Id);
});

test('ST-14 phiên bản mới: lấy mục tiêu và gợi ý nội dung từ Chương trình của Bộ, chỉ ghi khi bấm Lưu', async ({ page }) => {
  await login(page, USERS.teacher1);
  await page.goto(`/education/goals/${v2Id}/edit`);
  await expect(page.locator('#desc')).toBeEditable();
  await page.getByRole('button', { name: /Tiếp theo/ }).click();
  await page.getByRole('button', { name: 'Lấy từ Chương trình của Bộ' }).click();
  const dialog = page.getByRole('dialog', { name: 'Lấy từ Chương trình của Bộ' });
  await expect(dialog).toContainText('01/VBHN-BGDĐT');
  await dialog.locator('label.ga-goal-check', { hasText: ministryGoal.goalText }).first().locator('input').check();
  await dialog.getByRole('button', { name: /Thêm 1 mục tiêu/ }).click();
  await expect(dialog).toBeHidden();
  const badge = page.getByRole('link', { name: 'Theo Bộ' });
  await expect(badge).toHaveCount(1);
  await expect(badge).toHaveAttribute('href', new RegExp(`#cg-${ministryGoal.id}$`));

  // Gợi ý nội dung (mục C) gắn vào mục tiêu vừa lấy
  await page.getByRole('button', { name: 'Lấy từ Chương trình của Bộ' }).click();
  await dialog.getByRole('tab', { name: /Gợi ý nội dung/ }).click();
  const target = dialog.locator('#cur-target');
  const value = await target.locator('option', { hasText: ministryGoal.goalText.slice(0, 40) }).first().getAttribute('value');
  await target.selectOption(value);
  await dialog.locator('label.ga-goal-check', { hasText: suggestion.text }).first().locator('input').check();
  await dialog.getByRole('button', { name: /Thêm 1 nội dung/ }).click();
  await dialog.getByRole('button', { name: 'Đóng', exact: true }).last().click();
  await expect(dialog).toBeHidden();

  await expect(saveStatus(page)).toHaveText('Có thay đổi chưa lưu');
  expect(goalRows(await plan(v2Id)).some((r) => r.curriculumGoalId)).toBe(false);
  await page.keyboard.press('Control+s');
  await expect(saveStatus(page)).toHaveText(/Đã lưu lúc/);
  const row = goalRows(await plan(v2Id)).find((r) => r.curriculumGoalId === ministryGoal.id);
  expect(row.text).toBe(ministryGoal.goalText);
  expect(row.curriculumSectionRef).toBe(ministryGoal.sectionRef);
  expect(row.contents.map((c) => c.text)).toEqual([...ministryGoal.contents, suggestion.text]);
  await leave(page, v2Id);
});

test('ST-15 gửi Phó HT duyệt; Phó HT ban hành phiên bản mới; nhãn Theo Bộ mở đúng mục ở trang nguồn', async ({ browser }) => {
  const tl = await (await browser.newContext()).newPage();
  await login(tl, USERS.teacher1);
  await tl.goto(`/education/goals/${v2Id}/edit`);
  await expect(tl.locator('#desc')).toBeEditable();
  await review(tl, 'Gửi Phó HT duyệt', 'Gửi');
  await expect.poll(async () => (await plan(v2Id)).status).toBe('PENDING_VP');

  const ctx = await browser.newContext();
  const vp = await ctx.newPage();
  await login(vp, USERS.vp);
  await vp.goto(`/education/goals/${v2Id}`);
  await review(vp, 'Ban hành', 'Ban hành');
  await expect.poll(async () => (await plan(v2Id)).status).toBe('APPROVED');
  expect((await plan(v2Id)).current).toBe(true);
  expect((await plan(v1.id)).current).toBe(false);

  await vp.reload();
  const badge = vp.getByRole('link', { name: 'Theo Bộ' });
  await expect(badge).toHaveCount(1);
  const [source] = await Promise.all([ctx.waitForEvent('page'), badge.click()]);
  await source.waitForLoadState();
  expect(source.url()).toContain(`ageGroup=${E2E.ageGroupCode}`);
  await expect(source.locator('main')).toContainText('01/VBHN-BGDĐT');
  const item = source.locator(`#cg-${ministryGoal.id}`);
  await expect(item).toContainText(ministryGoal.goalText);
  await expect(item).toContainText(ministryGoal.sectionRef);
  await expect(item).toBeInViewport();
});
