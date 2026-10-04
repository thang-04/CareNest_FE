# Router — chọn context cho task Web

1. Xác định **loại task** → bảng 1 (profile, workflow, skill, mức khởi đầu).
2. Xác định **vùng nghiệp vụ** → grep từ khóa trong `.ai/CONTEXT_MAP.yaml` mục `keywords` → đọc BE module card + FE doc được map.
3. Đọc thêm chỉ khi `.ai/ESCALATION.md` yêu cầu.

## Bảng 1 — Loại task

| Task | Profile | Workflow | Skill | Mức đầu |
| --- | --- | --- | --- | --- |
| Bug UI, hiển thị sai, state lỗi, validation form, console error | `profiles/code.md` | `workflows/fix-bug.md` | fix-bug | L1 |
| Refactor nhỏ, sửa cục bộ component/hook | `profiles/code.md` | `workflows/implement-feature.md` (rút gọn) | implement-feature | L1 |
| Màn hình / chức năng Web mới, đổi luồng màn hình | `profiles/feature.md` | `workflows/implement-feature.md` | implement-feature | L2 |
| Review code / PR | `profiles/code.md` | `workflows/review-code.md` | review-code | L1→L2 |
| Gọi endpoint mới, đổi API client, xử lý lỗi API, auth/token | `profiles/feature.md` | `workflows/integrate-api.md` | integrate-api | L2; L3 nếu contract cần đổi |
| Cần BE đổi contract / ảnh hưởng APP / bug nghi do BE | `profiles/cross-repo.md` | theo loại thay đổi | — | L3 |
| Kiến trúc client: routing, state, folder, auth flow, chọn thư viện nền | `profiles/architecture.md` | — | — | L3–L4 |
| Onboarding toàn bộ, audit lớn, thiết kế lại FE | `profiles/full.md` | — | — | FULL |

## Bảng 2 — Tín hiệu nâng mức ngay (≥ L3)

Chạm bất kỳ mục nào: số suất ăn / MealCount (xác nhận, điều chỉnh) · phân quyền / ẩn-hiện theo role/scope · dữ liệu sức khỏe / dị ứng · hiển thị output AI (DRAFT/duyệt) · auth/token · response/HTTP status khác contract BE · dữ liệu trẻ hiển thị cho actor mới.

## Bảng 3 — Ngoài scope

Kho/NCC, tài sản/khấu hao/bảo trì/kiểm kê, chat, giáo án, chẩn đoán, multi-school, payroll/kế toán, màn hình Phụ huynh (thuộc APP) ⇒ **dừng**, đối chiếu `../CareNest_BE/docs/context/PROJECT_CONTEXT.md` (Exclusions) và hỏi người dùng. Kitchen trên Web: chỉ khi được yêu cầu (`BE:docs/business/USER_ROLES.md`).

## Cập nhật tri thức (song song với mọi task)

User đưa thông tin nghiệp vụ mới / chốt PENDING, gặp **bug mới** hoặc edge case ⇒ chạy `workflows/update-knowledge.md` (skill `update-knowledge`) **ngay trong lượt**, rồi tiếp tục task chính. Claude có Stop hook (`.claude/hooks/memory-reminder.mjs`) nhắc một lần khi code đổi mà `docs/` chưa đổi.
