import { test, expect } from '@playwright/test';
import { randomUUID } from 'node:crypto';
import { api, USERS, beReachable, editHeaders, newSession } from '../support/realBe.mjs';
import { login, saveStatus } from '../support/ui.mjs';

test.setTimeout(120_000);
const GOALS = '/education-plans/goals';
const marker = `[E2E-SUB-${randomUUID().slice(0, 8)}]`;
let ownedId;
const read = async () => {
  const result = await api(USERS.vp, 'GET', `${GOALS}/${ownedId}`);
  expect(result.status, result.desc).toBe(200);
  return result.data;
};

test.afterAll(async () => {
  if (!ownedId) return;
  const detail = await read();
  expect(detail.title.startsWith(marker), 'Chỉ dọn kế hoạch do test này tạo').toBe(true);
  const session = newSession();
  const lease = await api(USERS.vp, 'POST', `${GOALS}/${ownedId}/start-editing`, { headers: editHeaders(session, detail.revision) });
  expect(lease.status, lease.desc).toBe(200);
  const result = await api(USERS.vp, 'DELETE', `${GOALS}/${ownedId}`, { headers: editHeaders(session, lease.data.revision) });
  expect([200, 204], result.desc).toContain(result.status);
});

test('EDU-48 xóa cả nhánh, lưu/mở lại BE thật và Lĩnh vực ellipsis', async ({ page }, testInfo) => {
  expect(await beReachable(), 'Cần BE thật và Keycloak').toBe(true);
  const cfg = await api(USERS.vp, 'GET', '/education-plans/config');
  expect(cfg.status, cfg.desc).toBe(200);
  const config = cfg.data;
  const occupied = new Set();
  let current = 0;
  let pages;
  do {
    const list = await api(USERS.vp, 'GET', `${GOALS}?page=${current}&size=200`);
    expect(list.status, list.desc).toBe(200);
    list.data.items.forEach((p) => occupied.add(`${p.schoolYearId}:${p.ageGroupId}`));
    pages = list.data.totalPages;
    current++;
  } while (current < pages);
  const slot = config.schoolYears.flatMap((year) =>
    config.ageGroups.filter((group) => !occupied.has(`${year.id}:${group.id}`)).map((group) => ({ year, group })),
  )[0];
  expect(slot, 'Cần một cặp năm/nhóm trống; không xóa dữ liệu có sẵn để lấy chỗ').toBeTruthy();
  const content = (text, themeKeys = ['a']) => ({ text, themeKeys });
  const body = {
    schoolYearId: slot.year.id,
    ageGroupId: slot.group.id,
    title: `${marker} Xóa nhánh`,
    description: 'Dữ liệu kiểm thử tổng hợp EDU-48',
    domains: [
      {
        domainId: config.domains.find((d) => d.standard !== false).id,
        rows: [
          { kind: 'sub', text: 'Nhánh cần xóa', contents: [] },
          { kind: 'goal', text: 'Mục tiêu trực tiếp cần xóa', contents: [content('Nội dung trực tiếp')] },
          { kind: 'group', text: 'Nhóm cần xóa 1', contents: [] },
          { kind: 'goal', text: 'Mục tiêu cần xóa 1', contents: [content('Nội dung 1', ['a', 'b']), content('Nội dung 2')] },
          { kind: 'group', text: 'Nhóm cần xóa 2', contents: [] },
          { kind: 'goal', text: 'Mục tiêu cần xóa 2', contents: [content('Nội dung 3', ['b'])] },
          { kind: 'sub', text: 'Nhánh giữ nguyên', contents: [] },
          { kind: 'group', text: 'Nhóm giữ nguyên', contents: [] },
          { kind: 'goal', text: 'Mục tiêu giữ nguyên', contents: [content('Nội dung giữ nguyên')] },
        ],
      },
    ],
    themes: ['a', 'b'].map((key) => ({
      key,
      name: `Chủ đề thử ${key}`,
      abbr: key.toUpperCase(),
      startDate: slot.year.startDate,
      endDate: slot.year.startDate,
      festivals: '',
      note: '',
    })),
    breaks: [{ label: 'Đợt nghỉ thử', startDate: slot.year.startDate, endDate: slot.year.startDate }],
  };
  const session = newSession();
  const created = await api(USERS.vp, 'POST', GOALS, { body, headers: editHeaders(session, 0) });
  expect(created.status, created.desc).toBe(201);
  ownedId = created.data.id;
  const finish = await api(USERS.vp, 'POST', `${GOALS}/${ownedId}/finish-editing`, {
    headers: editHeaders(session, created.data.revision),
  });
  expect(finish.status, finish.desc).toBe(200);
  const before = await read();
  await login(page, USERS.vp);
  await page.goto(`/education/goals/${ownedId}/edit`);
  await expect(page.locator('#desc')).toBeEditable();
  let writes = 0;
  page.on('request', (request) => {
    if (request.method() === 'PUT' && request.url().endsWith(`${GOALS}/${ownedId}`)) writes++;
  });
  const remove = page.getByRole('button', { name: 'Xóa lĩnh vực con 1', exact: true });
  await remove.click();
  const dialog = page.getByRole('dialog', { name: 'Xóa lĩnh vực con', exact: true });
  await expect(dialog).toContainText('Xóa lĩnh vực con 1');
  for (const label of ['2 nhóm kết quả mong đợi', '3 mục tiêu', '4 nội dung', '5 dấu tích chủ đề'])
    await expect(dialog).toContainText(label);
  await dialog.getByRole('button', { name: 'Quay lại', exact: true }).click();
  expect((await read()).domains).toEqual(before.domains);
  await expect(remove).toBeVisible();
  await remove.click();
  await dialog.getByRole('button', { name: 'Xóa', exact: true }).click();
  const values = () => page.locator('textarea').evaluateAll((nodes) => nodes.map((node) => node.value));
  await expect.poll(values).not.toContain('Mục tiêu cần xóa 1');
  await expect.poll(values).not.toContain('Mục tiêu trực tiếp cần xóa');
  await expect.poll(values).toContain('Mục tiêu giữ nguyên');
  expect(writes).toBe(0);
  expect((await read()).domains).toEqual(before.domains);
  await page.keyboard.press('Control+s');
  await expect(saveStatus(page)).toHaveText(/Đã lưu lúc/);
  const saved = await read();
  expect(saved.domains[0].rows.map((r) => r.text)).toEqual(['Nhánh giữ nguyên', 'Nhóm giữ nguyên', 'Mục tiêu giữ nguyên']);
  const kept = before.domains[0].rows.find((r) => r.text === 'Mục tiêu giữ nguyên');
  expect(saved.domains[0].rows[2].id).toBe(kept.id);
  expect(saved.domains[0].rows[2].contents).toEqual(kept.contents);
  expect(saved.domains[0].rows[2].goalNo).toBe(1);
  expect(saved.themes).toEqual(before.themes);
  expect(saved.breaks).toEqual(before.breaks);
  expect(writes).toBe(1);
  await page.goto('/');
  await page.goto(`/education/goals/${ownedId}/edit`);
  await expect.poll(values).toContain('Mục tiêu giữ nguyên');
  await expect.poll(values).not.toContain('Nhánh cần xóa');
  await page.getByRole('button', { name: /Lấy từ Chương trình của Bộ/ }).click();
  await page.getByRole('tab', { name: /Gợi ý nội dung/ }).click();
  const domain = page.getByLabel('Lĩnh vực', { exact: true });
  const longName = 'Phát triển tình cảm và kỹ năng xã hội';
  await domain.selectOption(longName);
  for (const width of [360, 390, 768, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    await expect(domain).toHaveCSS('white-space', 'nowrap');
    await expect(domain).toHaveCSS('text-overflow', 'ellipsis');
    await expect(domain).toHaveAttribute('title', longName);
    await expect(domain).toHaveValue(longName);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.locator('.ga-cur-modal').screenshot({ path: testInfo.outputPath(`domain-${width}.png`) });
  }
  await page.locator('.ga-cur-modal .modal__footer').getByRole('button', { name: 'Đóng', exact: true }).click();
  await page.goto('/');
});
