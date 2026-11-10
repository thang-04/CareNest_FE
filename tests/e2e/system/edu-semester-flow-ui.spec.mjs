import { test, expect } from '@playwright/test';
import { api, beReachable, sql } from '../support/realBe.mjs';
import { login, spaGo } from '../support/ui.mjs';

// System spec 003/004 qua giao diện (BE thật, E2E_PG_DB=carenest_merge): gói học kỳ (nhánh + kế hoạch chủ đề + tuần) gửi/duyệt/
// trả lại/mở khóa ở trang Kế hoạch giáo dục chủ đề; trang Chủ đề / Chủ đề nhánh chỉ để sửa; HT lọc nhóm tuổi → lớp (EDU-73/74).
// teamlead34 = GVCN lớp 3–4 tuổi cơ sở A (kiêm Tổ trưởng ⇒ chuỗi nhánh bỏ bước Tổ trưởng, gửi thẳng PHT).
test.describe.configure({ mode: 'serial' });

const U = { vp: 'viceprincipal@gmail.com', ht: 'principal@gmail.com', tl: 'teamlead34@gmail.com' };
const DOCS = '/education-plans/class-docs';
const SEMESTER2_START = '2027-01-18';
const run = Date.now() % 100000;
const dmy = (iso) => iso.split('-').reverse().join('/');
const addDays = (iso, n) => {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};
const isoPlus = (days) => {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};
let cls;
let target; // thứ Hai của tuần duy nhất còn trống tên (tuần học đầu tiên của học kỳ 2)

const packageOf = async (user, no) =>
  (await api(user, 'GET', DOCS)).data.semesterPackages.find((p) => String(p.classId) === String(cls.id) && p.semesterNo === no);
// Spec 004: gói học kỳ phải đủ kế hoạch chủ đề, kế hoạch tuần mới gửi được ⇒ soạn nhanh phần còn thiếu qua API (trừ tên nhánh)
const fillPackage = async (no) => {
  const pkg = await packageOf(U.tl, no);
  for (const m of pkg.missing || []) {
    if (m.kind === 'theme') {
      const res = await api(U.tl, 'PUT', `${DOCS}/theme/tp_${cls.id}_${m.themeId}`, {
        body: { classId: String(cls.id), yearPlanId: String(pkg.yearPlanId), themeId: String(m.themeId), rows: {}, envIn: '[E2E] Góc chơi' },
        headers: { 'X-Class-Doc-Version': '-1' },
      });
      expect(res.status, res.desc).toBe(200);
    }
  }
  for (const m of (await packageOf(U.tl, no)).missing || []) {
    if (m.kind !== 'week') continue;
    const root = await packageOf(U.tl, no);
    const res = await api(U.tl, 'PUT', `${DOCS}/week/wp_${cls.id}_${m.weekStart}`, {
      body: { classId: String(cls.id), yearPlanId: String(root.yearPlanId), themeId: String(m.themeId), weekStart: m.weekStart, aims: { knowledge: '[E2E] Trẻ biết tên trường' } },
      headers: { 'X-Class-Doc-Version': '-1', 'X-Dossier-Version': String(root.version) },
    });
    expect(res.status, res.desc).toBe(200);
  }
};
const branchOf = async (user) => (await api(user, 'GET', DOCS)).data.branchPlans.find((b) => String(b.classId) === String(cls.id));

// Thêm nhánh 1 tuần cho các tuần học chưa có tên của chủ đề được chọn; fresh ⇒ dựng lại các tuần đó (bỏ tên lần chạy trước)
const nameWeeks = async (pick, fresh = false) => {
  const branch = await branchOf(U.tl);
  const plan = (await api(U.tl, 'GET', `/education-plans/goals/${branch.yearPlanId}`)).data;
  const fullBreak = (monday) => (plan.breaks || []).some((b) => b.startDate <= monday && (b.endDate || b.startDate) >= addDays(monday, 4));
  const picked = (b) => branch.themeSchedules.some((s) => String(s.themeId) === String(b.themeId) && pick(s));
  const branches = branch.branches.filter((b) => !fresh || b.sourceTemplateId != null || !picked(b));
  const named = (monday) => branches.some((b) => b.startDate <= monday && b.endDate >= monday);
  for (const s of branch.themeSchedules) {
    if (!pick(s)) continue;
    for (let monday = s.startDate; monday <= s.endDate; monday = addDays(monday, 7)) {
      if (fullBreak(monday) || named(monday)) continue;
      if (fresh && !target) {
        target = monday;
        continue;
      }
      branches.push({
        key: crypto.randomUUID(),
        themeId: s.themeId,
        sourceTemplateId: null,
        name: `[E2E] Nhánh ${dmy(monday).slice(0, 5)}`,
        startDate: monday,
        endDate: addDays(monday, 4),
        weekNotes: {},
      });
    }
  }
  const { version, dossierVersion, review, permissions, names, notes, calendarRevision, durationPolicySnapshot, ...content } = branch;
  const saved = await api(U.tl, 'PUT', `${DOCS}/branch/${branch.id}`, {
    body: { ...content, branches },
    headers: { 'X-Class-Doc-Version': String(version), 'X-Dossier-Version': String(dossierVersion ?? version) },
  });
  expect(saved.status, saved.desc).toBe(200);
};

