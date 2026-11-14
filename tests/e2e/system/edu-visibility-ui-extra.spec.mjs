import { test, expect } from '@playwright/test';
import { api, beReachable } from '../support/realBe.mjs';
import { login, spaGo } from '../support/ui.mjs';

// Giao diện cho các phần spec 002/003 trước đây chỉ có test API (IT-002-02/03/04, IT-003-04/05, thông báo có đường dẫn).
// Dữ liệu dev 10/11/2026: teamlead34 = Tổ trưởng + GVCN lớp 1 (3–4 tuổi, cơ sở A), teacher6 = GV thứ hai lớp đó.
test.describe.configure({ mode: 'serial' });

const U = { vp: 'viceprincipal@gmail.com', ht: 'principal@gmail.com', tl: 'teamlead34@gmail.com', gv2: 'teacher6@gmail.com' };
const GOALS = '/education-plans/goals';
let cls;
let myAge;

test.beforeAll(async () => {
  test.skip(!(await beReachable()), 'BE thật không chạy ở :8080');
  const me = await api(U.tl, 'GET', '/accounts/me');
  const docs = await api(U.tl, 'GET', '/education-plans/class-docs');
  cls = docs.data.classes.find((c) => String(c.homeroomTeacherId) === String(me.data.userId));
  const annual = (await api(U.gv2, 'GET', `${GOALS}?planLevel=SCHOOL_YEAR&size=100`)).data.items;
  myAge = annual[0]?.ageGroupId;
});

test('ST-002-08 bản chưa ban hành: HT/PHT mở đường dẫn thấy "Bản này chưa ban hành"; danh sách tổ của HT chỉ có bản ban hành', async ({
  page,
}) => {
  const teams = (await api(U.tl, 'GET', `${GOALS}?planLevel=TEAM&size=100`)).data.items;
  const draft = teams.find((p) => p.status === 'DRAFT');
  test.skip(!draft, 'Không có bản tổ Nháp để thử');
  await login(page, U.ht);
  await spaGo(page, `/education/goals/${draft.id}`);
  // HT tải tài liệu toàn trường ⇒ chờ lâu hơn mặc định
  await expect(page.getByText('Bản này chưa ban hành')).toBeVisible({ timeout: 45_000 });
  await expect(page.getByRole('link', { name: 'Về danh sách' })).toBeVisible();
  await spaGo(page, '/education/goals');
  await expect(page.locator('main')).not.toContainText(/Nháp|Chờ duyệt|Trả lại/, { timeout: 15_000 });
});

test('ST-002-09 GV thứ hai: chỉ thấy kế hoạch năm đã ban hành của nhóm tuổi mình, không thấy lịch sử duyệt; nhóm khác bị chặn', async ({
  page,
}) => {
  const mine = (await api(U.gv2, 'GET', `${GOALS}?planLevel=SCHOOL_YEAR&size=100`)).data.items;
  test.skip(!mine.length, 'GV thứ hai chưa có kế hoạch năm đã ban hành');
  await login(page, U.gv2);
  await spaGo(page, '/education/school-year-plans');
  await expect(page.getByText(mine[0].title).first()).toBeVisible({ timeout: 15_000 });
  await spaGo(page, `/education/school-year-plans/${mine[0].id}`);
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible({ timeout: 15_000 });
  await expect(page.getByRole('button', { name: /Chỉnh sửa|Gửi duyệt|Ban hành|Trả lại/ })).toHaveCount(0);
  await expect(page.getByText(/Lịch sử duyệt|Lý do trả lại/)).toHaveCount(0);
  const other = (await api(U.vp, 'GET', `${GOALS}?planLevel=SCHOOL_YEAR&size=100`)).data.items.find(
    (p) => p.ageGroupId !== myAge && p.status === 'APPROVED',
  );
  test.skip(!other, 'Không có kế hoạch năm nhóm tuổi khác để thử');
  await spaGo(page, `/education/school-year-plans/${other.id}`);
  await expect(page.getByRole('link', { name: 'Về danh sách' })).toBeVisible({ timeout: 15_000 });
});

test('ST-003-09 trang kế hoạch chủ đề không hiện hạn (chỉ ở trang danh sách), không còn cách gửi và nút gửi (spec 004: gửi ở Kế hoạch giáo dục chủ đề)', async ({
  page,
}) => {
  test.skip(!cls, 'Thiếu lớp');
  const dossier = (await api(U.tl, 'GET', '/education-plans/class-docs')).data.themeDossiers?.find(
    (d) => String(d.classId) === String(cls.id),
  );
  test.skip(!dossier, 'Lớp chưa có hồ sơ chủ đề');
  await login(page, U.tl);
  await spaGo(page, `/education/class/${cls.id}/themes/${dossier.themeId}`);
  // Trạng thái, hạn chỉ ở hàng nút trang danh sách học kỳ, không lặp ở trang kế hoạch chủ đề (Tiền 14/11/2026)
  await expect(page.getByRole('combobox', { name: 'Chủ đề' })).toBeVisible({ timeout: 30_000 });
  await expect(page.locator('.ga-year-toolbar').getByText(/Gần đến hạn|Quá hạn|Đúng hạn|Ban hành trễ|Hạn/)).toHaveCount(0);
  await expect(page.locator('.ga-page a[href^="/education/"]:not(nav[aria-label="Breadcrumb"] a)')).toHaveCount(0);
  await expect(page.getByText('Cách gửi duyệt kế hoạch chủ đề và kế hoạch tuần')).toHaveCount(0);
  await expect(page.getByRole('button', { name: /^Gửi duyệt$|Gửi .* duyệt kế hoạch chủ đề/ })).toHaveCount(0);
});

test('ST-003-10 GV thứ hai xem trang chủ đề nhánh: không sửa, không gửi, không mở hạn', async ({ page }) => {
  test.skip(!cls, 'Thiếu lớp');
  await login(page, U.gv2);
  await spaGo(page, `/education/branches/${cls.id}`);
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Dự kiến chủ đề - chủ đề nhánh', { timeout: 15_000 });
  await expect(page.getByRole('button', { name: /Chỉnh sửa|Gửi duyệt|Mở khóa|Nhập file/ })).toHaveCount(0);
});

test('ST-003-11 bấm thông báo kế hoạch giáo dục ở trang Thông báo ⇒ mở đúng trang đích', async ({ page }) => {
  const items = (await api(U.tl, 'GET', '/me/notifications')).data.items;
  const edu = items.find((n) => n.type?.startsWith('EDU_') && n.link);
  test.skip(!edu, 'Chưa có thông báo kế hoạch giáo dục');
  await login(page, U.tl);
  await spaGo(page, '/notifications');
  await page.getByText(edu.title).first().click();
  // Trang chi tiết thông báo có nút mở bản ghi liên quan
  await page.getByRole('button', { name: 'Mở nội dung liên quan' }).click();
  await page.waitForURL((u) => u.pathname === edu.link, { timeout: 15_000 });
  await expect(page.getByText(/Không tìm thấy|Đã có lỗi/)).toHaveCount(0);
});
