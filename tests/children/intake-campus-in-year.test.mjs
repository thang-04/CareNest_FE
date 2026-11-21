import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { beforeEach, test } from 'node:test';

/*
 * G94-180/CHD-02, CHD-11 (user chốt 2026-11-22): ô Điểm trường khi tiếp nhận, nhập Excel theo năm học tiếp nhận; tiếp nhận lại
 * chọn được điểm trường của năm (trống = giữ điểm trường cũ). BE vẫn chặn bằng 2125.
 */
const storage = new Map();
globalThis.localStorage = {
  getItem: (k) => storage.get(k) ?? null,
  setItem: (k, v) => storage.set(k, String(v)),
  removeItem: (k) => storage.delete(k),
  clear: () => storage.clear(),
};
globalThis.window = new EventTarget();

const { resetDb } = await import('@/mocks/mockDatabase');
const { childrenMockRepository: children, ensureChildRecordsSeeded } = await import('@/services/children/mock/childrenMockRepository');
const { emptyChildInfo, emptyDeclaration, keepCampusPick } = await import('@/utils/children/childrenHelpers');
const { todayInput } = await import('@/utils/format');
const { filledMedicalHistory, filledProfile } = await import('./profileFixture.mjs');

const read = (f) => readFileSync(f, 'utf8');
const PRINCIPAL = { id: 'u_hung', role: 'PRINCIPAL', campusId: 'c1' };

beforeEach(() => {
  resetDb();
  ensureChildRecordsSeeded();
});

test('keepCampusPick: giữ lựa chọn có trong danh sách (id số hay chuỗi), bỏ lựa chọn ngoài danh sách', () => {
  const options = [{ id: 1 }, { id: 2 }];
  assert.equal(keepCampusPick(null, options), null);
  assert.equal(keepCampusPick('2', options), '2');
  assert.equal(keepCampusPick(3, options), null);
});

test('tiếp nhận, nhập Excel lấy điểm trường của năm tiếp nhận; giữ lựa chọn khi danh sách đang tải', () => {
  const page = read('src/pages/children/EnrollChildPage.jsx');
  assert.match(page, /const md = useMasterData\(intakeYear\?\.id \?\? null\);/);
  assert.match(page, /md\.loading \? campusPick : keepCampusPick\(campusPick, campusOptions\)/);
  assert.match(page, /Điểm trường của bạn không có trong năm học \{yearLabel\}\. Chọn năm học khác hoặc báo Hiệu trưởng\./);
  const modal = read('src/components/children/ImportChildrenModal.jsx');
  assert.match(modal, /useMasterData\(intakeYear\?\.id \?\? null\)/);
});