test.beforeAll(async () => {
  test.skip(!(await beReachable()), 'BE thật không chạy ở :8080');
  const me = await api(U.tl, 'GET', '/accounts/me');
  const docs = await api(U.tl, 'GET', DOCS);
  cls = docs.data.classes.find((c) => String(c.homeroomTeacherId) === String(me.data.userId));
  test.skip(!cls, 'teamlead34 không có lớp chủ nhiệm');
  const branch = docs.data.branchPlans.find((b) => String(b.classId) === String(cls.id));
  test.skip(!branch, 'Lớp chưa có lịch chủ đề nhánh');
  // Chạy lại được: đưa hai gói học kỳ về Nháp, bỏ lần gửi/mở hạn của lần chạy trước (dữ liệu dev do bộ test tạo)
  sql(
    `update edu_class_docs set status='DRAFT', history='[]'::jsonb, approvals='[]'::jsonb ` +
      `where kind='semester' and classroom_id=${cls.id}`,
  );
  // Đặt tên mọi tuần học của chủ đề bắt đầu ở HK2 (nhánh 1 tuần), chừa đúng một tuần trống để giao diện nhập tên trước khi
  // chọn ngày. Chủ đề HK1 giữ nguyên: gói HK1 đã qua ngày bắt đầu nên khóa, chỉ sửa được sau khi PHT mở khóa (ST-003-08).
  await nameWeeks((s) => s.startDate >= SEMESTER2_START, true);
});

test('ST-003-05 nhập tên chủ đề nhánh trước khi chọn ngày: tuần tự thành nhánh 1 tuần, Lưu thành công', async ({ page }) => {
  test.skip(!target, 'Không còn tuần trống ở học kỳ 2');
  await login(page, U.tl);
  await spaGo(page, `/education/branches/${cls.id}`);
  await page.getByRole('button', { name: 'Chỉnh sửa' }).click();
  const cells = page.locator('textarea[aria-label^="Chủ đề nhánh tuần"]');
  const index = await cells.evaluateAll((list) => list.map((el) => !el.value.trim()).lastIndexOf(true));
  expect(index, 'phải còn một ô tên trống và ô đó nhập được').toBeGreaterThanOrEqual(0);
  const name = `[E2E] Nhập tên trước ${run}`;
  await cells.nth(index).fill(name);
  // Tuần vừa đặt tên tự có ngày Thứ Hai–Thứ Sáu của chính tuần đó
  await expect(cells.nth(index).locator('xpath=ancestor::tr')).toContainText(dmy(target));
  const saved = page.waitForResponse((r) => r.url().includes(`${DOCS}/branch/`) && r.request().method() === 'PUT');
  await page.getByRole('button', { name: 'Lưu', exact: true }).click();
  const res = await saved;
  expect(res.status(), await res.text()).toBe(200);
  const doc = await branchOf(U.tl);
  expect(doc.branches.find((b) => b.name === name)).toMatchObject({ startDate: target, endDate: addDays(target, 4) });
});

test('ST-004-01 trang Chủ đề / Chủ đề nhánh: không nút gửi duyệt, không trạng thái học kỳ, không liên kết sang trang khác', async ({ page }) => {
  await login(page, U.tl);
  await spaGo(page, `/education/branches/${cls.id}`);
  await expect(page.getByRole('button', { name: 'Chỉnh sửa' })).toBeVisible({ timeout: 30_000 });
  await expect(page.getByRole('button', { name: /Gửi duyệt/ })).toHaveCount(0);
  await expect(page.getByText(/Gói học kỳ|Học kỳ \d/)).toHaveCount(0);
  // Điều hướng chỉ bằng sidebar (Tiền 11/11)
  await expect(page.locator('.ga-page a[href^="/education/"]')).toHaveCount(0);
});

