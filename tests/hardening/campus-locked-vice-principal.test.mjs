import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

test('màn Điểm trường và trang chi tiết gắn nhãn khi tài khoản Phó hiệu trưởng đã khóa', () => {
  for (const file of ['CampusListPage', 'CampusDetailPage']) {
    const page = readFileSync(`src/pages/school-config/${file}.jsx`, 'utf8');
    assert.match(page, /\.locked && <LockedAccountBadge \/>/, file);
  }
  assert.match(readFileSync('src/components/school-config/SchoolConfigBadges.jsx', 'utf8'), /Tài khoản đã khóa/);
});
