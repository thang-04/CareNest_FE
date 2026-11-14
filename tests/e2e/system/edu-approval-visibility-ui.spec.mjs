import { test, expect } from '@playwright/test';
import { api, beReachable, sql } from '../support/realBe.mjs';
import { login, saveStatus, spaGo } from '../support/ui.mjs';

// System spec 002 trên dữ liệu dev sau reset 10/11/2026 (năm 2026–2027, nhóm 3–4 tuổi): teamlead34 = Tổ trưởng và
// GVCN lớp 1 cơ sở A, teacher6 = GV thứ hai lớp đó, viceprincipal = PHT duyệt kế hoạch tổ.
test.describe.configure({ mode: 'serial' });

const U = { vp: 'viceprincipal@gmail.com', ht: 'principal@gmail.com', tl: 'teamlead34@gmail.com', gv2: 'teacher6@gmail.com' };
const GOALS = '/education-plans/goals';
let homeroomClass;
let teamDraft;

test.beforeAll(async () => {
  test.skip(!(await beReachable()), 'BE thật không chạy ở :8080');
  const me = await api(U.tl, 'GET', '/accounts/me');
  const docs = await api(U.tl, 'GET', '/education-plans/class-docs');
  homeroomClass = docs.data.classes.find((c) => String(c.homeroomTeacherId) === String(me.data.userId));
  const teams = await api(U.tl, 'GET', `${GOALS}?planLevel=TEAM&size=100`);
  teamDraft = teams.data.items.find((p) => p.status === 'DRAFT');
  // Gói học kỳ Chờ duyệt khóa lịch nhánh (đúng nghiệp vụ) ⇒ bộ test khác để lại thì đưa về Nháp trước khi thử Lưu
  if (homeroomClass)
    sql(
      `update edu_class_docs set status='DRAFT', history='[]'::jsonb, approvals='[]'::jsonb where kind='semester' and classroom_id=${homeroomClass.id}`,
    );
});

const page404 = (page) => page.getByText(/Không tìm thấy|Đã có lỗi/);

test('ST-002-01 GVCN lưu được trang Dự kiến chủ đề - chủ đề nhánh (Lưu đổi trạng thái, tải lại còn thay đổi)', async ({ page }) => {
  test.skip(!homeroomClass, 'Tổ trưởng teamlead34 không có lớp chủ nhiệm');
  const failures = [];
  page.on('response', async (r) => {
    if (r.url().includes('/class-docs/') && r.request().method() !== 'GET' && r.status() >= 400)
      failures.push(`${r.status()} ${r.url()} ${await r.text().catch(() => '')}`);
  });
  await login(page, U.tl);
  await spaGo(page, `/education/branches/${homeroomClass.id}`);
  await expect(page.locator('.ga-page')).toBeVisible();
  await expect(page404(page)).toHaveCount(0);
  await page.getByRole('button', { name: 'Chỉnh sửa' }).click();
  // Tuần cuối năm (học kỳ 2): gói HK1 đã qua ngày bắt đầu nên khóa theo thời gian (spec 004), sửa HK1 bị chặn 7388
  const name = page.locator('textarea[aria-label^="Chủ đề nhánh tuần"]').last();
  const value = `Nhánh E2E ${Date.now() % 100000}`;
  await name.fill(value);
  const save = page.getByRole('button', { name: 'Lưu', exact: true });
  await expect(save, `nút Lưu bị khóa: ${await save.getAttribute('title')}`).toBeEnabled();
  const saved = page.waitForResponse((r) => r.url().includes('/class-docs/branch/') && r.request().method() === 'PUT');
  await save.click();
  expect((await saved).status(), failures.join('\n')).toBe(200);
  // Lưu xong vẫn ở chế độ sửa như các màn kế hoạch khác (Tiền 11/11/2026)
  await expect(page.getByText(/Đã lưu lúc/)).toBeVisible({ timeout: 15_000 });
  await expect(page.getByRole('button', { name: 'Hủy', exact: true })).toBeVisible();
  const docs = await api(U.tl, 'GET', '/education-plans/class-docs');
  const branch = docs.data.branchPlans.find((b) => String(b.classId) === String(homeroomClass.id));
  expect(JSON.stringify(branch)).toContain(value);
  await expect(page.getByText(value).first()).toBeVisible();
  // Lưu lần hai liên tiếp, không tải lại trang: bản đang sửa phải mang số phiên bản mới của lần lưu đầu
  const value2 = `${value} lần 2`;
  await page.locator('textarea[aria-label^="Chủ đề nhánh tuần"]').last().fill(value2);
  const saved2 = page.waitForResponse((r) => r.url().includes('/class-docs/branch/') && r.request().method() === 'PUT');
  await page.getByRole('button', { name: 'Lưu', exact: true }).click();
  expect((await saved2).status(), failures.join(' | ')).toBe(200);
  await expect(page.getByText(value2).first()).toBeVisible();
  // Hủy: gõ thêm rồi bấm Hủy ⇒ hỏi lại, về bản đã lưu và thoát chế độ sửa, không gọi lưu
  await page.locator('textarea[aria-label^="Chủ đề nhánh tuần"]').last().fill('[E2E] sẽ bị hủy');
  await page.getByRole('button', { name: 'Hủy', exact: true }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Hủy chỉnh sửa' }).click();
  await expect(page.getByRole('button', { name: 'Chỉnh sửa' })).toBeVisible();
  await expect(page.getByText(value2).first()).toBeVisible();
  await expect(page.getByText('[E2E] sẽ bị hủy')).toHaveCount(0);
  // Kiểu hiển thị (Danh sách / Bảng) là ô chọn trong thẻ lọc (G94-278, 13/11/2026); Xuất file ở thanh thao tác ghim
  await expect(page.locator('.ga-sticky-head').getByRole('combobox', { name: 'Kiểu hiển thị' })).toBeVisible();
  await expect(page.locator('.ga-sticky-head .ga-year-toolbar').getByRole('button', { name: 'Xuất file' })).toHaveCount(1);
});

test('ST-002-02 GV thứ hai không có nút sửa ở Dự kiến chủ đề - chủ đề nhánh của lớp', async ({ page }) => {
  test.skip(!homeroomClass, 'Thiếu lớp');
  await login(page, U.gv2);
  await spaGo(page, `/education/branches/${homeroomClass.id}`);
  await expect(page.locator('.ga-page')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Chỉnh sửa' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Lưu', exact: true })).toHaveCount(0);
  // Lịch chủ đề nhánh không duyệt riêng: GV thứ hai vẫn nhận được để xem (EDU-73)
  const docs = await api(U.gv2, 'GET', '/education-plans/class-docs');
  expect(docs.data.branchPlans.some((b) => String(b.classId) === String(homeroomClass.id))).toBe(true);
});

