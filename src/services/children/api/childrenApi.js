import { axiosClient } from '@/services/http/axiosClient';
import { enrollmentPhotoRequest } from '@/utils/children/enrollmentPhotos';
import { GUARDIAN_RELATIONSHIP_LABELS } from '@/models/guardianRelationships';
import { stringifyIds } from '@/services/http/idStrings';
import { toBeSchoolYear } from '@/services/http/schoolYearIds';

/**
 * Adapter BE (nhánh G94-180: ChildController, ChildEnrollmentController, ChildPhotoController, HealthMeasurementController...):
 * cùng tên hàm, shape với mock repository; BE đọc phạm vi người dùng từ JWT. Từ 2026-11-11 (plan
 * 2026-11-11-children-module-be-wiring) BE là nguồn đúng: id đổi sang chuỗi, mã quan hệ đổi sang chữ ở đây. Ghi chú bên dưới
 * là lịch sử contract đề xuất trước khi BE làm.
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
 * Kỳ cân đo (user chốt 2026-10-31, docs/plans/completed/2026-10-31-health-measurement-rounds.md): POST .../health/measurements bắt buộc
 * campaignId của kỳ cân đo (kind MEASUREMENT) cùng điểm trường của trẻ, thiếu/sai/đợt khám ⇒ 422 campaignId; trẻ đã có số đo
 * trong kỳ ⇒ 422 campaignId; kỳ chưa bắt đầu, đã đóng hoặc hủy ⇒ 409 (ngày đo: mục 2026-11-04 bên dưới). Số đo cũ ngoài đợt
 * (campaignId null) chỉ xem, PUT ⇒ 409 (2026-11-04). GET health trả openCampaign.kind; kỳ cân đo có resultStatus RECORDED khi trẻ
 * đã có số đo.
 * Cảnh báo ở Sổ sức khỏe (2026-11-04, HLT-16 bỏ, HLT-18, HLT-19; docs/plans/active/2026-11-04-health-warnings-book.md): lần đo bỏ
 * followUpId, followUpEffect, parentContact; thêm bmiStatus (SEVERE_THINNESS | THINNESS | NORMAL | OVERWEIGHT_RISK | OVERWEIGHT |
 * OBESE) và bmiZScore (2 chữ số) cho số đo của kỳ cân đo (có chiều cao, cân nặng, 0–84 tháng), null với phiếu khám. GET health bỏ
 * latestHealth, openFollowUp, externalResults; thêm latestExam { measurementId, campaignId, campaignName, date, followUpLevel,
 * conclusionCategory, conclusion } và latestBmi { measurementId, campaignId, campaignName, date, ageMonths, bmi,
 * bmiStatus, bmiZScore } (null khi chưa có).
 * Tuần thai, ngày đo (2026-11-04, docs/plans/active/2026-11-04-intake-weeks-round-dates.md): profile.gestationWeeks bắt buộc mọi
 * trẻ, 20–42, khớp premature (422 profile.gestationWeeks), lưu cho mọi trẻ. POST/PUT .../health/measurements bỏ date,
 * headCircumferenceCm: BE ghi ngày (mới = hôm nay, sửa giữ ngày), kỳ cân đo không ghi vòng đầu (response vẫn có
 * headCircumferenceCm của dữ liệu cũ); không còn lỗi ngày ngoài kỳ (HEALTH_MEASUREMENT_DATE_OUTSIDE), trùng ngày đo ⇒ 409.
 * GET health bỏ headCircumferenceUntil (mock: rules).
 */
const PAGE_SIZE = 100;
// Màn danh sách, xếp lớp tự lọc theo trạng thái; BE mặc định bỏ trẻ đã nghỉ nên gửi đủ 3 trạng thái như mock
const ALL_STATUSES = ['ACTIVE', 'PENDING_PLACEMENT', 'LEFT'];

const relationLabel = (relation) => GUARDIAN_RELATIONSHIP_LABELS[relation] || relation;
const relationCode = (relation) =>
  Object.keys(GUARDIAN_RELATIONSHIP_LABELS).find((key) => GUARDIAN_RELATIONSHIP_LABELS[key] === relation) || relation;
const withRelationLabels = (guardians = []) => guardians.map((g) => ({ ...g, relation: relationLabel(g.relation) }));
// Cùng cách hiển thị năm học với header (SchoolYearContext): "2026 - 2027"
const yearLabel = (name) => (name ? String(name).replace('-', ' - ') : name);
// BE trả id số; màn và mock dùng id chuỗi (plan 2026-11-11-children-module-be-wiring)
const read = (promise) => promise.then(stringifyIds);
// approvedBy không theo mẫu tên id ⇒ đổi riêng để so với user.id (chuỗi) như mock
const readTrend = (promise) => read(promise).then((t) => (t && t.approvedBy != null ? { ...t, approvedBy: String(t.approvedBy) } : t));

