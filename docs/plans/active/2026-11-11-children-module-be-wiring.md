---
title: Nối module children (hồ sơ trẻ, sức khỏe) với BE thật
status: in-progress  # draft → approved (chỉ user duyệt) → in-progress → done | blocked | cancelled
owner: Claude Code (agent); user duyệt
jira: G94-180 / FE-FEAT-43
branch: feature/G94-180-FE-FEAT-43-child-health-pickup
modules: [children, health]
rules: [G94-180/CHD-01, G94-180/CHD-03, G94-180/CHD-09, G94-180/CHD-10, G94-180/AUTH-21, AUTH-02, HLT-08, G94-180/HLT-08, HLT-09, HLT-13]
risk: high           # 17 màn, đổi nguồn dữ liệu cả module; id kiểu số làm hỏng nhiều phép so sánh
created: 2026-11-11
updated: 2026-11-11
---
# Nối module children (hồ sơ trẻ, sức khỏe) với BE thật

## Context

Khi build nối BE (`VITE_USE_MOCK=false`), module `children` vẫn là `source: 'demo'` (`src/config/integrationModules.js:117-122`). Mọi màn `/children/*` đọc dữ liệu mẫu trong trình duyệt và dùng tài khoản mẫu, trừ `/children/activation` (module `guardian`, đã `api`).

Hệ quả: màn Tài khoản phụ huynh lấy trẻ từ BE (id số), nhưng nút "Sửa thông tin ở hồ sơ trẻ" (`src/components/account/GuardianPanel.jsx:230`) mở `/children/{id BE}/edit`. Màn này tìm id đó trong mock và báo "Không tìm thấy hồ sơ trẻ". Giới hạn này đã ghi từ trước ở `docs/plans/active/2026-11-01-guardian-be-wiring.md:42`.

Hiện trạng đã kiểm ngày 2026-11-11:
- 32 lời gọi của module (`src/services/children/api/childrenApi.js`, `src/services/children/api/healthCheckApi.js`) đều có route ở BE nhánh G94-180 (`CareNest_BE/docs/api/openapi.yaml`).
- `origin/dev` của BE (`09a594c`) còn thiếu 6 route: `PUT /children/{id}`, `POST /children/{id}/placement`, `POST /children/{id}/withdraw`, `PUT /children/{id}/health-declaration`, `GET /children/parent-accounts`, `POST /children/{id}/health/trend-analysis`. `GET /children/guardian-overview` của module `guardian` cũng chỉ có ở nhánh.
- Mọi phương thức facade (`childrenService.js`, `healthCheckService.js`) đều có trong adapter API. Không có màn nào bỏ qua facade để đọc mock trực tiếp.
- Lỗi theo ô khớp: BE trả `data: [{field, message}]` (`CareNest_BE/.../exception/GlobalExceptionHandler.java:55-57`), FE đổi thành `err.details` (`src/services/http/apiError.js:20-23`).
- Adapter `childrenApi.js:5-6` vẫn ghi "PROPOSED ... not agreed with CareNest_BE yet". Đối chiếu từng response cho thấy các chỗ hỏng dưới đây.

### Chỗ hỏng khi bật `api` (đã kiểm trên code)

BLOCKER, màn không dùng được:
1. **Id số và chuỗi.** BE trả id kiểu `Long`; tham số URL, mock và `user.id`/`user.campusId` là chuỗi (`src/services/authProfile.js:26,39`). Các phép `===` hỏng:
   - `ClassPlacementPage.jsx:50`: không chọn được trẻ để xếp lớp.
   - `ChildrenListPage.jsx:61-62`: lọc điểm trường/lớp ra 0 dòng.
   - `HealthMeasurementFormPage.jsx:52`: trang sửa số đo luôn báo không tìm thấy.
   - `childrenPermissions.js:103`: PHT không quản lý được đợt khám.
2. **Sửa hồ sơ.** Adapter gửi nhãn quan hệ ("Bố") (`EditChildPage.jsx:44-50`, `childrenApi.js:123`). BE chỉ nhận mã (`EnrollmentFormValidator.java:187-191`), nên mọi lần lưu báo lỗi 400.
3. **Danh sách trẻ.**
   - Adapter chỉ gửi `campusId`, `classroomId`, `q` (`childrenApi.js:75-77`). Không gửi `status`, nên BE mặc định bỏ trẻ đã nghỉ (`ChildListServiceImpl.java:57-58`). Không gửi `schoolYear`, nên năm cũ vẫn hiện dữ liệu năm hiện tại.
   - Danh sách lớp để lọc lấy từ `school-lookup` (demo) (`ChildrenListPage.jsx:52`, `integrationModules.js:112-116`).
4. **Sổ sức khỏe.**
   - `GET /children/{id}/health` không trả `child`, `cls`, `declaration` (`ChildHealthRecordResponse.java:16-22`). Ba trang `ChildHealthRecordPage.jsx:61`, `HealthMeasurementFormPage.jsx:92`, `HealthTrendPage.jsx:181` rơi vào trạng thái lỗi quyền.
   - Quyền giáo viên dựa vào `cls.teacherIds` (`childrenPermissions.js:36,93`). Endpoint sức khỏe không trả trường này, nhưng có cờ `canRecord`.

DEGRADED, chạy được nhưng thiếu hoặc sai thông tin:
- Quan hệ hiện mã ("FATHER") ở danh sách và ở tra CCCD (`ChildInfoFields.jsx:330`).
- Hồ sơ trẻ:
  - Thiếu tên năm học: BE chỉ có `schoolYearId` (`ChildProfilePage.jsx:248`).
  - Tên giáo viên chủ nhiệm và tên người trong lịch sử tra qua danh bạ demo (`ChildProfilePage.jsx:174,254`).
  - FE có hành động lịch sử `UPDATED_FROM_EXAM`, BE không có (`ChildProfilePage.jsx:59`).
- Nhóm tuổi FE là danh sách cứng với id `ag-2..ag-5` (`src/models/School.js:28-35`). `suggestAgeGroupId` cắt năm học như chuỗi (`src/utils/children/childrenHelpers.js:10-16`), nên lọc nhóm tuổi và trục biểu đồ xu hướng sai.
- Lớp không giới hạn sĩ số (`capacity = null`) bị coi là đầy (`ClassPlacementFields.jsx:92`).
- Phiếu khám:
  - BE không có `child.schoolName`.
  - Số trong `draft` là `null`, không phải `''` (`ExamAdminStep.jsx:40`, `HealthExamFormPage.jsx:156`).
