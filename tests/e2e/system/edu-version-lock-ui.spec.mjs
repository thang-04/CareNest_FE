import { test, expect } from '@playwright/test';
import { api, beReachable } from '../support/realBe.mjs';
import { login, spaGo } from '../support/ui.mjs';

// System spec 004 (BE thật, E2E_PG_DB=carenest_merge):
// - Q3b/Q5/Q6: kế hoạch tổ khóa từ ngày bắt đầu năm học; Tổ trưởng thấy lý do khóa, không tạo phiên bản; chỉ Hiệu trưởng mở khóa
//   (bắt buộc lý do + hạn mới sau hôm nay), mở xong thì tạo phiên bản được.
// - Q2: gói học kỳ đã ban hành, chưa tới ngày bắt đầu học kỳ ⇒ GVCN "Tạo phiên bản điều chỉnh" ⇒ gói về Nháp, sửa rồi gửi lại.
test.describe.configure({ mode: 'serial' });

const U = { ht: 'principal@gmail.com', vp: 'viceprincipal@gmail.com', tl: 'teamlead34@gmail.com' };
const GOALS = '/education-plans/goals';
const DOCS = '/education-plans/class-docs';
const isoPlus = (days) => {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};
let team;
let cls;

test.beforeAll(async () => {
  test.skip(!(await beReachable()), 'BE thật không chạy ở :8080');
  const teams = (await api(U.tl, 'GET', `${GOALS}?planLevel=TEAM&size=100`)).data.items;
  team = teams.find((p) => p.status === 'APPROVED' && p.current);
  const me = await api(U.tl, 'GET', '/accounts/me');
  cls = (await api(U.tl, 'GET', DOCS)).data.classes.find((c) => String(c.homeroomTeacherId) === String(me.data.userId));
});

test('ST-004-10 kế hoạch tổ đã khóa: Tổ trưởng thấy lý do, không tạo phiên bản; Hiệu trưởng mở khóa bằng giao diện', async ({ page, browser }) => {
  test.skip(!team, 'Chưa có kế hoạch tổ đã ban hành');
  const detail = (await api(U.tl, 'GET', `${GOALS}/${team.id}`)).data;
  test.skip(!detail.timeLock?.timeLocked, 'Kế hoạch tổ đang không khóa (đã mở khóa trước đó hoặc năm học chưa bắt đầu)');
  await login(page, U.tl);
  await spaGo(page, `/education/goals/${team.id}`);
  await expect(page.getByText('Năm học đã bắt đầu, kế hoạch đã khóa', { exact: false })).toBeVisible({ timeout: 30_000 });
  await expect(page.getByRole('button', { name: 'Tạo phiên bản điều chỉnh' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Mở khóa' })).toHaveCount(0);

  const ht = await (await browser.newContext()).newPage();
  await login(ht, U.ht);
  await spaGo(ht, `/education/goals/${team.id}`);
  await ht.getByRole('button', { name: 'Mở khóa' }).click({ timeout: 30_000 });
  const dialog = ht.getByRole('dialog');
  await dialog.getByRole('button', { name: 'Mở khóa' }).click();
  await expect(dialog).toBeVisible(); // thiếu lý do / hạn thì chưa mở
  await dialog.getByLabel('Hạn mới').fill(isoPlus(1));
  await dialog.getByLabel('Lý do').fill('[E2E] Bổ sung chủ đề sau họp tổ');
  const unlocked = ht.waitForResponse((r) => r.url().endsWith(`/goals/${team.id}/unlock`));
  await dialog.getByRole('button', { name: 'Mở khóa' }).click();
  expect((await unlocked).status()).toBe(200);
  await expect(ht.getByText('Năm học đã bắt đầu, kế hoạch đã khóa', { exact: false })).toHaveCount(0);

  const after = (await api(U.tl, 'GET', `${GOALS}/${team.id}`)).data;
  expect(after.timeLock).toMatchObject({ timeLocked: false, extendedTo: isoPlus(1) });
  expect(after.history.some((h) => /unlock/i.test(h.action || '') || /Mở khóa/.test(h.label || h.actionLabel || ''))).toBe(true);
});

test('ST-004-11 gói học kỳ 2 đã ban hành, chưa tới học kỳ: GVCN tạo phiên bản điều chỉnh ⇒ Nháp, gửi lại được', async ({ page }) => {
  test.skip(!cls, 'teamlead34 không có lớp chủ nhiệm');
  const pkgOf = async () =>
    (await api(U.tl, 'GET', DOCS)).data.semesterPackages.find((p) => String(p.classId) === String(cls.id) && p.semesterNo === 2);
  const pkg = await pkgOf();
  test.skip(pkg?.status !== 'APPROVED' || !pkg.canRevise, 'Gói học kỳ 2 chưa ban hành (chạy edu-semester-flow-ui trước)');
  await login(page, U.tl);
  await spaGo(page, `/education/theme-plans/${cls.id}?hk=2`);
  await page.getByRole('button', { name: 'Tạo phiên bản điều chỉnh' }).click({ timeout: 30_000 });
  const confirm = page.getByRole('dialog');
  await expect(confirm.getByText('Bản đã ban hành vẫn hiệu lực', { exact: false })).toBeVisible();
  const revised = page.waitForResponse((r) => r.url().includes(`${DOCS}/semester/`) && r.url().endsWith('/actions'));
  await confirm.getByRole('button', { name: 'Tạo phiên bản' }).click();
  expect((await revised).status()).toBe(200);
  const draft = await pkgOf();
  expect(draft.status).toBe('DRAFT');
  expect(draft.history.some((h) => h.action === 'revise_future' || h.action === 'revise')).toBe(true);
  await expect(page.getByRole('button', { name: 'Gửi duyệt học kỳ 2' })).toBeVisible();
  // Gửi lại ngay: gói vẫn đủ phần ⇒ Chờ duyệt; PHT duyệt để bộ test khác chạy tiếp như cũ
  await page.getByRole('button', { name: 'Gửi duyệt học kỳ 2' }).click();
  const sent = page.waitForResponse((r) => r.url().endsWith('/actions'));
  await page.getByRole('dialog').getByRole('button', { name: 'Gửi duyệt' }).click();
  expect((await sent).status()).toBe(200);
  const review = await pkgOf();
  expect(review.status).toBe('REVIEW');
  const ok = await api(U.vp, 'POST', `${DOCS}/semester/${review.id}/actions`, {
    body: { action: 'approve', note: '' },
    headers: { 'Idempotency-Key': crypto.randomUUID(), 'X-Class-Doc-Version': String(review.version) },
  });
  expect(ok.status, ok.desc).toBe(200);
});
