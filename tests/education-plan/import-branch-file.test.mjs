import assert from 'node:assert/strict';
import { test } from 'node:test';
import { applyBranchFile, branchFileChanges, branchPayload } from '../../src/models/education-plan/importBranchFile.mjs';
const draft = { id: 'bp_1_2', names: { a: 'Cũ', b: 'Giữ', c: 'Giống' }, notes: { a: 'Ghi chú' }, extra: 42 };
const preview = {
  matches: [
    { weekStart: 'a', name: 'Mới' },
    { weekStart: 'c', name: 'Giống' },
    { weekStart: 'd', name: 'Thêm' },
  ],
};
test('preview/cancel không sửa nháp; chỉ tên khác đang có cần xác nhận', () => {
  const before = structuredClone(draft);
  const changes = branchFileChanges(draft, preview);
  assert.deepEqual(
    changes.map((x) => [x.weekStart, x.previous, x.overwrite]),
    [
      ['a', 'Cũ', true],
      ['c', 'Giống', false],
      ['d', '', false],
    ],
  );
  assert.deepEqual(draft, before);
});
test('áp dụng chỉ names khớp, giữ ghi chú/field/key khác, xóa pending đúng key kể cả tên giống', () => {
  const pending = { a: { prev: 'Tên trước AI' }, b: { prev: 'Giữ trước AI' }, c: { prev: 'Khác' } };
  const result = applyBranchFile(draft, pending, preview);
  assert.deepEqual(result.draft.names, { a: 'Mới', b: 'Giữ', c: 'Giống', d: 'Thêm' });
  assert.equal(result.draft.notes, draft.notes);
  assert.equal(result.draft.extra, 42);
  assert.deepEqual(result.pending, { b: pending.b });
  assert.deepEqual(branchPayload(result.draft, result.pending).names, { a: 'Mới', b: 'Giữ trước AI', c: 'Giống', d: 'Thêm' });
  assert.equal(draft.names.a, 'Cũ');
});
test('không có matches không đổi dữ liệu', () => {
  assert.deepEqual(applyBranchFile(draft, {}, { matches: [] }), { draft, pending: {} });
});
