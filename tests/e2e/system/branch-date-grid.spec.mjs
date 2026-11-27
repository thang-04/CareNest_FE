import { test, expect } from '@playwright/test';
import { api } from '../support/realBe.mjs';
import { login, spaGo } from '../support/ui.mjs';

const user = 'teacher1';
const addDays = (iso, days) => new Date(Date.parse(iso) + days * 86400000).toISOString().slice(0, 10);
const dmy = (iso) => iso.split('-').reverse().join('/');

test('ST-BRANCH-18 đổi nhánh thành hai tuần, gộp bảng và báo trùng không sập trang', async ({ page }) => {
  const me = (await api(user, 'GET', '/accounts/me')).data;
  const docs = (await api(user, 'GET', '/education-plans/class-docs')).data;
  const cls = docs.classes.find((c) => String(c.homeroomTeacherId) === String(me.userId));
  expect(cls, 'Cần lớp chủ nhiệm để kiểm tra giao diện soạn').toBeTruthy();
  let stored = structuredClone(docs.branchPlans.find((b) => String(b.classId) === String(cls.id)));
  expect(stored).toBeTruthy();
  // EDU-111 (1): chủ đề có gói học kỳ chờ duyệt hoặc hồ sơ chủ đề đã gửi/duyệt thì khóa nhánh ⇒ chỉ thử chủ đề còn sửa được
  const themeLocked = (themeId) => {
    const pkg = docs.semesterPackages.find(
      (p) => (p.themeIds || []).map(String).includes(String(themeId)) && String(p.classId) === String(cls.id),
    );
    const dossier = docs.themeDossiers.find((d) => d.id === `ds_${cls.id}_${themeId}`);
    return pkg?.status === 'REVIEW' || ['REVIEW', 'APPROVED'].includes(dossier?.status);
  };
  // Tuần trùng đợt nghỉ không có tuần học ⇒ ba tuần thử phải nằm ngoài đợt nghỉ của kế hoạch
  const breaks = (await api(user, 'GET', `/education-plans/goals/${stored.yearPlanId}`)).data?.breaks || [];
  const inBreak = (from, to) => breaks.some((b) => b.startDate <= to && b.endDate >= from);
  let start;
  let schedule;
  for (const s of stored.themeSchedules.filter((x) => !themeLocked(x.themeId))) {
    for (let date = s.startDate; addDays(date, 18) <= s.endDate; date = addDays(date, 7)) {
      if (date.slice(0, 7) === addDays(date, 18).slice(0, 7) && !inBreak(date, addDays(date, 18))) {
        start = date;
        schedule = s;
        break;
      }
    }
    if (start) break;
  }
  expect(start, 'Cần ba tuần trong cùng tháng của một chủ đề chưa khóa').toBeTruthy();
  stored = {
    ...stored,
    status: 'DRAFT',
    permissions: { ...stored.permissions, canEdit: true },
    branches: [
      {
        key: 'e2e-first',
        themeId: schedule.themeId,
        name: '[E2E] Nhánh mở rộng',
        startDate: start,
        endDate: addDays(start, 4),
        weekNotes: {},
      },
      {
        key: 'e2e-other',
        themeId: schedule.themeId,
        name: '[E2E] Nhánh khác',
        startDate: addDays(start, 14),
        endDate: addDays(start, 18),
        weekNotes: {},
      },
    ],
  };
  // Cô lập dữ liệu lịch và lưu để không thay đổi hồ sơ thật của lớp.
  await page.route(/\/education-plans\/class-docs(?:\?.*)?$/, async (route) => {
    const response = await route.fetch();
    const body = await response.json();
    body.data.branchPlans = body.data.branchPlans.map((b) => (String(b.id) === String(stored.id) ? stored : b));
    await route.fulfill({ response, json: body });
  });
  await page.route(/\/education-plans\/class-docs\/branch\/[^/?]+$/, async (route) => {
    if (route.request().method() !== 'PUT') return route.continue();
    stored = { ...stored, ...route.request().postDataJSON(), version: stored.version + 1 };
    await route.fulfill({ json: { code: 1000, data: stored } });
  });
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await login(page, user);
  await spaGo(page, `/education/branches/${cls.id}`);
  await page.getByRole('button', { name: 'Chỉnh sửa', exact: true }).click();
  const row = page
    .locator('tr')
    .filter({ has: page.getByRole('textbox', { name: /^Chủ đề nhánh tuần/ }).filter({ hasText: '[E2E] Nhánh mở rộng' }) });
  const name = page.locator('textarea').filter({ hasText: '[E2E] Nhánh mở rộng' });
  const branchRow = name.locator('xpath=ancestor::tr');
  const endButton = branchRow.getByRole('button', { name: /^Đến ngày chủ đề nhánh/ });
  const pickEnd = async (date) => {
    await endButton.click();
    await page.getByRole('textbox', { name: /^Gõ Đến ngày/ }).fill(dmy(date));
    await page.getByRole('textbox', { name: /^Gõ Đến ngày/ }).press('Enter');
  };
  await pickEnd(addDays(start, 11));
  await expect(endButton).toContainText(dmy(addDays(start, 11)));
  await pickEnd(addDays(start, 18));
  await expect(page.getByText('Thời gian bị trùng với nhánh khác.', { exact: true })).toBeVisible();
  await expect(endButton).toContainText(dmy(addDays(start, 11)));
  await name.fill('[E2E] Nhánh hai tuần');
  await page.getByRole('button', { name: 'Lưu', exact: true }).click();
  // Lưu xong vẫn đang sửa; bấm Hủy (đã lưu nên không hỏi) để về chế độ xem có tab Bảng
  await expect(page.getByText(/Đã lưu lúc/)).toBeVisible();
  await page.getByRole('button', { name: 'Hủy', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Chỉnh sửa', exact: true })).toBeVisible();
  await page.getByRole('combobox', { name: 'Kiểu hiển thị' }).selectOption({ label: 'Bảng' });
  const merged = page.locator('.ga-branch-grid-table td').filter({ hasText: '[E2E] Nhánh hai tuần' });
  await expect(merged).toHaveAttribute('colspan', '2');
  await expect(merged).toContainText(dmy(addDays(start, 11)).slice(0, 5));
  await expect(page.getByRole('combobox', { name: 'Tháng', exact: true })).toHaveCount(0);
  expect(errors).toEqual([]);
});
