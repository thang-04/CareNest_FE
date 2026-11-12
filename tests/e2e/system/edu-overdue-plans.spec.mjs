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
  const cls = page.getByRole('combobox', { name: /^Lớp:?$/ });
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
  await expect(page.getByRole('tab', { name: /Học kỳ 1/ })).toBeVisible({ timeout: 30_000 });
  await expect(page.getByRole('button', { name: /Mở hạn|Mở khóa/ })).toHaveCount(0);
  const deadline = page.getByText(/^Hạn: /).first();
  await expect(deadline).toBeVisible();
  // Nhãn hạn nằm ngoài vùng tiêu đề thẻ (nơi đặt nhãn trạng thái duyệt)
  await expect(page.locator('.card__header').getByText(/^Hạn: /)).toHaveCount(0);
});

test('ST-005-15 hàng chờ duyệt: lọc Nhóm tuổi → Lớp và cột Hạn riêng', async ({ page }) => {
  await login(page, U.vp);
  await spaGo(page, '/education/plan-reviews');
  await expect(page.getByRole('heading', { name: 'Duyệt kế hoạch giáo dục' })).toBeVisible({ timeout: 30_000 });
  const hasItems = await page.locator('tbody tr').count();
  test.skip(!hasItems, 'Không có tài liệu chờ duyệt');
  await expect(page.getByRole('combobox', { name: 'Nhóm tuổi' })).toBeVisible();
  await expect(page.getByRole('combobox', { name: /^Lớp:?$/ })).toBeDisabled();
  await expect(page.getByRole('columnheader', { name: 'Hạn' })).toBeVisible();
});

// Tiền 11/11/2026: lọc không ra dữ liệu thì giữ khung trang + hàng lọc, không thay bằng trang lỗi.
// Tiền 12/11/2026: chỉ hàng nút dính, hàng lọc cuộn theo trang.
test('ST-005-16 lớp không có trong phạm vi: trang vẫn có hàng lọc và báo trống ở phần nội dung', async ({ page }) => {
  await login(page, U.ht);
  for (const path of ['/education/branches/999999', '/education/theme-plans/999999', '/education/day-plans/999999']) {
    await spaGo(page, path);
    await expect(page.getByText('Không tìm thấy lớp')).toBeVisible({ timeout: 30_000 });
    const age = page.getByRole('combobox', { name: 'Nhóm tuổi' });
    await expect(age).toBeVisible();
    await expect(page.locator('.ga-sticky-head .filter-bar')).toBeVisible();
  }
  // Chọn lớp ngay trên trang trống thì mở được lớp đó
  await page.getByRole('combobox', { name: /^Lớp:?$/ }).selectOption({ index: 1 });
  await page.waitForURL((u) => /\/education\/day-plans\/\d+$/.test(u.pathname) && !u.pathname.endsWith('/999999'));
});

// Tiền 11/11/2026: trang Dự kiến chủ đề - chủ đề nhánh xem được dạng Danh sách hoặc Bảng (cột tuần của tháng, hàng chủ đề lớn)
test('ST-005-17 chủ đề nhánh: chuyển Danh sách / Bảng, bảng có cột Tuần theo tháng', async ({ page }) => {
  await login(page, U.ht);
  await spaGo(page, '/education/branches/999999');
  await page.getByRole('combobox', { name: /^Lớp:?$/ }).selectOption({ index: 1 });
  await page.waitForURL((u) => /\/education\/branches\/\d+$/.test(u.pathname) && !u.pathname.endsWith('/999999'));
  const grid = page.getByRole('tab', { name: 'Bảng' });
  await expect(grid).toBeVisible({ timeout: 30_000 });
  await expect(page.getByRole('columnheader', { name: 'Chủ đề nhánh' })).toBeVisible();
  await grid.click();
  await expect(page.getByRole('combobox', { name: 'Tháng' })).toHaveCount(0);
  await expect(page.getByRole('columnheader', { name: /^Tuần 1/ })).toBeVisible();
  await expect(page.getByRole('columnheader', { name: 'Chủ đề nhánh' })).toHaveCount(0);
  await page.getByRole('tab', { name: 'Danh sách' }).click();
  await expect(page.getByRole('columnheader', { name: 'Chủ đề nhánh' })).toBeVisible();
});

