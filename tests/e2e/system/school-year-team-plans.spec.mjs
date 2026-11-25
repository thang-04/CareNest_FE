import { test, expect } from '@playwright/test';
import { USERS, E2E, api, cleanup, addTeamLeader, newSession, editHeaders, yearPlanBody, devPassword } from '../support/realBe.mjs';
import { login, pickYear, spaGo } from '../support/ui.mjs';

test.describe.configure({ mode: 'serial' });
let annual;
let team;
const session = newSession();
const goals = '/education-plans/goals';

test.beforeAll(() => {
  devPassword();
  cleanup();
  addTeamLeader('teacher1');
});
test.afterAll(() => {
  if (process.env.E2E_DEV_PASSWORD) cleanup();
});

test('Q01/Q03 PHT có nút lập năm học và cột nhánh trắng, Enter thêm nhánh', async ({ page }) => {
  const body = await yearPlanBody(`${E2E.titlePrefix} annual table`);
  body.planLevel = 'SCHOOL_YEAR';
  body.themes[0].endDate = '2027-09-17';
  // YearPlanPublicationValidator: gửi duyệt cần tối thiểu 9 chủ đề ⇒ thêm 8 chủ đề, mỗi chủ đề 2 tuần (cần 2–4 tuần) sau chủ đề đầu
  for (let i = 0; i < 8; i++) {
    const start = new Date(Date.UTC(2027, 8, 20 + i * 14));
    const end = new Date(Date.UTC(2027, 8, 31 + i * 14));
    const iso = (d) => d.toISOString().slice(0, 10);
    body.themes.push({ key: `t${i + 2}`, name: `Chủ đề E2E ${i + 2}`, abbr: `E${i + 2}`, startDate: iso(start), endDate: iso(end), festivals: '', note: '' });
  }
  body.domains[0].rows[0].contents[0].themeKeys = [];
  // Gửi kế hoạch năm học cần mục tiêu nằm trong một nhóm kết quả mong đợi (requireAnnualContents)
  body.domains[0].rows.unshift({ kind: 'group', text: 'Nhóm kết quả (E2E)', contents: [] });
  // Gửi duyệt kiểm lịch chủ đề (7214): nhánh mẫu cần đủ ngày bắt đầu, kết thúc trong khoảng chủ đề
  body.branchTemplates = [{ key: 'b1', themeKey: 't1', name: 'Nhánh gợi ý', startDate: '2027-09-06', endDate: '2027-09-10' }];
  const result = await api(USERS.vp, 'POST', goals, { body, headers: editHeaders(session, 0) });
  expect(result.status).toBe(201);
  annual = result.data;
  expect(
    (await api(USERS.vp, 'POST', `${goals}/${annual.id}/finish-editing`, { headers: editHeaders(session, annual.revision) })).status,
  ).toBe(200);
  let browserSession;
  page.on('request', (request) => {
    if (request.url().includes(`/goals/${annual.id}/start-editing`)) browserSession = request.headers()['x-edit-session'];
  });
  await login(page, USERS.vp);
  await spaGo(page, '/education/school-year-plans');
  await pickYear(page, E2E.schoolYear);
  await expect(page.getByRole('link', { name: 'Lập kế hoạch năm học', exact: true }).first()).toBeVisible();
  await spaGo(page, `/education/school-year-plans/${annual.id}/edit`);
  const cell = page.locator('.ga-branch-template-cell').first();
  await expect(cell).toHaveCSS('background-color', 'rgb(255, 255, 255)');
  // Mỗi nhánh một dòng, ô thêm nhánh ở dòng cuối của chủ đề ⇒ tìm trong bảng (kế hoạch test chỉ có một chủ đề)
  const input = page.getByRole('textbox', { name: /^Thêm chủ đề nhánh \/ dự án/ }).first();
  await input.fill('Nhánh thêm bằng Enter');
  await page
    .getByRole('textbox', { name: /^Chủ đề nhánh \/ dự án/ })
    .last()
    .press('Enter');
  // Gõ vào ô thêm đã tạo nhánh; Enter ở nhánh có tên chèn một dòng nhánh trống ngay sau và chuyển con trỏ tới đó
  await expect(page.locator('.ga-branch-template-item')).toHaveCount(3);
  const added = page.getByRole('textbox', { name: /^Chủ đề nhánh \/ dự án/ }).nth(2);
  await expect(added).toHaveValue('');
  await expect(added).toBeFocused();
  // Ô ngày là bộ chọn lịch (gõ dd/mm/yyyy rồi Enter); ngày ngoài khoảng của chủ đề bị từ chối kèm khoảng cho phép
  await cell.getByRole('button', { name: 'Từ nhánh Nhánh gợi ý', exact: true }).click();
  const typed = page.getByRole('textbox', { name: 'Gõ Từ nhánh Nhánh gợi ý', exact: true });
  await typed.fill('01/09/2027');
  await typed.press('Enter');
  await expect(page.getByRole('alert').filter({ hasText: 'Chọn ngày trong năm học: 06/09/2027 – 17/09/2027' })).toBeVisible();
  await typed.press('Escape');
  if (browserSession)
    await api(USERS.vp, 'POST', `${goals}/${annual.id}/finish-editing`, { headers: editHeaders(browserSession, annual.revision) });
});

