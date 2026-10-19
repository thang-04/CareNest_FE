---
id: FE-BUG-261019-assessment-seed-quota
type: bug
screens: [daily-assessment, periodic-evaluation, good-behaviour-tickets, year-end-evaluation]
be_modules: [assessment]
rules: []
status: open
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

## Root cause

`seedOnce` trong `src/services/assessment/mock/assessmentMockRepository.js` sinh bản ghi hằng ngày theo `today` × số trẻ rồi chạy job tạo đánh giá định kỳ; tổng vượt quota localStorage (~5M ký tự). Dữ liệu tăng theo ngày nên lỗi sớm muộn sẽ xuất hiện. Có từ G94-179 (9380ab4), không do đợt ghép dinh dưỡng/phân quyền.

## Fix

Chưa sửa — cần user chọn hướng (thu gọn seed: ít ngày/ít trẻ, bỏ trường lớn trong bản ghi, hoặc lưu module riêng/IndexedDB).