// Tiền 11/11/2026: trang Cấu hình kế hoạch chỉ Hiệu trưởng (Phó hiệu trưởng không xem, không sửa); có nút Khôi phục mặc định
test('ST-005-19 cấu hình kế hoạch: PHT không vào được; HT khôi phục mặc định trên bản đang sửa', async ({ page, browser }) => {
  await login(page, U.vp);
  await expect(page.getByRole('link', { name: 'Cấu hình kế hoạch' })).toHaveCount(0);
  await spaGo(page, '/education/settings');
  await expect(page.getByText('Cấu hình kế hoạch giáo dục dành cho Hiệu trưởng.')).toBeVisible({ timeout: 30_000 });
  const cfg = (await api(U.vp, 'GET', '/education-plans/config')).data;
  const put = await api(U.vp, 'PUT', '/education-plans/config', {
    body: { domainLabels: cfg.domainLabels || {}, extraDomains: cfg.extraDomains || [], signers: cfg.signers, weekRows: cfg.weekRows },
  });
  expect(put.status).toBe(403);
  const htPage = await (await browser.newContext()).newPage();
  await login(htPage, U.ht);
  await spaGo(htPage, '/education/settings');
  await htPage.getByRole('button', { name: 'Chỉnh sửa' }).click({ timeout: 30_000 });
  await htPage.getByRole('button', { name: 'Khôi phục mặc định' }).click();
  await htPage.getByRole('dialog').getByRole('button', { name: 'Khôi phục' }).click();
  await expect(htPage.getByRole('dialog')).toHaveCount(0);
  await htPage.context().close();
});

// Tiền 11/11/2026: có nút Chỉnh sửa thì có nút Hủy cùng chỗ; nút Xuất file nằm trong vùng ghim đầu trang
test('ST-005-20 nút Hủy ở trang Cấu hình; Xuất file của Kế hoạch giáo dục chủ đề ở từng thẻ chủ đề', async ({ page }) => {
  await login(page, U.ht);
  await spaGo(page, '/education/settings');
  await page.getByRole('button', { name: 'Chỉnh sửa' }).click({ timeout: 30_000 });
  await page.getByRole('button', { name: 'Hủy', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Chỉnh sửa' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Lưu', exact: true })).toHaveCount(0);
  await spaGo(page, '/education/theme-plans/999999');
  await page.getByRole('combobox', { name: /^Lớp:?$/ }).selectOption({ index: 1 });
  await page.waitForURL((u) => /\/education\/theme-plans\/\d+$/.test(u.pathname) && !u.pathname.endsWith('/999999'));
  // Xuất file theo từng thẻ chủ đề (vị trí cũ); không còn nút xuất trong hàng lọc
  await expect(page.locator('.ga-sticky-head .filter-bar').getByRole('button', { name: 'Xuất file' })).toHaveCount(0);
});

// Tiền 11/11/2026: người chỉ xem thấy khung cả hai học kỳ ở trang Kế hoạch giáo dục chủ đề; phần chưa ban hành chỉ nhãn chung
test('ST-005-21 PHT xem Kế hoạch giáo dục chủ đề: đủ tab học kỳ, gói chưa ban hành chỉ "Chưa ban hành", không hạn, không nút', async ({
  page,
}) => {
  const me = await api(U.tl, 'GET', '/accounts/me');
  const vpDocs = (await api(U.vp, 'GET', DOCS)).data;
  const cls = vpDocs.classes.find((c) => String(c.homeroomTeacherId) === String(me.data.userId)) || vpDocs.classes[0];
  const pkgs = vpDocs.semesterPackages.filter((p) => String(p.classId) === String(cls.id));
  test.skip(!pkgs.length, 'Lớp chưa có gói học kỳ');
  for (const p of pkgs.filter((x) => x.unreleased)) {
    expect(p.status).toBeUndefined();
    expect(p.deadlineState).toBeUndefined();
    expect(p.history).toBeUndefined();
  }
  await login(page, U.vp);
  const frame = pkgs.find((p) => p.unreleased);
  await spaGo(page, `/education/theme-plans/${cls.id}${frame ? `?hk=${frame.semesterNo}` : ''}`);
  for (const p of pkgs)
    await expect(page.getByRole('tab', { name: new RegExp(`Học kỳ ${p.semesterNo}`) })).toBeVisible({ timeout: 30_000 });
  if (!frame) return;
  const toolbar = page.getByRole('group', { name: `Trạng thái và thao tác học kỳ ${frame.semesterNo}` });
  await expect(toolbar.getByText('Chưa ban hành')).toBeVisible();
  await expect(toolbar.getByText(/^Hạn: /)).toHaveCount(0);
  await expect(page.getByRole('button', { name: /Gửi duyệt|Duyệt|Trả lại/ })).toHaveCount(0);
  await expect(page.getByText('Chưa lập')).toHaveCount(0);
  await expect(page.getByText('Chưa thể bắt đầu')).toHaveCount(0);
});
