import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { mock, test } from 'node:test';
import { AI_MIN_VISIBLE_MS, aiHoldMs, runWithAiHold } from '../../src/hooks/loadingTiming.js';

const SRC = new URL('../../src/', import.meta.url);
const read = (path) => readFileSync(new URL(path, SRC), 'utf8');
const flush = async () => {
  for (let i = 0; i < 5; i += 1) await Promise.resolve();
};

test('AI xong sớm thì lớp phủ giữ đủ thời gian tối thiểu tính từ lúc bấm', () => {
  assert.equal(AI_MIN_VISIBLE_MS, 2000);
  assert.equal(aiHoldMs(0), 2000);
  assert.equal(aiHoldMs(300), 1700);
});

test('AI chạy lâu hơn mốc tối thiểu thì không giữ thêm', () => {
  assert.equal(aiHoldMs(2000), 0);
  assert.equal(aiHoldMs(2500), 0);
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

test('Lottie tải lazy (chunk riêng) và mọi file hoạt hình hợp lệ', () => {
  const player = read('components/ui/LottiePlayer.jsx');
  assert.match(player, /import\('lottie-web'\)/);
  for (const file of [
    'components/ui/LottiePlayer.jsx',
    'components/ui/AiWorkingOverlay.jsx',
    'components/ui/States.jsx',
    'contexts/ToastContext.jsx',
  ]) {
    assert.doesNotMatch(read(file), /^import .*(lottie-web|assets\/lottie)/m, `${file} phải nạp Lottie bằng import()`);
  }
  for (const name of readdirSync(new URL('assets/lottie/', SRC))) {
    const anim = JSON.parse(read(`assets/lottie/${name}`));
    assert.ok(anim.op > anim.ip && anim.fr > 0 && anim.layers.length > 0, name);
  }
});

test('file Lottie chỉ chứa expression đã soát (lottie-web chạy expression bằng eval)', () => {
  const REVIEWED = new Set(["var $bm_rt;\n$bm_rt = loopOut('cycle', 0);"]);
  for (const name of readdirSync(new URL('assets/lottie/', SRC))) {
    const found = [];
    (function walk(o) {
      if (Array.isArray(o)) return o.forEach(walk);
      if (o && typeof o === 'object')
        for (const [k, v] of Object.entries(o)) {
          if (k === 'x' && typeof v === 'string') found.push(v);
          else walk(v);
        }
    })(JSON.parse(read(`assets/lottie/${name}`)));
    for (const expr of found) assert.ok(REVIEWED.has(expr), `${name}: expression chưa soát: ${expr.slice(0, 80)}`);
  }
});
