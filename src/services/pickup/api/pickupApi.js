import { axiosClient } from '@/services/http/axiosClient';
import { GUARDIAN_RELATIONSHIP_LABELS } from '@/models/guardianRelationships';

/*
 * PROPOSED endpoints only – the backend contract is not agreed yet (CareNest_BE owns it).
 * Same function names and arguments as the mock repository; the user comes from the JWT.
 * Năm học (user chốt 2026-10-28, Y-1): chỉ lớp của năm học đang hoạt động (lớp năm khác ⇒ 422 classId); date không ở tương lai và
 * không trước ngày bắt đầu năm đang hoạt động khi năm đã bắt đầu (⇒ 422 date). Danh sách lớp lấy GET /classes?activeYear=true.
 */
export const pickupApi = {
  getPickupBoard: ({ classId, date }) => axiosClient.get(`/classes/${classId}/pickups`, { params: { date } }),
  getPickupChild: async (childId) => {
    const result = await axiosClient.get(`/pickups/children/${childId}`);
    return {
      ...result,
      ...(result.row || {}),
      guardians: result.guardians.map((g) => ({
        ...g,
        index: g.position ?? g.index,
        relation: GUARDIAN_RELATIONSHIP_LABELS[g.relationship] || g.relation || g.relationship,
      })),
    };
  },
  recordPickupResult: (form) => axiosClient.post('/pickups', form),
  getPickupResults: ({ date }) => axiosClient.get('/pickups', { params: { date } }),
};
