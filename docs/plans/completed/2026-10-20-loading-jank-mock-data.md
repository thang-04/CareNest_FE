---
title: Sửa giật/nháy khi tải và bổ sung dữ liệu mock còn thiếu
status: done
owner: carenestg94@gmail.com
jira: none
branch: dev
modules: []
rules: []
risk: medium
created: 2026-10-20
updated: 2026-10-20
---

# Sửa giật/nháy khi tải và bổ sung dữ liệu mock còn thiếu

## Context

User báo (2026-10-20): "loading quá nhanh và bị giật, nút chuông topbar nháy rất nhiều; nhiều màn chưa có dữ liệu mock, rà lại toàn bộ". Đã đo bằng trình duyệt (mock, cổng 5198), 4 vai trò HT/PHT/GV/Bếp, 127 lượt mở màn + 25 màn con. Chưa sửa code.

1. **Chuông nháy:** badge số chưa đọc chạy `animation: pulseDot 2s ease-in-out infinite` (`src/layouts/layout.css:594`, keyframes `src/styles/base.css:78`) ⇒ mờ–rõ liên tục. Không phải do tải lại: MutationObserver trên `.header__bell` ghi 0 thay đổi DOM khi đứng yên 10 giây và khi chuyển 14 màn.
2. **Đóng băng + kẹt loading (nguyên nhân chính của "giật"):** seed Đánh giá trẻ sinh phiếu hằng ngày cho mọi lớp (`src/mocks/assessmentSeed.js:31-37`), job kỳ tạo phiếu cho mọi trẻ của lớp có phiếu (`src/services/assessment/mock/assessmentMockRepository.js:478`). Từ khi trường có 24 lớp/413 trẻ: `periodicEvaluations` 1.652 bản (4,77 triệu ký tự), `dailyAssessments` 6.252 bản (2,84 triệu) ⇒ ghi vượt quota localStorage, `persist` ném 507 (`src/mocks/mockDatabase.js:31-36`), rollback, lần gọi sau tính lại từ đầu. Đo: mỗi lần gọi `getCriteria()` chặn luồng chính **3,4 giây** rồi lỗi 507. Màn bị ảnh hưởng: Trang chủ HT (chờ 7,8 giây), Trang chủ PHT/GV và `/approvals` kẹt spinner (`src/services/dashboard/dashboardService.js:6` gọi `getRewardProposals`), `/assessment/periodic|year-end|rewards|day-unlocks` kẹt khung chờ, `/assessment/daily|tickets` báo "Bộ nhớ trình duyệt đã đầy". Đã ghi `docs/knowledge/incidents/FE-BUG-261019-assessment-seed-quota.md` (open).
3. **Khung chờ chớp:** `useAsync` ép khung chờ tối thiểu 450 ms (`src/hooks/useAsync.js:5`) trong khi mock trả sau ~250 ms ⇒ mỗi lần mở màn khung chờ hiện ~450 ms rồi nội dung nhảy vào. Hai hook tự quản loading không có mức tối thiểu: `src/hooks/account/usePermissions.js:28`, `src/hooks/account/useGuardianQuery.js:20` (đo `/school/roles` chớp 110 ms).
4. **Màn thiếu dữ liệu mock (ngoài Cơ sở vật chất):**
   - Suất ăn hôm nay: `/kitchen/meal-count`, `/attendance/meal-handover`, `/kitchen/preparation/update` trống vì số suất chỉ sinh sau giờ chốt (`src/services/attendance/mock/attendanceMockRepository.js:198-201`) và seed chỉ xác nhận các ngày đã qua (`:264-299`).
   - Thông báo: mỗi tài khoản 1–2 thông báo.
   - `/education/plan-reviews` (HT, PHT): "Không có tài liệu chờ duyệt".
   - `/attendance/day-unlocks` (PHT): "Chưa có lần mở lại".
   - Rà lại toàn bộ sau Phase 1 (màn đánh giá và Trang chủ hiện chưa đo được dữ liệu vì đang lỗi).

## Quyết định đã chốt

