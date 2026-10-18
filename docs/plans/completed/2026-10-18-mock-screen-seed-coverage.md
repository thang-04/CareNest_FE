---
title: Rà soát và hoàn thiện mock seed cho các màn CareNest Web
status: done
owner: thangnd
jira: none
branch: feature/G94-209-FE-FEAT-53-permission-management
modules: [mock-database, nutrition, kitchen, attendance, children, pickup, assessment, education-plan, school-config, facility, account]
rules: []
risk: high
created: 2026-10-18
updated: 2026-10-18
---
# Rà soát và hoàn thiện mock seed cho các màn CareNest Web

## Context
Người dùng báo nhiều màn ở mock mode hiện trang lỗi chung, nêu ví dụ `/kitchen/weekly-forecast` (Dự trù & đi chợ) và yêu cầu rà soát, bổ sung dữ liệu demo cho các màn. Hiện dữ liệu giả được lưu trong localStorage qua `src/mocks/mockDatabase.js`; nhiều module khởi tạo collection khi đọc lần đầu. Bếp gọi `readSeeded()` tại `src/services/kitchen/mock/kitchenMockRepository.js:572-577`, nhưng `hasAll()` chỉ kiểm tra collection có phải array tại `:536-537`; collection array rỗng vẫn được xem là đã seed. Vì vậy cơ chế đảm bảo collection tồn tại chưa chứng minh màn nào có đủ dữ liệu để hiển thị.

## Quyết định đã chốt
1. Dữ liệu mới chỉ là dữ liệu tổng hợp/giả; không đưa dữ liệu trẻ thật, sức khỏe, tài khoản hoặc bí mật vào seed.
2. Giữ nguyên các thao tác và dữ liệu demo người dùng đã lưu; không tự reset localStorage.

## Làm rõ nghiệp vụ
- Actor: người dùng các vai trò Web trong mock mode · Outcome: các màn có trạng thái dữ liệu rõ, không rơi vào lỗi chung chỉ vì thiếu seed.
- Rule ID: không áp dụng; đây là độ phủ dữ liệu trình diễn, không thay đổi business rule hay authorization.
- Flow: [B] khởi tạo/đọc mock DB → [S] repository module → [S] màn hình hiển thị dữ liệu, empty state hoặc lỗi có thể xử lý.
- Phạm vi cần khảo sát: các route mock-enabled, đặc biệt kitchen/forecast; kiểm tra cả database mới và database localStorage cũ/thiếu collection.
- Chưa có route, role, tuần/ngày, console hoặc lỗi repository cụ thể từ lần tái hiện của người dùng; cần thu thập trong bước audit.

### Câu hỏi mở
- [x] Phạm vi: toàn bộ route dùng mock-enabled trên Web, theo yêu cầu “seed data hết”.

| Câu hỏi | Trả lời | Ai | Ngày | Rule/doc đã cập nhật |
| --- | --- | --- | --- | --- |
| Phạm vi route | Toàn bộ route mock-enabled | User | 2026-10-18 | Plan này |

## Acceptance criteria
- AC-1: Các nhóm route mock-enabled được đối chiếu với repository/seed; dữ liệu user-generated như OTP, log quyền và AI draft không được giả lập sẵn.
- AC-2: Các route tái hiện lỗi được truy nguyên từ dữ liệu/exception cụ thể; không che lỗi bằng dữ liệu giả tùy tiện.
- AC-3: Seed/backfill dùng dữ liệu tổng hợp, tham chiếu ID nhất quán, chỉ lấp collection rỗng trong migration và giữ nguyên collection có dữ liệu.
- AC-4: Cold start và DB cũ có array rỗng được backfill một lần cho các nhóm màn có seed; Dự trù & đi chợ cùng trang lịch sử bếp/kho được kiểm tra trực tiếp.
- AC-5: `node scripts/verify.mjs` chạy sau lần sửa cuối; `docs/quality/VERIFICATION.md` ghi rõ mức kiểm chứng.

## Key decisions
| Quyết định | Chọn | Phương án khác | Vì sao |
| --- | --- | --- | --- |
| Làm mới seed cũ | Bổ sung migration/backfill có tính lặp lại, không reset toàn DB | Đổi DB key và reset toàn bộ localStorage | Giữ dữ liệu demo người dùng đã tạo |
| Phạm vi | Audit route/repository mock-enabled, ưu tiên route lỗi đã báo | Chỉ thêm seed cho forecast | Yêu cầu hiện tại nói “seed data hết”; phải chốt danh sách bằng audit |

## Phases
### Phase 1 — Kiểm kê và tái hiện
- Files: R (route map, services, mock repositories, seed builders, `VITE_USE_MOCK` config); D (bảng coverage trong plan)
- Steps: 1. Liệt kê route mock-enabled theo role. 2. Theo dõi repository và yêu cầu dữ liệu từng màn. 3. Xác định lỗi bằng mock DB mới và dữ liệu localStorage thiếu collection, bao gồm forecast.
- Tests: AC-1, AC-2 → kiểm tra route/repository; thêm hồi quy cho từng root cause đã tái hiện.
- Exit: Có danh sách route, root cause và phạm vi file sửa; `node scripts/verify.mjs` → kết quả ghi nguyên văn.
- **Dừng chờ user review.**

