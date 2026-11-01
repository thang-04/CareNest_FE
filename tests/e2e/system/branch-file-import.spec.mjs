import { test, expect } from '@playwright/test';
import { randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { E2E, USERS, BE_URL, api, beReachable, editHeaders, ids, newSession, sql, tokenOf, yearPlanBody } from '../support/realBe.mjs';
import { login, pickYear, review, saveStatus, spaGo } from '../support/ui.mjs';
import { goalTableDocx, zipStore } from '../support/docx.mjs';

test.describe.configure({ mode: 'serial' });
test.setTimeout(180_000);
const marker = `[E2E-BRANCH-${randomUUID().slice(0, 8)}]`;
const fixture = fileURLToPath(new URL('../fixtures/branch-merged.doc', import.meta.url));
const previewPath = '/education-plans/class-docs/branch/file-preview';
let ref;
let plan;
let assignment;
const shifted = [];
const key = () => `bp_${ref.classroom}_${plan.id}`;
const docs = () => sql(`select coalesce(jsonb_agg(to_jsonb(d)), '[]') from edu_class_docs d where year_plan_id = ${Number(plan.id)}`);
const persisted = () => JSON.parse(docs()).find((d) => d.doc_key === key());
const names = (page) => page.getByPlaceholder('Nhập tên chủ đề nhánh');
const dialogOf = (page) => page.getByRole('dialog', { name: 'Nhập file chủ đề nhánh', exact: true });
const send = (page) => page.getByRole('button', { name: /^Gửi .* duyệt$/ });
const save = (page) => page.getByRole('button', { name: 'Lưu', exact: true });

test.beforeAll(async () => {
  expect(process.env.E2E_PG_DB, 'Chỉ chạy với database E2E được chỉ định rõ').toBeTruthy();
  expect(await beReachable(), 'Cần Backend thật và Keycloak; không thay response bằng mock').toBe(true);
  ref = ids();
  expect(
    Number(sql(`select count(*) from edu_year_plans where school_year_id = ${ref.year} and age_group_id = ${ref.ageGroup}`)),
    'Không xóa kế hoạch sẵn có để nhường fixture',
  ).toBe(0);
  const session = newSession();
  const body = await yearPlanBody(`${marker} nhập nhánh`);
  body.themes[0].endDate = '2027-09-24';
  body.themes.push({
    ...body.themes[0],
    key: 't2',
    name: 'Chủ đề giữ nguyên (E2E)',
    abbr: 'GN',
    startDate: '2027-09-27',
    endDate: '2027-10-01',
  });
  body.breaks = [{ label: 'Nghỉ tổng hợp (E2E)', startDate: '2027-09-13', endDate: '2027-09-17' }];
  const created = await api(USERS.vp, 'POST', '/education-plans/goals', { body, headers: editHeaders(session, 0) });
  expect(created.status, created.desc).toBe(201);
  plan = created.data;
  const finish = await api(USERS.vp, 'POST', `/education-plans/goals/${plan.id}/finish-editing`, {
    headers: editHeaders(session, plan.revision),
  });
  expect(finish.status, finish.desc).toBe(200);
  // Chỉ dựng tiền điều kiện ban hành; hành vi nhập/lưu/gửi/duyệt bên dưới đi qua API thật.
  sql(`update edu_year_plans set status = 'APPROVED' where id = ${Number(plan.id)} and title like '${marker}%'`);
  const originals = JSON.parse(
    sql(
      `select coalesce(jsonb_agg(id), '[]') from staff_assignments where user_id = ${ref.teacher1} and staff_role = 'AGE_GROUP_TEAM_LEADER' and valid_from < '2100-01-01'`,
    ),
  );
  shifted.push(...originals);
  if (shifted.length)
    sql(
      `update staff_assignments set valid_from = valid_from + interval '100 years', valid_to = valid_to + interval '100 years' where id in (${shifted.join(',')})`,
    );
  assignment = Number(
    sql(
      `insert into staff_assignments(user_id,staff_role,age_group_id,valid_from) values (${ref.teacher1},'AGE_GROUP_TEAM_LEADER',${ref.ageGroup},'2026-01-02') returning id`,
    ).split('\n')[0],
  );
  expect(Number.isSafeInteger(assignment)).toBe(true);
});

test.afterAll(() => {
  if (plan) sql(`delete from edu_year_plans where id = ${Number(plan.id)} and title like '${marker}%'`);
  if (assignment) sql(`delete from staff_assignments where id = ${assignment} and user_id = ${ref.teacher1} and valid_from = '2026-01-02'`);
  if (shifted.length)
    sql(
      `update staff_assignments set valid_from = valid_from - interval '100 years', valid_to = valid_to - interval '100 years' where id in (${shifted.join(',')})`,
    );
});

async function open(page, email = USERS.teacher2) {
  await login(page, email);
  await pickYear(page, E2E.schoolYear);
  await spaGo(page, `/education/branches/${ref.classroom}`);
  await expect(save(page)).toBeVisible();
  await expect(send(page)).toBeVisible();
}
async function choose(page, file = fixture) {
  await page.getByRole('button', { name: 'Nhập file', exact: true }).click();
  const response = page.waitForResponse((res) => res.request().method() === 'POST' && new URL(res.url()).pathname.endsWith(previewPath));
  await dialogOf(page).locator('input[type=file]').setInputFiles(file);
  const result = await response;
  return { status: result.status(), body: await result.json() };
}
async function disabledActions(page) {
  await expect(save(page)).toBeVisible();
  await expect(send(page)).toBeVisible();
  await expect(save(page)).toBeDisabled();
  await expect(send(page)).toBeDisabled();
  await expect(save(page)).toHaveAttribute('aria-description', /.+/);
  await expect(send(page)).toHaveAttribute('aria-description', /.+/);
}

test('EDU-47 .doc thật: tuần server, cảnh báo tên thừa/lạ; Hủy và xác nhận thay; Lưu rồi tải lại', async ({ page, browser }) => {
  await open(page);
  await expect(names(page)).toHaveCount(3);
  await names(page).nth(0).fill('Tên cũ (E2E)');
  await names(page).nth(2).fill('Tên không được ghép giữ nguyên (E2E)');
  await page.getByLabel('Ghi chú tuần 1', { exact: true }).fill('Ghi chú giữ nguyên (E2E)');
  await save(page).click();
  await expect(saveStatus(page)).toHaveText(/Đã lưu lúc/);
  const before = docs();
  const source = await api(USERS.vp, 'GET', `/education-plans/goals/${plan.id}`);
  const preview = await choose(page);
  expect(preview.status).toBe(200);
  expect(preview.body.data.matches.map((match) => [match.weekStart, match.name])).toEqual([
    ['2027-09-06', 'Tên nhập thứ nhất'],
    ['2027-09-20', 'Tên nhập thứ hai'],
  ]);
  expect(preview.body.data.warnings).toHaveLength(2);
  await expect(dialogOf(page)).toContainText('2027-09-06');
  await expect(dialogOf(page)).toContainText('2027-09-20');
  expect(docs()).toBe(before);
  await dialogOf(page).getByRole('button', { name: 'Hủy', exact: true }).click();
  await expect(names(page).nth(0)).toHaveValue('Tên cũ (E2E)');
  await expect(saveStatus(page)).not.toHaveText('Có thay đổi chưa lưu');

  const changedDates = await choose(page, {
    name: 'ngay-khac.docx',
    mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    buffer: goalTableDocx([
      ['Tháng', 'Chủ đề', 'Chủ đề nhánh', 'Thời gian thực hiện', 'Ghi chú'],
      ['12', { text: 'Trường mầm non (E2E)', merge: 'restart' }, 'Nhánh 9: Tên nhập thứ nhất', '01/12/2040', ''],
      ['12', { merge: 'continue' }, 'Nghỉ hè', '02/12/2040', ''],
      ['12', { merge: 'continue' }, 'Nhánh 9: Tên nhập thứ hai', '03/12/2040', ''],
      ['12', { merge: 'continue' }, 'Nhánh 1: Tên vượt số tuần', '04/12/2040', ''],
      ['12', 'Chủ đề không tồn tại (E2E)', 'Nhánh 1: Không được chuyển sang chủ đề khác', '05/12/2040', ''],
    ]),
  });
  expect(changedDates.status).toBe(200);
  expect(changedDates.body.data).toEqual(preview.body.data);
  await dialogOf(page).getByRole('button', { name: 'Hủy', exact: true }).click();

  await choose(page);
  await dialogOf(page).getByRole('button', { name: 'Thêm 2 tên nhánh' }).click();
  const overwrite = page.getByRole('dialog', { name: 'Thay tên chủ đề nhánh đã có?' });
  await overwrite.getByRole('button', { name: 'Quay lại', exact: true }).click();
  await expect(names(page).nth(0)).toHaveValue('Tên cũ (E2E)');
  await dialogOf(page).getByRole('button', { name: 'Thêm 2 tên nhánh' }).click();
  await overwrite.getByRole('button', { name: 'Thay tên và thêm' }).click();
  await expect(dialogOf(page)).toBeHidden();
  await expect(names(page).nth(0)).toHaveValue('Tên nhập thứ nhất');
  await expect(names(page).nth(1)).toHaveValue('Tên nhập thứ hai');
  await expect(names(page).nth(2)).toHaveValue('Tên không được ghép giữ nguyên (E2E)');
  await expect(page.getByLabel('Ghi chú tuần 1', { exact: true })).toHaveValue('Ghi chú giữ nguyên (E2E)');
  expect(docs()).toBe(before);
  await expect(saveStatus(page)).toHaveText('Có thay đổi chưa lưu');
  await save(page).click();
  await expect(saveStatus(page)).toHaveText(/Đã lưu lúc/);
  expect(persisted().status).toBe('DRAFT');
  expect(persisted().content.names).toEqual({
    '2027-09-06': 'Tên nhập thứ nhất',
    '2027-09-20': 'Tên nhập thứ hai',
    '2027-09-27': 'Tên không được ghép giữ nguyên (E2E)',
  });
  const after = await api(USERS.vp, 'GET', `/education-plans/goals/${plan.id}`);
  expect(after.data.themes).toEqual(source.data.themes);
  expect(after.data.breaks).toEqual(source.data.breaks);
  await page.reload();
  await expect(names(page).nth(0)).toHaveValue('Tên nhập thứ nhất');
  await expect(names(page).nth(2)).toHaveValue('Tên không được ghép giữ nguyên (E2E)');
  const mobileContext = await browser.newContext({ viewport: { width: 375, height: 800 } });
  const mobile = await mobileContext.newPage();
  await open(mobile);
  await expect(names(mobile).first()).toHaveValue('Tên nhập thứ nhất');
  await expect.poll(() => mobile.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(375);
  await expect(save(mobile)).toBeInViewport({ ratio: 1 });
  await expect(send(mobile)).toBeInViewport({ ratio: 1 });
  await mobile.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await expect(save(mobile)).toBeInViewport({ ratio: 1 });
  await expect(send(mobile)).toBeInViewport({ ratio: 1 });
  await mobileContext.close();
});

test('EDU-47 lỗi file thật 7124/7125/7126 và người xem 403 không thay bản đã lưu', async ({ page, request, browser }) => {
  await open(page);
  const before = docs();
  let result = await choose(page, {
    name: 'hong.doc',
    mimeType: 'application/msword',
    buffer: Buffer.from([0xd0, 0xcf, 0x11, 0xe0, 0, 0, 0, 0]),
  });
  expect(result.status).toBe(400);
  expect(result.body.errorCode).toBe(7124);
  await expect(dialogOf(page).getByRole('button', { name: /^Thêm.*tên nhánh$/ })).toBeDisabled();
  await dialogOf(page).getByRole('button', { name: 'Hủy', exact: true }).click();
  result = await choose(page, { name: 'sai-bang.csv', mimeType: 'text/csv', buffer: Buffer.from('Mục tiêu,Nội dung\nTổng hợp,Tổng hợp') });
  expect(result.status).toBe(400);
  expect(result.body.errorCode).toBe(7125);
  await dialogOf(page).getByRole('button', { name: 'Hủy', exact: true }).click();
  result = await choose(page, {
    name: 'qua-lon.doc',
    mimeType: 'application/msword',
    buffer: Buffer.alloc(2 * 1024 * 1024 + 1),
  });
  expect(result.status).toBe(400);
  expect(result.body.errorCode).toBe(7126);
  await dialogOf(page).getByRole('button', { name: 'Hủy', exact: true }).click();
  result = await choose(page, {
    name: 'toa-do-qua-gioi-han.xlsx',
    mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    buffer: zipStore({
      'xl/worksheets/sheet1.xml':
        '<?xml version="1.0"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData><row r="2001"><c r="A2001" t="inlineStr"><is><t>Tổng hợp</t></is></c></row></sheetData></worksheet>',
    }),
  });
  expect(result.status).toBe(400);
  expect(result.body.errorCode).toBe(7126);
  await dialogOf(page).getByRole('button', { name: 'Hủy', exact: true }).click();
  const denied = await request.post(`${BE_URL}${previewPath}?classId=${ref.classroom}&yearPlanId=${plan.id}`, {
    headers: { Authorization: `Bearer ${await tokenOf(USERS.vp)}` },
    multipart: { file: { name: 'nhanh.csv', mimeType: 'text/csv', buffer: Buffer.from('Chủ đề,Chủ đề nhánh\nTrường mầm non (E2E),Tên') } },
  });
  expect(denied.status()).toBe(403);
  expect(docs()).toBe(before);
  const viewer = await browser.newContext();
  const viewerPage = await viewer.newPage();
  await open(viewerPage, USERS.vp);
  await disabledActions(viewerPage);
  await viewer.close();
});

test('EDU-18/47 chuỗi Tổ trưởng → Phó HT giữ nguyên; nút luôn hiện khi chờ duyệt/đã duyệt/người xem', async ({ page, browser }) => {
  await open(page);
  await expect(send(page)).toHaveText('Gửi Tổ trưởng duyệt');
  await review(page, 'Gửi Tổ trưởng duyệt', 'Gửi');
  await expect.poll(() => persisted().status).toBe('PENDING_TL');
  await disabledActions(page);
  const as = async (email) => {
    const context = await browser.newContext();
    const next = await context.newPage();
    await open(next, email);
    return next;
  };
  const tl = await as(USERS.teacher1);
  await disabledActions(tl);
  await review(tl, 'Duyệt', 'Duyệt');
  await expect.poll(() => persisted().status).toBe('PENDING_VP');
  const vp = await as(USERS.vp);
  await disabledActions(vp);
  await review(vp, 'Trả lại', 'Trả lại', 'Điều chỉnh tên tổng hợp (E2E)');
  await expect.poll(() => persisted().status).toBe('REJECTED');
  await page.reload();
  await expect(names(page).first()).toBeEditable();
  await expect(save(page)).toBeVisible();
  await expect(send(page)).toBeEnabled();
  await review(page, 'Gửi Tổ trưởng duyệt', 'Gửi');
  await tl.reload();
  await review(tl, 'Duyệt', 'Duyệt');
  await vp.reload();
  await review(vp, 'Duyệt', 'Duyệt');
  await expect.poll(() => persisted().status).toMatch(/APPROVED|PENDING_HT/);
  if (persisted().status === 'PENDING_HT') {
    const principal = await as(USERS.principal);
    await review(principal, 'Duyệt', 'Duyệt');
    await principal.context().close();
  }
  await expect.poll(() => persisted().status).toBe('APPROVED');
  await page.reload();
  await disabledActions(page);
  await vp.reload();
  await disabledActions(vp);
  await tl.context().close();
  await vp.context().close();
});
