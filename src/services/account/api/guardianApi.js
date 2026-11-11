import { validateGuardian } from '@/utils/account/guardianValidation';
import { GUARDIAN_RELATIONSHIP_LABELS } from '@/models/guardianRelationships';
import { axiosClient } from '@/services/http/axiosClient';

/*
 * Contract: BE:src/main/java/com/carenest/controller/child/GuardianController.java, ChildController (`GET /children`),
 * CampusController, ClassController (`/school-structure`). Cùng tên/tham số với guardianMockRepository; `actor` bị bỏ qua.
 */

const GUARDIAN_FETCH_LIMIT = 6;

// Giới hạn số request song song khi đọc phụ huynh từng trẻ
const mapLimited = async (items, limit, fn) => {
  const results = new Array(items.length);
  let next = 0;
  const worker = async () => {
    while (next < items.length) {
      const index = next++;
      results[index] = await fn(items[index]);
    }
  };
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return results;
};

const listGuardians = (childId) => axiosClient.get(`/children/${childId}/guardians`);

export const guardianApi = {
  getStructure: async () => {
    const [campuses, structure] = await Promise.all([axiosClient.get('/campuses'), axiosClient.get('/school-structure')]);
    return { campuses, classrooms: structure.classes };
  },
  searchChildren: async ({ campusId, page = 0, size = 100 } = {}) => {
    const result = await axiosClient.get('/children', { params: { campusId, page, size } });
    // BE chỉ trả trẻ trong phạm vi quản lý phụ huynh của người gọi (AUTH-18) và kiểm lại khi ghi
    const items = await mapLimited(result.items, GUARDIAN_FETCH_LIMIT, async (child) => {
      const [guardians, candidates] = await Promise.all([
        listGuardians(child.id),
        axiosClient.get(`/children/${child.id}/account-recipient`),
      ]);
      const recipient = candidates.find((g) => g.accountRecipient) || null;
      return {
        ...child,
        guardians,
        guardianCount: guardians.length,
        accountRecipient: recipient
          ? { ...recipient, relation: GUARDIAN_RELATIONSHIP_LABELS[recipient.relation] || recipient.relation }
          : null,
        selectionRequired: candidates.length > 1 && !recipient,
        canManage: true,
      };
    });
    return { ...result, items };
  },
  listGuardians,
  // Spec013: chỉ phụ huynh được chọn chờ kích hoạt; kiểm định dạng ở FE để hỗ trợ nhập, BE kiểm lại khi lưu.
  listPendingGuardians: async (childId) =>
    (await axiosClient.get(`/children/${childId}/guardians/pending`)).map((g) => ({
      ...g,
      relation: GUARDIAN_RELATIONSHIP_LABELS[g.relation] || g.relation,
      problems: Object.values(validateGuardian({ ...g, relationship: g.relation })),
      hasAccount: false,
    })),
  getAccountCandidates: async (childId) =>
    (await axiosClient.get(`/children/${childId}/account-recipient`)).map((g) => ({
      ...g,
      relation: GUARDIAN_RELATIONSHIP_LABELS[g.relation] || g.relation,
    })),
  selectAccountRecipient: (childId, guardianId) => axiosClient.put(`/children/${childId}/account-recipient`, { guardianId }),
  activateGuardians: (childId, _user, guardianId) => axiosClient.post(`/children/${childId}/guardians/activate`, { guardianId }),
  lookupGuardian: (childId, phone) => axiosClient.post(`/children/${childId}/guardians/lookup`, { phone }),
  // BE không lưu email phụ huynh; confirmUserId bắt buộc khi SĐT đã có tài khoản (AUTH-18)
  addGuardian: (childId, { phone, fullName, relationship, confirmUserId }) =>
    axiosClient.post(`/children/${childId}/guardians`, { phone, fullName, relationship, confirmUserId }),
  removeGuardian: (childId, userId) => axiosClient.delete(`/children/${childId}/guardians/${userId}`),
  updateParentStatus: (userId, status) => axiosClient.patch(`/parent-accounts/${userId}/status`, { status }),
  resetParentPassword: (userId) => axiosClient.post(`/parent-accounts/${userId}/temporary-password`),
};
