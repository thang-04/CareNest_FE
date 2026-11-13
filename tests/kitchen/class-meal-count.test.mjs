import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

globalThis.window = new EventTarget();

const { classMealRows } = await import('@/utils/attendance/classMealCount');
const { createAttendanceBeApi } = await import('@/services/attendance/api/attendanceApi');

const meal = (over = {}) => ({
  session: 'LUNCH',
  normal: 18,
  substitute: 2,
  status: 'OPEN',
  needsReconfirmation: false,
  confirmedAt: null,
  ...over,
});

test('AC-11: ô từng bữa lấy nguyên số suất BE trả, không cộng trừ lại', () => {
  const rows = classMealRows({ meals: [meal(), meal({ session: 'AFTERNOON', normal: 20, substitute: 0 })] });
  assert.deepEqual(
    rows.map((r) => [r.title, r.normal, r.substitute, r.status, r.tone]),
    [
      ['Bữa trưa', 18, 2, 'Đang nhận báo ăn', 'blue'],
      ['Bữa chiều', 20, 0, 'Đang nhận báo ăn', 'blue'],
    ],
  );
});

test('AC-11: đã xác nhận có ổ khóa và giờ; cần xác nhận lại ưu tiên hơn trạng thái', () => {
  const [confirmed] = classMealRows({ meals: [meal({ status: 'CONFIRMED', confirmedAt: '2026-11-09T02:15:00Z' })] });
  assert.equal(confirmed.locked, true);
  assert.match(confirmed.status, /^Đã xác nhận lúc \d{2}:\d{2}$/);
  const [again] = classMealRows({ meals: [meal({ status: 'PENDING_CONFIRMATION', needsReconfirmation: true })] });
  assert.deepEqual([again.status, again.tone, again.locked], ['Cần xác nhận lại', 'red', false]);
  assert.deepEqual(classMealRows(null), []);
});

test('AC-11: gọi GET /meal-counts/class với lớp và ngày; lỗi 403 trả về màn hình', async () => {
  const calls = [];
  const api = createAttendanceBeApi({
    get: async (url, opts) => {
      calls.push([url, opts.params]);
      throw Object.assign(new Error('Bạn không có quyền với lớp này'), { status: 403 });
    },
  });
  await assert.rejects(api.getClassMealCount({ classId: '5', date: '2026-11-09' }), { status: 403 });
  assert.deepEqual(calls, [['/meal-counts/class', { classId: '5', date: '2026-11-09' }]]);
  const card = readFileSync('src/components/attendance/ClassMealCard.jsx', 'utf8');
  assert.match(card, /<ErrorState error=\{error\}/);
});