test('ST-004-02 gói thiếu phần thì chưa gửi được và liệt kê mục thiếu; soạn đủ rồi gửi duyệt học kỳ 2', async ({ page }) => {
  await login(page, U.tl);
  const before = await packageOf(U.tl, 2);
  if ((before.missing || []).some((m) => m.kind !== 'branch')) {
    await spaGo(page, `/education/theme-plans/${cls.id}?hk=2`);
    await expect(page.getByRole('tab', { name: /Học kỳ 2/ })).toHaveAttribute('aria-selected', 'true');
    await expect(page.getByText(/Còn thiếu \d+ mục trước khi gửi/)).toBeVisible();
    // Nút giữ nguyên, bấm thì hộp nói lý do (mẫu chung ReviewActions), không có nút gửi
    await page.getByRole('button', { name: 'Gửi duyệt học kỳ 2' }).click();
    const why = page.getByRole('dialog');
    await expect(why.getByText('Soạn đủ các mục còn thiếu trước khi gửi')).toBeVisible();
    await expect(why.getByRole('button', { name: 'Gửi duyệt' })).toHaveCount(0);
    await why.getByRole('button', { name: 'Đã hiểu' }).click();
  }
  await fillPackage(2);
  expect((await packageOf(U.tl, 2)).missing || []).toEqual([]);
  // Phần thiếu soạn qua API ⇒ tải lại trang để nạp dữ liệu mới
  await page.goto(`/education/theme-plans/${cls.id}?hk=2`);
  await expect(page.getByText(/Còn thiếu \d+ mục/)).toHaveCount(0, { timeout: 30_000 });
  await page.getByRole('button', { name: 'Gửi duyệt học kỳ 2' }).click();
  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible();
  const sent = page.waitForResponse((r) => r.url().includes(`${DOCS}/semester/`) && r.url().endsWith('/actions'));
  await dialog.getByRole('button', { name: 'Gửi duyệt' }).click();
  const res = await sent;
  expect(res.status(), await res.text()).toBe(200);
  expect((await packageOf(U.tl, 2)).status).toBe('REVIEW');
  await expect(page.getByRole('button', { name: 'Gửi duyệt học kỳ 2' })).toHaveCount(0);
});

test('ST-004-03 PHT mở gói từ hàng chờ duyệt, duyệt trên trang Kế hoạch giáo dục chủ đề ⇒ Đã ban hành', async ({ page }) => {
  test.skip((await packageOf(U.vp, 2))?.status !== 'REVIEW', 'gói học kỳ 2 chưa ở Chờ duyệt');
  await login(page, U.vp);
  await spaGo(page, `/education/theme-plans/${cls.id}?hk=2`);
  await page.getByRole('button', { name: 'Duyệt', exact: true }).click();
  const dialog = page.getByRole('dialog');
  const acted = page.waitForResponse((r) => r.url().includes(`${DOCS}/semester/`) && r.url().endsWith('/actions'));
  await dialog.getByRole('button', { name: 'Duyệt', exact: true }).click();
  const res = await acted;
  expect(res.status(), await res.text()).toBe(200);
  expect((await packageOf(U.vp, 2)).status).toBe('APPROVED');
});

test('ST-004-04 Kế hoạch giáo dục ngày: kế hoạch tuần đã duyệt hiện chỉ xem phía trên, có nút gửi hồ sơ chủ đề', async ({ page }) => {
  const pkg = await packageOf(U.tl, 2);
  test.skip(pkg?.status !== 'APPROVED', 'gói học kỳ 2 chưa ban hành');
  const week = (await api(U.tl, 'GET', DOCS)).data.weekPlans.find(
    (w) => String(w.classId) === String(cls.id) && (pkg.themeIds || []).map(String).includes(String(w.themeId)),
  );
  await login(page, U.tl);
  await spaGo(page, `/education/day-plans/${cls.id}?week=${week.weekStart}`);
  await expect(page.getByRole('heading', { name: new RegExp(`Kế hoạch giáo dục ngày`) })).toBeVisible();
  const weekCard = page.locator('section', { has: page.getByRole('heading', { name: /^Kế hoạch tuần \d+$/ }) }).first();
  await expect(weekCard).toBeVisible();
  await expect(weekCard.getByText('Kế hoạch tuần chưa được duyệt')).toHaveCount(0);
  await expect(weekCard.locator('textarea:not([disabled]), input:not([disabled])')).toHaveCount(0);
  await expect(page.getByRole('combobox', { name: 'Chọn tuần' })).toHaveValue(week.weekStart);
});

test('ST-004-05 menu tách Kế hoạch giáo dục chủ đề và Kế hoạch giáo dục ngày; đường dẫn cũ chuyển hướng', async ({ page }) => {
  await login(page, U.tl);
  await spaGo(page, '/');
  await expect(page.getByRole('link', { name: 'Kế hoạch giáo dục chủ đề' }).first()).toBeVisible();
  await expect(page.getByRole('link', { name: 'Kế hoạch giáo dục ngày' }).first()).toBeVisible();
  await spaGo(page, `/education/class/${cls.id}/semesters/2`);
  await page.waitForURL((u) => u.pathname === `/education/theme-plans/${cls.id}` && u.search === '?hk=2');
});

