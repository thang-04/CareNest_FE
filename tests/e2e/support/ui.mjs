import { expect } from '@playwright/test';
import { devPassword } from './realBe.mjs';

export async function login(page, email, pw = devPassword()) {
  await page.goto('/login');
  await page.getByPlaceholder('ten@carenest.edu.vn').fill(email);
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
  await page.getByRole('button', { name: button, exact: typeof button === 'string' }).first().click();
  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible();
  if (note !== undefined) await dialog.locator('#review-note').fill(note);
  await dialog.getByRole('button', { name: confirm, exact: true }).click();
}