1. Chuông: số tĩnh, chỉ nảy 1 lần khi số chưa đọc tăng — user, 2026-10-20.
2. Khung chờ: "hoãn rồi giữ" — dữ liệu về dưới ~300 ms thì không hiện khung chờ; đã hiện thì giữ tối thiểu ~400 ms; áp cho `useAsync` và 2 hook riêng — user, 2026-10-20.
3. Seed Đánh giá trẻ chỉ sinh cho 6 lớp demo gốc (`cls_c1_m1`, `cls_c1_c1`, `cls_c1_c2`, `cls_c1_l1`, `cls_c2_m1`, `cls_c2_la`, ~56 trẻ); 18 lớp tạo hàng loạt chưa có phiếu đánh giá — user, 2026-10-20.
4. Dữ liệu mock: seed số suất ăn hôm nay đã xác nhận (chấp nhận lệch luồng thật trước 8:45); rà mọi màn **trừ Cơ sở vật chất** và bổ sung chỗ thiếu — user, 2026-10-20.
5. Giữ nghiệp vụ, route, quyền, contract service; chỉ sửa seed mock, hook tải, CSS hiệu ứng. Không thêm dependency, không sửa BE/APP.

## Làm rõ nghiệp vụ

- **Hiểu nghiệp vụ:** không đổi rule. Dữ liệu mock là hư cấu, chỉ để demo.
- **Đối chiếu thiết kế:** `DESIGN.md` mục 9 (trạng thái loading/empty/error); `.claude/rules/component.md` (mọi màn xử lý loading/empty/error).
- **Ảnh hưởng:** mọi màn dùng `useAsync`/`usePermissions`/`useGuardianQuery` (thời điểm hiện khung chờ); header (chuông); module assessment, attendance/kitchen, notification, education (seed). Dữ liệu cũ: DB localStorage đã lưu trước đây giữ nguyên; DB chưa có collection assessment (do lỗi quota) sẽ được seed lại theo phạm vi mới.

### Câu hỏi mở

Không còn.

## Acceptance criteria

- **AC-1:** Badge chuông không có animation lặp; khi số chưa đọc tăng thì chạy hiệu ứng 1 lần; lần render đầu không chạy.
- **AC-2:** Loader trả dưới 300 ms ⇒ không hiện khung chờ/spinner (không chớp); loader chậm hơn ⇒ khung chờ hiện và giữ tối thiểu 400 ms; `usePermissions`, `useGuardianQuery` cùng hành vi.
- **AC-3:** DB mới seed đủ mọi module có `JSON.stringify` < 4 triệu ký tự; phiếu đánh giá chỉ thuộc 6 lớp demo; lần gọi repository assessment đầu tiên < 500 ms, các lần sau không seed lại.
- **AC-4:** Trang chủ HT/PHT/GV, `/approvals`, mọi màn `/assessment/*` tải xong dưới 1,5 giây, không kẹt khung chờ, không lỗi 507.
- **AC-5:** Các màn ở Context mục 4 có dữ liệu khi mở bằng tài khoản demo; rà lại toàn bộ route (trừ `/facility/*`) không còn bảng/khối trống do thiếu seed (trạng thái trống đúng nghiệp vụ được liệt kê trong Progress log).
- **AC-6:** `node scripts/verify.mjs` → `VERIFY PASS full`; `node scripts/check-ai-layer.mjs` exit 0.

## Key decisions

| Quyết định            | Chọn                                                                                                                                                                                            | Phương án khác                            | Vì sao                                                                             |
| --------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------- | ---------------------------------------------------------------------------------- |
| Thu gọn seed đánh giá | 6 lớp demo gốc                                                                                                                                                                                  | Mọi lớp 1 tuần; chuyển IndexedDB          | Giảm ~7 lần, đủ trạng thái demo; IndexedDB đổi mọi repository sang bất đồng bộ     |
| Hoãn khung chờ        | Hook giữ `loading` đúng nghĩa, chỉ khung chờ (`.skeleton`, `LoadingState`, spinner KPI) hiện sau 300 ms bằng CSS `animation-delay`; hook bỏ thời gian chờ tối thiểu khi dữ liệu về trước 300 ms | Hook trả `loading=false` trong 300 ms đầu | Trả `false` khi chưa có dữ liệu làm màn hiện "Chưa có dữ liệu" hoặc lỗi `data.map` |
| Nảy chuông            | Đổi `key` của badge khi số tăng để chạy lại keyframe `pop` có sẵn                                                                                                                               | Thư viện animation                        | Không thêm dependency                                                              |
| Logic tải dùng chung  | Tách helper tính thời gian chờ dùng chung cho 3 hook                                                                                                                                            | Sửa từng hook                             | Tránh lệch hành vi giữa 3 hook                                                     |

