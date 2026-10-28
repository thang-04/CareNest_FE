import { axiosClient } from '@/services/http/axiosClient';

/**
 * PROPOSED Spring Boot contract for child records & child health (not agreed with CareNest_BE yet).
 * Same names and shapes as the mock repository; the backend reads the user's scope from the JWT.
 * Mỗi trẻ trả thêm latestHealth { date, followUpLevel, campaignName, source, knownCondition, resultOn, followUpId,
 * closedWithoutResultOn } để danh sách lọc trẻ theo mức qua mọi đợt (2026-10-17): còn phiếu theo dõi mở ⇒ CLOSE_WATCH
 * (source FOLLOW_UP_OPEN); không thì mục mới hơn giữa lần khám có xếp mức (EXAM; bỏ phiếu nháp, cân đo ngoài đợt) và phiếu
 * đóng có kết quả theo lời bác sĩ (FOLLOW_UP_CLOSED). Mức KNOWN_STABLE "Vấn đề đã biết, ổn định" (2026-10-21).
 * Hành chính, tiền sử (2026-10-17, `models/children/childProfile.js`): child.profile trong GET profile, POST enrollments,
 * PUT /children/{id} (danh sách không trả); declaration.medicalHistory trong PUT health-declaration; file nhập thêm cột.
 * Khai tiếp xúc người bệnh lao ⇒ BE gửi thông báo CHILD_TB_CONTACT (cả người lưu, 2026-10-27). Từ 2026-10-22: bắt buộc trừ idNumber, bloodType (422 theo ô
 * profile.x, medicalHistory.x khác NOT_PROVIDED); phiếu khám không sửa hành chính, tiền sử sửa ở phiếu thì lưu kết luận BE cập nhật
 * vào khai báo; PUT health-declaration thêm Hiệu trưởng.
 * CCCD phụ huynh (2026-10-21): guardians[].idNumber (12 chữ số, bắt buộc) trong POST enrollments, PUT /children/{id}, file nhập
 * (cột "Số CCCD phụ huynh") và mọi response có guardians; parent-account-options trả idNumber; trùng phụ huynh khác ⇒ 409 + details.
 * Ngày tiếp xúc người bệnh lao (2026-10-21): medicalHistory.tbContact.contactDate bắt buộc khi REPORTED (PUT health-declaration,
 * POST enrollments, file nhập); đổi ngày đã có ⇒ BE gửi CHILD_TB_CONTACT_DATE_CHANGED cho Hiệu trưởng, Phó hiệu trưởng điểm trường và người lưu (2026-10-27).
 * Phụ huynh theo CCCD (2026-10-23, docs/plans/completed/2026-10-23-guardian-identity-by-citizen-id.md): GET by-citizen-id trả tài khoản
 * { id, fullName, phone, idNumber, email, status, children[], otherChildrenCount, relation } | null; POST enrollments, PUT /children/{id}, import:
 * idNumber trùng tài khoản ⇒ BE dùng họ tên/SĐT/email của tài khoản và liên kết trẻ (bỏ accountId, parent-account-options); SĐT trùng
 * phụ huynh có CCCD khác ⇒ 409 guardians.i.phone.
 * Công bố (2026-10-23, docs/plans/completed/2026-10-23-auto-publish-health-results.md): lưu/sửa cân đo ⇒ BE công bố ngay
 * (published, publishedAt), sửa thì gửi phụ huynh thông báo cập nhật; bỏ POST .../measurements/{id}/publish và publishBlockedReason.
 * Phiếu khám mức Cần theo dõi sát trả parentContact { contacted, atExam, on, opinion } | null.
 * Trùng hồ sơ (2026-10-23): cùng họ tên (giữ dấu), ngày sinh và CCCD của ít nhất một phụ huynh; duplicate-check nhận thêm
 * guardianIdNumbers, trả { kind: ACTIVE | LEFT, sameCampus, id?, code?, fullName?, leftAt?, canReadmit? } | null; LEFT ⇒ gợi ý
 * POST /children/{id}/readmit { reason } (về PENDING_PLACEMENT, giữ hồ sơ cũ). Enrollment/PUT/import 409 theo quy tắc mới.
 * Hiệu trưởng tiếp nhận như PHT trên mọi điểm trường (2026-10-27, docs/plans/active/2026-10-27-principal-child-enrollment.md):
 * duplicate-check, enrollments, import, readmit, placement nhận Hiệu trưởng; POST enrollments và import thêm campusId (bắt buộc
 * khi chưa xếp lớp và người dùng được giao toàn trường; PHT một điểm trường bỏ trống = điểm trường của mình; ngoài phạm vi ⇒ 422
 * campusId; có classId thì trẻ theo điểm trường của lớp, lớp khác campusId ⇒ 422 classId); placement sang lớp điểm trường khác
 * ⇒ campusId của trẻ theo lớp.
 * Form tiếp nhận kích hoạt ngay (2026-10-28, docs/plans/completed/2026-10-28-enroll-activates-guardians.md): POST enrollments tạo/liên
 * kết tài khoản phụ huynh trong cùng giao dịch, gửi SMS mật khẩu tạm, trả thêm guardianAccounts [{ fullName, phone, result:
 * CREATED | LINKED | NOT_ACTIVATED (người lưu không có quyền kích hoạt), smsStatus }]; import không tạo tài khoản.
 * P-18 A (user chốt 2026-10-28): người lưu không có quyền kích hoạt vẫn lưu, phụ huynh mới NOT_ACTIVATED; phụ huynh trùng CCCD tài
 * khoản ⇒ BE dùng họ tên/SĐT/email của tài khoản như import, không cập nhật tài khoản (user đồng ý 2026-10-28).
 * Sửa thông tin phụ huynh (2026-10-28, docs/plans/completed/2026-10-28-guardian-info-editable.md): POST enrollments, PUT /children/{id}
 * nhận họ tên/SĐT/email/CCCD client gửi cho phụ huynh đã có tài khoản và cập nhật tài khoản; đổi SĐT ⇒ tên đăng nhập = SĐT mới, mật
 * khẩu tạm mới gửi SMS. PUT trả thêm accountChanges [{ fullName, phone, phoneChanged, smsStatus }]; guardianAccounts thêm phoneChanged.
 * Đổi cùng lúc CCCD và SĐT của phụ huynh đã có tài khoản ⇒ 422 guardians.i.idNumber. Import vẫn dùng thông tin tài khoản.
 * BE giả theo nghiệp vụ đã chốt (2026-10-28, đặc tả docs/integration/CHILD_ENROLLMENT_BE_SPEC.md): bỏ kích hoạt từng phụ huynh
 * (POST /children/{id}/guardians/{index}/activate, /resend-sms) — kích hoạt khi lưu form hoặc cả nhà ở màn Tài khoản phụ huynh;
 * guardians[].accountStatus NOT_ACTIVATED | ACTIVE | INACTIVE; PUT bỏ phụ huynh đã liên kết tài khoản ⇒ 422 guardians;
 * mở lại hồ sơ theo quyền tiếp nhận; by-citizen-id cho cả người sửa hồ sơ.
 * Năm học (user chốt 2026-10-28, Y-2, Y-3): GET /children?schoolYear=X trả trẻ có lớp thuộc năm X (lớp cuối cùng trong năm X theo
 * enrollment) với classId/className/campusId của lớp đó; trẻ chờ xếp lớp chỉ ở năm đang hoạt động; trẻ nghỉ khi chưa có lớp ở năm
 * của ngày nghỉ. placement-classes chỉ trả lớp năm đang hoạt động (bỏ tham số schoolYear); enrollments/placement với lớp năm khác
 * ⇒ 422 classId.
 * Phụ huynh (user chốt 2026-10-28, D-5a B, D-5b A): relation một trong Bố, Mẹ, Ông, Bà, Anh/chị, Người giám hộ (khác ⇒ 422
 * guardians.i.relation; file nhập so không dấu); mỗi trẻ tối đa 3 phụ huynh (⇒ 422 guardians). Liên kết tài khoản dùng 6 mã tương
 * ứng (FATHER, MOTHER, GRANDFATHER, GRANDMOTHER, SIBLING, GUARDIAN).
 */
