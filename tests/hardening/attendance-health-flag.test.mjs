import assert from 'node:assert/strict';
import { test } from 'node:test';

const { createAttendanceBeApi } = await import('@/services/attendance/api/attendanceApi');
const { healthFlag, healthReminder } = await import('@/utils/attendance/healthFlag');

const sheetFrom = (children) => ({
  day: { date: '2026-10-28', today: '2026-10-28', schoolDay: true, locked: false },
  classId: 1,
  className: 'Lớp A',
  campusId: 1,
  mealSessions: ['LUNCH'],
  canRecord: true,
  children,
});

const child = (id) => ({ id, fullName: `Trẻ ${id}`, dateOfBirth: '2023-01-01' });
const notChecked = { checked: false, entryCount: 0, symptoms: [], note: '' };

test('bảng điểm danh từ BE: nhãn sức khỏe theo lần ghi nhận mới nhất, chưa khám có nhãn "Chưa khám"', async () => {
  const client = {
    get: async () =>
      sheetFrom([
        {
          child: child(1),
          record: { status: 'PRESENT', meals: { LUNCH: true } },
          health: {
            checked: true,
            entryCount: 2,
            observation: 'NOTED',
            temperature: 40.0,
            temperatureLevel: 'VERY_HIGH',
            symptoms: ['FEVER'],
            note: '',
          },
        },
        { child: child(2), record: null, health: notChecked },
        { child: child(3), record: { status: 'UNEXCUSED', meals: {} }, health: notChecked },
        { child: child(4), record: null },
      ]),
  };
  const sheet = await createAttendanceBeApi(client).getClassAttendance(1, '2026-10-28');
  const [fever, notYet, absent, unknown] = sheet.children;

  assert.equal(fever.healthSummary.checked, true);
  assert.equal(fever.healthSummary.flagged, true);
  assert.equal(fever.healthSummary.reminder, null);
  assert.equal(healthFlag(fever.healthSummary.latest), `${(40).toLocaleString('vi-VN')} °C · Sốt rất cao`);
  assert.equal(sheet.receptionStats.noted, 1);

  // Chưa khám: BE trả checked = false; trang chỉ ẩn nhãn khi trẻ đã lưu Vắng
  assert.equal(notYet.healthSummary.reminder, 'Chưa khám');
  assert.equal(notYet.healthSummary.latest, null);
  assert.equal(absent.healthSummary.reminder, 'Chưa khám');
  assert.equal(absent.record.status, 'UNEXCUSED');
  // Không có dữ liệu health thì không kết luận "Chưa khám"
  assert.equal(unknown.healthSummary.reminder, null);
  assert.equal(unknown.healthSummary.latest, null);
});

test('nhãn ngắn: mức thân nhiệt khác bình thường ghi tên mức, Có dấu hiệu mà thân nhiệt bình thường ghi "Cần chú ý"', () => {
  const c = (t) => `${t.toLocaleString('vi-VN')} °C`;
  assert.equal(healthFlag({ observation: 'NOTED', temperature: 38.2, symptoms: [] }), `${c(38.2)} · Sốt vừa`);
  assert.equal(healthFlag({ observation: 'NO_CONCERN', temperature: 37.6, symptoms: [] }), `${c(37.6)} · Sốt nhẹ`);
  assert.equal(healthFlag({ observation: 'NO_CONCERN', temperature: 39.2, symptoms: [] }), `${c(39.2)} · Sốt cao`);
  assert.equal(healthFlag({ observation: 'NO_CONCERN', temperature: 35.2, symptoms: [] }), `${c(35.2)} · Thân nhiệt thấp`);
  assert.equal(healthFlag({ observation: 'NOTED', temperature: 36.8, symptoms: ['COUGH'] }), `${c(36.8)} · Cần chú ý`);
  assert.equal(healthFlag({ observation: 'NOTED', temperature: null, symptoms: ['COUGH'] }), 'Cần chú ý');
  assert.equal(healthFlag({ observation: 'NO_CONCERN', temperature: 36.8, symptoms: [] }), c(36.8));
  assert.equal(healthFlag(null), '');
});

test('bảng điểm danh từ BE: đơn nghỉ phụ huynh thành nhãn "Phụ huynh báo nghỉ" ở dòng trẻ', async () => {
  const leave = { requestId: '7', fromDate: '2026-10-28', toDate: '2026-10-29', reason: 'Bé ốm' };
  const client = {
    get: async () =>
      sheetFrom([
        { child: child(1), record: { status: 'EXCUSED', meals: {} }, health: notChecked, leave },
        { child: child(2), record: null, health: notChecked, leave: null },
      ]),
  };
  const sheet = await createAttendanceBeApi(client).getClassAttendance(1, '2026-10-28');
  assert.deepEqual(sheet.children[0].leaveRequest, { id: '7', fromDate: '2026-10-28', toDate: '2026-10-29', reason: 'Bé ốm' });
  assert.equal(sheet.children[1].leaveRequest, null);
});

test('nhắc kiểm tra sau lưu Có mặt, phân biệt chưa khám và thiếu thân nhiệt', () => {
  const summary = { checked: true, latest: { temperature: null } };
  const row = (status, healthSummary = summary) => ({ record: status ? { status } : null, healthSummary });
  assert.equal(healthReminder(row(null)), '');
  assert.equal(healthReminder(row('EXCUSED')), '');
  assert.equal(healthReminder(row('UNEXCUSED')), '');
  assert.equal(healthReminder(row('PRESENT', { checked: false, reminder: 'Chưa khám' })), 'Chưa khám');
  assert.equal(healthReminder(row('PRESENT')), 'Chưa đo thân nhiệt');
  assert.equal(healthReminder(row('PRESENT', { checked: true, latest: { temperature: 36.8 } })), '');
  assert.equal(healthReminder(row('PRESENT', { checked: null, latest: null })), '');
});
