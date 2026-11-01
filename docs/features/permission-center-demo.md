# Trung tâm phân quyền — UI G94-209

Status: UI đã ghép; non-mock nối BE `PermissionController` từ 2026-11-01 (user yêu cầu) · Nguồn user: chọn phương án 1 ngày 2026-10-19. Plan: [ghép chọn lọc](../plans/active/2026-10-18-selective-nutrition-permission-merge.md).

## Actor & permission

Giữ guard Principal hiện tại cho cả route và mock repository. Không lấy cơ chế gateway auth, không thay `user.permissions` object hoặc chuyển TEAM_LEADER sang TEACHER. Dẫn chiếu AUTH-01/02/03/07, `BE:docs/modules/identity-access.md`; mã AUTH-10..17/ADR-0017 được nhánh nguồn ghi chú không có trong snapshot BE đang đọc, không coi là contract đã xác nhận.

## Màn hình & route

- Sidebar Cấu hình trường → Vai trò & quyền giữ nguyên `/school/roles`, mở UI RoleDefaultsPage mới (không phải bảng cũ).
- Ba tab: quyền theo vai trò; ngoại lệ từng người `/permissions/overrides`; lịch sử `/permissions/history`.
- `/permissions` là alias; URL chỉnh role cũ chuyển về màn mới, không mở form quyền legacy.
- Bảng việc × vai trò (user chọn 2026-10-20 sau khi thử bố cục thẻ Không/Xem/Sửa thấy khó hiểu): mỗi dòng một việc bằng lời thường, nhóm theo nghiệp vụ; cột HT (cố định) / PHT / GV / Bếp; ô tick phủ cả ô, ✓/— cho ô không chọn được. Việc cần quyền xem thụt "↳": tick thì tự tick dòng xem, bỏ tick dòng xem thì tự bỏ các dòng ↳, có dòng thông báo. Thanh thay đổi chưa lưu + lý do giữ nguyên; từng role báo lỗi riêng nếu lưu một phần.
- Tách quyền xem khỏi quyền làm (mock theo contract FE đề xuất, BE chưa duyệt): mã `*_VIEW` + `feature/action/requires` trong catalog; quan hệ cần-có lấy từ `requires`, không viết cứng ở FE. Wizard ngoại lệ dùng cùng bảng (cột Theo vai trò | Người này | Khác vai trò); danh sách ngoại lệ theo từng việc; lịch sử gom theo lần lưu + nghiệp vụ. Plan [2026-10-20-permission-view-edit-levels](../plans/active/2026-10-20-permission-view-edit-levels.md).
- Wizard ba bước: chọn nhân sự từ nguồn users hiện có (chỉ đọc field cần dùng) → chọn công tắc → xem lại và lý do. Sửa/đặt lại ngoại lệ ghi lịch sử. Link người từ lịch sử lọc đúng người, kể cả khi không còn ngoại lệ vẫn có đường thiết lập lại.

## Dữ liệu và giới hạn

Mock (`USE_MOCK=true`) là **demo độc lập**, chưa tác động đăng nhập, quyền truy cập hay phân công đang chạy; chỉ ghi `permissionCenterRoleRows`, `permissionCenterOverrides`, `permissionCenterChangeLogs` và version migration riêng. Không ghi `rolePermissions`, users, classes, vpAssignments hoặc dữ liệu sức khỏe/điểm danh. Các collection rỗng đã lưu không seed lại.

Đây là lựa chọn UI demo theo user, không phải tính năng phân quyền thật hoặc mapping sang catalog cũ. Danh sách nhân sự chỉ chứa ID, tên demo, vai trò, trạng thái, số liên hệ demo và tên campus; không trả credential hoặc hồ sơ trẻ.

## API dùng

Non-mock gọi `src/services/account/api/permissionApi.js` (chỉ PRINCIPAL; thay đổi có hiệu lực thật trên BE): `GET /permissions`, `GET`/`PUT /role-permissions/{role}`, `GET`/`PUT /accounts/{id}/permission-overrides`, `GET /permission-change-logs`; danh sách nhân sự = `GET /accounts?role=VICE_PRINCIPAL|TEACHER` (đọc hết trang, SĐT = `username`) + tên điểm trường từ `GET /campuses/options`. Contract: `BE:src/main/java/com/carenest/controller/account/PermissionController.java`.

Lệch contract đã xử lý ở lớp API, UI không đổi:
- Catalog BE chưa có `feature/action/requires` (đề xuất FE, BE chưa duyệt) ⇒ gom dòng theo `PERMISSION_TASKS[code].group`, `action` theo hậu tố `_VIEW`, `requires = []` (quan hệ cần-có để BE kiểm, FE không tự đặt).
- BE chưa có API "người có ngoại lệ" ⇒ đọc ngoại lệ của từng nhân sự (1 request/người).
- Override BE có `scope` (AUTH-20) nhưng UI chưa chọn ⇒ khi lưu giữ `scope` đang có của cùng mã + effect, mã mới để BE mặc định CAMPUS.
- Lịch sử BE chưa trả `actorName`/`targetUserName` ⇒ UI hiện "Tài khoản #id".

## Trạng thái UI và state

Loading/error/retry/empty qua component hiện có; guard từ chối role khác. Lưu khóa nút/công tắc, giữ lựa chọn lỗi. Dữ liệu truy vấn scoped theo user/filter; bỏ response cũ khi chuyển truy vấn/unmount. Form giữ state riêng, refetch sau mutation; không sửa shared auth cache.

Ba route dùng `page__head`, tab segmented, `table--grid table--compact`, `Avatar`, `Modal`, `FormField` và các state dùng chung. CSS `permissions.css` chỉ giữ ma trận, wizard, cột bảng và responsive đặc thù; không còn stylesheet `staff-hub.css` song song.

## Nhu cầu sau này (PENDING)

- User nêu 2026-10-20: cần luồng **giáo viên A làm thay giáo viên B** khi B có việc đột xuất. Chưa chốt actor tạo, thời hạn, A nhận toàn bộ hay một phần thao tác. Hướng đề xuất: đây là **phạm vi** (phân công tạm có `validFrom/validTo`, `BE:docs/modules/school-structure.md`), không phải mã quyền; chi tiết ở mục "Ngoài phạm vi" của plan mức Xem/Sửa.

## Known pitfalls

Wizard phải hydrate draft sau 2→3→2, cả draft rỗng; lịch sử không dựa riêng vào danh sách còn ngoại lệ. Xem [incident và regression](../knowledge/incidents/FE-BUG-261019-permission-wizard-draft-history.md).

## Test

`tests/integration/selective-merge/permission-center.test.mjs`: catalog, role/default/override/reset/history, input sai, 403/404, pagination, migration, TEAM_LEADER, snapshot dữ liệu protected, refresh phiên object/scope cũ, draft roundtrip. `npm run test:merge` bao gồm cả hồi quy bếp Phase 1; cổng đầy đủ `node scripts/verify.mjs`. `tests/auth/permission-api.test.mjs`: lớp API với BE giả (chuẩn hóa catalog, đọc hết trang tài khoản, lọc người có ngoại lệ, giữ scope, lỗi BE).

Browser smoke mock riêng tại 127.0.0.1:5192 bằng Principal: mở URL/menu cũ, lưu mặc định kèm lý do, tạo ngoại lệ, quay lại wizard giữ draft, hiển thị dữ liệu đã lưu và lịch sử. Chưa kiểm BE thật, role khác trên browser, mobile hoặc lỗi mạng thật; không suy luận quyền thật từ mock.
