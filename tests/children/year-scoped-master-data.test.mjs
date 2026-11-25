import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

/*
 * Màn trẻ, sức khỏe lấy điểm trường theo năm học đang xem (user chốt 2026-11-22): useMasterData(năm) gọi
 * GET /campuses?schoolYearId (BE: năm đã kết thúc trả bản chụp lúc đóng năm). Không truyền năm = năm đang hoạt động.
 */
const read = (f) => readFileSync(`src/pages/children/${f}.jsx`, 'utf8');

test('danh sách trẻ, đợt khám, tổng hợp cân đo, xu hướng: điểm trường theo năm ở header', () => {
  for (const page of ['ChildrenListPage', 'HealthCheckListPage', 'GrowthReportPage', 'HealthTrendPage']) {
    const src = read(page);
    assert.match(src, /const md = useMasterData\(schoolYear\);/, `${page} chưa truyền năm`);
    // Năm phải có trước khi gọi hook
    assert.ok(src.indexOf('useSchoolYear()') < src.indexOf('useMasterData(schoolYear)'), `${page}: useSchoolYear phải trước`);
  }
});

test('hồ sơ trẻ: trẻ Sắp nhập học dùng điểm trường của năm đăng ký', () => {
  assert.match(read('ChildProfilePage'), /const md = useMasterData\(child\?\.plannedAdmission\?\.schoolYearId \?\? null\);/);
});

test('tạo, sửa đợt khám vẫn theo năm đang hoạt động', () => {
  assert.match(read('HealthCheckFormPage'), /const md = useMasterData\(\);/);
});
