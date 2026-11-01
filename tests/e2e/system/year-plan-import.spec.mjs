import { test, expect } from '@playwright/test';
import { randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { E2E, api, USERS, beReachable, cleanup, editHeaders, newSession, sql, suspendOtherTeamLeads } from '../support/realBe.mjs';
import { login, saveStatus } from '../support/ui.mjs';
import { goalTableDocx } from '../support/docx.mjs';

// EDU-24: fixture riêng, BE/Keycloak thật; response giả chỉ dùng để kiểm race/lỗi.
test.describe.configure({ mode: 'serial' });
test.setTimeout(120_000);
const GOALS = '/education-plans/goals';
const ownedPlans = [];
const ownedYears = [];
const marker = `[E2E-IMPORT-${randomUUID().slice(0, 8)}]`;
let config;
let target;
let source;
let sourceYear;
let targetYear;
let sourceGroup;
let targetBefore;
const read = async (id) => {
  const result = await api(USERS.vp, 'GET', `${GOALS}/${id}`);
  expect(result.status, result.desc).toBe(200);
  return result.data;
};
const uiYear = (year) => year.name.replace('-', ' – ');
const childChecks = (dialog) => dialog.locator('.ga-cur-row input');
const importDialog = (page) => page.getByRole('dialog', { name: 'Lấy mục tiêu từ kế hoạch có sẵn' });
const confirm = (dialog) => dialog.getByRole('button', { name: /^Thêm.*mục tiêu$/ });
const envelope = (data) => ({ code: 200, desc: 'ok', data });
const sourceRoute = () => `**/education-plans/goals/${source.id}`;
const logicalRows = (detail) =>
  detail.domains.flatMap((domain) =>
    domain.rows.map((row) => ({
      domain: domain.name,
      kind: row.kind,
      text: row.text,
      contents: (row.contents || []).map((content) => content.text),
    })),
  );

async function availableSlots() {
  const occupied = new Set();
  let page = 0;
  let pages;
  do {
    const result = await api(USERS.vp, 'GET', `${GOALS}?page=${page}&size=200`);
    expect(result.status, result.desc).toBe(200);
    result.data.items.forEach((item) => occupied.add(`${item.schoolYearId}:${item.ageGroupId}`));
    pages = result.data.totalPages;
    page++;
  } while (page < pages);
  return config.schoolYears.flatMap((year) =>
    config.ageGroups.filter((group) => !occupied.has(`${year.id}:${group.id}`)).map((group) => ({ year, group })),
  );
}
async function addSyntheticYear() {
  const start = Number(sql('select coalesce(max(extract(year from start_date)), 2030)::int + 1 from school_years'));
  const name = `${start}-${start + 1}`;
  const id = Number(
    sql(
      `insert into school_years (name,start_date,end_date,status) values ('${name}','${start}-09-01','${start + 1}-05-31','PLANNED') returning id`,
    ).split('\n')[0],
  );
  expect(Number.isSafeInteger(id)).toBe(true);
  ownedYears.push({ id, name });
  const year = { id, name, startDate: `${start}-09-01`, endDate: `${start + 1}-05-31` };
  config.schoolYears.push(year);
}
function bodyFor(slot, isSource) {
  const prefix = isSource ? 'Nguồn' : 'Đích';
  const domains = config.domains.filter((domain) => domain.standard !== false).slice(0, isSource ? 2 : 1);
  expect(domains.length).toBeGreaterThan(isSource ? 1 : 0);
  return {
    schoolYearId: slot.year.id,
    ageGroupId: slot.group.id,
    title: `${marker} ${prefix}`,
    description: `${prefix} kiểm thử EDU-24`,
    domains: domains.map((domain, index) => ({
      domainId: domain.id,
      rows: [
        { kind: 'sub', text: `${prefix} lĩnh vực con ${index}`, contents: [] },
        { kind: 'group', text: `${prefix} nhóm ${index}`, contents: [] },
        ...Array.from({ length: isSource ? 5 : 1 }, (_, i) => ({
          kind: 'goal',
          text: `${prefix} mục tiêu ${index}-${i}`,
          contents: [{ text: `${prefix} nội dung ${index}-${i}`, themeKeys: ['owned-theme'] }],
        })),
      ],
    })),
    themes: [
      {
        key: 'owned-theme',
        name: `${prefix} chủ đề riêng`,
        abbr: prefix,
        startDate: slot.year.startDate,
        endDate: slot.year.startDate,
        festivals: '',
        note: '',
      },
    ],
    breaks: [
      { label: `${prefix} nghỉ riêng`, startDate: `${slot.year.name.slice(0, 4)}-12-30`, endDate: `${slot.year.name.slice(0, 4)}-12-31` },
    ],
  };
}
async function createPlan(slot, isSource) {
  const session = newSession();
  const result = await api(USERS.vp, 'POST', GOALS, { body: bodyFor(slot, isSource), headers: editHeaders(session, 0) });
  expect(result.status, result.desc).toBe(201);
  ownedPlans.push(result.data.id);
  const finish = await api(USERS.vp, 'POST', `${GOALS}/${result.data.id}/finish-editing`, {
    headers: editHeaders(session, result.data.revision),
  });
  expect(finish.status, finish.desc).toBe(200);
  return read(result.data.id);
}

test.beforeAll(async () => {
  expect(await beReachable(), 'Cần BE thật + Keycloak; không thay bằng mock').toBe(true);
  expect(process.env.E2E_PG_DB, 'Đặt E2E_PG_DB khớp database Backend trước khi tạo fixture SQL').toBeTruthy();
  const cfg = await api(USERS.vp, 'GET', '/education-plans/config');
  expect(cfg.status, cfg.desc).toBe(200);
  config = cfg.data;
  let slots = await availableSlots();
  let pair = slots.flatMap((a) => slots.filter((b) => a.year.id !== b.year.id && a.group.id !== b.group.id).map((b) => [a, b]))[0];
  while (!pair) {
    await addSyntheticYear();
    slots = await availableSlots();
    pair = slots.flatMap((a) => slots.filter((b) => a.year.id !== b.year.id && a.group.id !== b.group.id).map((b) => [a, b]))[0];
    if (ownedYears.length > 2) throw new Error('Không tìm được hai nhóm tuổi cho fixture EDU-24');
  }
  targetYear = pair[0].year;
  sourceYear = pair[1].year;
  sourceGroup = pair[1].group;
  target = await createPlan(pair[0], false);
  source = await createPlan(pair[1], true);
  targetBefore = await read(target.id);
});
test.afterAll(() => {
  // Chỉ xóa ID do suite tạo, kể cả beforeAll thất bại giữa chừng.
  try {
    for (const id of ownedPlans.reverse()) sql(`delete from edu_year_plans where id = ${Number(id)} and title like '${marker}%'`);
  } finally {
    for (const year of ownedYears.reverse()) sql(`delete from school_years where id = ${Number(year.id)} and name = '${year.name}'`);
  }
});
async function openEditor(page) {
  await login(page, USERS.vp);
  await page.goto(`/education/goals/${target.id}/edit`);
  await expect(page.locator('#desc')).toBeEditable();
  await page.getByRole('button', { name: 'Tiếp theo', exact: true }).click();
  await page.getByRole('button', { name: /Lấy từ kế hoạch có sẵn/ }).click();
  const dialog = importDialog(page);
  await dialog.locator('#imp-year').selectOption(uiYear(sourceYear));
  await dialog.locator('#imp-age').selectOption(sourceGroup.code);
  await expect(dialog.locator('#imp-src')).toBeVisible();
  await dialog.locator('#imp-src').selectOption(String(source.id));
  await expect(childChecks(dialog)).toHaveCount(10);
  return dialog;
}
async function selectFirst(dialog) {
  await childChecks(dialog).first().check();
  await expect(dialog.getByText('Đã chọn 1/10 mục tiêu', { exact: true })).toBeVisible();
}
async function delayedFresh(page) {
  let release;
  let entered;
  const gate = new Promise((resolve) => {
    release = resolve;
  });
  const started = new Promise((resolve) => {
    entered = resolve;
  });
  let requests = 0;
  await page.route(sourceRoute(), async (route) => {
    requests++;
    entered();
    await gate;
    await route.fulfill({ json: envelope(source) }).catch(() => {});
  });
  return { release, started, count: () => requests };
}

test('EDU-24 selection: one/domain/all, reset filters, cancel and keyboard keep header and target intact', async ({ page }) => {
  const dialog = await openEditor(page);
  const headerYear = await page.locator('header select').first().inputValue();
  await expect(confirm(dialog)).toBeDisabled();
  await childChecks(dialog).first().focus();
  await page.keyboard.press('Space');
  await expect(dialog.getByText('Đã chọn 1/10 mục tiêu', { exact: true })).toBeVisible();
  await dialog.locator('.ga-cur-domain__head input').first().check();
  await expect(dialog.getByText('Đã chọn 5/10 mục tiêu', { exact: true })).toBeVisible();
  await dialog.getByRole('button', { name: 'Chọn tất cả', exact: true }).click();
  await expect(dialog.getByText('Đã chọn 10/10 mục tiêu', { exact: true })).toBeVisible();
  await dialog.getByRole('button', { name: 'Bỏ chọn tất cả', exact: true }).click();
  await expect(confirm(dialog)).toBeDisabled();
  await selectFirst(dialog);
  await dialog.locator('#imp-year').selectOption(uiYear(targetYear));
  await expect(confirm(dialog)).toBeDisabled();
  await dialog.getByRole('button', { name: 'Hủy', exact: true }).click();
  await expect(dialog).toBeHidden();
  expect(await page.locator('header select').first().inputValue()).toBe(headerYear);
  expect(logicalRows(await read(target.id))).toEqual(logicalRows(targetBefore));
});

test('EDU-24 canEdit=false disables import despite a successful edit lease', async ({ page }) => {
  await login(page, USERS.vp);
  await page.route(`**/education-plans/goals/${target.id}/start-editing`, async (route) => {
    const response = await route.fetch();
    expect(response.status()).toBe(200);
    const body = await response.json();
    body.data.permissions.canEdit = false;
    await route.fulfill({ response, json: body });
  });
  const lease = page.waitForResponse((response) => response.url().endsWith(`${GOALS}/${target.id}/start-editing`));
  await page.goto(`/education/goals/${target.id}/edit`);
  expect((await lease).status()).toBe(200);
  await expect(page.getByText('Bạn chỉ lập, sửa được kế hoạch năm học của nhóm tuổi mình phụ trách.', { exact: true })).toBeVisible();
  await expect(page.locator('#desc')).toHaveCount(0);
  await expect(page.getByRole('button', { name: /Lấy từ kế hoạch có sẵn/ })).toHaveCount(0);
  expect(logicalRows(await read(target.id))).toEqual(logicalRows(targetBefore));
});

test('EDU-24 open portal refuses import when the target lease is lost', async ({ page }) => {
  const dialog = await openEditor(page);
  await selectFirst(dialog);
  await page.route(`**/education-plans/goals/${target.id}/editing-heartbeat`, (route) =>
    route.fulfill({
      status: 403,
      json: { code: 403, desc: 'Mất quyền sửa kiểm thử', data: null },
    }),
  );
  await page.evaluate(() => window.dispatchEvent(new Event('online')));
  await expect(page.locator('main')).toContainText('Mất quyền sửa kiểm thử');
  await confirm(dialog).click();
  await expect(dialog).toContainText('Chưa thêm được mục tiêu');
  expect(logicalRows(await read(target.id))).toEqual(logicalRows(targetBefore));
});

for (const change of ['revision', 'status', 'selected ID']) {
  test(`EDU-24 confirmation rejects changed source ${change} and clears selection`, async ({ page }) => {
    const dialog = await openEditor(page);
    await selectFirst(dialog);
    const changed = structuredClone(source);
    if (change === 'revision') changed.revision++;
    else if (change === 'status') changed.status = 'APPROVED';
    else
      changed.domains[0].rows = changed.domains[0].rows.filter(
        (row) => row.id !== source.domains[0].rows.find((row) => row.kind === 'goal').id,
      );
    await page.route(sourceRoute(), (route) => route.fulfill({ json: envelope(changed) }));
    await confirm(dialog).click();
    await expect(dialog).toContainText('Kế hoạch nguồn đã thay đổi');
    await expect(confirm(dialog)).toBeDisabled();
    expect(logicalRows(await read(target.id))).toEqual(logicalRows(targetBefore));
  });
}

for (const failure of [403, 404, 'network']) {
  test(`EDU-24 source ${failure} preserves form and supports explicit retry`, async ({ page }) => {
    const dialog = await openEditor(page);
    await selectFirst(dialog);
    await page.route(sourceRoute(), (route) =>
      failure === 'network'
        ? route.abort('failed')
        : route.fulfill({ status: failure, json: { code: failure, desc: `Nguồn kiểm thử ${failure}`, data: null } }),
    );
    await confirm(dialog).click();
    await expect(dialog).toContainText(failure === 'network' ? 'Không thể kết nối máy chủ' : `Nguồn kiểm thử ${failure}`);
    await expect(confirm(dialog)).toBeEnabled();
    await page.unroute(sourceRoute());
    await confirm(dialog).click();
    await expect(dialog).toBeHidden();
    await expect(saveStatus(page)).toHaveText('Có thay đổi chưa lưu');
    expect(logicalRows(await read(target.id))).toEqual(logicalRows(targetBefore));
  });
}

for (const action of ['filter', 'close']) {
  test(`EDU-24 late confirmation after ${action} cannot import`, async ({ page }) => {
    const dialog = await openEditor(page);
    await selectFirst(dialog);
    const delayed = await delayedFresh(page);
    await confirm(dialog).click();
    await delayed.started;
    if (action === 'filter') await dialog.locator('#imp-year').selectOption(uiYear(targetYear));
    else await dialog.getByRole('button', { name: 'Hủy', exact: true }).click();
    delayed.release();
    if (action === 'filter') {
      await expect(confirm(dialog)).toBeDisabled();
      await dialog.getByRole('button', { name: 'Hủy', exact: true }).click();
    }
    await expect(dialog).toBeHidden();
    await expect(saveStatus(page)).not.toHaveText('Có thay đổi chưa lưu');
    expect(logicalRows(await read(target.id))).toEqual(logicalRows(targetBefore));
  });
}

test('EDU-24 200 goals select within one second and remain usable at 390/768/1440px', async ({ page }) => {
  const dialog = await openEditor(page);
  const large = structuredClone(source);
  large.domains = [
    {
      ...source.domains[0],
      rows: Array.from({ length: 200 }, (_, i) => ({
        id: 900000 + i,
        kind: 'goal',
        goalNo: i + 1,
        text: `Mục tiêu tổng hợp ${i}`,
        contents: [{ id: 910000 + i, text: `Nội dung tổng hợp ${i}`, themeIds: [] }],
      })),
    },
  ];
  await dialog.getByRole('button', { name: 'Hủy', exact: true }).click();
  await page.route(sourceRoute(), (route) => route.fulfill({ json: envelope(large) }));
  await page.getByRole('button', { name: /Lấy từ kế hoạch có sẵn/ }).click();
  await dialog.locator('#imp-year').selectOption(uiYear(sourceYear));
  await dialog.locator('#imp-age').selectOption(sourceGroup.code);
  await dialog.locator('#imp-src').selectOption(String(source.id));
  await expect(childChecks(dialog)).toHaveCount(200);
  const start = performance.now();
  await dialog.getByRole('button', { name: 'Chọn tất cả', exact: true }).click();
  await expect(dialog.getByText('Đã chọn 200/200 mục tiêu', { exact: true })).toBeVisible();
  expect(performance.now() - start).toBeLessThan(1000);
  for (const width of [390, 768, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    await expect(dialog.locator('#imp-year')).toBeVisible();
    const box = await dialog.boundingBox();
    expect(box.x).toBeGreaterThanOrEqual(0);
    expect(box.x + box.width).toBeLessThanOrEqual(width + 1);
    await expect(dialog.getByRole('button', { name: 'Hủy', exact: true })).toBeInViewport();
  }
});

test('EDU-24/22 double confirm imports once; only manual Save persists hierarchy and preserves themes/breaks/ticks', async ({ page }) => {
  const dialog = await openEditor(page);
  await dialog.getByRole('button', { name: 'Chọn tất cả', exact: true }).click();
  const writes = [];
  page.on('request', (request) => {
    if (request.method() === 'PUT' && request.url().endsWith(`${GOALS}/${target.id}`)) writes.push(request);
    if (request.method() === 'POST' && request.url().endsWith(GOALS)) writes.push(request);
  });
  const delayed = await delayedFresh(page);
  await confirm(dialog).dispatchEvent('click');
  await delayed.started;
  await dialog.getByRole('button', { name: 'Đang kiểm tra…' }).dispatchEvent('click');
  expect(delayed.count()).toBe(1);
  delayed.release();
  await expect(dialog).toBeHidden();
  await expect(saveStatus(page)).toHaveText('Có thay đổi chưa lưu');
  expect(writes).toHaveLength(0);
  expect(logicalRows(await read(target.id))).toEqual(logicalRows(targetBefore));
  const saveRoute = `**/education-plans/goals/${target.id}`;
  await page.route(saveRoute, (route) =>
    route.request().method() === 'PUT'
      ? route.fulfill({ status: 500, json: { code: 500, desc: 'Lỗi lưu kiểm thử', data: null } })
      : route.continue(),
  );
  await page.keyboard.press('Control+s');
  await expect(saveStatus(page)).toHaveText('Chưa lưu được');
  expect(logicalRows(await read(target.id))).toEqual(logicalRows(targetBefore));
  await page.unroute(saveRoute);
  await page.keyboard.press('Control+s');
  await expect(saveStatus(page)).toHaveText(/Đã lưu lúc/);
  expect(writes).toHaveLength(2);
  const saved = await read(target.id);
  expect(saved.themes).toEqual(targetBefore.themes);
  expect(saved.breaks).toEqual(targetBefore.breaks);
  for (const domain of saved.domains) {
    const oldRows = targetBefore.domains.find((item) => item.name === domain.name)?.rows || [];
    const copiedRows = source.domains.find((item) => item.name === domain.name)?.rows || [];
    expect(logicalRows({ domains: [domain] })).toEqual(
      logicalRows({ domains: [{ name: domain.name, rows: [...oldRows, ...copiedRows] }] }),
    );
  }
  const oldGoal = saved.domains[0].rows.find((row) => row.id === targetBefore.domains[0].rows.find((row) => row.kind === 'goal').id);
  expect(oldGoal.contents).toEqual(targetBefore.domains[0].rows.find((row) => row.kind === 'goal').contents);
  const imported = saved.domains.flatMap((domain) => domain.rows.filter((row) => row.kind === 'goal' && row.text.startsWith('Nguồn')));
  expect(imported).toHaveLength(10);
  const sourceRowIds = new Set(source.domains.flatMap((domain) => domain.rows.map((row) => row.id)));
  const sourceContentIds = new Set(
    source.domains.flatMap((domain) => domain.rows.flatMap((row) => (row.contents || []).map((item) => item.id))),
  );
  for (const row of imported) {
    expect(sourceRowIds.has(row.id)).toBe(false);
    for (const content of row.contents) {
      expect(sourceContentIds.has(content.id)).toBe(false);
      expect(content.themeIds).toEqual([]);
    }
  }
  expect(logicalRows(await read(source.id))).toEqual(logicalRows(source));
  const reopenedRows = logicalRows(saved);
  await page.goto('/');
  await page.goto(`/education/goals/${target.id}/edit`);
  await expect(page.locator('#desc')).toBeEditable();
  await page.getByRole('button', { name: 'Tiếp theo', exact: true }).click();
  await expect.poll(() => page.locator('textarea').evaluateAll((nodes) => nodes.map((node) => node.value))).toContain('Nguồn mục tiêu 0-0');
  await expect(page.getByRole('button', { name: 'Lưu', exact: true })).toBeDisabled();
  await page.keyboard.press('Control+s');
  await expect(saveStatus(page)).not.toHaveText('Có thay đổi chưa lưu');
  expect(logicalRows(await read(target.id))).toEqual(reopenedRows);
  expect(writes).toHaveLength(2);
  await page.goto('/');
});

test('EDU-43 lấy chủ đề, đợt nghỉ từ kế hoạch khác năm/nhóm tuổi: dời ngày theo năm, bỏ dòng đã có, chỉ lưu khi bấm Lưu', async ({
  page,
}) => {
  const shift = Number(targetYear.name.slice(0, 4)) - Number(sourceYear.name.slice(0, 4));
  const moved = (date) => `${Number(date.slice(0, 4)) + shift}${date.slice(4)}`;
  const vn = (date) => date.split('-').reverse().join('/');
  await login(page, USERS.vp);
  await page.goto(`/education/goals/${target.id}/edit`);
  await expect(page.locator('#desc')).toBeEditable();
  await page.getByRole('button', { name: 'Tiếp theo', exact: true }).click();
  await page.getByRole('tab', { name: /Chủ đề và sự kiện/ }).click();
  await page.getByRole('button', { name: /Lấy chủ đề từ kế hoạch có sẵn/ }).click();
  const dialog = page.getByRole('dialog', { name: 'Lấy chủ đề từ kế hoạch có sẵn' });
  await dialog.locator('#imt-year').selectOption(uiYear(sourceYear));
  await dialog.locator('#imt-age').selectOption(sourceGroup.code);
  await dialog.locator('#imt-src').selectOption(String(source.id));
  await expect(dialog.getByRole('checkbox')).toHaveCount(2);
  await expect(dialog.getByRole('button', { name: /^Thêm.*dòng$/ })).toBeDisabled();
  await dialog.getByRole('button', { name: 'Chọn tất cả', exact: true }).click();
  await expect(dialog.getByText('Đã chọn 2/2 dòng', { exact: true })).toBeVisible();
  await dialog.getByRole('button', { name: 'Thêm 2 dòng' }).click();
  await expect(dialog).toBeHidden();
  const n = targetBefore.themes.length + 1;
  await expect(page.getByLabel(`Tên chủ đề ${n}`)).toHaveValue('Nguồn chủ đề riêng');
  await expect(page.getByLabel(`Viết tắt chủ đề ${n}`)).toHaveValue('Nguồn');
  const start = moved(source.themes[0].startDate);
  await expect
    .poll(() => page.locator('main input, main button').evaluateAll((els) => els.map((el) => el.value || el.textContent || '')))
    .toEqual(expect.arrayContaining([expect.stringMatching(new RegExp(`${start}|${vn(start)}`))]));
  // Chưa bấm Lưu thì hệ thống chưa đổi
  expect((await read(target.id)).themes).toHaveLength(targetBefore.themes.length);

  // Lấy lần hai: dòng đã có bị khóa, không thêm trùng
  await page.getByRole('button', { name: /Lấy chủ đề từ kế hoạch có sẵn/ }).click();
  await dialog.locator('#imt-year').selectOption(uiYear(sourceYear));
  await dialog.locator('#imt-age').selectOption(sourceGroup.code);
  await dialog.locator('#imt-src').selectOption(String(source.id));
  await expect(dialog.getByText('Đã có')).toHaveCount(2);
  await expect(dialog.getByRole('button', { name: 'Chọn tất cả', exact: true })).toBeDisabled();
  await dialog.getByRole('button', { name: 'Hủy', exact: true }).click();

  await page.keyboard.press('Control+s');
  await expect(saveStatus(page)).toHaveText(/Đã lưu lúc \d\d:\d\d/);
  const saved = await read(target.id);
  const theme = saved.themes.find((t) => t.name === 'Nguồn chủ đề riêng');
  expect(theme).toMatchObject({ abbr: 'Nguồn', startDate: start, endDate: moved(source.themes[0].endDate) });
  const brk = saved.breaks.find((b) => b.label === 'Nguồn nghỉ riêng');
  expect(brk).toMatchObject({ startDate: moved(source.breaks[0].startDate), endDate: moved(source.breaks[0].endDate) });
  // Không chép dấu tích chủ đề của kế hoạch nguồn
  const ticked = saved.domains.flatMap((d) => d.rows.flatMap((r) => (r.contents || []).flatMap((c) => c.themeIds || [])));
  expect(ticked).not.toContain(theme.id);
  await page.goto('/');
});

test('EDU-06/43 Tổ trưởng: nhóm tuổi khác chỉ thấy bản đã ban hành (chỉ đọc) và lấy được chủ đề từ đó', async ({ page }) => {
  const teacher1 = Number(sql(`select id from user_accounts where username = 'teacher1'`));
  sql(
    `insert into staff_assignments (user_id, staff_role, age_group_id, valid_from) values (${teacher1}, 'AGE_GROUP_TEAM_LEADER', ${Number(target.ageGroupId)}, '${E2E.markerDate}')`,
  );
  suspendOtherTeamLeads('teacher1');
  try {
    const listOf = async () =>
      (await api(USERS.teacher1, 'GET', `${GOALS}?ageGroupId=${sourceGroup.id}&page=0&size=200`)).data.items.map((p) => p.id);
    // Bản nháp của nhóm khác: không thấy trong danh sách, đọc chi tiết bị 403
    expect(await listOf()).not.toContain(source.id);
    expect((await api(USERS.teacher1, 'GET', `${GOALS}/${source.id}`)).status).toBe(403);
    sql(`update edu_year_plans set status = 'APPROVED' where id = ${Number(source.id)} and title like '${marker}%'`);
    expect(await listOf()).toContain(source.id);
    const seen = await api(USERS.teacher1, 'GET', `${GOALS}/${source.id}`);
    expect(seen.status).toBe(200);
    expect(seen.data.permissions.canEdit).toBe(false);
    expect(
      (await api(USERS.teacher1, 'POST', `${GOALS}/${source.id}/start-editing`, { headers: editHeaders(newSession(), seen.data.revision) }))
        .status,
    ).toBe(403);

    await login(page, USERS.teacher1);
    await page.goto(`/education/goals/${target.id}/edit`);
    await expect(page.locator('#desc')).toBeEditable();
    await page.getByRole('button', { name: 'Tiếp theo', exact: true }).click();
    await page.getByRole('tab', { name: /Chủ đề và sự kiện/ }).click();
    await page.getByRole('button', { name: /Lấy chủ đề từ kế hoạch có sẵn/ }).click();
    const dialog = page.getByRole('dialog', { name: 'Lấy chủ đề từ kế hoạch có sẵn' });
    await dialog.locator('#imt-year').selectOption(uiYear(sourceYear));
    await dialog.locator('#imt-age').selectOption(sourceGroup.code);
    await dialog.locator('#imt-src').selectOption(String(source.id));
    // Tổ trưởng đọc được bản đã ban hành của nhóm khác trong hộp chọn; chủ đề, đợt nghỉ đã lấy ở bước EDU-43 nên hiện "Đã có"
    await expect(dialog.getByRole('checkbox')).toHaveCount(2);
    await expect(dialog.getByText('Nguồn chủ đề riêng')).toBeVisible();
    await expect(dialog.getByText('Đã có')).toHaveCount(2);
    await dialog.getByRole('button', { name: 'Hủy', exact: true }).click();
    await expect(dialog).toBeHidden();
    await page.goto('/');
  } finally {
    cleanup();
  }
});

test('EDU-46 nhập file Word bảng mục tiêu: xem trước, Hủy không đổi, Thêm giữ dấu tích khớp viết tắt, chỉ lưu khi bấm Lưu', async ({
  page,
}) => {
  const domainName = config.domains.filter((domain) => domain.standard !== false)[0].name;
  const goalText = `${marker} mục tiêu từ file`;
  const docx = goalTableDocx([
    [
      { text: 'STT', merge: 'restart' },
      { text: 'Mục tiêu giáo dục năm', merge: 'restart' },
      { text: 'Nội dung giáo dục năm', merge: 'restart' },
      { text: 'Chủ đề thực hiện', span: 2 },
    ],
    [{ merge: 'continue' }, { merge: 'continue' }, { merge: 'continue' }, 'Đích', 'ZZZ'],
    ['', { text: `I. Giáo dục ${domainName}`, span: 2 }, '', ''],
    [{ text: '1', merge: 'restart' }, { text: `1. ${goalText}`, merge: 'restart' }, '- Nội dung file 1', 'x', ''],
    [{ merge: 'continue' }, { merge: 'continue' }, '- Nội dung file 2', '', 'x'],
  ]);
  const wordFile = {
    name: 'bang-muc-tieu.docx',
    mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    buffer: docx,
  };
  const values = () => page.locator('textarea').evaluateAll((els) => els.map((el) => el.value));
  const dialog = page.getByRole('dialog', { name: 'Nhập file mục tiêu' });
  const choose = async (file) => {
    await page.getByRole('button', { name: 'Nhập file', exact: true }).click();
    await dialog.locator('input[type="file"]').setInputFiles(file);
  };

  await login(page, USERS.vp);
  await page.goto(`/education/goals/${target.id}/edit`);
  await expect(page.locator('#desc')).toBeEditable();
  await page.getByRole('button', { name: 'Tiếp theo', exact: true }).click();

  // .doc hỏng bị từ chối; .doc nhị phân hợp lệ được kiểm riêng bên dưới.
  await choose({ name: 'cu.doc', mimeType: 'application/msword', buffer: Buffer.from([0xd0, 0xcf, 0x11, 0xe0, 0, 0, 0, 0]) });
  await expect(dialog).toContainText('Không đọc được file');
  await expect(dialog.getByRole('button', { name: /^Thêm.*mục tiêu$/ })).toBeDisabled();
  await dialog.getByRole('button', { name: 'Hủy', exact: true }).click();

  // Xem trước rồi Hủy: bảng không đổi
  await choose(wordFile);
  await expect(dialog).toContainText('bang-muc-tieu.docx');
  await expect(dialog).toContainText('Chưa có chủ đề ZZZ');
  await dialog.getByRole('button', { name: 'Hủy', exact: true }).click();
  await expect(dialog).toBeHidden();
  expect(await values()).not.toContain(goalText);

  // Thêm: có trong bảng, chưa ghi lên hệ thống tới khi Lưu
  await choose(wordFile);
  await dialog.getByRole('button', { name: 'Thêm 1 mục tiêu', exact: true }).click();
  await expect(dialog).toBeHidden();
  await expect.poll(values).toContain(goalText);
  await expect(saveStatus(page)).toHaveText('Có thay đổi chưa lưu');
  expect(logicalRows(await read(target.id)).some((row) => row.text === goalText)).toBe(false);

  // Nhập lại cùng file: mục tiêu trùng câu được bỏ qua
  await choose(wordFile);
  await dialog.getByRole('button', { name: 'Thêm 1 mục tiêu', exact: true }).click();
  await expect.poll(async () => (await values()).filter((v) => v === goalText).length).toBe(1);

  await page.keyboard.press('Control+s');
  await expect(saveStatus(page)).toHaveText(/Đã lưu lúc \d\d:\d\d/);
  const saved = await read(target.id);
  const theme = saved.themes.find((t) => t.abbr === 'Đích');
  const row = saved.domains.flatMap((d) => d.rows).find((r) => r.text === goalText);
  expect(row.contents.map((c) => c.text)).toEqual(['Nội dung file 1', 'Nội dung file 2']);
  expect(row.contents[0].themeIds || []).toEqual([theme.id]);
  expect(row.contents[1].themeIds || []).toEqual([]);
  await page.goto('/');
});

test('EDU-46 .doc nhị phân ở bước 2: xem trước/Hủy, thêm/bỏ trùng, lưu và mở lại', async ({ page }) => {
  const fixture = fileURLToPath(new URL('../fixtures/goals-merged.doc', import.meta.url));
  const goalText = 'Trẻ thực hiện vận động';
  const before = await read(target.id);
  await login(page, USERS.vp);
  await page.goto(`/education/goals/${target.id}/edit`);
  await expect(page.locator('#desc')).toBeEditable();
  await page.getByRole('button', { name: 'Tiếp theo', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Nhập file mục tiêu', exact: true });
  const choose = async () => {
    await page.getByRole('button', { name: 'Nhập file', exact: true }).click();
    const response = page.waitForResponse((res) => res.url().endsWith('/education-plans/goals/file-preview'));
    await dialog.locator('input[type=file]').setInputFiles(fixture);
    expect((await response).status()).toBe(200);
    await expect(dialog.getByRole('button', { name: 'Thêm 2 mục tiêu', exact: true })).toBeEnabled();
  };
  await choose();
  await dialog.getByRole('button', { name: 'Hủy', exact: true }).click();
  expect(logicalRows(await read(target.id))).toEqual(logicalRows(before));
  await choose();
  await dialog.getByRole('button', { name: 'Thêm 2 mục tiêu', exact: true }).click();
  await expect.poll(() => page.locator('textarea').evaluateAll((els) => els.map((el) => el.value))).toContain(goalText);
  expect(logicalRows(await read(target.id))).toEqual(logicalRows(before));
  await choose();
  await dialog.getByRole('button', { name: 'Thêm 2 mục tiêu', exact: true }).click();
  await expect
    .poll(() => page.locator('textarea').evaluateAll((els) => els.filter((el) => el.value === 'Trẻ thực hiện vận động').length))
    .toBe(1);
  await page.keyboard.press('Control+s');
  await expect(saveStatus(page)).toHaveText(/Đã lưu lúc/);
  const saved = await read(target.id);
  const imported = saved.domains.flatMap((domain) => domain.rows).find((row) => row.text === goalText);
  expect(imported.contents.map((content) => content.text)).toEqual(['Tập động tác', 'Đi bước dồn']);
  expect(saved.themes).toEqual(before.themes);
  expect(saved.breaks).toEqual(before.breaks);
  await page.goto('/');
  await page.goto(`/education/goals/${target.id}/edit`);
  await expect(page.locator('#desc')).toBeEditable();
  await page.getByRole('button', { name: 'Tiếp theo', exact: true }).click();
  await expect.poll(() => page.locator('textarea').evaluateAll((els) => els.map((el) => el.value))).toContain(goalText);
  await page.goto('/');
});
