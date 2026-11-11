import { test, expect } from '@playwright/test';
import { api, beReachable, sql } from '../support/realBe.mjs';
import { login, spaGo } from '../support/ui.mjs';

// System spec 005 (BE thật): trạng thái duyệt và trạng thái hạn tách rõ; mở hạn chỉ Hiệu trưởng, ở màn riêng "Kế hoạch quá hạn"
// (chọn nhiều dòng, một lý do + hạn mới); bản đã ban hành không mở lại; lọc Nhóm tuổi → Lớp; hàng chờ duyệt có cột Hạn.
test.describe.configure({ mode: 'serial' });

const U = { ht: 'principal@gmail.com', vp: 'viceprincipal@gmail.com', tl: 'teamlead34@gmail.com' };
const DOCS = '/education-plans/class-docs';
const run = Date.now() % 100000;
const isoPlus = (days) => {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};
let docs;

test.beforeAll(async () => {
  test.skip(!(await beReachable()), 'BE thật không chạy');
  // Chạy lại được: bỏ các lần mở hạn của bộ test (lý do bắt đầu "[E2E]") để tài liệu quay lại quá hạn
  sql(
    `update edu_class_docs set history = coalesce((select jsonb_agg(e) from jsonb_array_elements(history) e ` +
      `where not (e->>'action' = 'extend' and e->>'note' like '[E2E]%')), '[]'::jsonb) ` +
      `where kind in ('semester','dossier') and history @> '[{"action":"extend"}]'`,
  );
  docs = (await api(U.ht, 'GET', DOCS)).data;
});

test('ST-005-10 HT: màn Kế hoạch quá hạn có hai thẻ, lọc Nhóm tuổi → Lớp (Lớp khóa tới khi chọn nhóm tuổi)', async ({ page }) => {
  await login(page, U.ht);
  await spaGo(page, '/education/overdue');
  await expect(page.getByRole('tab', { name: /Đang quá hạn/ })).toBeVisible({ timeout: 30_000 });
  await expect(page.getByRole('tab', { name: /Đã mở hạn/ })).toBeVisible();
  const age = page.getByRole('combobox', { name: 'Nhóm tuổi' });
  const cls = page.getByRole('combobox', { name: 'Lớp', exact: true });
  await expect(cls).toBeDisabled();
  const groups = await age.locator('option').allInnerTexts();
  if (groups.length > 1) {
    await age.selectOption({ index: 1 });
    await expect(cls).toBeEnabled();
  }
  // Ô chọn của hàng lọc cùng cỡ (FR-022a)
  const widths = await page.locator('.filter-bar .select').evaluateAll((els) => els.map((e) => e.getBoundingClientRect().width));
  expect(new Set(widths).size).toBe(1);
});

test('ST-005-11 PHT không vào được màn quá hạn và API mở hạn bị từ chối; menu chỉ HT có mục', async ({ page }) => {
  const overdue = docs.semesterPackages.find((p) => p.canExtend) || docs.themeDossiers.find((d) => d.canExtend);
  await login(page, U.vp);
  await spaGo(page, '/education/overdue');
  await expect(page.getByRole('tab', { name: /Đang quá hạn/ })).toHaveCount(0);
  await expect(page.getByRole('link', { name: 'Kế hoạch quá hạn' })).toHaveCount(0);
  test.skip(!overdue, 'Không có tài liệu quá hạn để thử API');
  const kind = overdue.semesterNo ? 'semester' : 'dossier';
  const res = await api(U.vp, 'POST', `${DOCS}/${kind}/${overdue.id}/actions`, {
    body: { action: 'extend', note: '[E2E] PHT thử', deadline: isoPlus(3) },
    headers: { 'Idempotency-Key': crypto.randomUUID(), 'X-Class-Doc-Version': String(overdue.version) },
  });
  expect(res.status, res.desc).toBe(403);
});

