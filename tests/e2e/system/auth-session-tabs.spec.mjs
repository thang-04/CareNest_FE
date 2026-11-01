import { test, expect } from '@playwright/test';
import { USERS, beReachable, devPassword } from '../support/realBe.mjs';
import { spaGo } from '../support/ui.mjs';

// FE-BUG-261028-keycloak-dev-token-expiry: tab mở bằng link mang bản sao sessionStorage (không "Ghi nhớ") ⇒ hai tab cùng
// refresh token; tab làm mới sau dùng lại token đã dùng ⇒ Keycloak hủy cả phiên. Code cũ: bị đẩy ra trang đăng nhập.
test('ST-16 hai tab cùng phiên làm mới token không bị đăng xuất', async ({ page, context }) => {
  test.skip(!(await beReachable()), 'BE thật không chạy');
  await page.goto('/login');
  await page.getByPlaceholder('ten@carenest.edu.vn').fill(USERS.teacher1);
  await page.getByPlaceholder('Nhập mật khẩu').fill(devPassword());
  await page.locator('input[type=checkbox]').first().uncheck();
  await page.getByRole('button', { name: 'Đăng nhập' }).click();
  await page.waitForURL((u) => !u.pathname.startsWith('/login'), { timeout: 30_000 });
  expect(await page.evaluate(() => !!sessionStorage.getItem('carenest.kcRefreshToken'))).toBe(true);
  const [tabB] = await Promise.all([context.waitForEvent('page'), page.evaluate(() => window.open('/education/goals', '_blank'))]);
  await tabB.waitForLoadState();
  await expect(tabB).not.toHaveURL(/\/login/);
  const expire = (p) => p.evaluate(() => sessionStorage.setItem('carenest.kcAccessExp', String(Date.now() - 1000)));
  await expire(page);
  await expire(tabB);
  await spaGo(page, '/education/class');
  await page.waitForTimeout(1500);
  await spaGo(tabB, '/education/branches');
  await tabB.waitForTimeout(1500);
  for (const p of [page, tabB]) {
    await p.reload();
    await p.waitForTimeout(1500);
    await expect(p).not.toHaveURL(/\/login/);
  }
  const rt = (p) => p.evaluate(() => sessionStorage.getItem('carenest.kcRefreshToken'));
  expect(await rt(page)).toBe(await rt(tabB));
});
