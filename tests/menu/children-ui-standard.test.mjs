import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { test } from 'node:test';

const SRC = new URL('../../src/', import.meta.url);
const DIRS = ['pages/children', 'components/children'];

const sources = DIRS.flatMap((dir) =>
  readdirSync(new URL(dir, SRC))
    .filter((name) => name.endsWith('.jsx'))
    .map((name) => ({ file: `${dir}/${name}`, text: readFileSync(new URL(`${dir}/${name}`, SRC), 'utf8') })),
);
const css = readFileSync(new URL('styles/modules/children.css', SRC), 'utf8');

test('bảng màn Quản lý trẻ và Khám sức khỏe dùng table--grid như màn nhân sự', () => {
  const offenders = [];
  for (const { file, text } of sources) {
    for (const [, cls] of text.matchAll(/className="(table(?: [^"]*)?)"/g)) {
      if (!cls.split(' ').includes('table--grid')) offenders.push(`${file}: ${cls}`);
    }
  }
  assert.deepEqual(offenders, []);
});

test('màu dòng lỗi nhập Excel và dòng đang chọn vẫn thắng nền trắng của bảng kẻ ô', () => {
  for (const sel of ['.tr-row-error td', '.tr-row-selected td']) {
    assert.ok(css.includes(`.table.table--grid ${sel} {`), sel);
  }
});

test('khoảng cách dùng class gap-* thay inline style cố định; CSS không dùng màu primitive', () => {
  const offenders = sources.filter(({ text }) => /style=\{\{\s*gap:\s*\d/.test(text)).map(({ file }) => file);
  assert.deepEqual(offenders, []);
  assert.doesNotMatch(css, /var\(--(?:gray|blue|green|red|amber|purple|orange)-\d/);
});