/**
 * BE:ChildController.searchChildren (G94-180/CHD-09) trả trang {items, totalPages}, tối đa 100 trẻ/trang; lọc theo
 * schoolYear, campusId, classroomId, status, q. Màn hình cần cả danh sách ⇒ đọc hết các trang, đổi classroomId → classId
 * và mã quan hệ → chữ như mock.
 */
export async function listAllChildren(filters = {}) {
  const params = Object.fromEntries(
    Object.entries({
      schoolYear: await toBeSchoolYear(filters.schoolYear),
      campusId: filters.campusId,
      classroomId: filters.classId,
      q: filters.keyword,
      status: filters.statuses?.join(','),
    }).filter(([, v]) => v),
  );
  const items = [];
  let page = 0;
  let totalPages = 1;
  do {
    const result = await axiosClient.get('/children', { params: { ...params, page, size: PAGE_SIZE } });
    // Bản cũ (mảng) vẫn đọc được
    if (Array.isArray(result)) return stringifyIds(result);
    items.push(...(result?.items || []));
    totalPages = result?.totalPages || 0;
    page++;
  } while (page < totalPages);
  return stringifyIds(
    items.map((child) => ({ ...child, classId: child.classId ?? child.classroomId, guardians: withRelationLabels(child.guardians) })),
  );
}

/** Lớp, nhóm tuổi, giáo viên của một năm học (BE:ClassController GET /school-structure, theo phạm vi người xem). */
async function getClassOptions(schoolYear) {
  const beYear = await toBeSchoolYear(schoolYear);
  const structure = stringifyIds(await axiosClient.get('/school-structure', { params: beYear ? { schoolYear: beYear } : {} }));
  const { year } = structure;
  return {
    year: year ? { id: year.id, name: yearLabel(year.name), startDate: year.startDate, status: year.status } : null,
    ageGroups: (structure.ageGroups || []).map(({ id, code, name, shortName, ageFromMonths, ageToMonths }) => ({
      id,
      code,
      name,
      shortName,
      ageFromMonths,
      ageToMonths,
    })),
    classes: (structure.classes || []).map((c) => ({
      id: c.id,
      name: c.name,
      campusId: c.campusId,
      ageGroupId: c.ageGroupId,
      schoolYear: c.schoolYearId,
      capacity: c.capacity,
      homeroomTeacherId: c.homeroomTeacherId,
      homeroomTeacherName: (c.teachers || []).find((t) => t.id === c.homeroomTeacherId)?.fullName,
      teacherIds: c.teacherIds || [],
    })),
  };
}

/** Tên năm học, nhóm tuổi, giáo viên chủ nhiệm cho lớp ở hồ sơ trẻ; không đọc được cấu trúc lớp thì để trống. */
async function withClassNames(cls) {
  if (!cls?.schoolYearId) return cls;
  try {
    const { year, ageGroups, classes } = await getClassOptions(cls.schoolYearId);
    return {
      ...cls,
      schoolYearName: year?.name,
      ageGroupName: ageGroups.find((g) => g.id === cls.ageGroupId)?.name,
      homeroomTeacherName: classes.find((c) => c.id === cls.id)?.homeroomTeacherName,
    };
  } catch {
    return cls;
  }
}

/** Hồ sơ trẻ (BE GET /children/{id}/profile) về shape mock: { child, cls, declaration, placements }, chưa thêm tên lớp. */
async function loadProfile(id) {
  const result = stringifyIds(await axiosClient.get(`/children/${id}/profile`));
  const child = {
    ...result.child,
    guardians: withRelationLabels(result.child?.guardians),
    // Lịch sử hồ sơ BE ghi userFullName; màn đọc userName như lịch sử khai báo, xếp lớp
    history: (result.child?.history || []).map((h) => ({ ...h, userName: h.userName ?? h.userFullName })),
  };
  const cls =
    result.cls ||
    (child.classId ? { id: child.classId, name: child.className, campusId: child.campusId, ageGroupId: child.ageGroupId } : null);
  return { declaration: null, placements: [], ...result, cls, child };
}

