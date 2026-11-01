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
  removeTeamLeader,
  sql,
  suspendOtherTeamLeads,
  yearPlanBody,
} from '../support/realBe.mjs';
import { expectNoAutosaveWording, login, pickYear, review, saveStatus, spaGo, storageKeys } from '../support/ui.mjs';

// System: luồng người dùng thật trên trình duyệt (FE VITE_USE_MOCK=false ↔ BE thật ↔ Keycloak thật), nhiều vai trò.
// Tiền điều kiện duy nhất dựng bằng API: bản nháp kế hoạch năm có đủ nội dung (form soạn đủ mục tiêu/chủ đề quá dài cho test).
test.describe.configure({ mode: 'serial' });
// Mỗi bước có 1–3 lần đăng nhập Keycloak và nạp dữ liệu thật
test.setTimeout(180_000);

const GOALS = '/education-plans/goals';
let planId;
let themeId;
let ref;
const goal = async () => (await api(USERS.vp, 'GET', `${GOALS}/${planId}`)).data;
const classDocs = async () => (await api(USERS.vp, 'GET', `/education-plans/class-docs?schoolYearId=${ref.year}`)).data;
const findDoc = (node, key) => {
  if (!node || typeof node !== 'object') return null;
  if (node.id === key || node.docKey === key) return node;
  for (const v of Object.values(node)) {
    const hit = findDoc(v, key);
    if (hit) return hit;
  }
  return null;
};
const docStatus = async (key) => findDoc(await classDocs(), key)?.status;
// Rời trang bình thường để trang nhả phiên sửa (finish-editing); đóng context thẳng thì phiên giữ tới hết hạn 90 giây
const leave = async (page) => {
  await page.goto('/');
  await expect.poll(async () => (await goal()).status, { timeout: 20_000 }).not.toBe('EDITING');
};

test.beforeAll(async () => {
  test.skip(!(await beReachable()), 'BE thật không chạy ở :8080');
  cleanup();
  ref = ids();
  addTeamLeader('teacher1');
  suspendOtherTeamLeads('teacher1');
  const s = newSession();
  const created = await api(USERS.teacher1, 'POST', GOALS, {
    body: await yearPlanBody(`${E2E.titlePrefix} Kế hoạch năm học 2027 – 2028 (system)`),
    headers: editHeaders(s, 0),
  });
  expect(created.status, created.desc).toBe(201);
  planId = created.data.id;
  themeId = created.data.themes[0].id;
  await api(USERS.teacher1, 'POST', `${GOALS}/${planId}/finish-editing`, { headers: editHeaders(s, created.data.revision) });
});

test.afterAll(() => {
  if (process.env.E2E_KEEP_DATA !== '1') cleanup();
});