### Phase 2 — Bổ sung migration seed cho các module
- Files: M `src/mocks/mockDatabase.js`, `schoolMockRepository.js`, repositories mock trong `account`, `school-config`, `menu-planning`, `education-plan`, `children`, `attendance`, `pickup`, `assessment`, `facility`, `kitchen`; T regression seed migration.
- Steps: 1. Thêm helper migration có version. 2. Nối seed builder hiện có vào các repository; chỉ backfill collection rỗng. 3. Tạo history mẫu cho kho bếp. 4. Giữ nguyên override, OTP, log và draft do người dùng tạo.
- Tests: AC-3, AC-4 → unit/regression cho seed idempotence, tham chiếu và legacy DB; kiểm tra UI mock các route lỗi.
- Exit: `node scripts/verify.mjs` → kết quả ghi nguyên văn, không bỏ qua regression fail.
- **Dừng chờ user review.**

## Test matrix
| AC | Rule | Test (tầng) | Phase | Kết quả |
| --- | --- | --- | --- | --- |
| AC-1 | - | Route/repository coverage (static) | 1 | Covered by module audit |
| AC-2 | - | Base, school, and kitchen seed regression tests | 1 | Fail before fix; pass after fix |
| AC-3, AC-4 | - | Legacy DB migrations + local route smoke | 2 | Pass; existing rows preserved |

## Rủi ro & rollback
| Rủi ro | Tác động | Giảm thiểu | Rollback |
| --- | --- | --- | --- |
| Backfill ghi đè dữ liệu demo cũ | Mất thay đổi do người dùng tạo | Chỉ thêm collection/row thiếu, không thay giá trị đã có | Revert phần migration/backfill; giữ DB nguyên trạng |
| Seed giả không khớp tham chiếu | Màn lỗi hoặc dữ liệu sai | Kiểm tra FK-like IDs và các luồng liên module | Revert seed module liên quan |

## Validation log
- [x] Khẳng định code có `file:line`.
- [x] Không thay đổi API contract hay quy tắc nghiệp vụ BE.
- [x] Nhiều module và có khả năng vượt 8 file; triển khai theo phase/module, không thay đổi toàn cục một lần.
- [x] Xác nhận phạm vi toàn bộ route mock-enabled.
- [x] Seed coverage đã được nối cho các nhóm mock-enabled có seed; OTP, audit log, override, AI draft và các flow user-generated vẫn empty theo đúng trạng thái. Generic error nguyên văn chưa tái hiện trong Chrome mock.

## Audit coverage
| Nhóm màn | Seed hiện có | Kết quả rà soát |
| --- | --- | --- |
| Trường, lớp, nhân sự, trẻ | `schoolSeed`, `schoolConfigSeed`, account/children repositories | Có dữ liệu giả; giữ nguyên collection đã có |
| Điểm danh, đón trẻ, đánh giá, kế hoạch giáo dục | `attendanceSeed`, `pickupSeed`, `assessmentSeed`, `educationPlanSeed` | Có cơ chế seed theo ngày/lần đọc; trạng thái tác nghiệp phát sinh theo flow |
| Thực đơn | `menuPlanningSeed`, reference seed | Có danh mục và tuần mẫu |
| Bếp & kho | `kitchenSeed`, `weeklyForecast`, `seedHistory` | Tái hiện lỗ hổng: DB cũ có collection array rỗng bỏ qua lịch sử và phiếu kiểm kê mẫu |
| Cơ sở vật chất | `seed.js`, `facilitySeed`, `inspectionSeed` | Có tài sản, luân chuyển, sự cố, đề nghị và kiểm kê mẫu |
| Xác thực / audit / OTP | mock auth và permission repositories | Token reset/OTP/audit log là dữ liệu phát sinh theo thao tác, không tự tạo record giả để tránh gây hiểu sai trạng thái |

## Progress log
### 2026-10-18 — Audit và migration seed (done)
- Commit: chưa commit
- Verify: `node scripts/verify.mjs` → `VERIFY PASS full`; migration tests → 4/4 pass; `npm.cmd run test:kitchen` → 31/31 pass; `node scripts/check-ai-layer.mjs` → 0 errors, 4 existing warnings.
- Khác plan: triển khai migration version dùng chung vì cùng lỗi array rỗng xuất hiện trong nhiều repository; dữ liệu user-generated không được seed.
- Tiếp: lỗi chung nguyên văn chưa tái hiện trong Chrome mock; nếu người dùng còn thấy, cần route cụ thể để khoanh vùng ngoài nhóm lỗi collection rỗng.
