# Trung tâm phân quyền — UI G94-209, demo độc lập

Status: UI đã ghép, chờ BE · Nguồn user: chọn phương án 1 ngày 2026-10-19. Plan: [ghép chọn lọc](../plans/active/2026-10-18-selective-nutrition-permission-merge.md).

## Actor & permission

Giữ guard Principal hiện tại cho cả route và mock repository. Không lấy cơ chế gateway auth, không thay `user.permissions` object hoặc chuyển TEAM_LEADER sang TEACHER. Dẫn chiếu AUTH-01/02/03/07, `BE:docs/modules/identity-access.md`; mã AUTH-10..17/ADR-0017 được nhánh nguồn ghi chú không có trong snapshot BE đang đọc, không coi là contract đã xác nhận.

## Màn hình & route

- Sidebar Cấu hình trường → Vai trò & quyền giữ nguyên `/school/roles`, mở UI RoleDefaultsPage mới (không phải bảng cũ).
- Ba tab: quyền theo vai trò; ngoại lệ từng người `/permissions/overrides`; lịch sử `/permissions/history`.
- `/permissions` là alias; URL chỉnh role cũ chuyển về màn mới, không mở form quyền legacy.
- Ma trận hai cột PHT/GV, nhóm nghiệp vụ, công tắc và thanh thay đổi chưa lưu. Lưu cần lý do; từng role báo lỗi riêng nếu lưu một phần.
- Wizard ba bước: chọn nhân sự từ nguồn users hiện có (chỉ đọc field cần dùng) → chọn công tắc → xem lại và lý do. Sửa/đặt lại ngoại lệ ghi lịch sử. Link người từ lịch sử lọc đúng người, kể cả khi không còn ngoại lệ vẫn có đường thiết lập lại.

## Dữ liệu và giới hạn

Banner trên cả ba màn ghi rõ đây là **demo độc lập**, chưa tác động đăng nhập, quyền truy cập hay phân công đang chạy. Chỉ ghi `permissionCenterRoleRows`, `permissionCenterOverrides`, `permissionCenterChangeLogs` và version migration riêng. Không ghi `rolePermissions`, users, classes, vpAssignments hoặc dữ liệu sức khỏe/điểm danh. Các collection rỗng đã lưu không seed lại.

Đây là lựa chọn UI demo theo user, không phải tính năng phân quyền thật hoặc mapping sang catalog cũ. Danh sách nhân sự chỉ chứa ID, tên demo, vai trò, trạng thái, số liên hệ demo và tên campus; không trả credential hoặc hồ sơ trẻ.

## API dùng

Chưa có contract xác nhận để nối màn này. Service gọi mock khi USE_MOCK=true; non-mock trả lỗi 501 “cần thống nhất contract BE”, không tạo endpoint giả. BE cần thống nhất catalog, ma trận, ngoại lệ, lịch sử, hiệu lực và mapping scope trước khi áp vào hệ thống. Không sửa BE/App.

## Trạng thái UI và state

Loading/error/retry/empty qua component hiện có; guard từ chối role khác. Lưu khóa nút/công tắc, giữ lựa chọn lỗi. Dữ liệu truy vấn scoped theo user/filter; bỏ response cũ khi chuyển truy vấn/unmount. Form giữ state riêng, refetch sau mutation; không sửa shared auth cache.

## Known pitfalls

Wizard phải hydrate draft sau 2→3→2, cả draft rỗng; lịch sử không dựa riêng vào danh sách còn ngoại lệ. Xem [incident và regression](../knowledge/incidents/FE-BUG-261019-permission-wizard-draft-history.md).

## Test

`tests/integration/selective-merge/permission-center.test.mjs`: catalog, role/default/override/reset/history, input sai, 403/404, pagination, migration, TEAM_LEADER, snapshot dữ liệu protected, refresh phiên object/scope cũ, draft roundtrip. `npm run test:merge` bao gồm cả hồi quy bếp Phase 1; cổng đầy đủ `node scripts/verify.mjs`.

Browser smoke mock riêng tại 127.0.0.1:5192 bằng Principal: mở URL/menu cũ, lưu mặc định kèm lý do, tạo ngoại lệ, quay lại wizard giữ draft, hiển thị dữ liệu đã lưu và lịch sử. Chưa kiểm BE thật, role khác trên browser, mobile hoặc lỗi mạng thật; không suy luận quyền thật từ mock.
