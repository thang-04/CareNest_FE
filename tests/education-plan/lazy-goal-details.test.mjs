import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mergeGoals } from '../../src/models/education-plan/planVersions.mjs';

const detail = (id, extra = {}) => ({ id, revision: 3, status: 'APPROVED', versionNo: 1, domains: [{ id: 'd' }], ...extra });
const summary = (id, extra = {}) => ({ id, revision: 3, status: 'APPROVED', versionNo: 1, summary: true, ...extra });

// Danh sách chỉ có bản tóm tắt: bản chưa đổi giữ chi tiết đã tải, bản đã đổi để lại tóm tắt cho trang tải lại
test('mergeGoals giữ chi tiết của kế hoạch chưa đổi, bỏ chi tiết của kế hoạch đã đổi', () => {
  const prev = [detail('a'), detail('b'), summary('c')];
  const next = [summary('a'), summary('b', { revision: 4 }), summary('c'), summary('d')];
  const out = mergeGoals(prev, next);
  assert.equal(out[0], prev[0]);
  assert.equal(out[1].summary, true);
  assert.equal(out[1].revision, 4);
  assert.equal(out[2].summary, true);
  assert.equal(out[3].id, 'd');
});

test('mergeGoals: đổi trạng thái hoặc số phiên bản cũng tải lại; bản đầy đủ (mock) giữ nguyên', () => {
  assert.equal(mergeGoals([detail('a')], [summary('a', { status: 'REVIEW' })])[0].summary, true);
  assert.equal(mergeGoals([detail('a')], [summary('a', { versionNo: 2 })])[0].summary, true);
  const full = detail('a', { revision: 9 });
  assert.equal(mergeGoals([detail('a')], [full])[0], full);
  assert.deepEqual(mergeGoals(undefined, []), []);
});

test('mergeGoals nhận trạng thái hạn mới dù số phiên bản và nội dung không đổi', () => {
  const old = detail('a', { timeLock: { deadlineState: 'NEAR' } });
  const next = summary('a', { timeLock: { deadlineState: 'OVERDUE' } });
  const current = mergeGoals([old], [next])[0];
  assert.equal(current.timeLock.deadlineState, 'OVERDUE');
  assert.equal(current.domains, old.domains);
});
