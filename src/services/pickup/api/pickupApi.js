import { beClient } from '@/services/http/beClient';
import { GUARDIAN_RELATIONSHIP_LABELS } from '@/models/guardianRelationships';
import { VERIFICATION } from '@/models/pickup/pickupConstants';

/*
 * Adapter BE đón trẻ (PickupController, BE:docs/modules/attendance.md): cùng tên hàm, shape với mock repository; BE đọc
 * người dùng từ JWT và kiểm quyền PICKUP_RECORD + phân công lớp. beClient đổi id số <-> chuỗi; mã quan hệ đổi sang chữ ở đây.
 * Danh sách lớp lấy GET /pickups/classes, không dùng /attendance/classes (cờ ở đó theo quyền điểm danh).
 */
const relationLabel = (code) => GUARDIAN_RELATIONSHIP_LABELS[code] || code || '';
const toRecord = (record) => record && { ...record, pickupPersonRelation: relationLabel(record.pickupPersonRelationship) };
const toRow = (row) => ({ ...row, pickup: toRecord(row.pickup) || null, attempts: (row.attempts || []).map(toRecord) });

export const createPickupApi = (client) => ({
  getPickupClasses: async () => (await client.get('/pickups/classes')) || [],
  getPickupBoard: async ({ classId, date }) => {
    const board = await client.get(`/classes/${classId}/pickups`, { params: { date } });
    return { ...board, rows: (board.rows || []).map(toRow) };
  },
  getPickupChild: async (childId) => {
    const result = await client.get(`/pickups/children/${childId}`);
    return {
      ...result,
      ...toRow(result.row || {}),
      guardians: (result.guardians || []).map((g) => ({ ...g, index: g.position, relation: relationLabel(g.relationship) })),
    };
  },
  // BE chỉ nhận các field này; khớp ảnh gửi vị trí phụ huynh, BE tự chép họ tên, quan hệ, SĐT từ hồ sơ trẻ
  recordPickupResult: async ({ childId, verification, guardianPosition, handoverTime, note }) =>
    toRecord(
      await client.post('/pickups', {
        childId,
        verification,
        guardianPosition: verification === VERIFICATION.PHOTO_MATCH ? guardianPosition : null,
        handoverTime: handoverTime || null,
        note: note || '',
      }),
    ),
  getPickupResults: async ({ date }) => ((await client.get('/pickups', { params: { date } })) || []).map(toRecord),
});

export const pickupApi = createPickupApi(beClient);