## Phases

### Phase 1 — Seed đánh giá vừa quota (gỡ đóng băng)

- Files: M `src/mocks/assessmentSeed.js` · M `src/services/assessment/mock/assessmentMockRepository.js` (nếu job kỳ cần giới hạn theo lớp có phiếu) · C `tests/assessment/assessment-seed-size.test.mjs` · M incident `FE-BUG-261019-assessment-seed-quota.md` + `docs/knowledge/ISSUE_INDEX.md`.
- Steps: 1. Test RED: seed DB đầy đủ + chạy `ensureReady` ⇒ kích thước < 4 triệu ký tự, phiếu chỉ thuộc 6 lớp. 2. Giới hạn `buildDailyAssessments` (và các shell năm/khen thưởng nếu cần) theo danh sách lớp demo. 3. Đo lại trên trình duyệt profile sạch.
- Tests: AC-3 (node), AC-4 (trình duyệt).
- Exit: `node scripts/verify.mjs` → `VERIFY PASS full`.
- **Dừng chờ user review.**

### Phase 2 — Khung chờ "hoãn rồi giữ" + chuông

- Files: M `src/hooks/useAsync.js` · M `src/hooks/account/usePermissions.js` · M `src/hooks/account/useGuardianQuery.js` · C helper thời gian tải trong `src/hooks/` · M `src/components/ui/States.jsx` · M `src/styles/components.css` · M `src/layouts/layout.css` · M `src/layouts/NotificationBell.jsx` · C test node cho helper.
- Steps: 1. Test RED cho helper (về < 300 ms ⇒ không chờ; ≥ 300 ms ⇒ tổng ≥ 700 ms). 2. Dùng helper trong 3 hook. 3. CSS: khung chờ ẩn 300 ms đầu rồi hiện (tôn trọng `prefers-reduced-motion`). 4. Chuông: bỏ `pulseDot` lặp, nảy 1 lần khi số tăng. 5. Đo lại timeline tải và chuông trên trình duyệt.
- Tests: AC-1, AC-2.
- Exit: `node scripts/verify.mjs` → `VERIFY PASS full`.
- **Dừng chờ user review.**

### Phase 3 — Bổ sung dữ liệu mock (trừ Cơ sở vật chất)

- Files (dự kiến, chốt sau khi rà): M `src/services/attendance/mock/attendanceMockRepository.js` và/hoặc `src/mocks/attendanceSeed.js` (suất ăn hôm nay) · M `src/mocks/seed.js` hoặc seed module (thông báo) · M `src/mocks/educationPlanSeed.js` (tài liệu chờ duyệt) · M seed mở lại ngày điểm danh · test seed tương ứng.
- Steps: 1. Rà lại mọi route của 4 vai trò (trừ `/facility/*`) sau Phase 1–2, lập bảng màn trống. 2. Phân loại: thiếu seed / trống đúng nghiệp vụ. 3. Bổ sung seed có version (không ghi đè dữ liệu user đã sửa). 4. Đo lại.
- Tests: AC-5 (node kiểm collection + trình duyệt).
- Exit: `node scripts/verify.mjs` → `VERIFY PASS full`; `node scripts/check-ai-layer.mjs` exit 0.
- **Dừng chờ user review.**

## Test matrix

| AC   | Rule         | Test (tầng)                                                 | Phase | Kết quả |
| ---- | ------------ | ----------------------------------------------------------- | ----- | ------- |
| AC-1 | DESIGN §9    | Trình duyệt: đếm animation/mutation badge                   | 2     | pass    |
| AC-2 | DESIGN §9    | Node: helper thời gian tải; trình duyệt: timeline khung chờ | 2     | pass    |
| AC-3 | —            | Node: kích thước seed + lớp                                 | 1     | pass    |
| AC-4 | —            | Trình duyệt: thời gian tải các màn                          | 1     | pass    |
| AC-5 | —            | Node seed + trình duyệt rà route                            | 3     | pass    |
| AC-6 | VERIFICATION | Hai cổng                                                    | 1–3   | pass    |