- Số đo: FE không giới hạn 1 chữ số thập phân, BE từ chối (`childrenValidation.js:171-176`).
- Báo cáo tăng trưởng: lọc điểm trường so chuỗi với số (`GrowthReportPage.jsx:127-129`).
- PHT phụ trách nhiều điểm trường có `user.campusId = null` (`authProfile.js:39`), nên `canManageHealthCheck` luôn trả false.
- Sửa hồ sơ:
  - FE cho đổi SĐT phụ huynh và hứa đổi tên đăng nhập (`ChildInfoFields.jsx:38-40`).
  - BE từ chối, vì rule G94-180/AUTH-21 (sửa 2026-11-11) khóa ô SĐT và bắt đổi qua yêu cầu riêng (`ChildProfileEditServiceImpl.java:83-90`).

## Quyết định đã chốt
1. Chuyển module `children` sang BE thật, thay vì ẩn link hay để nguyên. User chọn hướng 1, ngày 2026-11-11.
2. FE gọi endpoint mới chỉ merge sau khi BE tương ứng đã lên `dev`. Đây là quy trình chung user chốt ngày 2026-11-11. Trong lúc phát triển, kiểm với BE nhánh G94-180 chạy local (`carenest_local`).
3. Tiếp nhận và nhập Excel luôn có ít nhất một phụ huynh và đúng một người nhận tài khoản (user, 2026-11-11).
4. Đổi SĐT phụ huynh: plan này chỉ khóa ô SĐT; UI gửi/duyệt yêu cầu làm plan riêng (user, Q1, 2026-11-11).
5. Gợi ý khi nhập Excel: sửa BE theo mock, như một việc BE riêng trên nhánh G94-180, xong trước Phase 3 (user, Q2, 2026-11-11). Chi tiết ở mục "Việc BE kèm theo".
6. Nút duyệt giải thích xu hướng AI: plan riêng (user, Q3, 2026-11-11).
7. Khi bật BE gặp lỗi: sửa tiếp theo dữ liệu BE, không quay về dữ liệu mẫu (user, 2026-11-11). Dữ liệu mẫu chỉ còn cho `VITE_USE_MOCK=true` và test mock.

## Làm rõ nghiệp vụ
- **Hiểu nghiệp vụ:**
  - Actor: HT, PHT, GV trên Web.
  - Outcome: màn hồ sơ trẻ và sức khỏe đọc, ghi dữ liệu thật, cùng id với các màn đã nối BE (Tài khoản phụ huynh, điểm danh, đánh giá).
  - Rule: G94-180/CHD-01, CHD-03, CHD-09, CHD-10, G94-180/AUTH-21 (CONFIRMED); AUTH-02, HLT-08, HLT-09, HLT-13 (CONFIRMED); HLT-17..20 (PROPOSED, đã triển khai, không đổi trong plan này).
  - Flow: [B] màn gọi facade → [S] adapter API gọi BE, chuẩn hóa dữ liệu về shape FE đang dùng → màn hiển thị.
- **Đối chiếu thiết kế ban đầu:**
  - Adapter viết theo mock trước ("PROPOSED", `childrenApi.js:5-6`). Nay BE là nguồn đúng; chỗ lệch xử lý ở adapter, không sửa BE (trừ khi câu hỏi mở đổi điều này).
  - AUTH-21 mới chốt 2026-11-11: ô SĐT phụ huynh trong Sửa hồ sơ phải khóa. FE hiện còn cho sửa.
- **Ảnh hưởng:**
  - FE: mọi route `/children/*` trừ `/children/activation` (17 màn, `src/routes/AppRoutes.jsx:309-345`). Màn "Tài khoản phụ huynh" mở đúng hồ sơ trẻ.
  - Quyền: theo BE (`canRecord`, scope campus).
  - Nhãn "Dữ liệu demo" mất ở `/children/*`.
  - APP: không đổi. BE: không đổi contract.
  - Dữ liệu cũ: dữ liệu mẫu trong trình duyệt chỉ còn dùng khi `VITE_USE_MOCK=true`.

### Câu hỏi mở
- [x] Q1 (G94-180/AUTH-21): đổi SĐT phụ huynh.
  - BE đã có:
    - gửi yêu cầu kèm lý do: `POST /children/{id}/guardians/{gid}/phone-change-requests`, `ChildEnrollmentController.java:65`;
    - xem, duyệt, từ chối: `/parent-accounts/phone-change-requests`, `GuardianPhoneChangeController.java:28,48,58`.
  - FE chưa có màn nào cho việc này.
  - Chọn: (A) plan này chỉ khóa ô SĐT, kèm ghi chú; UI gửi và duyệt yêu cầu làm plan riêng; trong thời gian chờ, Web không đổi được SĐT phụ huynh. (B) làm luôn trong plan này: nút "Yêu cầu đổi SĐT" ở Sửa hồ sơ, khối danh sách yêu cầu chờ duyệt (Duyệt/Từ chối) cho HT, PHT; thêm 1 phase, khoảng 6–8 file.
  - Đề xuất: A.
- [x] Q2: Khi xem trước file Excel, BE luôn trả `notes` rỗng (`ChildEnrollmentImportServiceImpl.java:117-118`).
  - Mất gợi ý "phụ huynh đã có tài khoản (trùng CCCD)": mock có (`childrenMockRepository.js:1118-1122`).
  - Trẻ trùng hồ sơ đã nghỉ: BE chặn dòng bằng câu chung "Trẻ đã có hồ sơ trong hệ thống" (`ChildEnrollmentImportServiceImpl.java:108-116`). Mock chỉ gợi ý "nên mở lại hồ sơ cũ" (`childrenMockRepository.js:1128-1130`). Rule G94-180/CHD-04 ghi "trùng trẻ đã nghỉ ⇒ gợi ý mở lại hồ sơ cũ".
  - Chọn: (A) chấp nhận như BE hiện tại; (B) sửa nhỏ ở BE như một việc riêng (làn M BE, cùng nhánh G94-180, xong trước Phase 3): điền `notes` cho phụ huynh trùng CCCD, câu lỗi trẻ đã nghỉ nêu mã hồ sơ cũ và hướng "mở lại hồ sơ ở Tiếp nhận trẻ". Plan FE này không đổi.
  - Đề xuất: B.
