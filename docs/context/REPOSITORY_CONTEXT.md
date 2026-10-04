# Repository Context — CareNest_FE

Bối cảnh dự án đầy đủ (trường, vấn đề, scope V1, exclusions, quy ước status): `../CareNest_BE/docs/context/PROJECT_CONTEXT.md`. File này chỉ mô tả phần Web.

## CareNest là gì (tóm tắt)

Nền tảng Web + Mobile hỗ trợ vận hành và quản lý thông tin trẻ cho **Trường Mầm non Thượng Hồng (Hải Phòng) — 1 trường, 2 điểm trường (campus)**. Không phải multi-school/multi-tenant. CareNest bao phủ + mở rộng workflow cần thiết của PMS/GoKids, không thay hệ thống ngành và không thay Zalo chat (`BE:docs/context/PROJECT_CONTEXT.md` "Định vị"). AI chỉ hỗ trợ: tạo bản nháp, con người duyệt.

## 3 repo

| Repo | Vai trò |
| --- | --- |
| CareNest_BE | **Source of truth**: business rule, domain, authorization, API contract, database, engineering memory nghiệp vụ. Java + Spring Boot + PostgreSQL (CONFIRMED) |
| **CareNest_FE (repo này)** | Web cho System Admin, Principal, Vice Principal, Teacher |
| CareNest_APP | Mobile cho Parent, Teacher, Kitchen Staff |

## Actor Web phục vụ

| Actor | Ghi chú | Chi tiết quyền |
| --- | --- | --- |
| System Admin | Tài khoản, role, phân công, cấu hình. Mặc định không xem dữ liệu trẻ (AUTH-06, PENDING P-16) | `../CareNest_BE/docs/business/USER_ROLES.md` |
| Principal | Tổng hợp 2 campus, xác nhận/duyệt trong quyền | như trên |
| Vice Principal | Như Principal nhưng **trong campus được phân công** (AUTH-02) | như trên |
| Teacher | Lớp được phân công (Web + App) | như trên |

Parent dùng APP — màn hình của họ không thuộc repo này. Kitchen Staff dùng APP; Kitchen trên Web: chỉ khi được yêu cầu (`BE:docs/business/USER_ROLES.md`).

## FE sở hữu

Màn hình, route/navigation, client state, tích hợp API, UX/accessibility, ẩn/hiện UI theo dữ liệu quyền BE trả về, engineering memory cho lỗi UI/client (`docs/knowledge/`).

## FE KHÔNG sở hữu

- Business rule (rule ID ở `../CareNest_BE/docs/business/BUSINESS_RULES.md`) — FE dẫn chiếu, không chép.
- Authorization / access scope — BE kiểm tra thật; ẩn UI không phải phân quyền.
- API contract — FE là consumer; cần đổi ⇒ thống nhất với BE.
- Tính toán nghiệp vụ / dữ liệu dẫn xuất (số suất, định lượng, trend, tổng hợp báo cáo) — hiển thị số BE trả.
- Issue contract/nghiệp vụ — ghi ở `../CareNest_BE/docs/knowledge/CROSS_MODULE_ISSUES.md`.

## Ngoài scope V1 (liên quan Web)

Quản lý tài sản (khấu hao, bảo trì, kiểm kê) — CSVC chỉ **báo và theo dõi sự cố** · kho/NCC (OPEN — `BE:docs/decisions/ADR-0009-nutrition-inventory-scope.md`, chưa làm) · chat thay Zalo · giáo án · chẩn đoán y tế/tâm lý · payroll/kế toán. Ngữ cảnh hoạt động/học tập: OPEN (BE ADR-0006) — không làm màn hình cho tới khi chốt.

## Stack Web

React + TypeScript (Next.js) — **PROPOSED**, chưa chốt. Router, state/cache, UI kit, cách lưu token, auth flow: chưa quyết định ⇒ hỏi trước khi chọn.
