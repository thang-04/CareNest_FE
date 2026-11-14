import { expect } from '@playwright/test';
import { devPassword } from './realBe.mjs';

export async function login(page, email, pw = devPassword()) {
  await page.goto('/login');
  await page.getByPlaceholder(/SĐT hoặc email|ten@carenest\.edu\.vn/).fill(email);
  await page.getByPlaceholder('Nhập mật khẩu').fill(pw);
  await page.getByRole('button', { name: 'Đăng nhập' }).click();
  await page.waitForURL((u) => !u.pathname.startsWith('/login'), { timeout: 30_000 });
}

/** Năm học chọn ở header chỉ giữ trong phiên SPA ⇒ chọn rồi điều hướng trong app (spaGo), không page.goto. */
export async function pickYear(page, name) {
  const text = name.replace('-', ' - ');
  const select = page
    .locator('select')
    .filter({ has: page.locator('option', { hasText: text }) })
    .first();
  const value = await select.locator('option', { hasText: text }).first().getAttribute('value');
  await select.selectOption(value);
}

export async function spaGo(page, path) {
  await page.evaluate((to) => {
    window.history.pushState({}, '', to);
    window.dispatchEvent(new PopStateEvent('popstate'));
  }, path);
  await page.waitForURL((u) => u.pathname + u.search === path);
}

// Trạng thái lưu cạnh nút Lưu (đầu trang)
export const saveStatus = (page) => page.locator('.page__head .muted.text-sm, .ga-sticky-head .muted.text-sm').first();

export async function expectNoAutosaveWording(page) {
  await expect(page.locator('body')).not.toContainText(/Tự động lưu|lưu tạm|trên máy|tự lưu/i);
}

export const storageKeys = (page, part) => page.evaluate((p) => Object.keys(localStorage).filter((k) => k.includes(p)), part);

/** Bấm nút hành động duyệt (ReviewActions) rồi xác nhận trong hộp; note cho Trả lại. */
export async function review(page, button, confirm, note) {
  await clickAction(page, button);
  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible();
  if (note !== undefined) await dialog.locator('#review-note').fill(note);
  await dialog.getByRole('button', { name: confirm, exact: true }).click();
}

/** Bấm thao tác: nút hiện sẵn, không có thì mở nút "Thao tác" rồi chọn mục (Tiền 14/11/2026 gom thao tác vào menu). */
export async function clickAction(page, name, scope = page) {
  const exact = typeof name === 'string';
  const btn = scope.getByRole('button', { name, exact });
  const menu = scope.getByRole('button', { name: 'Thao tác', exact: true });
  // Chờ trang hiện nút đích hoặc nút "Thao tác" rồi mới chọn (đếm ngay lúc trang chưa tải xong sẽ sai)
  await btn.or(menu).first().waitFor({ timeout: 30_000 });
  if (await btn.count()) return btn.first().click();
  await menu.first().click();
  await page.getByRole('menuitem', { name, exact }).click();
}

/** Số thao tác tên `name` đang có (nút hiện sẵn hoặc mục trong nút "Thao tác"); đóng menu sau khi đếm. */
export async function actionCount(page, name, scope = page) {
  const exact = typeof name === 'string';
  const shown = await scope.getByRole('button', { name, exact }).count();
  const menu = scope.getByRole('button', { name: 'Thao tác', exact: true }).first();
  if (shown || !(await menu.count())) return shown;
  await menu.click();
  const n = await page.getByRole('menuitem', { name, exact }).count();
  await page.keyboard.press('Escape');
  return n;
}