- [x] Q3: Giải thích xu hướng bằng AI.
  - BE (rule AI-07, AI-02): bản AI là nháp. HT, PHT hoặc GV duyệt (có thể sửa câu chữ) thì phụ huynh mới thấy trong APP (`HealthTrendController.java:28,54`; `CareNest_BE/docs/modules/health.md:32`).
  - FE ghi "chỉ tham khảo, không có bước duyệt" và không có nút duyệt (`src/components/children/AiTrendPanel.jsx:22-23`). Tài liệu hai bên lệch nhau.
  - Chọn: (A) plan riêng: phụ huynh chưa thấy giải thích AI cho tới khi làm; (B) làm trong plan này: thêm nút Duyệt, cho sửa câu chữ, hiện trạng thái Nháp/Đã duyệt (Phase 2, khoảng 2 file).
  - Đề xuất: A.
- [x] Q4 (HLT-01, HLT-08): ai quản lý đợt khám/kỳ cân đo. User trả lời 2026-11-11: "được phân quyền cũng có thể phụ trách đợt khám".
  - Hiện trạng BE: chỉ vai trò HT, PHT, kèm phạm vi điểm trường (`CareNest_BE/.../service/health/impl/HealthCheckRules.java:67-69`, `HealthCheckController.java:66,83,119-168`). Ma trận phân quyền không có quyền cho đợt khám (`CareNest_BE/.../utils/enums/Permission.java:16-76`).
  - Chọn: (A) theo phân công điểm trường: HT mọi điểm trường; PHT mọi điểm trường mình được phân công, kể cả nhiều điểm trường. BE đã đúng, FE sửa trong Phase 2. (B) thêm quyền cấu hình được "Quản lý đợt khám, kỳ cân đo" vào ma trận phân quyền (mặc định HT, PHT; HT cấp thêm cho người khác). Đổi rule HLT-01, HLT-08, cần sửa BE (quyền mới, migration, kiểm tra quyền) và FE ⇒ plan riêng, plan chính ở BE.
  - Đề xuất: A trong plan này; B nếu cần thì plan riêng.

| Câu hỏi | Trả lời | Ai | Ngày | Rule/doc đã cập nhật |
| --- | --- | --- | --- | --- |
| Q1 | A: plan này chỉ khóa ô SĐT + ghi chú; UI gửi/duyệt yêu cầu làm plan riêng | user | 2026-11-11 | plan này |
| Q2 | B, phần BE làm theo mock: preview điền `notes` phụ huynh trùng CCCD như mock; trẻ trùng hồ sơ đã nghỉ không chặn, chỉ ghi chú "nên mở lại hồ sơ cũ" như mock; trẻ trùng đang học/chờ xếp lớp vẫn chặn | user | 2026-11-11 | plan này; khớp G94-180/CHD-04 (`CareNest_BE/docs/business/BUSINESS_RULES.md:337`) |
| Q3 | A: nút duyệt giải thích AI làm plan riêng | user | 2026-11-11 | plan này |
| Duyệt cách làm | Duyệt Key decisions 1–4 và quy tắc merge; quyền đợt khám ⇒ Q4; khi bật BE có lỗi thì sửa tiếp theo dữ liệu BE, không quay về dữ liệu mẫu | user | 2026-11-11 | plan này |
| Q2 (xác nhận) | Đúng cách hiểu ở mục "Việc BE kèm theo" | user | 2026-11-11 | plan này |
| Q4 | A: HT mọi điểm trường; PHT mọi điểm trường được phân công, kể cả nhiều điểm trường; BE giữ nguyên, FE sửa ở Phase 2 | user | 2026-11-11 | plan này; khớp HLT-01, HLT-08 |

## Acceptance criteria
Mọi AC chạy với `VITE_USE_MOCK=false`, BE nhánh G94-180 local.
- **AC-1** (G94-180/CHD-09):
  - Given năm học X chọn ở header, When mở Danh sách trẻ, Then thấy trẻ có lớp thuộc năm X, gồm cả trẻ đã nghỉ (thống kê "Đã nghỉ" đúng).
  - Lọc điểm trường, lớp trả đúng trẻ; danh sách lớp để lọc là lớp BE của năm X.
- **AC-2** (G94-180/CHD-10): Given trẻ chờ xếp lớp, When mở Xếp lớp từ dòng trẻ, Then form mở đúng trẻ, gợi ý nhóm tuổi theo năm sinh; lưu thành công.
- **AC-3** (G94-180/AUTH-21):
  - Given hồ sơ có phụ huynh đã lưu, When Sửa hồ sơ và lưu, Then BE nhận đúng mã quan hệ và lưu thành công.
  - Ô SĐT phụ huynh đã lưu bị khóa, kèm ghi chú đổi SĐT qua yêu cầu.
- **AC-4** (G94-180/CHD-01): Hồ sơ trẻ hiện đủ:
  - quan hệ phụ huynh bằng chữ;
  - tên năm học, nhóm tuổi, lớp, tên giáo viên chủ nhiệm;
  - tên người trong lịch sử thay đổi.
- **AC-5** (G94-180/CHD-03): Cho nghỉ học và mở lại hồ sơ chạy với BE; trạng thái trẻ đổi đúng ở danh sách và hồ sơ.
- **AC-6** (HLT-09, HLT-13):
  - Given GV lớp của trẻ, When mở Sổ sức khỏe, Then thấy thông tin trẻ, nút Nhập số đo theo `canRecord` của BE.
  - Sửa số đo mở đúng lần đo, bắt lý do.
  - Số đo quá 1 chữ số thập phân báo lỗi ở ô trước khi gửi.
- **AC-7** (AUTH-02, HLT-08): PHT, kể cả PHT phụ trách nhiều điểm trường, tạo, sửa, đóng, hủy, mở lại đợt khám ở điểm trường mình; điểm trường khác thì không.
- **AC-8** (G94-180/HLT-08): Danh sách đợt khám, chi tiết đợt (mở đúng lớp), phiếu khám (tên trường, số trống thành ô trống), báo cáo tăng trưởng (lọc điểm trường) chạy với BE.
- **AC-9** (G94-180/AUTH-21): Từ Tài khoản phụ huynh, "Sửa thông tin ở hồ sơ trẻ" mở đúng hồ sơ BE (lỗi ban đầu).
- **AC-10:** `node scripts/check-api-contract.mjs` với `children: source 'api'` → 0 lỗi; mọi lời gọi khớp route BE.