## Rủi ro & rollback

| Rủi ro                                                 | Tác động               | Giảm thiểu                                                   | Rollback                  |
| ------------------------------------------------------ | ---------------------- | ------------------------------------------------------------ | ------------------------- |
| DB demo cũ đã lưu thiếu module                         | Không thấy dữ liệu mới | Seed theo version/collection thiếu; "Khôi phục dữ liệu demo" | Hoàn tác seed             |
| Hoãn khung chờ làm màn chậm trông như đứng             | Người dùng tưởng treo  | Chỉ hoãn 300 ms; API chậm vẫn có khung chờ                   | Đặt độ trễ = 0            |
| Suất ăn hôm nay đã xác nhận trước 8:45 lệch luồng thật | Demo khác thực tế      | Chỉ ở mock; user đã chấp nhận                                | Bỏ seed hôm nay           |
| Tests hiện có phụ thuộc số lượng phiếu đánh giá        | Test đỏ                | Chạy `tests/assessment` trước/sau                            | Cập nhật fixture có lý do |

## Validation log

- [x] Khẳng định về code có `file:line`
- [x] Không đổi contract BE
- [x] Mỗi AC có test; mỗi phase có Exit
- [x] > 8 file: 3 phase độc lập, mỗi phase dừng review; không tách plan vì cùng nguồn yêu cầu và cùng phiên đo
- [x] Không dùng rule PENDING/OPEN
- [x] Tự review: không placeholder, không mâu thuẫn

## Progress log

### 2026-10-20 — Phase 1 (done)

- Nguồn duyệt: user "duyệt /goal" ⇒ chạy liền các phase tới đích, mỗi phase vẫn verify + ghi log. **Khác plan:** không dừng review giữa phase.
- TDD: `tests/menu/assessment-seed-size.test.mjs` (localStorage giả quota 5 triệu) RED đúng lỗi 507 → GREEN sau khi thêm `DEMO_CLASS_IDS` vào `src/mocks/assessmentSeed.js`. Không cần sửa repository.
- Đo: node lần gọi đầu 220 ms, 224 phiếu kỳ, 843 phiếu ngày. Trình duyệt profile sạch (GV/HT/PHT): Trang chủ, `/approvals`, mọi `/assessment/*` tải ~450 ms, không kẹt, không 507; localStorage 3,37 triệu ký tự.
- Còn trống thuộc Phase 3: GV Lê Minh Anh (lớp Chồi 1) không có đánh giá cuối năm/đề xuất khen thưởng; `/assessment/day-unlocks` "Chưa mở lại ngày nào".
- Incident `FE-BUG-261019-assessment-seed-quota` ⇒ fixed.
- Verify: `node scripts/verify.mjs` → `VERIFY PASS full | npm run verify | log verify.log`; check-ai-layer 0 lỗi.

### 2026-10-20 — Phase 2 (done)

- TDD: `tests/menu/loading-timing.test.mjs` RED (thiếu module) → GREEN 5/5.
- Helper `src/hooks/loadingTiming.js` (`holdLoading`, 300 ms hoãn + 400 ms giữ) dùng trong `useAsync`, `usePermissions`, `useGuardianQuery`, `usePublishedMenu`. Token `--loading-reveal-delay: 300ms`; `.skeleton`, `.state--loading` (LoadingState), `.spinner--deferred` (spinner KPI Trang chủ, `YearReadiness`, `EnrollChildPage`) ẩn bằng `visibility` trong 300 ms đầu nên vẫn giữ chỗ trong bố cục.
- **Khác plan:** thêm `src/hooks/kitchen/useKitchen.js` — `usePublishedMenu` tự quản loading (lượt grep đầu bỏ sót vì file có `useAsync`) và tải lại **không im lặng** mỗi lần DB mock đổi ⇒ bảng thực đơn chớp khung chờ sau mọi thao tác ghi. Sửa: sự kiện đổi dữ liệu tải lại im lặng.
- Chuông: bỏ `pulseDot` lặp (xóa keyframes ở `base.css`), thêm `.badge-dot--bump` chạy 1 lần khi số chưa đọc tăng sau lần tải đầu.
- Đo trình duyệt (HT): 11/12 màn không hiện khung chờ (nội dung sau 200–390 ms); Trang chủ và published-menu tải > 300 ms ⇒ khung chờ hiện ~400 ms rồi tắt, không lóe. Thêm thông báo ⇒ badge 2→3, `animation badge-bump`, `iteration 1`.
- Verify: `node scripts/verify.mjs` → `VERIFY PASS full | npm run verify | log verify.log`.

