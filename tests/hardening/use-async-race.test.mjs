import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createLatestRequest } from '../../src/hooks/latestRequest.js';

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// Mô phỏng useAsync.run: tải, rồi chỉ ghi state khi còn là lần mới nhất.
const makeRunner = () => {
  const guard = createLatestRequest();
  const state = { data: null, writes: 0 };
  const run = async (loader) => {
    const id = guard.begin();
    const result = await loader();
    if (guard.isLatest(id)) {
      state.data = result;
      state.writes++;
    }
  };
  return { guard, state, run };
};

test('đổi filter nhanh: response cũ về sau không ghi đè dữ liệu của filter mới', async () => {
  const { state, run } = makeRunner();
  const slowOld = run(async () => {
    await delay(30);
    return 'filter-A';
  });
  const fastNew = run(async () => {
    await delay(5);
    return 'filter-B';
  });
  await Promise.all([slowOld, fastNew]);
  assert.equal(state.data, 'filter-B');
  assert.equal(state.writes, 1);
});

test('đổi filter liên tục: chỉ lần gọi cuối được ghi', async () => {
  const { state, run } = makeRunner();
  const runs = [40, 10, 30, 5].map((ms, i) => run(() => delay(ms).then(() => `lan-${i}`)));
  await Promise.all(runs);
  assert.equal(state.data, 'lan-3');
  assert.equal(state.writes, 1);
});

test('unmount: kết quả về sau không ghi state', async () => {
  const { guard, state, run } = makeRunner();
  const pending = run(() => delay(10).then(() => 'muon'));
  guard.unmount();
  await pending;
  assert.equal(state.writes, 0);
});

test('StrictMode mount lại: lần tải sau khi mount lại vẫn ghi được', async () => {
  const { guard, state, run } = makeRunner();
  guard.unmount();
  guard.mount();
  await run(() => delay(1).then(() => 'sau-mount'));
  assert.equal(state.data, 'sau-mount');
});

test('cancel (tắt enabled): lần đang chạy bị bỏ', async () => {
  const { guard, state, run } = makeRunner();
  const pending = run(() => delay(10).then(() => 'cu'));
  guard.cancel();
  await pending;
  assert.equal(state.writes, 0);
});