export const childrenApi = {
  listChildren: (filters) => axiosClient.get('/children', { params: filters }),
  getChildDetail: (id) => axiosClient.get(`/children/${id}/profile`),
  checkDuplicate: (data, _user, excludeId) =>
    axiosClient.get('/children/duplicate-check', {
      params: {
        fullName: data.fullName,
        dateOfBirth: data.dateOfBirth,
        guardianIdNumbers: (data.guardianIdNumbers || []).join(','),
        excludeId,
      },
    }),
  // POST để CCCD, SĐT phụ huynh không nằm trên URL; lệch phụ huynh đã có ⇒ 409, details theo ô như khi lưu (2026-10-28).
  checkGuardianConflicts: (guardians) => axiosClient.post('/children/guardian-check', { guardians }),
  readmitChild: (childId, body) => axiosClient.post(`/children/${childId}/readmit`, body),
  getPlacementClasses: (filters) => axiosClient.get('/children/placement-classes', { params: filters }),
  enrollChild: (payload) => axiosClient.post('/children/enrollments', payload),
  updateChild: (id, body) => axiosClient.put(`/children/${id}`, body),
  previewImport: (file) => {
    const form = new FormData();
    form.append('file', file);
    return axiosClient.post('/children/enrollments/import/preview', form);
  },
  importChildren: (rows, _user, campusId) => axiosClient.post('/children/enrollments/import', { rows, campusId }),
  placeChild: (childId, body) => axiosClient.post(`/children/${childId}/placement`, body),
  withdrawChild: (childId, body) => axiosClient.post(`/children/${childId}/withdraw`, body),
  saveDeclaration: (childId, body) => axiosClient.put(`/children/${childId}/health-declaration`, body),
  listParentAccounts: (filters) => axiosClient.get('/children/parent-accounts', { params: filters }),
  findParentAccountByCitizenId: (idNumber) => axiosClient.get('/children/parent-accounts/by-citizen-id', { params: { idNumber } }),
  getHealthRecord: (childId) => axiosClient.get(`/children/${childId}/health`),
  saveMeasurement: (childId, measurementId, payload) =>
    measurementId
      ? axiosClient.put(`/children/${childId}/health/measurements/${measurementId}`, payload)
      : axiosClient.post(`/children/${childId}/health/measurements`, payload),
  analyzeHealthTrend: (childId) => axiosClient.post(`/children/${childId}/health/trend-analysis`),
};