## Key decisions
| Quyết định | Chọn | Phương án khác | Vì sao |
| --- | --- | --- | --- |
| Phạm vi bật `api` | Cả module `children` (hồ sơ + sức khỏe) một lần, ở phase cuối | Tách khóa module hồ sơ / sức khỏe, bật từng phần | Id trẻ đi xuyên hồ sơ, sổ sức khỏe, danh sách khám; bật từng phần tái lỗi "không tìm thấy hồ sơ" giữa các màn. Phase 1–2 chỉ sửa đường `api`, mock không đổi hành vi |
| Id số và chuỗi | Adapter đổi mọi `id`, `*Id`, `*Ids` của response sang chuỗi (helper dùng chung, chỉ ở đường `api`) | Sửa từng phép so sánh bằng `String()` | Màn và mock đều coi id là chuỗi; một chỗ đổi thay vì hàng chục phép so sánh. Body gửi id chuỗi: Jackson tự đổi sang `Long` |
| Thông tin trẻ cho Sổ sức khỏe | `getHealthRecord` gọi song song `GET /children/{id}/health` và `GET /children/{id}/profile`, ghép `child`, `cls`, `declaration`; nút ghi theo `canRecord` của BE | BE thêm thông tin trẻ vào response sức khỏe | Không đổi contract BE. GV có `CHILD_PROFILE_VIEW` mặc định (`CareNest_BE/.../V7__create_permissions.sql:58`) |
| Lớp, nhóm tuổi, tên giáo viên | Facade `children` thêm `getClassOptions(schoolYear)`: mock trả lớp mock; API đọc `GET /school-structure` (lớp, nhóm tuổi, tên giáo viên) | Bật `school-lookup` sang `api` | `school-lookup` phục vụ nhiều màn demo khác; BE chưa có `GET /classes` (`integrationModules.js:111`) |
| Quyền PHT nhiều điểm trường (Q4 = A) | `canManageHealthCheck` xét `user.locationIds` | Giữ `user.campusId`; quyền cấu hình được (không làm) | `campusId` là null khi PHT có nhiều điểm trường (`authProfile.js:39`) |

## Việc BE kèm theo (Q2, làm theo mock)
Làm ở repo BE, nhánh G94-180, làn M (mini-plan trong chat, `node scripts/verify.mjs` BE). Xong trước Phase 3. Không đổi contract: `PreviewRow.notes` đã có.
- File: M `CareNest_BE/src/main/java/com/carenest/service/child/impl/ChildEnrollmentImportServiceImpl.java` (preview, dòng 108-118), M test nhập Excel của BE.
- Hiện trạng:
  - Preview coi mọi trẻ trùng là lỗi "Trẻ đã có hồ sơ trong hệ thống" (`ChildEnrollmentImportServiceImpl.java:108-116`), kể cả trẻ đã nghỉ.
  - Lúc lưu, BE chỉ chặn trẻ trùng chưa nghỉ (`ChildIntakeServiceImpl.java:258-266`).
  - `notes` luôn rỗng (`:117-118`).
- Sau khi sửa, khớp mock `childrenMockRepository.js:1118-1130`:
  1. Trùng trẻ đang học/chờ xếp lớp: vẫn là lỗi, câu "Trẻ đã có hồ sơ trong hệ thống (trùng họ tên, ngày sinh và phụ huynh)".
  2. Trùng trẻ đã nghỉ: không chặn dòng, thêm ghi chú "Trẻ từng học ở trường (hồ sơ cũ {mã}, đã nghỉ học): nên mở lại hồ sơ cũ ở Tiếp nhận trẻ thay vì nhập mới."
  3. Phụ huynh trùng CCCD với tài khoản: ghi chú "Phụ huynh đã có tài khoản (trùng CCCD): {họ tên} · {SĐT}. Dùng thông tin tài khoản, chỉ liên kết người được chọn khi kích hoạt sau khi nhập."
- Test BE: preview với trẻ trùng đang học (lỗi), trẻ trùng đã nghỉ (ghi chú, không lỗi), phụ huynh trùng CCCD (ghi chú); nhập dòng trẻ trùng đã nghỉ tạo hồ sơ mới.

## Phases
### Phase 1 — Hồ sơ trẻ: adapter và màn
- Files:
  - C `src/services/http/idStrings.js`
  - M `src/services/children/api/childrenApi.js`
  - M `src/services/children/childrenService.js`
  - M `src/services/children/mock/childrenMockRepository.js`
  - M `src/pages/children/ChildrenListPage.jsx`
  - M `src/pages/children/ChildProfilePage.jsx`
  - M `src/components/children/ClassPlacementFields.jsx`
  - M `src/components/children/ChildInfoFields.jsx`
  - M `src/utils/children/childrenHelpers.js`
  - C `tests/children/children-api-be.test.mjs`
- Steps:
  1. Helper đổi id sang chuỗi; áp vào mọi response của `childrenApi`.
  2. `listChildren` gửi `schoolYear`, `status` (mặc định cả ACTIVE, PENDING_PLACEMENT, LEFT) và đổi mã quan hệ sang chữ.
  3. `findParentAccountByCitizenId` đổi mã quan hệ sang chữ. `updateChild` đổi chữ sang mã trước khi gửi.
  4. `getChildDetail`:
     - thêm tên năm học;
     - tên giáo viên chủ nhiệm từ `getClassOptions`;
     - tên người trong lịch sử từ `userFullName`/`userName` BE.
     Bỏ nhánh `UPDATED_FROM_EXAM`.
  5. `getClassOptions` ở facade, mock và API. Danh sách trẻ, xếp lớp, tiếp nhận dùng nó thay `useClasses` và `AGE_GROUPS`. `suggestAgeGroupId` nhận danh sách nhóm tuổi.
  6. `capacity = null` coi là không giới hạn.
  7. Khóa ô SĐT phụ huynh đã lưu ở Sửa hồ sơ, ghi chú đổi qua yêu cầu; bỏ câu hứa đổi tên đăng nhập.
- Tests:
  - AC-1..AC-4 → `tests/children/children-api-be.test.mjs` (adapter với response có shape BE, gọi qua axios giả như `tests/auth/guardian-api.test.mjs`).
  - Test mock hiện có giữ nguyên, pass.
- Exit: `node scripts/verify.mjs` → `VERIFY PASS full`.
- **Dừng chờ user review.**