test('ST-002-03 Tổ trưởng thêm chủ đề nhánh ở bản tổ Nháp và lưu được (nhánh do tổ thêm, không xóa được nhánh kế thừa)', async ({
  page,
}) => {
  test.skip(!teamDraft, 'Không có bản tổ Nháp của teamlead34 (chạy integration trước)');
  await login(page, U.tl);
  await spaGo(page, `/education/goals/${teamDraft.id}/edit`);
  // Ô "Thêm chủ đề nhánh / dự án của …": gõ tên là thêm nhánh mới của tổ
  const add = page.getByRole('textbox', { name: /^Thêm chủ đề nhánh/ }).first();
  await expect(add).toBeVisible({ timeout: 20_000 });
  const name = `Nhánh tổ thêm E2E ${Date.now() % 100000}`;
  await add.fill(name);
  await page.getByRole('button', { name: 'Lưu', exact: true }).first().click();
  await expect(saveStatus(page)).toContainText(/Đã lưu lúc/, { timeout: 15_000 });
  const saved = await api(U.tl, 'GET', `${GOALS}/${teamDraft.id}`);
  expect(saved.data.branchTemplates.some((t) => t.sourceTemplateId == null && t.name === name)).toBe(true);
  // Nhánh kế thừa không có nút xóa; nhánh tổ thêm có
  await expect(page.getByRole('button', { name: `Xóa nhánh gợi ý ${name}` })).toBeVisible();
  const inherited = saved.data.branchTemplates.find((t) => t.sourceTemplateId != null);
  if (inherited) await expect(page.getByRole('button', { name: `Xóa nhánh gợi ý ${inherited.name}` })).toHaveCount(0);
});

test('ST-002-04 HT đang mở trang Duyệt: bản PHT vừa gửi kèm ghi chú tự hiện (không tải lại); thẻ "Chờ bạn duyệt" dẫn sang hàng chờ', async ({
  page,
}) => {
  const list = await api(U.vp, 'GET', `${GOALS}?planLevel=SCHOOL_YEAR&size=100`);
  const annual = list.data.items.find((p) => p.status === 'APPROVED' && p.current && p.ageGroupId === teamDraft?.ageGroupId);
  test.skip(!annual, 'Không có kế hoạch năm đã ban hành');
  await login(page, U.ht);
  await spaGo(page, '/education/plan-reviews');
  // HT tải tài liệu toàn trường ⇒ chờ lâu hơn mặc định
  await expect(page.locator('.ga-page')).toBeVisible({ timeout: 45_000 });

  const note = `[E2E] Nhờ thầy duyệt ${Date.now() % 100000}`;
  const h = (rev) => ({
    'X-Plan-Revision': String(rev ?? 0),
    'Idempotency-Key': crypto.randomUUID(),
    'X-Edit-Session': crypto.randomUUID(),
  });
  const v = await api(U.vp, 'POST', `${GOALS}/${annual.id}/versions`, { body: {}, headers: h(annual.revision) });
  expect(v.status, v.desc).toBe(201);
  const sub = await api(U.vp, 'POST', `${GOALS}/${v.data.id}/submit`, {
    body: { note },
    headers: h(v.data.contentRevision ?? v.data.revision),
  });
  expect(sub.status, sub.desc).toBe(200);
  try {
    // Không tải lại trang: hàng chờ tự hỏi lại BE (≤30 s) và hiện ghi chú người gửi
    await expect(page.getByText(`Ghi chú: ${note}`)).toBeVisible({ timeout: 35_000 });
    await spaGo(page, '/education/school-year-plans');
    await page.getByRole('button', { name: /Chờ bạn duyệt/ }).click();
    await expect(page).toHaveURL(/\/education\/plan-reviews/);
  } finally {
    await api(U.ht, 'POST', `${GOALS}/${v.data.id}/return`, {
      body: { note: '[E2E] trả lại sau kiểm thử' },
      headers: h(sub.data.contentRevision ?? sub.data.revision),
    });
    const back = await api(U.vp, 'GET', `${GOALS}/${v.data.id}`);
    await api(U.vp, 'DELETE', `${GOALS}/${v.data.id}`, { headers: h(back.data.contentRevision ?? back.data.revision) });
  }
});