test('ST-01 kế hoạch năm: sửa không tự ghi lên hệ thống, chỉ Ctrl+S mới lưu; không có chữ về tự lưu', async ({ page }) => {
  await login(page, USERS.teacher1);
  await page.goto(`/education/goals/${planId}/edit`);
  const desc = page.locator('#desc');
  await expect(desc).toBeEditable();
  await desc.fill('Mô tả sửa bằng tay (ST-01)');
  await expect(saveStatus(page)).toHaveText('Có thay đổi chưa lưu');
  await expectNoAutosaveWording(page);
  const exportButtons = page.getByRole('button', { name: 'Xuất', exact: true });
  await expect(exportButtons).toHaveCount(1);
  await expect(page.getByRole('button', { name: 'Xuất file' })).toHaveCount(0);
  // Ô tích chủ đề (cột hẹp): viết tắt "TMN" nằm trên 1 dòng, không ngắt từng chữ; tự tích thì bỏ lại cho như cũ
  const tick = page.locator('button.ga-theme-tick').first();
  const wasOn = (await tick.getAttribute('aria-pressed')) === 'true';
  if (!wasOn) await tick.click();
  await expect(tick).toHaveAttribute('aria-pressed', 'true');
  const lines = await tick.evaluate((el) => {
    const cs = getComputedStyle(el);
    const inner = el.scrollHeight - parseFloat(cs.paddingTop) - parseFloat(cs.paddingBottom);
    return Math.round(inner / parseFloat(cs.lineHeight));
  });
  expect(lines).toBe(1);
  if (!wasOn) {
    await tick.click();
    await expect(tick).toHaveAttribute('aria-pressed', 'false');
  }
  // Ô cao (nội dung dài cùng hàng): bấm sát đáy ô, dưới nút, vẫn tích/bỏ tích (Tiền 31/10)
  const tickCell = page.locator('td.ga-theme-tick-cell').first();
  await tickCell.evaluate((td) => (td.parentElement.style.height = '160px'));
  const box = await tickCell.boundingBox();
  const before = await tick.getAttribute('aria-pressed');
  const after = before === 'true' ? 'false' : 'true';
  await tickCell.click({ position: { x: box.width / 2, y: box.height - 6 } });
  await expect(tick).toHaveAttribute('aria-pressed', after);
  await expect(tick).toBeFocused();
  await tickCell.click({ position: { x: box.width / 2, y: box.height - 6 } });
  await expect(tick).toHaveAttribute('aria-pressed', before);
  await expect(page.getByRole('button', { name: 'Nhập file' })).toBeVisible();
  await expect(exportButtons).toHaveCount(1);
  // Các thao tác ở đầu trang, không còn thanh nút đáy.
  for (const width of [1280, 375]) {
    await page.setViewportSize({ width, height: 800 });
    await page.evaluate(() => window.scrollTo(0, 0));
    await expect(page.locator('.page-actions')).toHaveCount(0);
    await expect(exportButtons).toBeInViewport();
    if (process.env.E2E_SHOT_DIR) await page.screenshot({ path: `${process.env.E2E_SHOT_DIR}/year-plan-${width}.png` });
  }
  await page.setViewportSize({ width: 1280, height: 720 });
  // Nút Xuất mở bản xem trước (Tiền 31/10): đúng tài liệu sẽ xuất, có tên Tổ trưởng dưới chỗ ký
  const leaderName = sql(`select full_name from user_accounts where username = 'teacher1'`).trim();
  await exportButtons.click();
  const preview = page.getByRole('dialog', { name: 'Xem trước' });
  const doc = preview.frameLocator('iframe.ga-doc-preview').locator('body');
  await expect(doc).toContainText('KẾ HOẠCH GIÁO DỤC');
  await expect(doc).toContainText('Tổ trưởng');
  await expect(doc).toContainText(leaderName);
  if (process.env.E2E_SHOT_DIR) await page.screenshot({ path: `${process.env.E2E_SHOT_DIR}/preview-year-plan.png` });
  const [download] = await Promise.all([page.waitForEvent('download'), preview.getByRole('button', { name: 'Xuất Word' }).click()]);
  expect(download.suggestedFilename()).toMatch(/\.doc$/);
  if (process.env.E2E_SHOT_DIR) await download.saveAs(`${process.env.E2E_SHOT_DIR}/${download.suggestedFilename()}`);
  await preview.getByRole('button', { name: 'Đóng', exact: true }).last().click();
  await expect(preview).toBeHidden();
  await page.waitForTimeout(4000);
  expect((await goal()).description).not.toBe('Mô tả sửa bằng tay (ST-01)');
  await page.keyboard.press('Control+s');
  await expect(saveStatus(page)).toHaveText(/Đã lưu lúc \d\d:\d\d/);
  expect((await goal()).description).toBe('Mô tả sửa bằng tay (ST-01)');
  await leave(page);
});

test('ST-01b điện thoại: nút "Lấy mục tiêu" mở danh sách 3 cách lấy, chọn được (không sập trang)', async ({ browser }) => {
  const ctx = await browser.newContext({ viewport: { width: 375, height: 812 } });
  const page = await ctx.newPage();
  await login(page, USERS.teacher1);
  await page.goto(`/education/goals/${planId}/edit`);
  await expect(page.locator('#desc')).toBeEditable();
  await page.getByRole('button', { name: 'Lấy mục tiêu' }).click();
  await expect(page.getByRole('menuitem')).toHaveText(['Nhập file', 'Lấy từ kế hoạch có sẵn', 'Lấy từ Chương trình của Bộ']);
  await page.getByRole('menuitem', { name: 'Lấy từ kế hoạch có sẵn' }).click();
  await expect(page.getByRole('dialog', { name: 'Lấy mục tiêu từ kế hoạch có sẵn' })).toBeVisible();
  await expect(page.getByText('Hệ thống gặp sự cố')).toHaveCount(0);
  await page.getByRole('dialog').getByRole('button', { name: 'Hủy', exact: true }).click();
  // Nhập file (BE:EDU-46) mở hộp xem trước, không mở thẳng ô chọn file
  await page.getByRole('button', { name: 'Lấy mục tiêu' }).click();
  await page.getByRole('menuitem', { name: 'Nhập file' }).click();
  await expect(page.getByRole('dialog', { name: 'Nhập file mục tiêu' })).toBeVisible();
  await page.getByRole('dialog').getByRole('button', { name: 'Hủy', exact: true }).click();
  await leave(page);
  await ctx.close();
});