### Phase 2 — Sức khỏe: adapter và màn
- Files:
  - M `src/services/children/api/childrenApi.js` (phần sức khỏe)
  - M `src/services/children/api/healthCheckApi.js`
  - M `src/utils/children/childrenPermissions.js`
  - M `src/utils/children/childrenValidation.js`
  - M `src/pages/children/ChildHealthRecordPage.jsx`
  - M `src/pages/children/HealthMeasurementFormPage.jsx`
  - M `src/pages/children/HealthTrendPage.jsx`
  - M `src/pages/children/GrowthReportPage.jsx`
  - M `src/components/children/exam/ExamAdminStep.jsx`
  - C `tests/health/health-api-be.test.mjs`
- Steps:
  1. Đổi id sang chuỗi cho mọi response của `healthCheckApi` và phần sức khỏe trong `childrenApi`.
  2. `getHealthRecord` ghép hồ sơ trẻ. Màn dùng `canRecord` của BE khi có, mock giữ cách tính cũ.
  3. Số đo tối đa 1 chữ số thập phân (lỗi ở ô).
  4. `canManageHealthCheck` xét `user.locationIds`.
  5. Phiếu khám:
     - tên trường lấy từ cấu hình trường khi thiếu `child.schoolName`;
     - `draft` null thành `''`.
  6. Trục biểu đồ xu hướng và lọc báo cáo tăng trưởng dùng nhóm tuổi, điểm trường BE.
- Tests:
  - AC-6..AC-8 → `tests/health/health-api-be.test.mjs`.
  - Quyền PHT nhiều điểm trường → test `canManageHealthCheck` trong cùng file.
- Exit: `node scripts/verify.mjs` → `VERIFY PASS full`.
- **Dừng chờ user review.**

### Phase 3 — Bật `api`, kiểm với BE thật, tài liệu
- Files:
  - M `src/config/integrationModules.js` (`children.source = 'api'`)
  - M `docs/integration/be-api-routes.json` (`--sync`)
  - C `tests/e2e/system/children-records.spec.mjs`
  - M `docs/features/README.md`
  - M `docs/plans/active/2026-11-01-guardian-be-wiring.md` (bỏ giới hạn dòng 42)
- Steps:
  1. Bật `api`, chạy `node scripts/check-api-contract.mjs --sync` rồi kiểm.
  2. Viết Playwright system test chạy với BE local: danh sách, hồ sơ, sửa hồ sơ, xếp lớp, cho nghỉ, mở lại hồ sơ, sổ sức khỏe, nhập/sửa số đo, đợt khám (PHT), mở hồ sơ từ Tài khoản phụ huynh.
  3. Đi tay 17 màn bằng tài khoản HT, PHT, GV; ghi lỗi còn lại vào Progress log.
- Tests:
  - AC-9, AC-10 → `children-records.spec.mjs`, `check-api-contract.mjs`.
  - AC-1..AC-8 lặp lại ở tầng trình duyệt.
- Exit:
  - `node scripts/verify.mjs` → `VERIFY PASS full`.
  - `npm run test:e2e:system -- children-records` → pass (cần BE, Keycloak, `E2E_DEV_PASSWORD`; không nằm trong verify).
- Merge: chỉ sau khi BE G94-180 đã lên `dev` (Quyết định 2).
- **Dừng chờ user review.**

## Test matrix
| AC | Rule | Test (tầng) | Phase | Kết quả |
| --- | --- | --- | --- | --- |
| AC-1 | G94-180/CHD-09 | `children-api-be.test.mjs` (adapter); `children-records.spec.mjs` (trình duyệt) | 1, 3 | chưa chạy |
| AC-2 | G94-180/CHD-10 | `children-api-be.test.mjs`; `children-records.spec.mjs` | 1, 3 | chưa chạy |
| AC-3 | G94-180/AUTH-21 | `children-api-be.test.mjs`; `children-records.spec.mjs` | 1, 3 | chưa chạy |
| AC-4 | G94-180/CHD-01 | `children-api-be.test.mjs` | 1 | chưa chạy |
| AC-5 | G94-180/CHD-03 | `children-records.spec.mjs` | 3 | chưa chạy |
| AC-6 | HLT-09, HLT-13 | `health-api-be.test.mjs`; `children-records.spec.mjs` | 2, 3 | chưa chạy |
| AC-7 | AUTH-02, HLT-08 | `health-api-be.test.mjs` | 2 | chưa chạy |
| AC-8 | G94-180/HLT-08 | `health-api-be.test.mjs`; `children-records.spec.mjs` | 2, 3 | chưa chạy |
| AC-9 | G94-180/AUTH-21 | `children-records.spec.mjs` | 3 | chưa chạy |
| AC-10 | — | `check-api-contract.mjs` | 3 | chưa chạy |

## Rủi ro & rollback
| Rủi ro | Tác động | Giảm thiểu | Rollback |
| --- | --- | --- | --- |
| Còn phép so sánh id hoặc trường lệch chưa phát hiện | Một màn hỏng khi bật `api` | Đổi id ở adapter; Playwright + đi tay 17 màn ở Phase 3 trước khi merge | Sửa tiếp theo dữ liệu BE, không quay về dữ liệu mẫu (Quyết định 7) |
| BE G94-180 chậm lên `dev` | FE không merge được | Phase 1–2 merge được độc lập vì chỉ sửa đường `api`; Phase 3 chờ | — |
| Câu hỏi mở đổi thành cần sửa BE | Plan chính phải chuyển sang BE | Hỏi trước khi duyệt plan | — |
| Gọi thêm `GET /profile` ở Sổ sức khỏe | Thêm 1 request mỗi lần mở | Gọi song song | — |
| `GET /school-structure` theo năm | Thêm 1 request ở các màn lọc lớp | Cache theo năm trong facade | — |

## Validation log
- [x] Khẳng định về code có `file:line` (FE và BE)
- [x] Đổi contract: không đổi contract BE. Consumer FE đổi: `childrenApi.js`, `healthCheckApi.js`, các màn liệt kê ở Phase 1–2
- [x] Mỗi AC có test; mỗi phase có Exit = lệnh + kết quả mong đợi
- [x] >8 file: có (khoảng 25 file). Đề xuất giữ một plan 3 phase, vì bật `api` phải làm một lần cho cả module. Phase 1–2 tự đứng được và merge riêng được
- [x] Không dùng rule PENDING/OPEN làm căn cứ; HLT-17..20 PROPOSED chỉ ghi là không đổi
- [x] Tự review: hết câu hỏi mở (Q1–Q4 đã trả lời 2026-11-11)

## Progress log
### 2026-11-11 — Lập plan (chờ review)
- Commit: chưa commit
- Verify: chưa chạy (chưa code)
- Khác plan: —
- Tiếp: user trả lời Q1–Q3 và duyệt plan