test('Q05/Q12 annual PHT→HT, TEAM kế thừa có cột map và ô cố định xám', async ({ page }) => {
  expect(annual).toBeTruthy();
  let result = await api(USERS.vp, 'POST', `${goals}/${annual.id}/start-editing`, { headers: editHeaders(session, annual.revision) });
  expect(result.status).toBe(200);
  annual = (await api(USERS.vp, 'GET', `${goals}/${annual.id}`)).data;
  result = await api(USERS.vp, 'POST', `${goals}/${annual.id}/submit`, { headers: editHeaders(session, annual.revision) });
  expect(result.status, `${result.errorCode} ${result.desc}`).toBe(200);
  // Duyệt/ban hành cần revision hiện tại (X-Plan-Revision)
  annual = (await api(USERS.vp, 'GET', `${goals}/${annual.id}`)).data;
  result = await api(USERS.principal, 'POST', `${goals}/${annual.id}/issue`, { headers: editHeaders(newSession(), annual.revision) });
  expect(result.status, `${result.errorCode} ${result.desc}`).toBe(200);
  // Ban hành kế hoạch năm học ⇒ hệ thống tự sinh bản tổ Nháp kế thừa (EduTeamAutoDraft); không tạo tay (7002)
  const teams = await api(USERS.teacher1, 'GET', `${goals}?planLevel=TEAM&schoolYearId=${annual.schoolYearId}&size=100`);
  const auto = teams.data.items.find((p) => p.curriculumSourcePlanId === annual.id);
  expect(auto, 'bản tổ tự sinh từ kế hoạch năm học vừa ban hành').toBeTruthy();
  team = (await api(USERS.teacher1, 'GET', `${goals}/${auto.id}`)).data;
  expect(team.curriculumSourcePlanId).toBe(annual.id);
  await login(page, USERS.teacher1);
  await pickYear(page, E2E.schoolYear); // EDU-107: trang lọc theo năm chọn ở header
  await spaGo(page, `/education/goals/${team.id}/edit`);
  await expect(page.locator('.ga-theme-table, .ga-goal-table').first()).toBeVisible();
  const fixed = page
    .locator('.ga-curriculum-fixed td')
    .filter({ hasNot: page.locator('input[type=checkbox]') })
    .first();
  await expect(fixed.locator('textarea:not([readonly]):not([disabled]), input:not([readonly]):not([disabled])')).toHaveCount(0);
  await expect(fixed).not.toHaveCSS('background-color', 'rgb(255, 255, 255)');
});

test('EDU-57 PHT không xóa được TEAM qua API', async () => {
  expect(team).toBeTruthy();
  const rejected = await api(USERS.vp, 'DELETE', `${goals}/${team.id}`, { headers: editHeaders(newSession(), team.revision) });
  expect(rejected.status).toBe(403);
  // Bản tổ vẫn còn (không bị xóa): Tổ trưởng đọc được; PHT chỉ xem bản đã ban hành (EDU-73) ⇒ 403 "chưa ban hành"
  expect((await api(USERS.teacher1, 'GET', `${goals}/${team.id}`)).status).toBe(200);
  expect((await api(USERS.vp, 'GET', `${goals}/${team.id}`)).errorCode).toBe(7384);
});
