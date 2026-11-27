import assert from 'node:assert/strict';
import { test } from 'node:test';

test('parser CSV chung giữ nguyên export tuyển sinh: BOM, dấu phân cách, quote và xuống dòng', async () => {
  const shared = await import('../../src/utils/csv.js');
  const enrollment = await import('../../src/services/children/mock/enrollmentImport.js');
  assert.equal(enrollment.parseCsv, shared.parseCsv);
  assert.deepEqual(shared.parseCsv('\uFEFFChủ đề;Chủ đề nhánh\r\n"Mẫu; A";"Tên ""nhánh""\nxuống dòng"\r\n'), [
    ['Chủ đề', 'Chủ đề nhánh'],
    ['Mẫu; A', 'Tên "nhánh"\nxuống dòng'],
  ]);
});
