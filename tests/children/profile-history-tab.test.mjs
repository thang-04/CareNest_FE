import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { profileHistoryRows } from '@/utils/children/profileHistory';

// 3A (user chốt 2026-11-22): tab "Lịch sử sửa hồ sơ" đọc child.history BE trả; BE:CHD-13 ghi cả đổi "Báo ăn".
const history = [
  { action: 'ENROLLED', userName: 'Cô Tâm', at: '2026-11-20T02:00:00Z' },
  {
    action: 'UPDATED',
    userName: 'Cô Tuyết',
    at: '2026-11-22T03:00:00Z',
    note: 'Ngừng ăn bán trú',
    changes: [{ field: 'mealRegistered', label: 'Báo ăn', from: 'Có', to: 'Không' }],
  },
  {
    action: 'UPDATED',
    userName: 'Cô Tâm',
    at: '2026-11-21T03:00:00Z',
    note: 'Phụ huynh báo sai',
    changes: [{ field: 'profile.bloodType', label: 'Nhóm máu', from: null, to: 'O' }],
  },
];

test('mới nhất trước; nhãn hành động; thay đổi "Nhãn: cũ → mới", giá trị trống ghi (trống)', () => {
  const rows = profileHistoryRows(history);
  assert.deepEqual(
    rows.map((r) => r.actionLabel),
    ['Sửa hồ sơ', 'Sửa hồ sơ', 'Tiếp nhận'],
  );
  assert.deepEqual(rows[0].changes, ['Báo ăn: Có → Không']);
  assert.equal(rows[0].note, 'Ngừng ăn bán trú');
  assert.equal(rows[0].userName, 'Cô Tuyết');
  assert.deepEqual(rows[1].changes, ['Nhóm máu: (trống) → O']);
  assert.deepEqual(rows[2].changes, []);
});

test('BE giả ghi giá trị thô, thiếu nhãn ⇒ dùng tên trường của FE, ngày dd/mm/yyyy, danh sách ghi "đã thay đổi"', () => {
  const [row] = profileHistoryRows([
    {
      action: 'UPDATED',
      at: '2026-11-22T03:00:00Z',
      changes: [
        { field: 'fullName', from: 'Bé A', to: 'Bé An' },
        { field: 'dateOfBirth', from: '2023-03-10', to: '2023-03-12' },
        { field: 'guardians', from: [{ fullName: 'X' }], to: [{ fullName: 'Y' }] },
      ],
    },
  ]);
  assert.deepEqual(row.changes, ['Họ tên: Bé A → Bé An', 'Ngày sinh: 10/03/2023 → 12/03/2023', 'Phụ huynh: đã thay đổi']);
});

test('nghỉ học, tiếp nhận lại có nhãn; lịch sử trống ⇒ không có dòng', () => {
  const rows = profileHistoryRows([
    { action: 'WITHDRAWN', at: '2026-11-23T03:00:00Z' },
    { action: 'READMITTED', at: '2026-11-24T03:00:00Z' },
  ]);
  assert.deepEqual(
    rows.map((r) => r.actionLabel),
    ['Tiếp nhận lại', 'Nghỉ học'],
  );
  assert.deepEqual(profileHistoryRows(undefined), []);
});

test('hồ sơ trẻ có tab "Lịch sử sửa hồ sơ" hiển thị bằng ChildProfileHistory', () => {
  const page = readFileSync('src/pages/children/ChildProfilePage.jsx', 'utf8');
  assert.match(page, /\{ key: 'history', label: 'Lịch sử sửa hồ sơ' \}/);
  assert.match(page, /<ChildProfileHistory history=\{child\.history\}/);
});
