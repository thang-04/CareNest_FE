import { test, expect } from '@playwright/test';
import { api, beReachable } from '../support/realBe.mjs';
import { login, spaGo } from '../support/ui.mjs';

// System spec 004 (BE thật, E2E_PG_DB=carenest_merge):
// - Q3b/Q6 + spec 005: kế hoạch tổ đã ban hành khóa cứng từ ngày bắt đầu năm học, không ai mở lại.
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

// Spec 005 (Tiền 11/11): kế hoạch đã ban hành tới ngày bắt đầu là khóa cứng, không ai mở lại; trang chi tiết không có nút mở hạn
test('ST-004-10 kế hoạch tổ đã ban hành bị khóa: không nút mở hạn ở trang chi tiết, Hiệu trưởng cũng không mở lại được', async ({
  page,
}) => {
  test.skip(!team, 'Chưa có kế hoạch tổ đã ban hành');
  const detail = (await api(U.tl, 'GET', `${GOALS}/${team.id}`)).data;
  test.skip(!detail.timeLock?.timeLocked, 'Kế hoạch tổ đang không khóa (năm học chưa bắt đầu)');
  expect(detail.timeLock.canUnlock).toBe(false);
  await login(page, U.ht);
  await spaGo(page, `/education/goals/${team.id}`);
  // Tiền 11/11/2026: thông báo khóa/hạn chỉ người soạn thấy ⇒ Hiệu trưởng chỉ thấy trang, không thấy thông báo, không nút mở
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible({ timeout: 30_000 });
  await expect(page.getByText('Năm học đã bắt đầu, kế hoạch đã khóa', { exact: false })).toHaveCount(0);
  await expect(page.getByRole('button', { name: /Mở hạn|Mở khóa/ })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Tạo phiên bản điều chỉnh' })).toHaveCount(0);
  const res = await api(U.ht, 'POST', `${GOALS}/${team.id}/unlock`, {
    body: { note: '[E2E] thử mở bản đã ban hành', deadline: isoPlus(1) },
  });
  expect(res.status, res.desc).toBe(400);
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
