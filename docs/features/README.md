# Features — feature nghiệp vụ → màn hình Web

File này **không chứa business rule**. Rule, flow, PENDING nằm ở BE module card/flow; ở đây chỉ map feature sang màn hình Web và chỉ chỗ đọc. Actor và permission từng màn hình: `docs/architecture/ROUTE_MAP.md`.

`BE:<path>` = `../CareNest_BE/<path>` (xem `AGENTS.md`).

## Bảng map

Ngày 2026-10-12, người dùng làm rõ báo cáo giáo viên: một cột Suất ăn thay bữa trưa/chiều, theo tích Có/Không tham gia ăn bên điểm danh. Demo trả `mealTotal` theo lượt trẻ tham gia ăn/ngày, không cộng lặp một trẻ vì có nhiều bữa; UI, tổng Theo trẻ và CSV dùng cùng đơn vị. Không lấy riêng số Có mặt thay MealParticipation (tham chiếu NUT-01), không thay MealCount của bếp. Contract summary thật chưa có; đề xuất BE trả số lượt trẻ/ngày cho báo cáo này, phân biệt số suất theo từng bữa ở nutrition. Excel hai sheet vẫn đang chờ Phase 2.

Demo tiếp nhận trẻ tại `/attendance`: xem `daily-reception.md` (điểm danh/báo ăn và ghi nhận sức khỏe nhiều lần/ngày; chưa có contract thật).

Tổng hợp `/attendance/summary`: người dùng chốt 2026-10-12 giữ lọc từ ngày–đến ngày dd/mm/yyyy, bỏ giới hạn 31 ngày demo và phân trang riêng Theo ngày (20 dòng mặc định, 10/20/50 tùy chọn). Theo trẻ giữ cả lớp, tổng/biểu đồ cho toàn kỳ. Dữ liệu không khớp bộ lọc, đang tải, lỗi hoặc ngày sai không được xuất. Mock vẫn tải toàn kỳ, không phải server pagination; lớp/trẻ lịch sử chưa đầy đủ nên không dùng làm quyết toán. Đề xuất API thật trả phân trang ngày, tổng toàn kỳ, summary theo trẻ và xuất đầy đủ theo scope AUTH-08; chưa đặt endpoint. Plan `../plans/active/2026-10-12-attendance-summary-export.md` có Phase 2 .xlsx hai sheet, chờ sau review Phase 1; hiện CSV cũ còn giữ, không coi là .xlsx.

Luồng phòng `/school/rooms` được người dùng yêu cầu đổi tên hiển thị thành Phòng ban ngày 2026-10-12 (menu, breadcrumb, tiêu đề). Mọi loại Location có ô Sức chứa và cột danh sách hiển thị số đã lưu. Phòng học giữ required và ràng buộc lớp đang dùng phòng; loại khác tùy chọn, nếu nhập phải là số nguyên dương. Không đặt số mặc định cho dữ liệu cũ; mock lưu capacity cho mọi loại thay vì bỏ số của phòng không phải CLASS. Không đổi mã loại/route/quyền, không sửa BE/APP. Source of truth thật vẫn ở `BE:docs/modules/school-structure.md`; capacity ngoài CLASS là mở rộng demo, cần BE chốt trước tích hợp API.

