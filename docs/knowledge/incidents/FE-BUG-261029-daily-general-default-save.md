---
id: FE-BUG-261029-daily-general-default-save
type: bug
screens: [daily-assessment]
be_modules: [learning-observation]
rules: [OBS-12, OBS-14, OBS-15]
status: fixed
date: 2026-10-29
keywords: [đánh giá, mặc định, Hoạt động chung, nút Lưu, dirty]
similar_to: []
---

# FE-BUG-261029-daily-general-default-save — Chưa sửa ô thì không lưu được giá trị mặc định

## Symptom

Giáo viên vào Hoạt động chung, bảng có trẻ Có mặt với giá trị mặc định nhưng nút Lưu bị khóa. Sửa một trẻ thì nút chỉ lưu một trẻ.

## Điều kiện tái hiện

`/assessment/daily`, giáo viên lớp, ngày được phép ghi, ba dòng `recorded: false`, chưa sửa ô. Người dùng chốt 29/10/2026: bấm Lưu lần đầu xác nhận giá trị đang hiển thị của các trẻ chưa ghi nhận; lần sau chỉ gửi trẻ đã sửa. Đây là thao tác Lưu thủ công, không tự lưu hoặc tự chấm Đạt ở view Kiến thức kỹ năng.

## Attempts — đã thử

| # | Cách thử | Kết quả | Bài học |
| --- | --- | --- | --- |
| 1 | Đọc page và tách nguyên cách tạo draft/chọn dòng lưu vào utility để kiểm thử | Page chỉ chọn dòng thuộc `dirty`; chưa sửa thì danh sách lưu rỗng | Có giá trị hiển thị không đồng nghĩa đã lưu; phải xét cả dòng chưa ghi nhận |
| 2 | Chạy regression trên cách chọn dòng cũ | 3/5 test fail: lần đầu, draft khác lớp/ngày, payload API thiếu dòng mặc định | Chứng minh lỗi trước khi đổi cách chọn dòng |
| 3 | Chọn dòng chưa ghi nhận hoặc đã sửa, chạy lại regression và lint source đã sửa | 5/5 đạt; lint đạt | Trẻ đã lưu không sửa không gửi lại, mặc định không tự chấm kỹ năng |

## Root cause

FE dùng duy nhất `dirty` cho điều kiện bật nút, số lượng và payload. Draft mặc định không được tính là thay đổi nên lần đầu không có dòng để lưu. BE đã nhận được payload General hiện tại, không cần đổi API.

## Fix

`dailyGeneralDraft.js` chọn các dòng chưa ghi nhận hoặc đã sửa, dùng chung danh sách cho nút và payload trong `DailyAssessmentPage.jsx`; giữ nguyên draft và điều kiện quyền/khóa từ BE. Khóa nút khi đang tải/lưu hoặc có lỗi phiếu, chờ tải lại phiếu sau khi lưu để tránh gửi lặp trước khi trạng thái đã ghi nhận cập nhật.

## Regression test

`tests/dashboard/daily-general-default-save.test.mjs`: lần đầu, lớp đã lưu, lưu hỗn hợp, lớp rỗng/draft cũ và payload API General.

Regression 5/5 đạt sau sửa; chưa smoke test browser/BE thật. Cổng toàn dự án có lỗi menu và format tồn tại từ trước (xem `verify.log` và báo cáo kiểm tra 29/10), không coi test cục bộ là full verify đạt.

## Ảnh hưởng

Chỉ màn Hoạt động chung của giáo viên. Không đổi view kỹ năng, không sửa BE/APP hoặc schema/API. Giữ các giá trị mặc định hiện có và trạng thái Tham gia chưa chọn.

## Lesson

Form có giá trị gợi ý cần phân biệt dữ liệu chưa từng ghi nhận với dữ liệu đã lưu mà chưa thay đổi.