export const childrenApi = {
  listChildren: (filters = {}) => listAllChildren({ ...filters, statuses: ALL_STATUSES }),
  getClassOptions,
  getChildDetail: async (id) => {
    const detail = await loadProfile(id);
    return { ...detail, cls: await withClassNames(detail.cls) };
  },
  checkDuplicate: (data, _user, excludeId) =>
    read(
      axiosClient.get('/children/duplicate-check', {
        params: {
          fullName: data.fullName,
          dateOfBirth: data.dateOfBirth,
          guardianIdNumbers: (data.guardianIdNumbers || []).join(','),
          excludeId,
        },
      }),
    ),
  // POST để CCCD, SĐT phụ huynh không nằm trên URL; lệch phụ huynh đã có ⇒ 409, details theo ô như khi lưu (2026-10-28).
  checkGuardianConflicts: (guardians) => axiosClient.post('/children/guardian-check', { guardians }),
  readmitChild: (childId, body) => read(axiosClient.post(`/children/${childId}/readmit`, body)),
  getPlacementClasses: (filters) => read(axiosClient.get('/children/placement-classes', { params: filters })),
  enrollChild: (payload) => {
    const { body, config } = enrollmentPhotoRequest(payload);
    return read(axiosClient.post('/children/enrollments', body, config));
  },
  // BE nhận mã quan hệ (FATHER...); savedPhone chỉ để form khóa ô SĐT đã lưu (G94-180/AUTH-21)
  updateChild: (id, body) =>
    read(
      axiosClient.put(`/children/${id}`, {
        ...body,
        child: {
          ...body.child,
          guardians: (body.child?.guardians || []).map(({ savedPhone: _savedPhone, ...g }) => ({
            ...g,
            relation: relationCode(g.relation),
          })),
        },
      }),
    ),
  previewImport: (file) => {
    const form = new FormData();
    form.append('file', file);
    return read(axiosClient.post('/children/enrollments/import/preview', form)).then((preview) => ({
      ...preview,
      rows: preview.rows.map((row) => ({
        ...row,
        payload: {
          ...row.payload,
          child: { ...row.payload.child, guardians: withRelationLabels(row.payload.child.guardians) },
        },
      })),
    }));
  },
  importChildren: (rows, _user, campusId) =>
    read(axiosClient.post('/children/enrollments/import', { rows: rows.map((row) => enrollmentPhotoRequest(row).body), campusId })),
  placeChild: (childId, body) => read(axiosClient.post(`/children/${childId}/placement`, body)),
  withdrawChild: (childId, body) => read(axiosClient.post(`/children/${childId}/withdraw`, body)),
  saveDeclaration: (childId, body) => read(axiosClient.put(`/children/${childId}/health-declaration`, body)),
  listParentAccounts: (filters) => read(axiosClient.get('/children/parent-accounts', { params: filters })),
  findParentAccountByCitizenId: (idNumber) =>
    read(axiosClient.get('/children/parent-accounts/by-citizen-id', { params: { idNumber } })).then(
      (account) => account && { ...account, relation: relationLabel(account.relation) },
    ),
  // BE sổ sức khỏe không có thông tin trẻ, lớp (ChildHealthRecordResponse): ghép từ hồ sơ như mock; GV có CHILD_PROFILE_VIEW
  getHealthRecord: async (childId) => {
    const [record, detail] = await Promise.all([read(axiosClient.get(`/children/${childId}/health`)), loadProfile(childId)]);
    return { ...record, child: detail.child, cls: detail.cls, declaration: detail.declaration };
  },
  saveMeasurement: (childId, measurementId, payload) =>
    read(
      measurementId
        ? axiosClient.put(`/children/${childId}/health/measurements/${measurementId}`, payload)
        : axiosClient.post(`/children/${childId}/health/measurements`, payload),
    ),
  // HLT-21: period = khoảng đang chọn trên biểu đồ (MONTHS_6 | MONTHS_12 | ALL)
  analyzeHealthTrend: (childId, period = 'ALL') =>
    readTrend(axiosClient.post(`/children/${childId}/health/trend-analysis`, null, { params: { period } })),
  // HLT-21: bản mới nhất (nháp hoặc đã duyệt), null khi trẻ chưa có bản nào
  getLatestHealthTrend: (childId) => readTrend(axiosClient.get(`/children/${childId}/health/trend-analysis`)),
  // Chỉ GV phụ trách lớp hiện tại của trẻ (BE 403 5041); content trống ⇒ duyệt nguyên bản AI
  approveHealthTrend: (childId, interpretationId, content) =>
    readTrend(axiosClient.post(`/children/${childId}/health/trend-analysis/${interpretationId}/approve`, content ? { content } : {})),
};
