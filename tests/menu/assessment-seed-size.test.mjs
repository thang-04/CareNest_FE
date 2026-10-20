import assert from 'node:assert/strict';
import { test } from 'node:test';

// localStorage giả có hạn mức gần trình duyệt (~5 triệu ký tự): seed vượt hạn mức phải lộ ra ở đây
const QUOTA = 5_000_000;
const values = new Map();
let writes = 0;
globalThis.localStorage = {
  getItem: (k) => values.get(k) ?? null,
  setItem: (k, v) => {
    if (String(v).length > QUOTA) throw new DOMException('quota', 'QuotaExceededError');
    writes += 1;
    values.set(k, String(v));
  },
  removeItem: (k) => values.delete(k),
};
globalThis.window = new EventTarget();

const { assessmentMockRepository: repo } = await import('@/services/assessment/mock/assessmentMockRepository');
const { readDb } = await import('@/mocks/mockDatabase');

const DEMO_CLASSES = ['cls_c1_m1', 'cls_c1_c1', 'cls_c1_c2', 'cls_c1_l1', 'cls_c2_m1', 'cls_c2_la'];

test('dữ liệu mẫu đánh giá lưu được trong hạn mức localStorage và chỉ thuộc lớp demo', async () => {
  const criteria = await repo.getCriteria();
  assert.ok(criteria.length > 0);
  const db = readDb();
  const size = JSON.stringify(db).length;
  assert.ok(size < 4_000_000, `DB demo ${size} ký tự, cần < 4.000.000 để còn chỗ cho thao tác`);
  const classIds = new Set([...db.dailyAssessments, ...db.periodicEvaluations].map((r) => r.classId));
  assert.deepEqual(
    [...classIds].filter((id) => !DEMO_CLASSES.includes(id)),
    [],
  );
  assert.ok(db.periodicEvaluations.length > 0, 'vẫn có phiếu đánh giá kỳ để demo');
});

test('lần gọi sau không sinh lại dữ liệu mẫu', async () => {
  const before = writes;
  const started = Date.now();
  await repo.getCriteria();
  assert.equal(writes, before);
  assert.ok(Date.now() - started < 500);
});
