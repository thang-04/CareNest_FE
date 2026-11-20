import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

/*
 * G94-395 (BUG-24): header chọn năm đã kết thúc ⇒ màn trẻ, sức khỏe chỉ xem (BE CFG-YR-01), như năm sắp
 * diễn ra chưa tới ngày mở chuẩn bị (CHD-12). Cờ khóa của trang lấy từ useChildYearLock, không từ useSchoolYear().yearLocked.
 */
const read = (f) => readFileSync(f, 'utf8');

const LOCKED_FILES = [
  'src/pages/children/ChildrenListPage.jsx',
  'src/pages/children/ChildProfilePage.jsx',
  'src/pages/children/EditChildPage.jsx',
  'src/pages/children/ParentActivationPage.jsx',
  'src/pages/children/ChildHealthRecordPage.jsx',
  'src/pages/children/HealthDeclarationPage.jsx',
  'src/pages/children/HealthExamFormPage.jsx',
  'src/pages/children/HealthMeasurementFormPage.jsx',
  'src/pages/children/HealthTrendPage.jsx',
];

test('hook khóa ghi gộp năm đã kết thúc với năm chưa tới ngày mở chuẩn bị', () => {
  const src = read('src/hooks/children/useChildYearLock.js');
  assert.match(src, /const \{ yearLocked, yearReadOnly \} = useSchoolYear\(\);/);
  assert.match(src, /return !!\(yearLocked \|\| yearReadOnly\);/);
});

test('màn trẻ, sức khỏe lấy cờ khóa từ useChildYearLock', () => {
  for (const file of LOCKED_FILES) {
    const src = read(file);
    assert.match(src, /import \{ useChildYearLock \} from '@\/hooks\/children\/useChildYearLock';/, `${file} thiếu import`);
    assert.match(src, /const yearLocked = useChildYearLock\(\);/, `${file} chưa dùng useChildYearLock`);
    // yearLocked của header chỉ xét CHD-12; trang cần nghĩa đó thì đổi tên (vd. prepLocked)
    assert.doesNotMatch(src, /\{[^}]*\byearLocked\s*[,}][^}]*\}\s*=\s*useSchoolYear\(\)/, `${file} còn lấy yearLocked từ header`);
  }
});

test('câu báo năm đã kết thúc nói đúng thông tin của trang', () => {
  const subjects = {
    'src/pages/children/ChildrenListPage.jsx': 'hồ sơ trẻ',
    'src/pages/children/ChildProfilePage.jsx': 'hồ sơ trẻ',
    'src/pages/children/EditChildPage.jsx': 'hồ sơ trẻ',
    'src/pages/children/ParentActivationPage.jsx': 'tài khoản phụ huynh',
    'src/pages/children/ChildHealthRecordPage.jsx': 'sức khỏe của trẻ',
    'src/pages/children/HealthDeclarationPage.jsx': 'sức khỏe của trẻ',
    'src/pages/children/HealthExamFormPage.jsx': 'sức khỏe của trẻ',
    'src/pages/children/HealthMeasurementFormPage.jsx': 'sức khỏe của trẻ',
    'src/pages/children/HealthTrendPage.jsx': 'sức khỏe của trẻ',
  };
  for (const [file, subject] of Object.entries(subjects)) {
    assert.ok(read(file).includes(`subject="${subject}"`), `${file} thiếu subject="${subject}"`);
  }
});

test('danh sách trẻ: thẻ, câu Sắp nhập học vẫn theo năm chưa tới ngày mở chuẩn bị, không theo năm đã kết thúc', () => {
  const src = read('src/pages/children/ChildrenListPage.jsx');
  assert.match(src, /yearLocked: prepLocked/);
  assert.match(src, /plannedCount > 0 \|\| preparingYear \|\| prepLocked/);
  assert.match(src, /preparingYear \|\| prepLocked\s*\?\s*'Chưa có trẻ Sắp nhập học/);
});
