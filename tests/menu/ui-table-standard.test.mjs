import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { test } from 'node:test';

const SRC = new URL('../../src/', import.meta.url);
const DIRS = ['pages/menu-planning', 'pages/kitchen', 'components/menu-planning', 'components/kitchen'];
// Bản in dùng ps-table riêng nên không thuộc phạm vi; mọi .table trên màn hình đều kẻ ô

const sources = DIRS.flatMap((dir) =>
  readdirSync(new URL(dir, SRC))
    .filter((name) => name.endsWith('.jsx'))
    .map((name) => ({ file: `${dir}/${name}`, text: readFileSync(new URL(`${dir}/${name}`, SRC), 'utf8') })),
);

test('bảng thường của dinh dưỡng/bếp dùng table--grid như màn nhân sự', () => {
  const offenders = [];
  for (const { file, text } of sources) {
    for (const [, cls] of text.matchAll(/className="(table(?: [^"]*)?)"/g)) {
      if (!cls.split(' ').includes('table--grid')) offenders.push(`${file}: ${cls}`);
    }
  }
  assert.deepEqual(offenders, []);
});

test('màu dòng/cột cảnh báo được giữ khi bảng kẻ ô ép nền trắng', () => {
  const menu = readFileSync(new URL('styles/modules/menu-planning.css', SRC), 'utf8');
  const kitchen = readFileSync(new URL('styles/modules/kitchen.css', SRC), 'utf8');
  for (const sel of ['.td-row--danger td', '.td-row--warn td', '.td-grp-row td', '.td-hl__total td']) {
    assert.ok(menu.includes(`.table.table--grid ${sel} {`), sel);
  }
  for (const sel of ['.td-balance .td-low', '.td-balance .td-high']) {
    assert.ok(menu.includes(`.table.table--grid${sel} {`), sel);
  }
  for (const sel of ['td.kb-col-today', '.kb-tr--warn td', '.kb-tr--danger td']) {
    assert.ok(kitchen.includes(`.table.table--grid ${sel} {`), sel);
  }
  // Module không viết lại lề ô hoặc đậm chân bảng đã có ở .table chung
  for (const sel of ['.td-hl th', '.td-norm tbody td.right', '.td-norm tfoot td', '.td-recipe tfoot td']) {
    assert.ok(!menu.includes(sel), sel);
  }
});