### 2026-10-20 — Phase 3 (done)

- Rà trình duyệt profile sạch 4 vai trò (HT 35, PHT 44, GV 20, Bếp 11 route, trừ `/facility/*`).
- Bổ sung seed (đều có test, trừ chỗ ghi rõ):
  - Suất ăn hôm nay: `ensureDemoToday` trong `attendanceMockRepository` chạy 1 lần/ngày (`todayMealDemoDate`), điểm danh các lớp còn thiếu (trừ Chồi 1 của GV demo, để tự điểm danh), tổng hợp + Phó HT xác nhận ngay cả trước 8:45, tạo phiếu bàn giao. Bếp đi qua `getDayInfo` sẵn có nên không cần nối thêm. Test `tests/kitchen/today-meal-demo.test.mjs` (RED 2/3 → GREEN 4/4).
  - Lịch sử mở lại ngày điểm danh (version `mockSeedVersions.attendanceUnlocks`, bổ sung cả DB cũ) và mở lại ngày đánh giá (seed lần đầu).
  - Đánh giá: lớp Chồi 1 thêm vào đánh giá cuối năm demo + 2 đề xuất khen thưởng của GV Lê Minh Anh.
  - Kế hoạch giáo dục: chủ đề nhánh lớp Chồi 3 chờ Phó HT duyệt; `EDU_SEED_VERSION` tăng ⇒ trình duyệt đã có dữ liệu cũ nạp lại bộ demo giáo dục (hành vi sẵn có khi đổi version, sửa tay trong module này sẽ mất).
  - Thông báo: `src/mocks/notificationSeed.js` 25 thông báo cho 11 tài khoản demo (ngoài CSVC), version `mockSeedVersions.notifications`, bổ sung cả DB cũ.
  - Test `tests/menu/demo-seed-coverage.test.mjs` 5/5 — viết sau code, không có bước RED.
- **Khác plan (Phase 2 bổ sung):** màn tải nối tiếp (lớp → phiếu) vẫn lóe 74–82 ms vì khung chờ đã hiện từ lượt đầu còn hook lượt sau đếm lại từ 0. Thêm phiên tải `beginLoading/endLoading` + `loadWithHold` (lượt bắt đầu trong 100 ms sau lượt trước tính chung phiên) và CSS hiện dần bằng `opacity` (nhịp thở skeleton đổi sang màu nền). Đo lại: mọi màn hoặc không hiện khung chờ, hoặc hiện ~380–420 ms.
- 2 test tích hợp cũ chỉnh fixture vì seed demo mới, không nới điều kiện: `attendance-unlock.test.mjs` (chỉ đếm lần mở lại vừa tạo; bỏ số suất demo của hôm nay trước khi thử luồng xác nhận lại).
- Trống đúng nghiệp vụ (giữ nguyên): `/school/placement` (chưa có năm học sắp tới), `/education/plan-reviews` của HT (cấu hình mặc định HT không trong luồng duyệt), `/assessment/daily` GV "Lớp chưa điểm danh" (Chồi 1 để GV tự điểm danh), `/kitchen/preparation/update` (màn xử lý dữ liệu chế biến cũ), `/children/health-trends` và `/children/placement` (chờ chọn trẻ).
- DESIGN.md mục 9: thêm nhịp khung chờ và quy tắc badge.
- Verify: `node scripts/verify.mjs` → `VERIFY PASS full | npm run verify | log verify.log`.

### 2026-10-20 — Draft, chờ duyệt

- Commit: chưa commit.
- Verify: chưa chạy (chưa sửa source).
- Tiếp: user duyệt plan ⇒ Phase 1.