test('ST-005-12 bản đã ban hành bị khóa từ ngày bắt đầu: HT gọi mở hạn bị từ chối', async () => {
  const locked = docs.semesterPackages.find((p) => p.status === 'APPROVED' && p.timeLocked);
  test.skip(!locked, 'Không có gói học kỳ đã ban hành bị khóa');
  expect(locked.canExtend).toBe(false);
  const res = await api(U.ht, 'POST', `${DOCS}/semester/${locked.id}/actions`, {
    body: { action: 'extend', note: '[E2E] mở bản đã ban hành', deadline: isoPlus(3) },
    headers: { 'Idempotency-Key': crypto.randomUUID(), 'X-Class-Doc-Version': String(locked.version) },
  });
  expect(res.status, res.desc).toBe(400);
});

test('ST-005-13 HT tích 2 dòng, Mở hạn một lần (lý do + hạn mới) ⇒ hai dòng sang thẻ Đã mở hạn', async ({ page }) => {
  const rows = [...docs.semesterPackages.filter((p) => p.canExtend), ...docs.themeDossiers.filter((d) => d.canExtend)];
  test.skip(rows.length < 2, 'Cần ít nhất 2 tài liệu quá hạn');
  await login(page, U.ht);
  await spaGo(page, '/education/overdue');
  const boxes = page.locator('tbody input[type="checkbox"]');
  await expect(boxes.first()).toBeVisible({ timeout: 30_000 });
  const before = await boxes.count();
  await boxes.nth(0).check();
  await boxes.nth(1).check();
  await page.getByRole('button', { name: 'Mở hạn (2)' }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByRole('button', { name: 'Mở hạn' }).click();
  await expect(dialog.getByText('Vui lòng ghi lý do')).toBeVisible();
  await dialog.getByLabel('Hạn mới').fill(isoPlus(7));
  await dialog.getByLabel('Lý do').fill(`[E2E] Mở hạn hàng loạt ${run}`);
  const calls = [];
  page.on('response', (r) => (r.url().endsWith('/actions') || r.url().endsWith('/unlock')) && calls.push(r.status()));
  await dialog.getByRole('button', { name: 'Mở hạn' }).click();
  await expect(dialog).toHaveCount(0, { timeout: 30_000 });
  expect(calls).toEqual([200, 200]);
  await expect(boxes).toHaveCount(before - 2, { timeout: 30_000 });
  await page.getByRole('tab', { name: /Đã mở hạn/ }).click();
  await expect(page.getByText(`[E2E] Mở hạn hàng loạt ${run}`).first()).toBeVisible();
});

test('ST-005-14 trang chi tiết không có nút mở hạn; nhãn hạn ("Hạn: …") tách khỏi nhãn trạng thái duyệt', async ({ page }) => {
  const me = await api(U.tl, 'GET', '/accounts/me');
  const cls = docs.classes.find((c) => String(c.homeroomTeacherId) === String(me.data.userId)) || docs.classes[0];
  await login(page, U.ht);
  await spaGo(page, `/education/theme-plans/${cls.id}?hk=1`);
  await expect(page.getByRole('heading', { name: 'Học kỳ 1', exact: true })).toBeVisible({ timeout: 30_000 });
  await expect(page.getByRole('button', { name: /Mở hạn|Mở khóa/ })).toHaveCount(0);
  const deadline = page.getByText(/^Hạn: /).first();
  await expect(deadline).toBeVisible();
  // Nhãn hạn nằm ngoài vùng tiêu đề thẻ (nơi đặt nhãn trạng thái duyệt)
  await expect(page.locator('.card__header').getByText(/^Hạn: /)).toHaveCount(0);
});

test('ST-005-15 hàng chờ duyệt: lọc Nhóm tuổi → Lớp và cột Hạn riêng', async ({ page }) => {
  await login(page, U.vp);
  await spaGo(page, '/education/plan-reviews');
  await expect(page.getByRole('heading', { name: 'Duyệt kế hoạch, giáo án' })).toBeVisible({ timeout: 30_000 });
  const hasItems = await page.locator('tbody tr').count();
  test.skip(!hasItems, 'Không có tài liệu chờ duyệt');
  await expect(page.getByRole('combobox', { name: 'Nhóm tuổi' })).toBeVisible();
  await expect(page.getByRole('combobox', { name: 'Lớp', exact: true })).toBeDisabled();
  await expect(page.getByRole('columnheader', { name: 'Hạn' })).toBeVisible();
});