### 2026-11-11 — User trả lời (chờ Q4)
- User chốt Q1 A, Q2 B (BE theo mock), Q3 A; duyệt Key decisions; lỗi khi bật BE thì sửa tiếp, không quay về dữ liệu mẫu.
- Thêm mục "Việc BE kèm theo" cho Q2. Thêm Q4 vì câu trả lời về quyền đợt khám có hai cách hiểu.
- Tiếp: user trả lời Q4 ⇒ `status: approved`, bắt đầu Phase 1.

### 2026-11-11 — Plan duyệt, bắt đầu Phase 1
- User xác nhận Q2, chọn Q4 A. Hết câu hỏi mở; user đã duyệt plan ⇒ approved, chuyển `in-progress`.

### 2026-11-11 — Phase 1 (dừng giữa chừng: phiên khác đang sửa cùng file màn children)
- Commit: chưa commit
- Đã làm:
  - C `src/services/http/idStrings.js` (`stringifyIds`, `sameId`).
  - `childrenApi.js` phần hồ sơ: id chuỗi; danh sách gửi `schoolYear` và 3 trạng thái; đổi quan hệ mã ↔ chữ (danh sách, hồ sơ, tra CCCD, sửa hồ sơ, xem trước Excel); hồ sơ thêm `cls.schoolYearName`, `ageGroupName`, `homeroomTeacherName` và `history[].userName`; `getClassOptions` đọc `/school-structure`.
  - Facade, mock, hook `useClassOptions`.
  - `suggestAgeGroupId` theo nhóm tuổi có số tháng; `isClassFull`; `AGE_GROUPS` thêm số tháng.
  - `ChildrenListPage`: lớp lấy từ `useClassOptions`, so id bằng `sameId`.
- Test: C `tests/children/children-api-be.test.mjs` (9 test). Sửa kỳ vọng id chuỗi, gửi năm học ở `tests/hardening/children-list-api.test.mjs` và `tests/children/enrollment-photos.test.mjs`.
- Verify: `npm run test:children` → 115 pass, 0 fail; `npm run test:hardening` → 96 pass, 0 fail; eslint file đã sửa → 0 lỗi. Chưa chạy `node scripts/verify.mjs` đủ.
- Khác plan:
  - Thêm `sameId` cho phép so với nguồn khác vẫn trả id số (`/campuses`, năm học ở header); theo convention các module đã nối BE.
  - `getClassOptions` không cache (mỗi màn gọi 1 lần).
  - Giữ nhánh `UPDATED_FROM_EXAM` vì mock vẫn ghi hành động này.
  - Thêm `src/pages/children/HealthDeclarationPage.jsx` (tên người trong lịch sử khai báo).
- Còn lại của Phase 1:
  - `ChildProfilePage` (tên năm học, nhóm tuổi, giáo viên chủ nhiệm, người sửa).
  - `ClassPlacementPage`, `ClassPlacementFields`, `EnrollChildPage` (nhóm tuổi BE, `isClassFull`, `sameId` điểm trường).
  - `ChildInfoFields`, `EditChildPage` (khóa SĐT đã lưu, sửa câu hứa đổi tên đăng nhập).
  - `HealthDeclarationPage`.
- Chặn: lúc 10:14–10:39 một phiên khác sửa đúng các file còn lại (gỡ `ChildQuickPanel`, thêm `ChildInfoTable`, sửa `ChildProfilePage`, `EnrollChildPage`, `ClassPlacementFields`, `ChildInfoFields`, CSS). User chọn chờ phiên giao diện làm xong (2026-11-11); khi user báo, đọc lại các file rồi làm tiếp phần còn lại.

### 2026-11-11 — Phase 1 (chờ review)
- Commit: chưa commit
- Làm tiếp sau khi phiên giao diện xong (đọc lại file trên bản mới, không hoàn tác thay đổi giao diện):
  - `ChildProfilePage`: tên năm học, nhóm tuổi, giáo viên chủ nhiệm lấy `cls.*Name` của adapter; người sửa lấy `userName` (mock vẫn tra danh mục mẫu).
  - `HealthDeclarationPage`: người trong lịch sử khai báo lấy `userName`.
  - `ClassPlacementFields`: nhận `ageGroups`; so id bằng `sameId`; `isClassFull`; sĩ số "n (không giới hạn)" khi `capacity` null.
  - `ClassPlacementPage`, `EnrollChildPage`: nhóm tuổi từ `useClassOptions`, gợi ý theo ngày bắt đầu năm học; tên nhóm, sĩ số ở bước Xem lại.
  - `EditChildPage`, `ChildInfoFields`: phụ huynh đã lưu có `savedPhone` ⇒ ô SĐT khóa, gợi ý "đổi số qua yêu cầu đổi SĐT"; bỏ câu hứa đổi tên đăng nhập; `savedPhone` không gửi đi.
- Verify: `node scripts/verify.mjs` → `VERIFY PASS full | npm run verify | log verify.log`.
- Khác plan: như mục Phase 1 phía trên (thêm `sameId`, không cache, giữ `UPDATED_FROM_EXAM`, thêm `HealthDeclarationPage`); thêm sửa `ClassPlacementPage`, `EnrollChildPage`, `EditChildPage` (đã nêu trong Steps 5, 7 nhưng không có ở danh sách Files).
- Chưa kiểm trên trình duyệt với BE: module `children` còn `demo` tới Phase 3; đường BE chỉ được kiểm bằng test adapter.
- Tiếp: user review Phase 1 ⇒ Phase 2 (sức khỏe).

