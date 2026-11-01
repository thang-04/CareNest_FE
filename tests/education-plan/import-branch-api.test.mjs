import assert from 'node:assert/strict';
import { test } from 'node:test';
globalThis.window = new EventTarget();
const { axiosClient } = await import('../../src/services/http/axiosClient.js');
const { educationPlanApi } = await import('../../src/services/education-plan/api/educationPlanApi.js');
test('preview nhánh multipart giữ đúng id server và bóc ResponseJson một lần', async () => {
  const preview = { matches: [{ row: 2, themeId: 10, themeName: 'Mẫu', weekStart: '2026-09-07', name: 'Nhánh' }], warnings: [] };
  axiosClient.defaults.adapter = async (config) => {
    assert.equal(config.url, '/education-plans/class-docs/branch/file-preview');
    assert.equal(config.method, 'post');
    assert.equal(config.data.get('classId'), '12');
    assert.equal(config.data.get('yearPlanId'), '41');
    assert.equal(config.data.get('file').name, 'branch.csv');
    assert.equal(config.timeout, 60000);
    return { status: 200, headers: {}, config, data: { code: 200, desc: 'ok', data: preview } };
  };
  assert.deepEqual(
    await educationPlanApi.previewBranchFile(new File(['Chủ đề,Chủ đề nhánh'], 'branch.csv'), { classId: '12', yearPlanId: '41' }),
    preview,
  );
});
test('không đoán server id từ prefix mock', () => {
  assert.throws(() => educationPlanApi.previewBranchFile(new File([], 'x.csv'), { classId: 'class-12', yearPlanId: '41' }), /không hợp lệ/);
});