test('ST-002-05 giáo viên thứ hai mở kế hoạch tổ đã ban hành, bấm "Nguồn" sang đúng kế hoạch năm (chỉ xem)', async ({ page }) => {
  const teams = await api(U.gv2, 'GET', `${GOALS}?planLevel=TEAM&size=100`);
  const team = teams.data.items.find((p) => p.status === 'APPROVED' && p.curriculumSourcePlanId);
  test.skip(!team, 'GV thứ hai chưa thấy kế hoạch tổ đã ban hành nào');
  await login(page, U.gv2);
  await spaGo(page, `/education/goals/${team.id}`);
  const source = page.locator('.ga-plan-section--source a').first();
  await expect(source).toBeVisible({ timeout: 20_000 });
  await source.click();
  await expect(page).toHaveURL(new RegExp(`/education/school-year-plans/${team.curriculumSourcePlanId}$`));
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  await expect(page.getByText(/Bản này chưa ban hành|không có quyền/i)).toHaveCount(0);
  await expect(page.getByRole('link', { name: /Chỉnh sửa/ })).toHaveCount(0);
  await expect(page.getByRole('button', { name: /Gửi duyệt|Ban hành|Trả lại/ })).toHaveCount(0);
});

test('ST-002-06 GVCN xóa được chủ đề nhánh do lớp tự thêm (có hộp xác nhận), lưu xong nhánh biến mất', async ({ page }) => {
  test.skip(!homeroomClass, 'Thiếu lớp');
  const docs = await api(U.tl, 'GET', '/education-plans/class-docs');
  const doc = docs.data.branchPlans.find((b) => String(b.classId) === String(homeroomClass.id));
  test.skip(!doc || doc.schemaVersion !== 2, 'Lớp chưa có lịch chủ đề nhánh dạng mới');
  // Tạo sẵn một nhánh lớp tự thêm ở tuần trống đầu tiên còn lại của chủ đề đầu
  const theme = doc.themeSchedules[0];
  const used = doc.branches
    .filter((b) => b.themeId === theme.themeId)
    .map((b) => b.endDate)
    .sort();
  const start = new Date(`${used.at(-1) || theme.startDate}T00:00:00Z`);
  start.setUTCDate(start.getUTCDate() + (used.length ? 3 : 0));
  const end = new Date(start);
  end.setUTCDate(end.getUTCDate() + 4);
  const iso = (d) => d.toISOString().slice(0, 10);
  test.skip(iso(end) > theme.endDate, 'Chủ đề đầu không còn tuần trống');
  const key = crypto.randomUUID();
  const { version, dossierVersion, review, permissions, names, notes, calendarRevision, durationPolicySnapshot, releases, ...content } =
    doc;
  content.branches = [
    ...doc.branches,
    {
      key,
      themeId: theme.themeId,
      sourceTemplateId: null,
      name: 'Nhánh lớp tự thêm (E2E)',
      startDate: iso(start),
      endDate: iso(end),
      weekNotes: {},
    },
  ];
  const put = await api(U.tl, 'PUT', `/education-plans/class-docs/branch/${doc.id}`, {
    body: content,
    headers: { 'X-Class-Doc-Version': String(doc.version) },
  });
  expect(put.status, put.desc).toBe(200);

  await login(page, U.tl);
  await spaGo(page, `/education/branches/${homeroomClass.id}`);
  await page.getByRole('button', { name: 'Chỉnh sửa' }).click();
  const remove = page.getByRole('button', { name: /^Xóa chủ đề nhánh tuần/ });
  await expect(remove).toHaveCount(1);
  await remove.click();
  const dialog = page.getByRole('dialog');
  await expect(dialog).toContainText('Xóa chủ đề nhánh');
  await dialog.getByRole('button', { name: 'Xóa', exact: true }).click();
  const saved = page.waitForResponse((r) => r.url().includes('/class-docs/branch/') && r.request().method() === 'PUT');
  await page.getByRole('button', { name: 'Lưu', exact: true }).click();
  expect((await saved).status()).toBe(200);
  const after = await api(U.tl, 'GET', '/education-plans/class-docs');
  const branches = after.data.branchPlans.find((b) => b.id === doc.id).branches;
  expect(branches.some((b) => b.key === key)).toBe(false);
  expect(branches.length).toBe(doc.branches.length);
});
