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
| Principal | Tổng hợp 2 campus, xác nhận/duyệt trong quyền; chỉ Web (AUTH-21) | như trên |
| Vice Principal | Như Principal nhưng **trong campus được phân công** (AUTH-02); mảng phụ trách = mã quyền HT bật/tắt, không chia mức (AUTH-20); chỉ Web (AUTH-21) | như trên |
| Teacher | Lớp được phân công (Web + App). Tổ trưởng = phân công trên tài khoản GV, không phải role đăng nhập (AUTH-23) | như trên |

Parent dùng APP — màn hình của họ không thuộc repo này. Kitchen Staff **chỉ dùng APP**, gateway Web từ chối đăng nhập (AUTH-21); tổ bếp mỗi cơ sở dùng chung một tài khoản (AUTH-22). Lệch BE (28/10): UI mock còn route/dashboard cho `KITCHEN_STAFF` và `TEAM_LEADER` như role đăng nhập — cần sửa UI khi tích hợp (`BE:docs/business/USER_ROLES.md`).

## FE sở hữu

Màn hình, route/navigation, client state, tích hợp API, UX/accessibility, ẩn/hiện UI theo dữ liệu quyền BE trả về, engineering memory cho lỗi UI/client (`docs/knowledge/`).

## FE KHÔNG sở hữu

- Business rule (rule ID ở `../CareNest_BE/docs/business/BUSINESS_RULES.md`) — FE dẫn chiếu, không chép.
- Authorization / access scope — BE kiểm tra thật; ẩn UI không phải phân quyền.
- API contract — FE là consumer; cần đổi ⇒ thống nhất với BE.
- Tính toán nghiệp vụ / dữ liệu dẫn xuất (số suất, định lượng, trend, tổng hợp báo cáo) — hiển thị số BE trả.
- Issue contract/nghiệp vụ — ghi ở `../CareNest_BE/docs/knowledge/CROSS_MODULE_ISSUES.md`.

## Ngoài scope V1 (liên quan Web)

CSVC: cả báo/theo dõi sự cố lẫn tài sản, luân chuyển, kiểm kê (BE FAC REMOVED 29/10; code ẩn sau `FACILITY_ENABLED=false`) · kho/NCC ngoài phạm vi rút gọn của ADR-0009 (ACCEPTED 28/10 — `BE:docs/decisions/ADR-0009-nutrition-inventory-scope.md`: chỉ nhập kho khô, trừ tự động, xem tồn, kiểm nhận hàng tươi, danh mục NCC; FE hiện UI mock theo BA, `docs/features/nutrition-inventory.md`; không kiểm kê kho thực phẩm) · chat thay Zalo · chẩn đoán y tế/tâm lý · payroll/kế toán. Kế hoạch giáo dục **trong scope** (BE EDU-01..28, ADR-0020); ngữ cảnh hoạt động = MT giáo án tuần/ngày đã duyệt (OBS-07, EDU-19).

## Stack Web

React 18 + Vite, JavaScript/JSX — đã có source. Bảng quyết định: `docs/architecture/FRONTEND_ARCHITECTURE.md`; code: `docs/architecture/CODING_GUIDE.md`; giao diện: `DESIGN.md`. Auth thật / lưu token: PROPOSED (`docs/integration/AUTH_FLOW.md`) ⇒ hỏi trước khi đổi.
