import { test, expect } from '@playwright/test';
import { api, beReachable } from '../support/realBe.mjs';
import { login, spaGo } from '../support/ui.mjs';

// System spec 003 trên dữ liệu dev (chạy sau integration edu-lead-time-api: học kỳ đã cấu hình, gói học kỳ đã có).
test.describe.configure({ mode: 'serial' });

const U = { vp: 'viceprincipal@gmail.com', tl: 'teamlead34@gmail.com', gv2: 'teacher6@gmail.com' };
let cls;
let week;

test.beforeAll(async () => {
  test.skip(!(await beReachable()), 'BE thật không chạy ở :8080');
  const me = await api(U.tl, 'GET', '/accounts/me');
  const docs = await api(U.tl, 'GET', '/education-plans/class-docs');
  cls = docs.data.classes.find((c) => String(c.homeroomTeacherId) === String(me.data.userId));
  week = (docs.data.weekPlans || []).find((w) => String(w.classId) === String(cls?.id));
  if (!week && cls) {
    // Lớp dev chưa có giáo án tuần: lưu kế hoạch chủ đề đầu tiên để trang tuần / ngày mở được (Q9)
    const branch = docs.data.branchPlans.find((b) => String(b.classId) === String(cls.id));
    const first = (branch?.themeSchedules || [])[0];
    if (first) {
      const key = `tp_${cls.id}_${first.themeId}`;
      const exists = docs.data.classThemePlans.find((t) => t.id === key);
      if (!exists)
        await api(U.tl, 'PUT', `/education-plans/class-docs/theme/${key}`, {
          body: { id: key, classId: String(cls.id), yearPlanId: String(branch.yearPlanId), themeId: String(first.themeId) },
          headers: { 'X-Class-Doc-Version': '-1' },
        });
      const start = new Date(`${first.startDate}T00:00:00`);
      start.setDate(start.getDate() - ((start.getDay() + 6) % 7));
      const iso = `${start.getFullYear()}-${String(start.getMonth() + 1).padStart(2, '0')}-${String(start.getDate()).padStart(2, '0')}`;
      week = { weekStart: iso };
    }
  }
});

const notFound = (page) => page.getByText(/Không tìm thấy|Đã có lỗi/);

test('ST-003-01 trang gói học kỳ hiện trạng thái, nhãn hạn, lịch nhánh của kỳ', async ({ page }) => {
  test.skip(!cls, 'Thiếu lớp');
  await login(page, U.tl);
  await spaGo(page, `/education/class/${cls.id}/semesters/1`);
  await expect(page.getByRole('heading', { name: 'Gói học kỳ 1' })).toBeVisible();
  await expect(notFound(page)).toHaveCount(0);
  await expect(page.getByText('Lịch chủ đề nhánh của học kỳ')).toBeVisible();
  await expect(page.getByText(/Gần đến hạn|Quá hạn|Đúng hạn|Ban hành trễ|Hạn \d\d\/\d\d/).first()).toBeVisible();
});

test('ST-003-02 PHT thấy nút Mở hạn khi gói quá hạn; GV thứ hai không thấy', async ({ page, browser }) => {
  test.skip(!cls, 'Thiếu lớp');
  const pkg = (await api(U.vp, 'GET', '/education-plans/class-docs')).data.semesterPackages.find(
    (p) => String(p.classId) === String(cls.id) && p.semesterNo === 1,
  );
  await login(page, U.vp);
  await spaGo(page, `/education/class/${cls.id}/semesters/1`);
  await expect(page.getByRole('heading', { name: 'Gói học kỳ 1' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Mở hạn' })).toHaveCount(pkg?.canExtend ? 1 : 0);
  const other = await (await browser.newContext()).newPage();
  await login(other, U.gv2);
  await spaGo(other, `/education/class/${cls.id}/semesters/1`);
  await expect(other.getByRole('heading', { name: 'Gói học kỳ 1' })).toBeVisible();
  await expect(other.getByRole('button', { name: 'Mở hạn' })).toHaveCount(0);
});

test('ST-003-03 Kế hoạch tuần và Giáo án ngày là hai trang, liên kết qua lại', async ({ page }) => {
  test.skip(!week, 'Lớp chưa có giáo án tuần');
  await login(page, U.tl);
  await spaGo(page, `/education/class/${cls.id}/weeks/${week.weekStart}`);
  await expect(page.getByRole('heading', { name: /Kế hoạch tuần \d+/ })).toBeVisible();
  await expect(page.getByRole('tab', { name: /Thứ 2/ })).toHaveCount(0);
  await page.getByRole('link', { name: 'Giáo án ngày' }).first().click();
  await expect(page.getByRole('heading', { name: /Giáo án ngày tuần \d+/ })).toBeVisible();
  await expect(page.getByRole('tab', { name: /Thứ 2/ })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Kế hoạch tuần' })).toBeVisible();
});

test('ST-003-04 chuông thông báo hiện thông báo kế hoạch giáo dục và mở đúng trang', async ({ page }) => {
  test.skip(!cls, 'Thiếu lớp');
  const notes = await api(U.tl, 'GET', '/me/notifications');
  const edu = notes.data.items.find((n) => n.type?.startsWith('EDU_') && n.link);
  test.skip(!edu, 'Chưa có thông báo kế hoạch giáo dục (chạy integration trước)');
  await login(page, U.tl);
  await spaGo(page, '/notifications');
  await expect(page.getByText(edu.title).first()).toBeVisible({ timeout: 15_000 });
});
