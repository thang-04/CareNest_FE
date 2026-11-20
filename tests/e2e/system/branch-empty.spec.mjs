import { test, expect } from '@playwright/test';
import { api } from '../support/realBe.mjs';
import { login, spaGo } from '../support/ui.mjs';

test('ST-BRANCH-EMPTY chọn nhóm có lớp nhưng chưa có kế hoạch tổ', async ({ page }, info) => {
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.stack || error.message));
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text());
  });
  try {
    const config = (await api('principal', 'GET', '/education-plans/config')).data;
    const docs = (await api('principal', 'GET', '/education-plans/class-docs')).data;
    const start = docs.classes[0];
    const original = config.ageGroups.find((g) => g.code === start?.ageGroupId);
    const target = config.ageGroups.find(
      (g) =>
        docs.classes.some((cls) => cls.ageGroupId === g.code) &&
        g.ageFromMonths != null &&
        g.ageToMonths != null &&
        (g.ageFromMonths !== original?.ageFromMonths || g.ageToMonths !== original?.ageToMonths),
    );
    expect(target, 'Cần hai nhóm tuổi có lớp khác khoảng tháng').toBeTruthy();

    // Tạo trạng thái không có kế hoạch tổ cho riêng trình duyệt, giữ nguyên dữ liệu BE.
    await page.route(/\/education-plans\/goals(?:\?|$)/, async (route) => {
      const response = await route.fetch();
      if (!response.ok()) return route.fulfill({ response });
      const json = await response.json();
      if (json.data?.items) json.data.items = json.data.items.filter((p) => String(p.ageGroupId) !== String(target.id));
      await route.fulfill({ response, json });
    });
    await login(page, 'principal');
    await spaGo(page, `/education/branches/${start.id}`);
    const select = page.getByRole('combobox', { name: 'Nhóm tuổi' });
    await expect(select).toBeVisible({ timeout: 30_000 });
    await select.selectOption(target.code);
    await expect(page.getByText('Kế hoạch giáo dục tổ của nhóm tuổi này chưa được ban hành')).toBeVisible();
    await expect(select).toBeVisible();
    await select.selectOption(original.code);
    await expect(select).toHaveValue(original.code);
    expect(errors).toEqual([]);
  } finally {
    await info.attach('browser-errors', { body: errors.join('\n\n') || 'Không có lỗi trình duyệt', contentType: 'text/plain' });
  }
});

test('ST-BRANCH-LIVE đổi qua các nhóm tuổi từ dữ liệu BE thật', async ({ page }, info) => {
  const events = [];
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.stack || error.message));
  page.on('console', (message) => {
    if (message.type() === 'error') events.push(message.text());
  });
  try {
    await login(page, 'viceprincipal');
    await spaGo(page, '/education/branches');
    const select = page.getByRole('combobox', { name: 'Nhóm tuổi' });
    await expect(select).toBeVisible({ timeout: 30_000 });
    const options = await select
      .locator('option')
      .evaluateAll((rows) => rows.filter((o) => o.value).map((o) => ({ label: o.textContent.trim(), value: o.value })));
    expect(options.length).toBeGreaterThan(1);
    const ready = page.getByRole('columnheader', { name: 'Chủ đề nhánh', exact: true });
    const empty = page.getByText('Kế hoạch giáo dục tổ của nhóm tuổi này chưa được ban hành', { exact: true });
    const crash = page.getByRole('heading', { name: 'Hệ thống gặp sự cố', exact: true });
    for (const { label, value } of options) {
      await select.selectOption(value);
      await expect(ready.or(empty).or(crash).first()).toBeVisible({ timeout: 30_000 });
      await expect(crash, errors.join('\n')).toHaveCount(0);
      await expect(select).toHaveValue(value);
      events.push(`${label}: ${(await empty.isVisible()) ? 'chưa có kế hoạch tổ' : 'có bảng chủ đề nhánh'}`);
    }
    expect(errors).toEqual([]);
  } finally {
    await info.attach('branch-live-diagnostics', { body: [...events, ...errors].join('\n\n'), contentType: 'text/plain' });
  }
});
