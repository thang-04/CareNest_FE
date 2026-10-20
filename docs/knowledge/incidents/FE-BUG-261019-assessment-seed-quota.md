---
id: FE-BUG-261019-assessment-seed-quota
type: bug
screens: [daily-assessment, periodic-evaluation, good-behaviour-tickets, year-end-evaluation]
be_modules: [assessment]
rules: []
status: fixed
date: 2026-10-19
keywords: [Bộ nhớ trình duyệt đã đầy, QuotaExceededError, 507, mock seed, localStorage, periodicEvaluations, dailyAssessments]
similar_to: []
---

# Màn Đánh giá trẻ báo "Bộ nhớ trình duyệt đã đầy" ngay lần mở đầu

## Symptom / điều kiện tái hiện

Mock mode, localStorage sạch, đăng nhập giáo viên demo, mở Đánh giá tuần/tháng hoặc Phiếu bé ngoan: ErrorState "Bộ nhớ trình duyệt đã đầy. Hãy dùng ảnh nhỏ hơn hoặc reset dữ liệu demo." (`src/mocks/mockDatabase.js` persist, 507). Ngày máy 2026-10-19.

## Attempts

1. Đo setItem: DB lưu 1.440k ký tự; lần ghi đầu của module assessment là 8.626k ký tự ⇒ QuotaExceededError.
2. So collection trước/sau: `periodicEvaluations` 0→4.411k, `dailyAssessments` 0→2.600k, `behaviourTickets` 0→118k.
3. Đo trình duyệt 2026-10-20: mỗi lần gọi repository assessment chặn luồng chính ~3,4 giây (seed lại vì lần trước không lưu được) rồi 507 ⇒ Trang chủ HT/PHT/GV và `/approvals` kẹt spinner (dashboard gọi `getRewardProposals`).

## Root cause

`seedOnce` trong `src/services/assessment/mock/assessmentMockRepository.js` sinh bản ghi hằng ngày theo `today` × số trẻ rồi chạy job tạo đánh giá định kỳ; tổng vượt quota localStorage (~5M ký tự). Dữ liệu tăng theo ngày nên lỗi sớm muộn sẽ xuất hiện. Có từ G94-179 (9380ab4), không do đợt ghép dinh dưỡng/phân quyền.

## Fix

User chọn (2026-10-20) chỉ seed cho 6 lớp có tài khoản giáo viên demo: `DEMO_CLASS_IDS` trong `src/mocks/assessmentSeed.js`; job kỳ chỉ tạo phiếu cho lớp có phiếu hằng ngày nên cũng gọn theo. Kết quả: 224 phiếu kỳ, lần gọi đầu ~220 ms; DB đủ mọi module ~3,37 triệu ký tự. Test `tests/menu/assessment-seed-size.test.mjs` (localStorage giả có quota). Plan `docs/plans/completed/2026-10-20-loading-jank-mock-data.md`.
