import assert from 'node:assert/strict';
import { test } from 'node:test';
import { coalesce } from '../../src/hooks/coalesce.js';

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// Trang chủ Hiệu trưởng: dữ liệu giả ghi 13 lần liền khi đọc thực đơn ⇒ chỉ được tải lại một lần
test('nhiều sự kiện "dữ liệu đổi" liền nhau chỉ tải lại một lần', async () => {
  let runs = 0;
  const reload = coalesce(() => (runs += 1), 20);
  for (let i = 0; i < 13; i++) reload.trigger();
  await delay(60);
  assert.equal(runs, 1);
  reload.trigger();
  await delay(60);
  assert.equal(runs, 2);
});

test('rời màn (cancel) thì không tải lại nữa', async () => {
  let runs = 0;
  const reload = coalesce(() => (runs += 1), 20);
  reload.trigger();
  reload.cancel();
  await delay(60);
  assert.equal(runs, 0);
});
