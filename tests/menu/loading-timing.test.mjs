import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { mock, test } from 'node:test';
import { LOADING_MIN_VISIBLE_MS, LOADING_REVEAL_MS, beginLoading, endLoading, loadingHoldMs } from '../../src/hooks/loadingTiming.js';

const SRC = new URL('../../src/', import.meta.url);
const read = (path) => readFileSync(new URL(path, SRC), 'utf8');

test('dữ liệu về trước lúc khung chờ hiện thì không chờ thêm', () => {
  assert.equal(loadingHoldMs(0), 0);
  assert.equal(loadingHoldMs(LOADING_REVEAL_MS - 1), 0);
});

test('khung chờ đã hiện thì giữ đủ thời gian tối thiểu', () => {
  assert.equal(loadingHoldMs(LOADING_REVEAL_MS), LOADING_MIN_VISIBLE_MS);
  assert.equal(loadingHoldMs(LOADING_REVEAL_MS + 100), LOADING_MIN_VISIBLE_MS - 100);
  assert.equal(loadingHoldMs(LOADING_REVEAL_MS + LOADING_MIN_VISIBLE_MS + 50), 0);
});

test('tải nối tiếp (lượt sau bắt đầu ngay khi lượt trước xong) tính chung một phiên với khung chờ đang hiện', () => {
  mock.timers.enable({ apis: ['Date'], now: 1_000_000 });
  try {
    const first = beginLoading();
    mock.timers.tick(250);
    endLoading();
    mock.timers.tick(20);
    assert.equal(beginLoading(), first, 'lượt sau nối tiếp giữ mốc đầu phiên');
    endLoading();
    mock.timers.tick(1000);
    assert.equal(beginLoading(), Date.now(), 'nghỉ lâu thì mở phiên mới');
    const parallel = beginLoading();
    assert.equal(parallel, Date.now(), 'tải song song dùng chung phiên');
    endLoading();
    endLoading();
  } finally {
    mock.timers.reset();
  }
});

test('CSS hoãn khung chờ đúng bằng mốc của hook', () => {
  assert.match(read('styles/tokens.css'), new RegExp(`--loading-reveal-delay: ${LOADING_REVEAL_MS}ms`));
});

test('các hook tự quản loading dùng chung mốc thời gian', () => {
  for (const file of [
    'hooks/useAsync.js',
    'hooks/account/usePermissions.js',
    'hooks/account/useGuardianQuery.js',
    'hooks/kitchen/useKitchen.js',
  ]) {
    assert.match(read(file), /loadWithHold/, `${file} chưa dùng loadWithHold`);
  }
});

test('badge chuông không nháy lặp vô hạn', () => {
  const css = read('layouts/layout.css');
  const badge = css.slice(css.indexOf('.badge-dot {'), css.indexOf('}', css.indexOf('.badge-dot {')));
  assert.doesNotMatch(badge, /infinite/);
});
