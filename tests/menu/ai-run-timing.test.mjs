import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { mock, test } from 'node:test';
import { AI_MIN_VISIBLE_MS, aiHoldMs, runWithAiHold } from '../../src/hooks/loadingTiming.js';

const SRC = new URL('../../src/', import.meta.url);
const read = (path) => readFileSync(new URL(path, SRC), 'utf8');
const flush = async () => {
  for (let i = 0; i < 5; i += 1) await Promise.resolve();
};

test('AI xong sớm thì lớp phủ giữ đủ thời gian tối thiểu tính từ lúc bấm', () => {
  assert.equal(AI_MIN_VISIBLE_MS, 1200);
  assert.equal(aiHoldMs(0), 1200);
  assert.equal(aiHoldMs(300), 900);
});

test('AI chạy lâu hơn mốc tối thiểu thì không giữ thêm', () => {
  assert.equal(aiHoldMs(1200), 0);
  assert.equal(aiHoldMs(1500), 0);
});

test('runWithAiHold trả kết quả sau mốc tối thiểu', async () => {
  mock.timers.enable({ apis: ['Date', 'setTimeout'], now: 1_000_000 });
  try {
    let settled = false;
    const pending = runWithAiHold(async () => 'draft').then((value) => {
      settled = true;
      return value;
    });
    await flush();
    mock.timers.tick(AI_MIN_VISIBLE_MS - 1);
    await flush();
    assert.equal(settled, false, 'chưa đủ mốc thì chưa trả');
    mock.timers.tick(1);
    assert.equal(await pending, 'draft');
  } finally {
    mock.timers.reset();
  }
});

test('runWithAiHold lỗi cũng giữ đủ mốc rồi mới ném lỗi', async () => {
  mock.timers.enable({ apis: ['Date', 'setTimeout'], now: 1_000_000 });
  try {
    let rejected = false;
    const pending = runWithAiHold(async () => {
      throw new Error('AI_FAILED');
    }).catch((err) => {
      rejected = true;
      return err;
    });
    await flush();
    mock.timers.tick(AI_MIN_VISIBLE_MS - 1);
    await flush();
    assert.equal(rejected, false);
    mock.timers.tick(1);
    assert.equal((await pending).message, 'AI_FAILED');
  } finally {
    mock.timers.reset();
  }
});

test('lớp phủ AI: vòng lặp vô hạn có nhịp thật khi giảm chuyển động, nằm trên modal và dưới toast', () => {
  const tokens = read('styles/tokens.css');
  const z = (name) => Number(tokens.match(new RegExp(`--z-${name}: (\\d+)`))[1]);
  assert.ok(z('ai-veil') > z('modal') && z('ai-veil') < z('toast'));
  const css = read('styles/components.css');
  const reduce = css.slice(css.indexOf('/* Lớp phủ AI: giảm chuyển động'));
  assert.match(reduce, /animation-duration: [^;]+!important/);
});
