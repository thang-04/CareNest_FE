import assert from 'node:assert/strict';
import { beforeEach, test } from 'node:test';

const values = new Map();
globalThis.localStorage = {
  getItem: (key) => values.get(key) ?? null,
  setItem: (key, value) => values.set(key, String(value)),
  removeItem: (key) => values.delete(key),
  clear: () => values.clear(),
};
globalThis.window = new EventTarget();

const { assessmentMockRepository: repo } = await import('@/services/assessment/mock/assessmentMockRepository');
const { OVERVIEW_PERIOD } = await import('@/models/assessment/assessmentConstants');

const VP = { id: 'u_lan', role: 'VICE_PRINCIPAL', campusId: 'c1' };
const PRINCIPAL = { id: 'u_hung', role: 'PRINCIPAL', campusId: null };
const TEACHER = { id: 'u_t1', role: 'TEACHER', campusId: 'c1' };

beforeEach(() => values.clear());

test('tổng quan đánh giá lớp: PHT chỉ thấy lớp điểm trường mình, Hiệu trưởng thấy toàn trường và lọc được điểm trường', async () => {
  const vp = await repo.getClassAssessmentOverview({ period: OVERVIEW_PERIOD.WEEK }, VP);
  assert.ok(vp.rows.length > 0);
  assert.ok(vp.rows.every((r) => r.campusId === 'c1'));
  assert.deepEqual(
    vp.campuses.map((c) => c.id),
    ['c1'],
  );

  const all = await repo.getClassAssessmentOverview({ period: OVERVIEW_PERIOD.WEEK }, PRINCIPAL);
  assert.ok(all.campuses.length > 1);
  const c2 = await repo.getClassAssessmentOverview({ period: OVERVIEW_PERIOD.WEEK, campusId: 'c2' }, PRINCIPAL);
  assert.ok(c2.rows.every((r) => r.campusId === 'c2'));
  assert.equal(all.totals.classes, all.rows.length);
});

test('tổng quan: số đã đánh giá không vượt số có mặt; kỳ tuần không vượt 5 ngày học; giáo viên không xem được', async () => {
  for (const period of Object.values(OVERVIEW_PERIOD)) {
    const o = await repo.getClassAssessmentOverview({ period }, PRINCIPAL);
    assert.ok(o.rows.every((r) => r.assessed <= r.present && r.assessedDays <= r.schoolDays));
    if (period === OVERVIEW_PERIOD.WEEK) assert.ok(o.schoolDays <= 5);
    if (period === OVERVIEW_PERIOD.DAY) assert.ok(o.schoolDays <= 1);
  }
  await assert.rejects(() => repo.getClassAssessmentOverview({ period: OVERVIEW_PERIOD.DAY }, TEACHER), (err) => err.status === 403);
});

test('chi tiết lớp: từng trẻ khớp tổng của lớp; PHT không mở được lớp điểm trường khác', async () => {
  const o = await repo.getClassAssessmentOverview({ period: OVERVIEW_PERIOD.MONTH }, PRINCIPAL);
  const row = o.rows[0];
  const detail = await repo.getClassAssessmentDetail({ classId: row.classId, period: OVERVIEW_PERIOD.MONTH }, PRINCIPAL);
  assert.equal(detail.children.length, row.size);
  assert.equal(
    detail.children.reduce((n, c) => n + c.assessedDays, 0),
    row.assessed,
  );
  const other = o.rows.find((r) => r.campusId !== 'c1');
  if (other) {
    await assert.rejects(
      () => repo.getClassAssessmentDetail({ classId: other.classId, period: OVERVIEW_PERIOD.DAY }, VP),
      (err) => err.status === 403,
    );
  }
});