| Feature V1 (BE)                                             | Màn hình Web (screen group)                                         | Module card                                                                 | Flow                                          | Rule nhóm               |
| ----------------------------------------------------------- | ------------------------------------------------------------------- | --------------------------------------------------------------------------- | --------------------------------------------- | ----------------------- |
| Điểm danh + báo ăn                                          | Teacher: Điểm danh + báo ăn                                         | `BE:docs/modules/attendance.md`                                             | `BE:docs/business/flows/attendance.md`        | ATT                     |
| Số suất đã xác nhận → bếp                                   | Actor PENDING P-05 (theo `meal-count:confirm`): Xác nhận số suất    | `BE:docs/modules/nutrition.md`                                              | `BE:docs/business/flows/meal-management.md`   | NUT                     |
| Báo nghỉ (phụ huynh gửi qua app, không duyệt)               | Teacher: Báo nghỉ của lớp · BGH: Báo nghỉ của campus (chỉ xem)      | `BE:docs/modules/attendance.md`                                             | `BE:docs/business/flows/leave-request.md`     | ATT-04, ATT-05, ATT-05b |
| Thực đơn (MealPlan), dinh dưỡng; AI gợi ý thực đơn có duyệt | BGH: Duyệt thực đơn                                                 | `BE:docs/modules/nutrition.md`                                              | `BE:docs/business/flows/meal-management.md`   | NUT, AI                 |
| Hồ sơ sức khỏe định kỳ, trend, AI diễn giải có duyệt        | Teacher: Nhập đo (actor PENDING) · BGH: Tổng quan sức khỏe          | `BE:docs/modules/health.md`                                                 | `BE:docs/business/flows/health-check.md`      | HLT, AI                 |
| Quan sát hằng ngày; summary; hồ sơ phát triển               | Teacher: Quan sát, Review summary · BGH: Summary & hồ sơ phát triển | `BE:docs/modules/learning-observation.md`                                   | `BE:docs/business/flows/child-observation.md` | OBS, AI                 |
| Báo & theo dõi sự cố CSVC                                   | Teacher: Báo sự cố · BGH: Theo dõi sự cố                            | `BE:docs/modules/facility-issue.md`                                         | `BE:docs/business/flows/facility-issue.md`    | FAC                     |
| Báo cáo lớp/campus/trường                                   | BGH: Dashboard báo cáo                                              | `BE:docs/modules/reporting.md`                                              | —                                             | AUTH-08                 |
| Tài khoản, phân quyền, phân công                            | Admin: Tài khoản, Role, Phân công                                   | `BE:docs/modules/identity-access.md`, `BE:docs/modules/school-structure.md` | —                                             | AUTH                    |
| Hồ sơ trẻ, ghi danh, dị ứng                                 | (màn hình Web chưa xác định — hỏi)                                  | `BE:docs/modules/child.md`                                                  | —                                             | AUTH-04, HLT-06         |
| Ngữ cảnh hoạt động/học tập                                  | **Không làm** — OPEN (ADR-0006)                                     | `BE:docs/modules/learning-observation.md`                                   | —                                             | OBS-07                  |

Parent visibility (PAR-\*) và gửi báo nghỉ thuộc APP. Kitchen trên Web: chỉ khi được yêu cầu (`BE:docs/business/USER_ROLES.md`).

## Cách dùng khi làm một feature

1. Tìm hàng trong bảng (hoặc grep `.ai/CONTEXT_MAP.yaml` → `keywords`).
2. Đọc module card BE (Rules, PENDING, Known pitfalls) → flow: chỉ bước `[S]` thành hành động UI.
3. Ghi rule ID liên quan vào doc feature/PR; **không chép nội dung rule**.
4. Màn hình phức tạp (nhiều trạng thái, nhiều role, có AI) ⇒ tạo `docs/features/<feature>.md` theo template dưới, thêm vào `docs/INDEX.md` và `.ai/CONTEXT_MAP.yaml` (`available.docs` + `keywords`).

## Template `docs/features/<feature>.md`

```markdown
# Feature — <tên>

Status: thiết kế | đang code | xong · BE card: `../CareNest_BE/docs/modules/<m>.md` · Rule: <ID,...>

## Actor & permission (dẫn ROUTE_MAP; actor PENDING ghi rõ)

## Màn hình & route (route thực tế, entry point, điều hướng)

## API dùng (method + path + DTO BE; endpoint chưa có ⇒ "cần thống nhất")

## Trạng thái UI (loading / empty / error / 403 / 404 / DRAFT-APPROVED)

## Server state / UI state (key cache, invalidate sau mutation nào)

## PENDING ảnh hưởng UI (ID P-xx + cách UI xử lý tạm: theo permission / cấu hình)

## Known pitfalls (1 dòng/bẫy, link incident FE nếu có)

## Test (component/e2e chính)
```

Agent: gặp bẫy UI đặc thù feature ⇒ thêm 1 dòng **Known pitfalls** vào doc feature (và link incident).
