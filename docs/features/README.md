# Features — feature nghiệp vụ → màn hình Web

File này **không chứa business rule**. Rule, flow, PENDING nằm ở BE module card/flow; ở đây chỉ map feature sang màn hình Web và chỉ chỗ đọc. Actor và permission từng màn hình: `docs/architecture/ROUTE_MAP.md`.

`BE:` = `../CareNest_BE/docs/`.

## Bảng map

| Feature V1 (BE) | Màn hình Web (screen group) | Module card | Flow | Rule nhóm |
| --- | --- | --- | --- | --- |
| Điểm danh + báo ăn | Teacher: Điểm danh + báo ăn | `BE:modules/attendance.md` | `BE:business/flows/attendance.md` | ATT |
| Số suất đã xác nhận → bếp | BGH (actor PENDING): Xác nhận số suất | `BE:modules/nutrition.md` | `BE:business/flows/meal-management.md` | NUT |
| Đơn xin nghỉ | Teacher/BGH: Đơn nghỉ (actor PENDING P-15) | `BE:modules/attendance.md` | `BE:business/flows/leave-request.md` | ATT |
| Thực đơn, dinh dưỡng; AI gợi ý thực đơn có duyệt | BGH: Duyệt thực đơn | `BE:modules/nutrition.md` | `BE:business/flows/meal-management.md` | NUT, AI |
| Hồ sơ sức khỏe định kỳ, trend, AI diễn giải có duyệt | Teacher: Nhập đo (actor PENDING) · BGH: Tổng quan sức khỏe | `BE:modules/health.md` | `BE:business/flows/health-check.md` | HLT, AI |
| Quan sát hằng ngày; summary; hồ sơ phát triển | Teacher: Quan sát, Review summary · BGH: Summary & hồ sơ phát triển | `BE:modules/learning-observation.md` | `BE:business/flows/child-observation.md` | OBS, AI |
| Báo & theo dõi sự cố CSVC | Teacher: Báo sự cố · BGH: Theo dõi sự cố | `BE:modules/facility-issue.md` | `BE:business/flows/facility-issue.md` | FAC |
| Báo cáo lớp/campus/trường | BGH: Dashboard báo cáo | `BE:modules/reporting.md` | — | AUTH-08 |
| Tài khoản, phân quyền, phân công | Admin: Tài khoản, Role, Phân công | `BE:modules/identity-access.md`, `BE:modules/school-structure.md` | — | AUTH |
| Hồ sơ trẻ, ghi danh, dị ứng | (màn hình Web chưa xác định — hỏi) | `BE:modules/child.md` | — | AUTH-04, HLT-06 |
| Ngữ cảnh hoạt động/học tập | **Không làm** — OPEN (ADR-0006) | `BE:modules/learning-observation.md` | — | OBS-07 |

Parent visibility (PAR-*) và màn hình bếp thuộc APP.

## Cách dùng khi làm một feature

1. Tìm hàng trong bảng (hoặc grep `.ai/CONTEXT_MAP.yaml` → `keywords`).
2. Đọc module card BE (Rules, PENDING, Known pitfalls) → flow: chỉ bước `[S]` thành hành động UI.
3. Ghi rule ID liên quan vào doc feature/PR; **không chép nội dung rule**.
4. Màn hình phức tạp (nhiều trạng thái, nhiều role, có AI) ⇒ tạo `docs/features/<feature>.md` theo template dưới, thêm vào `docs/INDEX.md` và `.ai/CONTEXT_MAP.yaml` (`available.docs` + `keywords`).

## Template `docs/features/<feature>.md`

```markdown
# Feature — <tên>
Status: thiết kế | đang code | xong · BE card: `../CareNest_BE/docs/modules/<m>.md` · Rule: <ID,...>
## Actor & permission     (dẫn ROUTE_MAP; actor PENDING ghi rõ)
## Màn hình & route       (route thực tế, entry point, điều hướng)
## API dùng               (method + path + DTO BE; endpoint chưa có ⇒ "cần thống nhất")
## Trạng thái UI          (loading / empty / error / 403 / 404 / DRAFT-APPROVED)
## Server state / UI state (key cache, invalidate sau mutation nào)
## PENDING ảnh hưởng UI   (ID P-xx + cách UI xử lý tạm: theo permission / cấu hình)
## Known pitfalls         (1 dòng/bẫy, link incident FE nếu có)
## Test                   (component/e2e chính)
```

Agent: gặp bẫy UI đặc thù feature ⇒ thêm 1 dòng **Known pitfalls** vào doc feature (và link incident).
