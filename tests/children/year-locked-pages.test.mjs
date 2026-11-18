import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

// CHD-12: header chọn năm sắp diễn ra chưa tới ngày mở chuẩn bị ⇒ màn trẻ, sức khỏe, đón trẻ chỉ xem.
const read = (f) => readFileSync(f, 'utf8');

const CHILD_PAGES = ['ChildrenListPage', 'ChildProfilePage', 'EditChildPage', 'EnrollChildPage', 'ClassPlacementPage', 'ImportChildrenPage', 'ParentActivationPage'];

test('màn trẻ: có yearLocked và banner YearLockedNotice', () => {
  for (const name of CHILD_PAGES) {
    const src = read(`src/pages/children/${name}.jsx`);
    assert.match(src, /yearLocked/, `${name} thiếu yearLocked`);
    if (name === 'EnrollChildPage' || name === 'ClassPlacementPage' || name === 'ImportChildrenPage') continue; // dùng khối yearReadOnly || yearLocked
    assert.match(src, /YearLockedNotice/, `${name} thiếu YearLockedNotice`);
  }
});

test('tiếp nhận, xếp lớp, nhập Excel: khối chỉ xem gộp yearReadOnly || yearLocked kèm banner', () => {
  for (const name of ['EnrollChildPage', 'ClassPlacementPage', 'ImportChildrenPage']) {
    const src = read(`src/pages/children/${name}.jsx`);
    assert.match(src, /yearReadOnly \|\| yearLocked/, `${name} thiếu yearReadOnly || yearLocked`);
    assert.match(src, /YearLockedNotice/, `${name} thiếu YearLockedNotice`);
  }
});

test('hộp nhập Excel: nút tải lên tắt khi năm bị khóa', () => {
  assert.match(read('src/components/children/ImportChildrenModal.jsx'), /yearReadOnly \|\| yearLocked/);
});