### 2026-11-11 — Review Phase 1 của user
- Duyệt: Sửa hồ sơ (mã quan hệ, khóa SĐT, bỏ câu hứa), Hồ sơ trẻ (tên năm học, nhóm tuổi, giáo viên, người sửa).
- Sĩ số: user chốt "lớp luôn có giới hạn sĩ số" (BE bắt buộc khi tạo lớp: `CareNest_BE/.../dto/organization/ClassRequest.java:20`). Đã bỏ phần "không giới hạn" (hiển thị, `isClassFull`, test); sĩ số hiện `n/giới hạn` như cũ, so lớp hiện tại bằng `sameId`. AC-2 bỏ vế "lớp không giới hạn sĩ số chọn được".
- Trẻ đã nghỉ ở Danh sách trẻ: user yêu cầu "không hiện"; lệch G94-180/CHD-09 (CONFIRMED, có vế "trẻ nghỉ khi chưa có lớp ở năm của ngày nghỉ") và màn hiện có ô thống kê, bộ lọc "Đã nghỉ" (`ChildrenListPage.jsx:96`) ⇒ hỏi user ẩn hẳn hay mặc định ẩn.
- User chọn B (mặc định ẩn): danh sách và ô "Tổng số trẻ" chỉ tính trẻ đang học, chờ xếp lớp; bấm ô "Đã nghỉ học" mới hiện trẻ đã nghỉ. Rule CHD-09 giữ nguyên (dữ liệu vẫn có trẻ đã nghỉ, chỉ đổi mặc định hiển thị). Áp cho cả mock và BE.
  - Code: `childrenOfStatus` (`src/utils/children/childrenHelpers.js`), `ChildrenListPage` dùng nó; câu trống "Không có trẻ đang học hoặc chờ xếp lớp…".
  - Test: thêm 1 test vào `tests/children/children-api-be.test.mjs` (9 pass). Trình duyệt (mock): 414 = 413 đang học + 1 chờ xếp lớp; năm mẫu không có trẻ đã nghỉ nên phần ẩn/hiện chỉ kiểm bằng test.
- Verify: `node scripts/verify.mjs` → `VERIFY PASS full | npm run verify | log verify.log`.
- Tiếp: user duyệt Phase 1 ⇒ Phase 2 (sức khỏe).

### 2026-11-11 — Phase 1 done, bắt đầu Phase 2
- User duyệt Phase 1.

### 2026-11-11 — Phase 2 (chờ review)
- Commit: chưa commit
- Đã làm:
  - `childrenApi`: `getHealthRecord` gọi song song sổ sức khỏe và hồ sơ (`loadProfile`, không gọi `/school-structure`), ghép `child`, `cls`, `declaration`; `saveMeasurement`, `analyzeHealthTrend` đổi id sang chuỗi.
  - `healthCheckApi`: mọi response đổi id sang chuỗi; phiếu khám thêm tên trường (`SCHOOL_NAME`) khi BE không trả, số nháp `null` thành ô trống.
  - `validateMeasurement`: chiều cao, cân nặng tối đa 1 chữ số thập phân (lỗi ở ô).
  - `canManageHealthCheck`: user BE xét `locationIds` (điểm trường), PHT nhiều điểm trường quản lý được (Q4 = A); mock giữ `campusId`.
  - `HealthCheckFormPage`: ô điểm trường của PHT lọc theo `canManageHealthCheck` (trước so `c.id === user.campusId`, rỗng khi nối BE, cả trường khi PHT nhiều điểm trường).
  - `GrowthReportPage`: lọc điểm trường bằng `sameId`.
  - `HealthTrendPage`: nhóm tuổi từ `useClassOptions`, thang biểu đồ theo `code` (ag-*), gợi ý theo ngày bắt đầu năm học; helper `ageGroupIn`.
- Test: C `tests/health/health-api-be.test.mjs` (7 test, đỏ trước khi sửa). `tests/health/measurement-head-display.test.mjs` thêm giả `useClassOptions`, `ageGroupIn` cho trang xu hướng.
- Verify: `node scripts/verify.mjs` → `VERIFY PASS full | npm run verify | log verify.log`. Trình duyệt (mock): Xu hướng sức khỏe hiện thang "Nhà trẻ", 2 biểu đồ, không lỗi console; Tạo đợt khám (HT) có 2 điểm trường.
- Khác plan:
  - Không dùng cờ `canRecord` của BE: hồ sơ BE có `cls.teacherIds` (giáo viên phân công hôm nay), sau khi đổi id sang chuỗi `canRecordMeasurement` cho cùng kết quả; BE vẫn kiểm khi lưu.
  - `ChildHealthRecordPage`, `HealthMeasurementFormPage`, `ExamAdminStep` không phải sửa: lỗi id và thiếu `child`/tên trường được sửa ở adapter.
  - Thêm sửa `HealthCheckFormPage` (không có trong danh sách Files).
- Chưa kiểm: PHT nhiều điểm trường trên trình duyệt (không có tài khoản như vậy trong seed; đã có test); đường BE thật ở Phase 3.
- Tiếp: user review Phase 2 ⇒ Phase 3 (bật `api`, Playwright với BE, tài liệu). Việc BE kèm theo (Q2) làm trước Phase 3.

### 2026-11-11 — Việc BE kèm theo (Q2) done; Phase 3 bắt đầu
- User duyệt Phase 2.
- BE (chưa commit):
  - `ChildEnrollmentImportServiceImpl.preview`: trùng trẻ đã nghỉ ⇒ ghi chú "Trẻ từng học ở trường (hồ sơ cũ {mã}, đã nghỉ học): nên mở lại hồ sơ cũ…", không chặn; trùng trẻ đang học ⇒ lỗi "Trẻ đã có hồ sơ trong hệ thống (trùng họ tên, ngày sinh và phụ huynh)".
  - `EnrollmentImportAccountServiceImpl.preview` (feature account): ghi chú "Phụ huynh đã có tài khoản (trùng CCCD): {họ tên} · {tên đăng nhập}…", tra tài khoản một lần cho cả file (`findAllByCitizenIdIn`).
  - Test: `ChildEnrollmentIntegrationTest#importPreviewNotesWithdrawnDuplicateAndExistingAccount` (file CSV thật, đỏ trước khi sửa).
  - Verify BE: `node scripts/verify.mjs` → `VERIFY PASS full | tests 1334 fail 0 err 0 skip 0 | archunit ok | snapshot ok | spotless ok`.
- FE Phase 3 (chưa commit):
  - `integrationModules.js`: `children.source = 'api'`.
  - `docs/integration/be-api-routes.json`: `--sync` từ openapi nhánh G94-180 làm mất 3 route `/assessment/semester-evaluations*` của nhánh BE G94-236 (chưa vào `dev`) ⇒ dùng hợp của bản chụp HEAD (2026-11-06) và openapi G94-180 (304 route). Khác plan: không dùng `--sync` thuần.
  - `node scripts/check-api-contract.mjs` → 0 lỗi, 2 cảnh báo (bản chụp khác openapi cạnh bên do là bản hợp; `pickup` có sẵn).
  - Verify FE: `node scripts/verify.mjs` → `VERIFY PASS full | npm run verify | log verify.log`.
