# Điều kiện gửi và nội dung riêng của kế hoạch giáo dục

Nguồn nghiệp vụ: [BE spec016](../../../CareNest_BE/specs/016-education-submit-validation/spec.md), [BE flow](../../../CareNest_BE/docs/business/flows/education-plan.md), EDU-65–71 tại [business rules](../../../CareNest_BE/docs/business/BUSINESS_RULES.md). Đây là yêu cầu user trực tiếp ngày 09/11/2026 (PROPOSED), chưa phải bằng chứng đã triển khai hoặc giáo viên trường đã xác nhận.

- Khi gửi năm: tối thiểu 9 chủ đề hợp lệ, có chuỗi kết quả/STT/mục tiêu/nội dung, mỗi mục tiêu có nội dung; mọi chủ đề và mẫu nhánh đã khai báo đủ ngày, số tuần trong giới hạn hồ sơ. Lưu nháp chưa hoàn chỉnh; dấu * đỏ có tên truy cập, lỗi chỉ được phần cần sửa. STT tự sinh, nhãn STT tùy chọn; rỗng về mặc định.
- Hồ sơ mất giới hạn hoặc chưa phân biệt được legacy thật phải chặn gửi, báo kiểm tra/khôi phục. Legacy thật có bằng chứng giữ ngoại lệ khoảng tuần cũ nhưng vẫn kiểm đủ ngày. Không tự suy hoặc sửa dữ liệu cũ; server quyết định.
- Tổ trưởng thêm/sửa nội dung riêng của tổ, không sửa năm; khi gửi, mỗi mục tiêu có ít nhất một nội dung tick vào một chủ đề hợp lệ. Năm mới và tổ cùng sửa thì giữ nội dung tổ, báo rà soát; giáo viên thấy bản tổ theo quyền và trạng thái hiện hành.
- Duyệt theo thứ bậc EDU-70, một người soạn được chỉ định; bỏ lease/heartbeat 90/20, giữ REVIEW không sửa, revision và bảo vệ xung đột/nháp. Các mô tả cũ về luồng duyệt tùy cấu hình hoặc lease trong tài liệu Web khác là lịch sử, không xác nhận trạng thái source đã thay đổi. Contract và tác động client phải được duyệt trước triển khai.
