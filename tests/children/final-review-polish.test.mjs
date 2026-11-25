import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { splitHistoryText } from '../../src/models/children/childProfile.js';

/* Sửa nhỏ sau review cuối: chip trùng, gợi ý chưa thêm, lý do nút khóa, ngày xếp lớp gõ dở. */
const read = (path) => readFileSync(path, 'utf8');

test('splitHistoryText: bỏ mục trùng không phân biệt hoa thường, giữ thứ tự', () => {
  assert.deepEqual(splitHistoryText('Hen; hen ;Viêm; HEN'), ['Hen', 'Viêm']);
});

test('ChipListInput gợi ý bấm Thêm hoặc Enter khi đã gõ mà chưa thêm', () => {
  assert.match(read('src/components/children/ChipListInput.jsx'), /Chưa thêm vào danh sách: bấm Thêm hoặc Enter/);
});

test('RosterActions: nút chính khóa dùng disabledReason để đọc được lý do', () => {
  const src = read('src/components/children/RosterActions.jsx');
  assert.match(src, /disabledReason=\{primary\.title\}/);
  assert.doesNotMatch(src, /\sdisabled title=/);
});

test('usePlacementClasses giữ ngày đầy đủ gần nhất khi ngày đang gõ dở và trả from cho thông báo', () => {
  const src = read('src/hooks/children/useChildRecords.js');
  assert.match(src, /lastComplete\.current = from/);
  assert.match(src, /reload, from: fromDate/);
  for (const page of ['ClassPlacementPage', 'EnrollChildPage']) {
    assert.match(read(`src/pages/children/${page}.jsx`), /classesFrom \? formatDate\(classesFrom\) : 'hôm nay'/);
  }
});

test('tiện ích gap-8 và variant secondary không còn ở trang xếp lớp', () => {
  const src = read('src/pages/children/ClassPlacementPage.jsx');
  assert.doesNotMatch(src, /gap-8|variant="secondary"/);
});