test('ST-002-07 HT lọc nhóm tuổi rồi lớp; chỉ thấy lịch nhánh học kỳ đã duyệt, không có nút sửa', async ({ page }) => {
  await login(page, U.ht);
  await spaGo(page, '/education/branches');
  const age = page.getByRole('combobox', { name: 'Chọn nhóm tuổi' });
  // HT tải dữ liệu mọi lớp toàn trường ⇒ chờ lâu hơn mặc định
  await expect(age).toBeVisible({ timeout: 30_000 });
  await age.selectOption({ label: 'Mẫu giáo bé (3–4 tuổi)' });
  const classSelect = page.getByRole('combobox', { name: 'Chọn lớp' });
  // Danh sách lớp chỉ còn lớp của nhóm tuổi đã chọn
  for (const label of await classSelect.locator('option').allInnerTexts()) expect(label).toMatch(/3–4 tuổi|Mẫu giáo bé|Lớp/);
  await classSelect.selectOption(String(cls.id));
  await page.waitForURL((u) => u.pathname === `/education/branches/${cls.id}`);
  await expect(page.getByRole('button', { name: 'Chỉnh sửa' })).toHaveCount(0);
  await expect(page.getByText(`[E2E] Nhập tên trước ${run}`)).toBeVisible();
  // Học kỳ 1 chưa duyệt ⇒ HT không thấy tên nhánh HK1 (EDU-73: người chỉ xem chỉ thấy bản đã ban hành)
  await expect(page.getByText('Chưa có lịch chủ đề nhánh đã duyệt của học kỳ 1.')).toBeVisible();
  await expect(page.getByText('[E2E] Nhánh 05/10')).toHaveCount(0);
});

test('ST-003-08 PHT mở khóa gói học kỳ 1 quá hạn bằng giao diện; GVCN gửi được; PHT trả lại phải ghi lý do', async ({ page, browser }) => {
  const pkg = await packageOf(U.vp, 1);
  test.skip(!pkg?.canExtend, `gói học kỳ 1 không ở trạng thái quá hạn (${pkg?.deadlineState})`);
  await login(page, U.vp);
  await spaGo(page, `/education/theme-plans/${cls.id}?hk=1`);
  await page.getByRole('button', { name: 'Mở khóa' }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByLabel('Hạn mới').fill(isoPlus(5));
  await dialog.getByLabel('Lý do').fill(`[E2E] Mở hạn ${run}`);
  const extended = page.waitForResponse((r) => r.url().endsWith('/actions'));
  await dialog.getByRole('button', { name: 'Mở khóa' }).click();
  expect((await extended).status()).toBe(200);
  expect((await packageOf(U.vp, 1)).extendedTo).toBe(isoPlus(5));

  await nameWeeks((s) => s.startDate < SEMESTER2_START);
  await fillPackage(1);
  const tl = await (await browser.newContext()).newPage();
  await login(tl, U.tl);
  await spaGo(tl, `/education/theme-plans/${cls.id}?hk=1`);
  await tl.getByRole('button', { name: 'Gửi duyệt học kỳ 1' }).click();
  const sent = tl.waitForResponse((r) => r.url().endsWith('/actions'));
  await tl.getByRole('dialog').getByRole('button', { name: 'Gửi duyệt' }).click();
  const res = await sent;
  expect(res.status(), await res.text()).toBe(200);

  expect((await packageOf(U.vp, 1)).status).toBe('REVIEW');
  // PHT mở lại trang (dữ liệu trang cũ tải trước lúc GVCN gửi)
  const vp = await (await browser.newContext()).newPage();
  await login(vp, U.vp);
  await spaGo(vp, `/education/theme-plans/${cls.id}?hk=1`);
  await vp.getByRole('button', { name: 'Trả lại' }).click();
  const back = vp.getByRole('dialog');
  await back.getByRole('button', { name: 'Trả lại' }).click();
  await expect(back).toBeVisible(); // thiếu lý do thì chưa trả lại
  await back.locator('textarea').fill(`[E2E] Thiếu ghi chú tuần ${run}`);
  const returned = vp.waitForResponse((r) => r.url().endsWith('/actions'));
  await back.getByRole('button', { name: 'Trả lại' }).click();
  expect((await returned).status()).toBe(200);
  expect((await packageOf(U.tl, 1)).status).toBe('DRAFT');
});
