import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

const { sortLeaves } = await import('@/utils/attendance/leaveRange');
const { isPastUnconfirmed } = await import('@/utils/attendance/mealRegisterDay');

const leave = (id, fromDate, toDate = fromDate) => ({ id, fromDate, toDate });

test('đơn đang nghỉ và sắp nghỉ gần nhất lên đầu, đơn đã qua xuống dưới theo ngày mới nhất', () => {
  const rows = [
    leave('far', '2027-05-15'),
    leave('old', '2026-12-01'),
    leave('next', '2026-12-21'),
    leave('now', '2026-12-19', '2026-12-22'),
    leave('recent', '2026-12-18'),
    leave('later', '2026-12-25'),
  ];
  assert.deepEqual(
    sortLeaves(rows, '2026-12-20').map((r) => r.id),
    ['now', 'next', 'later', 'far', 'recent', 'old'],
  );
  assert.equal(rows[0].id, 'far');
});

const counts = (date, status, needsReconfirmation = false) => [
  { date, status: 'CONFIRMED' },
  { date, status, needsReconfirmation },
];

test('sổ ngày đã qua chưa xác nhận được nhận ra; hôm nay, đã xác nhận, chờ xác nhận lại thì không', () => {
  assert.equal(isPastUnconfirmed(counts('2026-11-30', 'PENDING_CONFIRMATION'), '2026-12-01'), true);
  assert.equal(isPastUnconfirmed(counts('2026-11-30', 'OPEN'), '2026-12-01'), true);
  assert.equal(isPastUnconfirmed(counts('2026-12-01', 'PENDING_CONFIRMATION'), '2026-12-01'), false);
  assert.equal(isPastUnconfirmed(counts('2026-11-30', 'CONFIRMED'), '2026-12-01'), false);
  assert.equal(isPastUnconfirmed(counts('2026-11-30', 'PENDING_CONFIRMATION', true), '2026-12-01'), false);
  assert.equal(isPastUnconfirmed([], '2026-12-01'), false);
});

const read = (path) => readFileSync(new URL(`../../src/${path}`, import.meta.url), 'utf8');

test('sổ suất ăn ngày đã qua không còn nút trả lại, ghi rõ chưa xác nhận', () => {
  const card = read('components/attendance/MealRegisterCard.jsx');
  assert.match(card, /!pastUnconfirmed &&/);
  assert.match(card, /Ngày đã qua, chưa xác nhận/);
});

test('màn đơn nghỉ dùng thứ tự ngày nghỉ gần nhất', () => {
  assert.match(read('pages/attendance/LeaveRequestsPage.jsx'), /sortLeaves\(/);
});