- Chặn: BE local :8080 chạy từ 10:21, chưa có thay đổi Q2, không có devtools ⇒ chờ user quyết khởi động lại trước khi kiểm trên trình duyệt và viết Playwright.

### 2026-11-11 — Phase 3 (chờ review)
- User cho phép khởi động lại BE local (`carenest_local`, profile dev). BE chạy lại 2 lần: sau Q2 và sau sửa lỗi mở lại hồ sơ (dưới).
- Commit: chưa commit (FE, BE).
- Đã làm:
  - `schoolYearIds.js` (mới, thuộc `children.files`): header năm học của bản nối BE dùng tên năm "2026-2027" làm id ⇒ `GET /children`, `/school-structure`, `/health-checks` trả 400. Adapter đổi tên năm sang id BE (đọc `GET /school-years`, giữ trong bộ nhớ). Test trong `children-api-be.test.mjs`, `health-api-be.test.mjs`.
  - `ParentActivationPage`, `useGuardians` (`campusName`, `classroomName`): so id bằng `sameId`. Trước đó link "Tài khoản phụ huynh" ở hồ sơ trẻ (`?childId=`) không mở hộp phụ huynh của bé (id BE là số, trên URL là chuỗi), tên điểm trường rỗng sau khi id trẻ thành chuỗi.
  - Playwright `tests/e2e/system/children-records.spec.mjs` (8 test, BE thật): danh sách, hồ sơ, sửa hồ sơ (SĐT chỉ đọc, lưu có lý do), xếp lớp (sĩ số `n/giới hạn`), PHT tạo kỳ cân đo, GV nhập rồi sửa số đo, Tài khoản phụ huynh mở đúng bé và mở trang sửa hồ sơ, cho nghỉ học (danh sách mặc định ẩn), tiếp nhận trùng trẻ đã nghỉ ⇒ mở lại hồ sơ. Phụ huynh của trẻ test là phụ huynh dữ liệu mẫu đã có tài khoản ⇒ không tạo user Keycloak; `cleanup()` xóa trẻ, kỳ cân đo `[E2E]`.
  - `tests/e2e/support/realBe.mjs`: thêm `E2E_PG_USER` (máy này Postgres không có role `postgres`). `tests/e2e/README.md`: biến môi trường Postgres, dữ liệu của bộ test trẻ.
  - Tài liệu: `docs/features/README.md` (module trẻ đọc BE thật; link Tài khoản phụ huynh), `2026-11-01-guardian-be-wiring.md` (bỏ giới hạn `?child=`).
- Lỗi BE tìm thấy khi chạy Playwright, đã sửa (nhánh G94-180, fix forward theo Quyết định 7):
  - Cho nghỉ học đúng ngày vào lớp ⇒ BE xóa dòng `enrollments` duy nhất, mà xếp lớp đã bỏ `intake_campus_id` ⇒ hồ sơ đã nghỉ không còn điểm trường; mở lại hồ sơ đặt `PENDING_PLACEMENT` với `intake_campus_id = null` ⇒ vi phạm `ck_children_complete`, trả 500 (PHT cũng không thấy trẻ đó).
  - Sửa: `ChildRecordServiceImpl.withdraw` ghi điểm trường của lớp vào hồ sơ (`Child.keepCampus`) trước khi xóa lớp đó. Test `ChildEnrollmentIntegrationTest#readmitChildWithdrawnOnPlacementDay` (đỏ trước khi sửa: `campusId` null).
- Verify:
  - FE `node scripts/verify.mjs` → `VERIFY PASS full | npm run verify | log verify.log`.
  - BE `node scripts/verify.mjs` → `VERIFY PASS full | tests 1335 fail 0 err 0 skip 0 | archunit ok | snapshot ok | spotless ok`.
  - Playwright: `E2E_DEV_PASSWORD=… E2E_PG_DB=carenest_local E2E_PG_USER=carenest npx playwright test tests/e2e/system/children-records.spec.mjs --project=system --no-deps` → `8 passed`. Sau khi chạy: không còn trẻ, kỳ cân đo của bộ test; phụ huynh mẫu vẫn `ACTIVE`, giữ liên kết với con của mình.
  - Đi tay với BE thật (HT, PHT `viceprincipal`, GV `teacher1`): danh sách 216 = 212 + 4 chờ xếp lớp, 1 đã nghỉ; hồ sơ có năm học, nhóm tuổi, lớp, GVCN; sửa hồ sơ mở được (lỗi ban đầu "Không tìm thấy hồ sơ trẻ" hết); xếp lớp, tiếp nhận, nhập Excel, sổ sức khỏe, khai báo sức khỏe, đợt khám, xu hướng, báo cáo tăng trưởng đều tải được. PHT thấy 110 trẻ cơ sở 1, tạo đợt khám chỉ có Cơ sở 1. GV thấy 23 trẻ lớp mình.
- Khác plan:
  - Thêm `schoolYearIds.js`, sửa `ParentActivationPage.jsx`, `useGuardians.js`, `realBe.mjs`, `tests/e2e/README.md` và 2 file BE (`Child.java`, `ChildRecordServiceImpl.java`) không có trong danh sách Files.
  - Máy thiếu `@playwright/test` trong `node_modules` (`npm install` lỗi peer `vite@8` với `@vitejs/plugin-react@4`, có sẵn): cài riêng `@playwright/test`, `playwright`, `playwright-core` 1.63.0 (đúng lockfile) vào `node_modules`, tải Chromium 1243. Không đổi `package.json`, `package-lock.json`.
  - Lần chạy Playwright đầu dùng phụ huynh mới ⇒ HT tiếp nhận tự tạo tài khoản (user `0919990001`, Keycloak local). Đã xóa tay khỏi `carenest_local` và Keycloak local; bộ test đổi sang phụ huynh mẫu có tài khoản.
- Còn lại, ngoài phạm vi plan:
  - Dữ liệu mẫu BE thiếu `gestation_weeks` ở 216/217 trẻ ⇒ sửa hồ sơ trẻ mẫu báo "Nhập tuần thai khi sinh" (đúng rule CHD-05). Cần bổ sung seed BE nếu muốn demo sửa hồ sơ không phải điền thêm.
  - GV gặp 403 ở `/campuses`, `/locations`, `/teacher-assignments` (master-data, có từ trước, không thuộc module trẻ).
  - Giải thích xu hướng bằng AI trả 503 khi BE không có khóa AI (đúng thiết kế).
- Tiếp: user review Phase 3. Merge chỉ sau khi BE G94-180 lên `dev` (Quyết định 2).
