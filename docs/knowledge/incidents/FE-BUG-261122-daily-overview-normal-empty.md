---
id: FE-BUG-261122-daily-overview-normal-empty
type: bug
screens: [assessment]
rules: [OBS-01, OBS-19]
status: fixed
date: 2026-11-22
keywords: [tổng quan, bình thường, ngủ tốt, generalRecorded]
---

# Tổng quan đánh giá để trống các kết quả bình thường đã lưu

- Ngày: 22/11/2026. Màn `/assessment/overview`, chi tiết từng lớp/ngày. Phạm vi: assessment của Cần.
- Tái hiện thật: teacher2 lưu General 19 trẻ trên DB local riêng, sau đó lưu Skills. Tổ trưởng/PHT mở chi tiết thấy các ô ngủ, cảm xúc, hành vi trống; DB có đủ NGU_TOT/HAPPY/BINH_THUONG. Không phải mất dữ liệu khi lưu.
- Nguyên nhân: `ConcernCell` trả null khi số ngày cần chú ý bằng 0. API tổng hợp chỉ có số bất thường, không đủ phân biệt mức thực tế hay General chưa lưu.
- Sửa: chi tiết DAY đọc thêm phiếu ngày từ endpoint hiện có (ASSESSMENT_VIEW + scope do BE kiểm tra), hiển thị giá trị thực qua `generalRecorded`. Skills-only hiện Chưa lưu; trường đã lưu nhưng thiếu hiện Chưa ghi nhận. Kỳ nhiều ngày giữ cách tổng hợp cũ. Không đổi API/BE/role editor.
- Kiểm: 27 test Node (daily-overview-values, daily-general-default-save, class-assessment-overview, assessment-be-api) đạt; ESLint 3 file đạt; Vite build đạt (cảnh báo plugin có sẵn). UI thật tổ trưởng, PHT, HT đều thấy Bình thường/Ngủ tốt/Vui vẻ và mức ăn từng bữa của cùng dữ liệu GV đã lưu.
- Lần thử thất bại: fixture dùng mã sức khỏe SOT thay FEVER, đã sửa fixture theo danh mục hiện có. Lint chặn import nhãn bữa từ module school-config; dùng `models/mealSessions` chung, không sửa module khác.
- Ảnh local không commit: `logs/ui-proof/pht-daily-saved.jpg`, `ht-daily-saved.jpg`. Dữ liệu hư cấu trong DB carenest_ui_20261122; business Clock mô phỏng 20/11/2026 07:45, không đổi đồng hồ Windows/production.
