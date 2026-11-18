import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

// CHD-12: header chọn năm sắp diễn ra chưa tới ngày mở chuẩn bị ⇒ màn trẻ, sức khỏe, đón trẻ chỉ xem.
const read = (f) => readFileSync(f, 'utf8');

const CHILD_PAGES = [
  'ChildrenListPage',
  'ChildProfilePage',
  'EditChildPage',
  'EnrollChildPage',
  'ClassPlacementPage',
  'ImportChildrenPage',
  'ParentActivationPage',
];

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

const HEALTH_PAGES = [
  'ChildHealthRecordPage',
  'HealthDeclarationPage',
  'HealthCheckListPage',
  'HealthCheckDetailPage',
  'HealthCheckFormPage',
  'HealthExamFormPage',
  'HealthMeasurementFormPage',
  'HealthTrendPage',
];

test('màn sức khỏe: có yearLocked và banner YearLockedNotice', () => {
  for (const name of HEALTH_PAGES) {
    const src = read(`src/pages/children/${name}.jsx`);
    assert.match(src, /yearLocked/, `${name} thiếu yearLocked`);
    assert.match(src, /YearLockedNotice/, `${name} thiếu YearLockedNotice`);
  }
});

test('danh sách nhập số đo, kết quả khám theo lớp: có yearLocked', () => {
  for (const name of ['HealthCheckClassRoster', 'MeasurementRoundRoster']) {
    assert.match(read(`src/components/children/${name}.jsx`), /yearLocked/, `${name} thiếu yearLocked`);
  }
});

test('đón trẻ: chỉ xem khi năm bị khóa, dùng lockedYearMessage và không phụ thuộc module children', () => {
  const src = read('src/pages/pickup/PickupListPage.jsx');
  assert.match(src, /yearLocked/);
  assert.match(src, /lockedYearMessage\(lockedYear\)/);
  assert.match(src, /Chuyển sang năm học \{activeYear\.label\}/);
  assert.doesNotMatch(src, /@\/components\/children/);
});

// Kiểm tra biểu thức chặn thật sự, không chỉ có mặt từ khóa (comment/import cũng khớp từ khóa)
test('hồ sơ trẻ: mọi nút ghi (xếp lớp, sửa, kích hoạt PH, nhập số đo) chặn bằng !yearLocked &&', () => {
  const src = read('src/pages/children/ChildProfilePage.jsx');
  for (const guard of [
    'canPlaceChild(child, user)',
    'canEditChild(child, user)',
    'canActivateParent(child, user)',
    'canRecordMeasurement(child, user, cls)',
  ]) {
    assert.ok(
      src.includes(`!yearLocked && ${guard}`) || src.includes(`!yearLocked && !child.plannedAdmission && ${guard}`),
      `thiếu chặn yearLocked cho ${guard}`,
    );
  }
});

test('danh sách trẻ: nhập Excel và cột thao tác chặn bằng !yearLocked', () => {
  const src = read('src/pages/children/ChildrenListPage.jsx');
  assert.match(src, /const canImport = canEnrollChild\(user\) && !yearLocked;/);
  assert.match(src, /const showActions = !isTeacherRole\(user\) && !yearLocked;/);
  assert.match(src, /\{!yearLocked && isVicePrincipal\(user\)/);
});

test('sổ sức khỏe và danh sách nhập theo lớp: canRecord/canEdit gồm !yearLocked', () => {
  const record = read('src/pages/children/ChildHealthRecordPage.jsx');
  assert.match(record, /const canRecord = !yearLocked && canRecordMeasurement\(/);
  assert.match(record, /const canEdit = !yearLocked && canEditMeasurement\(/);
  for (const name of ['HealthCheckClassRoster', 'MeasurementRoundRoster']) {
    assert.match(
      read(`src/components/children/${name}.jsx`),
      /const canRecord = !!roster\?\.canRecord && !yearLocked;/,
      `${name} thiếu canRecord && !yearLocked`,
    );
  }
});

test('danh sách đợt khám: canCreate gồm !yearLocked và gợi ý rỗng dựa trên canCreate', () => {
  const src = read('src/pages/children/HealthCheckListPage.jsx');
  assert.match(src, /const canCreate = manage && !yearLocked;/);
  assert.match(src, /canCreate\s*\?\s*'Tạo đợt khám/);
});

test('tiếp nhận trẻ: return sớm chỉ xem khi yearReadOnly || yearLocked', () => {
  assert.match(read('src/pages/children/EnrollChildPage.jsx'), /if \(yearReadOnly \|\| yearLocked\)\s*\n?\s*return/);
});

test('đón trẻ: nút trả/gọi và hai modal đều chặn bằng !yearLocked', () => {
  const src = read('src/pages/pickup/PickupListPage.jsx');
  assert.match(src, /\{!yearLocked && isToday && r\.status === PICKUP_STATUS\.WAITING/);
  assert.match(src, /open=\{!!verifyId && !yearLocked\}/);
  assert.match(src, /open=\{!!callId && !yearLocked\}/);
  assert.match(src, /\{verifyId && !yearLocked && <PickupPhotoFlow/);
  assert.match(src, /\{callId && !yearLocked && <PickupCallFlow/);
});
