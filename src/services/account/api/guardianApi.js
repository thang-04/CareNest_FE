import { validateGuardian } from '@/utils/account/guardianValidation';
import { GUARDIAN_RELATIONSHIP_LABELS } from '@/models/guardianRelationships';
import { axiosClient } from '@/services/http/axiosClient';

/*
 * Contract: BE:src/main/java/com/carenest/controller/child/GuardianController.java, ChildController (`GET /children`),
 * CampusController, ClassController (`/school-structure`). Cùng tên/tham số với guardianMockRepository; `actor` bị bỏ qua.
 */

const listGuardians = (childId) => axiosClient.get(`/children/${childId}/guardians`);

export const guardianApi = {
  getStructure: async () => {
    const [campuses, structure] = await Promise.all([axiosClient.get('/campuses'), axiosClient.get('/school-structure')]);
    return { campuses, classrooms: structure.classes };
  },
  // Một lần gọi cho cả trang: trẻ (phạm vi như GET /children, AUTH-18) kèm tài khoản của phụ huynh nhận tài khoản.
  // `child.guardians` = phụ huynh trên hồ sơ (như /account-recipient); `account` như /children/{id}/guardians.
  searchChildren: async ({ campusId, page = 0, size = 100 } = {}) => {
    const result = await axiosClient.get('/children/guardian-overview', { params: { campusId, page, size } });
    const items = result.items.map(({ child, account }) => {
      const candidates = child.guardians || [];
      // Hồ sơ một phụ huynh: người đó nhận tài khoản kể cả dữ liệu cũ chưa đánh dấu (tiếp nhận luôn chọn một người)
      const recipient = candidates.find((g) => g.accountRecipient) || (candidates.length === 1 ? candidates[0] : null);
      const guardians = account ? [account] : [];
      return {
        ...child,
        guardians,
        guardianCount: guardians.length,
        accountRecipient: recipient
          ? { ...recipient, relation: GUARDIAN_RELATIONSHIP_LABELS[recipient.relation] || recipient.relation }
          : null,
        canManage: child.canManage,
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
