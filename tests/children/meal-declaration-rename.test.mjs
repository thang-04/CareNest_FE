import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';

// 4A (user chốt 2026-11-22): màn module Trẻ gọi "Khai báo ăn và sức khỏe". Giữ tên quyền (module phân quyền, cấu hình trường).
const walk = (dir) =>
  readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    return statSync(path).isDirectory() ? walk(path) : /\.(js|jsx)$/.test(name) ? [path] : [];
  });

const FILES = [
  ...walk('src/pages/children'),
  ...walk('src/components/children'),
  ...walk('src/utils/children'),
  'src/models/children/childrenConstants.js',
  ...walk('src/services/children'),
];

// Bỏ chú thích (dòng chú thích, phần sau //) ⇒ chỉ xét chữ người dùng thấy
const visibleLines = (source) =>
  source
    .split(/\r?\n/)
    .filter((line) => !/^\s*(\/\/|\*|\/\*)/.test(line))
    .map((line) => line.replace(/\s\/\/.*$/, ''));

test('module Trẻ không còn chữ "khai báo sức khỏe" người dùng thấy', () => {
  const stale = FILES.flatMap((file) =>
    visibleLines(readFileSync(file, 'utf8'))
      .filter((line) => /khai báo sức khỏe/i.test(line))
      .map((line) => `${file}: ${line.trim()}`),
  );
  assert.deepEqual(stale, []);
});

test('trang khai báo, lỗi thiếu khai báo dùng tên mới', () => {
  assert.match(readFileSync('src/pages/children/HealthDeclarationPage.jsx', 'utf8'), /Khai báo ăn và sức khỏe/);
  assert.match(readFileSync('src/utils/children/childrenValidation.js', 'utf8'), /'Khai báo ăn và sức khỏe còn thiếu'/);
});