test('ST-01c một trang đủ ba phần, không còn bước/tab/thanh Đóng; liên kết bước cũ vẫn mở đầy đủ', async ({ page }) => {
  await login(page, USERS.teacher1);
  await page.goto(`/education/goals/${planId}/edit?buoc=3`);
  await expect(page.locator('#desc')).toBeEditable();
  const cards = page.locator('fieldset > .card');
  await expect(cards).toHaveCount(3);
  await expect(cards.nth(0)).toContainText('Thông tin chung');
  await expect(cards.nth(1)).toContainText('Chủ đề, sự kiện trong năm');
  await expect(cards.nth(2)).toContainText('Mục tiêu, nội dung giáo dục');
  await expect(page.getByRole('tablist')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Tiếp theo', exact: true })).toHaveCount(0);
  await expect(page.locator('.page-actions')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Nhập file' })).toBeVisible();
  await leave(page);
});

test('ST-01d Back rời màn soạn một trang, vẫn hỏi khi chưa lưu và giữ nội dung khi Hủy', async ({ page }) => {
  await login(page, USERS.teacher1);
  await pickYear(page, E2E.schoolYear);
  await spaGo(page, '/education/goals');
  await page.locator('tr.row-click').filter({ hasText: E2E.titlePrefix }).first().click();
  await page.waitForURL(`**/education/goals/${planId}`);
  await page.getByRole('link', { name: /Chỉnh sửa|Sửa trước khi duyệt/ }).click();
  await expect(page.locator('#desc')).toBeEditable();
  await page.locator('#desc').fill('Sửa dở (ST-01d)');
  await page.goBack();
  const dialog = page.getByRole('dialog', { name: 'Có thay đổi chưa lưu' });
  await expect(dialog).toBeVisible();
  await dialog.getByRole('button', { name: 'Hủy', exact: true }).click();
  await expect(page.locator('#desc')).toHaveValue('Sửa dở (ST-01d)');
  await page.goBack();
  await dialog.getByRole('button', { name: 'Không lưu', exact: true }).click();
  await page.waitForURL((u) => u.pathname === `/education/goals/${planId}`);
  await leave(page);
});

test('ST-02 rời màn khi chưa lưu: hỏi Hủy · Không lưu · Lưu; Không lưu xóa bản giữ ẩn', async ({ page }) => {
  await login(page, USERS.teacher1);
  await page.goto(`/education/goals/${planId}/edit`);
  await expect(page.locator('#desc')).toBeEditable();
  await page.locator('#desc').fill('Sửa rồi bỏ (ST-02)');
  await page.waitForTimeout(1200);
  expect((await storageKeys(page, 'year-plan-recovery')).length).toBeGreaterThan(0);
  await page.locator('nav, aside').getByRole('link', { name: 'Kế hoạch năm học' }).first().click();
  const dialog = page.getByRole('dialog', { name: 'Có thay đổi chưa lưu' });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole('button')).toHaveText(['Hủy', 'Không lưu', 'Lưu']);
  await dialog.getByRole('button', { name: 'Hủy' }).click();
  await expect(page).toHaveURL(new RegExp(`/goals/${planId}/edit`));
  await page.locator('nav, aside').getByRole('link', { name: 'Kế hoạch năm học' }).first().click();
  await page.getByRole('dialog').getByRole('button', { name: 'Không lưu' }).click();
  await expect(page).toHaveURL(/\/education\/goals$/);
  expect(await storageKeys(page, 'year-plan-recovery')).toEqual([]);
  expect((await goal()).description).toBe('Mô tả sửa bằng tay (ST-01)');
  await leave(page);
});

test('ST-02b viết tắt chủ đề trùng: chỉ báo đỏ tại ô, Enter đứng yên, Ctrl+S không lưu; Enter xuống dòng dưới, dòng cuối thêm chủ đề (BE:EDU-42)', async ({
  page,
}) => {
  await login(page, USERS.teacher1);
  await page.goto(`/education/goals/${planId}/edit`);
  await expect(page.locator('#desc')).toBeEditable();
  const before = (await goal()).themes.length;
  const firstAbbr = (await goal()).themes[0].abbr;
  await page.getByLabel('Thêm chủ đề').pressSequentially('Chủ đề thử');
  const n = before + 1;
  const abbr = page.getByLabel(`Viết tắt chủ đề ${n}`);
  const name = page.getByLabel(`Tên chủ đề ${n}`);
  await abbr.fill(` ${firstAbbr.toLowerCase()} `);
  await expect(abbr).toHaveAttribute('aria-invalid', 'true');
  const inlineError = page.getByRole('alert').filter({ hasText: 'Tên viết tắt đã có' }).first();
  await expect(inlineError).toBeVisible();
  // Không còn khung thông báo vàng
  await expect(page.getByText('Tên viết tắt của các chủ đề bị trùng.')).toHaveCount(0);
  // Enter ở ô viết tắt / ô tên của dòng đang trùng: đứng yên tại ô, không thêm dòng
  await abbr.press('Enter');
  await expect(abbr).toBeFocused();
  await name.click();
  await expect(name).toBeFocused(); // không bị kéo về ô lỗi
  await name.press('Enter');
  await expect(name).toBeFocused();
  await expect(page.getByLabel(`Tên chủ đề ${n + 1}`)).toHaveCount(0);
  // Bấm vào chỗ trống trong ô (dòng báo lỗi của chính ô này) cũng vào ô nhập
  await page.locator(`#${await abbr.getAttribute('aria-describedby')}`).click();
  await expect(abbr).toBeFocused();
  await page.keyboard.press('Control+s');
  await page.waitForTimeout(1500);
  await expect(saveStatus(page)).not.toHaveText(/Đã lưu lúc/);
  await expect(page.getByText('Tên viết tắt của các chủ đề bị trùng.')).toHaveCount(0);
  expect((await goal()).themes.length).toBe(before);
  // Sửa khác đi thì hết lỗi; Enter ở dòng trên xuống ô cùng cột dòng dưới; dòng cuối thì đứng yên
  await abbr.fill('CĐT');
  await expect(abbr).not.toHaveAttribute('aria-invalid', 'true');
  await expect(page.getByText('Tên viết tắt đã có')).toHaveCount(0);
  await page.getByLabel(`Viết tắt chủ đề ${n - 1}`).press('Enter');
  await expect(abbr).toBeFocused();
  await page.getByLabel(`Ghi chú chủ đề ${n - 1}`).press('Enter');
  await expect(page.getByLabel(`Ghi chú chủ đề ${n}`)).toBeFocused();
  // Dòng cuối: Enter ở ô nào cũng thêm chủ đề mới và đặt con trỏ vào ô cùng cột của dòng mới
  await abbr.press('Enter');
  await expect(page.getByLabel(`Viết tắt chủ đề ${n + 1}`)).toBeFocused();
  await expect(page.getByLabel('Thêm chủ đề')).toHaveAttribute('placeholder', 'Nhập tên chủ đề mới');
  await page.locator('nav, aside').getByRole('link', { name: 'Kế hoạch năm học' }).first().click();
  await page.getByRole('dialog').getByRole('button', { name: 'Không lưu' }).click();
  await expect(page).toHaveURL(/\/education\/goals$/);
  await leave(page);
});

test('ST-02c Phó HT đang xem bản do Tổ trưởng giữ quyền sửa: Tổ trưởng rời trang thì màn Phó HT tự mở lại quyền sửa, không cần tải lại (EDU-10)', async ({
  browser,
}) => {
  const a = await (await browser.newContext()).newPage();
  await login(a, USERS.teacher1);
  await a.goto(`/education/goals/${planId}/edit`);
  await expect(a.locator('#desc')).toBeEditable();
  await expect.poll(async () => (await goal()).status).toBe('EDITING');

  const b = await (await browser.newContext()).newPage();
  await login(b, USERS.vp);
  await b.goto(`/education/goals/${planId}`);
  await expect(b.getByText(/^Đang được .+ sửa từ/)).toBeVisible();
  await expect(b.getByRole('link', { name: 'Chỉnh sửa' })).toHaveCount(0);
  const navigations = [];
  b.on('framenavigated', (frame) => frame === b.mainFrame() && navigations.push(frame.url()));

  // A rời trang soạn (không đổi gì) ⇒ nhả quyền; B tự thấy trong vài giây, không tải lại trang
  await a.locator('nav, aside').getByRole('link', { name: 'Kế hoạch năm học' }).first().click();
  await expect(a).toHaveURL(/\/education\/goals$/);
  await expect(b.getByRole('link', { name: 'Chỉnh sửa' })).toBeVisible({ timeout: 15_000 });
  await expect(b.getByText(/^Đang được .+ sửa từ/)).toHaveCount(0);
  expect(navigations).toEqual([]);
  await a.context().close();
  await b.context().close();
});

test('ST-03 đóng tab khi chưa lưu: trình duyệt hỏi; mở lại mời khôi phục, Khôi phục + Lưu thì xóa bản giữ', async ({ context }) => {
  const page = await context.newPage();
  await login(page, USERS.teacher1);
  await page.goto(`/education/goals/${planId}/edit`);
  await expect(page.locator('#desc')).toBeEditable();
  await page.locator('#desc').fill('Nội dung trước khi mất điện (ST-03)');
  await page.waitForTimeout(1200);
  let dialogType = null;
  page.on('dialog', async (d) => {
    dialogType = d.type();
    await d.accept();
  });
  await page.close({ runBeforeUnload: true });
  await expect.poll(() => dialogType).toBe('beforeunload');
  const again = await context.newPage();
  await again.goto(`/education/goals/${planId}/edit`);
  await expect(again.getByText('Có nội dung chưa lưu từ lần soạn trước.')).toBeVisible();
  await expectNoAutosaveWording(again);
  await again.getByRole('button', { name: 'Khôi phục' }).click();
  await expect(again.locator('#desc')).toHaveValue('Nội dung trước khi mất điện (ST-03)');
  await expect(saveStatus(again)).toHaveText('Có thay đổi chưa lưu');
  await again.keyboard.press('Control+s');
  await expect(saveStatus(again)).toHaveText(/Đã lưu lúc/);
  expect(await storageKeys(again, 'year-plan-recovery')).toEqual([]);
  expect((await goal()).description).toBe('Nội dung trước khi mất điện (ST-03)');
  await leave(again);
});

test('ST-03b mất điện rồi mở lại cùng tài khoản: nhận quyền ngay, Khôi phục bấm được; tab cũ còn sống thì mất quyền và giữ bản giữ', async ({
  context,
}) => {
  const old = await context.newPage();
  await login(old, USERS.teacher1);
  await old.goto(`/education/goals/${planId}/edit`);
  await expect(old.locator('#desc')).toBeEditable();
  await old.locator('#desc').fill('Nội dung trước khi mất điện (ST-03b)');
  await old.waitForTimeout(1200);
  // Tab cũ không nhả quyền (giống mất điện); mở lại ngay, không chờ 90 giây
  const again = await context.newPage();
  await again.goto(`/education/goals/${planId}/edit`);
  await expect(again.getByText('Có nội dung chưa lưu từ lần soạn trước.')).toBeVisible({ timeout: 15_000 });
  await expect(again.getByRole('button', { name: 'Khôi phục' })).toBeEnabled({ timeout: 10_000 });
  // Tín hiệu kế tiếp của tab cũ (≤20 giây) bị từ chối ⇒ hiện mất quyền, không ghi đè
  await expect(old.locator('main')).toContainText('Đã mất quyền sửa', { timeout: 30_000 });
  await expect(old.locator('#desc')).not.toBeEditable();
  expect((await storageKeys(old, 'year-plan-recovery')).length).toBeGreaterThan(0);
  await again.getByRole('button', { name: 'Khôi phục' }).click();
  await expect(again.locator('#desc')).toHaveValue('Nội dung trước khi mất điện (ST-03b)');
  await again.keyboard.press('Control+s');
  await expect(saveStatus(again)).toHaveText(/Đã lưu lúc/);
  expect((await goal()).description).toBe('Nội dung trước khi mất điện (ST-03b)');
  await old.close();
  await leave(again);
});

test('ST-04 Tổ trưởng gửi Phó HT duyệt kế hoạch năm', async ({ page }) => {
  await login(page, USERS.teacher1);
  await page.goto(`/education/goals/${planId}/edit`);
  await expect(page.locator('#desc')).toBeEditable();
  await review(page, 'Gửi Phó HT duyệt', 'Gửi');
  await expect.poll(async () => (await goal()).status).toBe('PENDING_VP');
  await leave(page);
});

test('ST-05 Phó HT trả lại phải ghi lý do; Tổ trưởng thấy lý do', async ({ page, browser }) => {
  await login(page, USERS.vp);
  await page.goto(`/education/goals/${planId}`);
  await page.getByRole('button', { name: 'Trả lại' }).first().click();
  const dialog = page.getByRole('dialog');
  await dialog.getByRole('button', { name: 'Trả lại', exact: true }).click();
  await expect(dialog).toContainText('Vui lòng ghi lý do trả lại');
  await dialog.locator('#review-note').fill('Bổ sung lễ hội cho chủ đề (ST-05)');
  await dialog.getByRole('button', { name: 'Trả lại', exact: true }).click();
  await expect.poll(async () => (await goal()).status).toBe('REJECTED');
  const tl = await (await browser.newContext()).newPage();
  await login(tl, USERS.teacher1);
  await tl.goto(`/education/goals/${planId}`);
  await expect(tl.locator('main')).toContainText('Bổ sung lễ hội cho chủ đề (ST-05)');
});

// Mã kế hoạch (mục cuối breadcrumb) không được chồng lên nút hành động đầu trang
async function headerOverlaps(page) {
  const code = await page.locator('.breadcrumb > :last-child').boundingBox();
  const boxes = await page
    .locator('.page__head .page__actions > *')
    .evaluateAll((els) => els.map((e) => e.getBoundingClientRect().toJSON()));
  return boxes.some((b) => b.x < code.x + code.width && code.x < b.x + b.width && b.y < code.y + code.height && code.y < b.y + b.height);
}

test('ST-05b chi tiết bản Bị trả lại: mã kế hoạch không chồng lên nút ở đầu trang (desktop và 375px)', async ({ browser }) => {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const tl = await ctx.newPage();
  await login(tl, USERS.teacher1);
  await tl.goto(`/education/goals/${planId}`);
  await expect(tl.getByRole('button', { name: 'Gửi Phó HT duyệt' })).toBeVisible();
  // Đầu trang giờ chỉ còn 1 nút Xuất nên không tái hiện được lỗi chồng cũ (cần 3 nút); chỉ kiểm không chồng
  expect(await headerOverlaps(tl)).toBe(false);
  if (process.env.E2E_SHOTS) await tl.screenshot({ path: 'docs/test-reports/assets/b1-after-1280.png' });
  await ctx.close();
  // Mở mới ở 375px (thu cửa sổ từ desktop thì menu bên mở đè lên trang)
  const mctx = await browser.newContext({ viewport: { width: 375, height: 800 } });
  const m = await mctx.newPage();
  await login(m, USERS.teacher1);
  await m.goto(`/education/goals/${planId}`);
  await expect(m.getByRole('button', { name: 'Gửi Phó HT duyệt' })).toBeVisible();
  expect(await headerOverlaps(m)).toBe(false);
  if (process.env.E2E_SHOTS) await m.screenshot({ path: 'docs/test-reports/assets/b1-after-375.png' });
  await mctx.close();
});

test('ST-06 Tổ trưởng gửi lại; Phó HT ban hành; giáo viên chỉ xem', async ({ browser }) => {
  const tl = await (await browser.newContext()).newPage();
  await login(tl, USERS.teacher1);
  await tl.goto(`/education/goals/${planId}/edit`);
  await expect(tl.locator('#desc')).toBeEditable();
  await review(tl, 'Gửi Phó HT duyệt', 'Gửi');
  await expect.poll(async () => (await goal()).status).toBe('PENDING_VP');
  const vp = await (await browser.newContext()).newPage();
  await login(vp, USERS.vp);
  await vp.goto(`/education/goals/${planId}`);
  await review(vp, 'Ban hành', 'Ban hành');
  await expect.poll(async () => (await goal()).status).toBe('APPROVED');
  const t2 = await (await browser.newContext()).newPage();
  await login(t2, USERS.teacher2);
  await t2.goto(`/education/goals/${planId}`);
  await expect(t2.locator('main')).toContainText(E2E.titlePrefix);
  await expect(t2.getByRole('button', { name: /Sửa|Chỉnh sửa/ })).toHaveCount(0);
});

const branchKey = () => `bp_${ref.classroom}_${planId}`;
const themeKey = () => `tp_${ref.classroom}_${themeId}`;

async function openClassPage(page, email, path) {
  await login(page, email);
  await pickYear(page, E2E.schoolYear);
  await spaGo(page, path);
}

test('ST-07 giáo viên đặt tên chủ đề nhánh, lưu tay và gửi duyệt', async ({ page }) => {
  await openClassPage(page, USERS.teacher2, `/education/branches/${ref.classroom}`);
  const name = page.getByPlaceholder('Nhập tên chủ đề nhánh').first();
  await expect(name).toBeEditable();
  // F5 ở trang lớp của năm không phải năm đang hoạt động: giữ năm đã chọn, không báo "Không tìm thấy lớp" (Tiền 31/10)
  await page.reload();
  await expect(page.locator('header select').first()).toHaveValue(E2E.schoolYear);
  await expect(name).toBeEditable();
  await name.fill('Bé vui đến trường (ST-07)');
  await expect(saveStatus(page)).toHaveText('Có thay đổi chưa lưu');
  await expectNoAutosaveWording(page);
  await page.getByRole('button', { name: 'Lưu', exact: true }).click();
  await expect(saveStatus(page)).toHaveText(/Đã lưu lúc/);
  await review(page, /^Gửi .* duyệt$/, 'Gửi');
  await expect.poll(() => docStatus(branchKey())).toBe('PENDING_TL');
});

test('ST-08 Tổ trưởng duyệt; Phó HT trả lại có lý do; giáo viên sửa, gửi lại; Tổ trưởng → Phó HT duyệt', async ({ browser }) => {
  const as = async (email) => {
    const p = await (await browser.newContext()).newPage();
    await openClassPage(p, email, `/education/branches/${ref.classroom}`);
    return p;
  };
  await review(await as(USERS.teacher1), 'Duyệt', 'Duyệt');
  await expect.poll(() => docStatus(branchKey())).toBe('PENDING_VP');
  await review(await as(USERS.vp), 'Trả lại', 'Trả lại', 'Tên nhánh gần trẻ hơn (ST-08)');
  await expect.poll(() => docStatus(branchKey())).toBe('REJECTED');
  const t2 = await as(USERS.teacher2);
  await expect(t2.locator('main')).toContainText('Tên nhánh gần trẻ hơn (ST-08)');
  await t2.getByPlaceholder('Nhập tên chủ đề nhánh').first().fill('Lớp học của bé (ST-08)');
  await t2.keyboard.press('Control+s');
  await expect(saveStatus(t2)).toHaveText(/Đã lưu lúc/);
  await review(t2, /^Gửi .* duyệt$/, 'Gửi');
  await expect.poll(() => docStatus(branchKey())).toBe('PENDING_TL');
  await review(await as(USERS.teacher1), 'Duyệt', 'Duyệt');
  await review(await as(USERS.vp), 'Duyệt', 'Duyệt');
  await expect.poll(() => docStatus(branchKey())).toMatch(/APPROVED|PENDING_HT/);
  if ((await docStatus(branchKey())) === 'PENDING_HT') {
    await review(await as(USERS.principal), 'Duyệt', 'Duyệt');
    await expect.poll(() => docStatus(branchKey())).toBe('APPROVED');
  }
});

test('ST-09 kế hoạch chủ đề: lưu tay', async ({ page }) => {
  await openClassPage(page, USERS.teacher2, `/education/class/${ref.classroom}/themes/${themeId}`);
  const field = page.locator('main textarea:not([disabled])').first();
  await expect(field).toBeEditable();
  await field.fill('Góc xây dựng: trường của bé (ST-09)');
  await expect(saveStatus(page)).toHaveText('Có thay đổi chưa lưu');
  await page.keyboard.press('Control+s');
  await expect(saveStatus(page)).toHaveText(/Đã lưu lúc/);
  await expect.poll(async () => JSON.stringify(await classDocs())).toContain(themeKey());
});

test('ST-10 giáo án tuần: đóng tab khi chưa lưu ⇒ mở lại khôi phục được; Lưu xóa bản giữ', async ({ context }) => {
  const path = `/education/class/${ref.classroom}/weeks/${E2E.weekStart}`;
  const page = await context.newPage();
  await openClassPage(page, USERS.teacher2, path);
  const field = page.locator('main textarea:not([disabled])').first();
  await expect(field).toBeEditable();
  await field.fill('Trẻ biết tên lớp, tên cô (ST-10)');
  await page.waitForTimeout(1200);
  expect(await storageKeys(page, 'plan-backup')).toHaveLength(1);
  await page.close();
  const again = await context.newPage();
  await pickYearAfterReload(again, path);
  await expect(again.getByText('Có nội dung chưa lưu từ lần soạn trước.')).toBeVisible();
  await again.getByRole('button', { name: 'Khôi phục' }).click();
  await expect(again.locator('main textarea:not([disabled])').first()).toHaveValue('Trẻ biết tên lớp, tên cô (ST-10)');
  await again.keyboard.press('Control+s');
  await expect(saveStatus(again)).toHaveText(/Đã lưu lúc/);
  expect(await storageKeys(again, 'plan-backup')).toEqual([]);
});

async function pickYearAfterReload(page, path) {
  await page.goto('/');
  await pickYear(page, E2E.schoolYear);
  await spaGo(page, path);
}

test('ST-11 Tổ trưởng dạy chính lớp ⇒ gửi hồ sơ chủ đề thẳng Phó HT; bản giữ cũ không được mời khôi phục sau khi gửi', async ({
  context,
}) => {
  addTeamLeader('teacher2');
  try {
    const weekPath = `/education/class/${ref.classroom}/weeks/${E2E.weekStart}`;
    const page = await context.newPage();
    await openClassPage(page, USERS.teacher2, weekPath);
    await page.locator('main textarea:not([disabled])').first().fill('Sửa dở rồi đóng tab (ST-11)');
    await page.waitForTimeout(1200);
    await page.close();
    const dossier = await context.newPage();
    await pickYearAfterReload(dossier, `/education/class/${ref.classroom}/themes/${themeId}/review`);
    await review(dossier, 'Gửi Phó HT duyệt', 'Gửi');
    await expect.poll(() => docStatus(themeKey())).toBe('PENDING_VP');
    const week = await context.newPage();
    await pickYearAfterReload(week, weekPath);
    await expect(week.locator('main')).toBeVisible();
    await week.waitForTimeout(1500);
    await expect(week.getByText('Có nội dung chưa lưu từ lần soạn trước.')).toHaveCount(0);
    expect(await storageKeys(week, 'plan-backup')).toEqual([]);
  } finally {
    removeTeamLeader('teacher2');
  }
});

test('ST-12 Phó HT duyệt hồ sơ chủ đề; giáo viên mở trình chiếu dạy học', async ({ browser }) => {
  const vp = await (await browser.newContext()).newPage();
  await openClassPage(vp, USERS.vp, `/education/class/${ref.classroom}/themes/${themeId}/review`);
  await review(vp, 'Duyệt', 'Duyệt');
  await expect.poll(() => docStatus(themeKey())).toMatch(/APPROVED|PENDING_HT/);
  const t2 = await (await browser.newContext()).newPage();
  await openClassPage(t2, USERS.teacher2, `/education/class/${ref.classroom}/themes/${themeId}/teach`);
  await expect(t2.getByRole('button', { name: 'Toàn màn hình' })).toBeVisible();
  await expect(t2.locator('main')).toContainText('Góc xây dựng: trường của bé (ST-09)');
  await expect(t2.locator('main')).toContainText('Đã duyệt');
  await expect(t2.getByText(/Không tìm thấy|Đã xảy ra lỗi/)).toHaveCount(0);
});
