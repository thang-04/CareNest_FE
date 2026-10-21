import assert from 'node:assert/strict';
import { test } from 'node:test';
import { modalStack, trapTabIndex } from '../../src/components/ui/modalStack.js';

test('modal lồng nhau: chỉ modal mở sau cùng là trên cùng, đóng nó thì modal dưới lên trên', () => {
  const lower = {};
  const upper = {};
  modalStack.push(lower);
  modalStack.push(upper);
  assert.equal(modalStack.isTop(upper), true);
  assert.equal(modalStack.isTop(lower), false);
  modalStack.remove(upper);
  assert.equal(modalStack.isTop(lower), true);
  modalStack.remove(lower);
  assert.equal(modalStack.size(), 0);
});

test('đóng modal dưới trước (không theo thứ tự) vẫn giữ đúng modal trên cùng', () => {
  const a = {};
  const b = {};
  modalStack.push(a);
  modalStack.push(b);
  modalStack.remove(a);
  assert.equal(modalStack.isTop(b), true);
  modalStack.remove(b);
  assert.equal(modalStack.isTop(b), false);
});

test('Tab ở phần tử cuối quay về đầu, Shift+Tab ở đầu sang cuối', () => {
  assert.equal(trapTabIndex(3, 2, false), 0);
  assert.equal(trapTabIndex(3, 0, true), 2);
});

test('Tab giữa vùng để trình duyệt tự chuyển', () => {
  assert.equal(trapTabIndex(3, 1, false), null);
  assert.equal(trapTabIndex(3, 1, true), null);
});

test('focus đang ở ngoài modal thì kéo về trong; modal không có phần tử focus được thì giữ ở modal', () => {
  assert.equal(trapTabIndex(3, -1, false), 0);
  assert.equal(trapTabIndex(3, -1, true), 2);
  assert.equal(trapTabIndex(0, -1, false), -1);
});
