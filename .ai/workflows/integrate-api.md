# Workflow tích hợp API Web

1. Xác định màn hình/caller và contract BE đang tồn tại; nếu chưa có contract chính thức, ghi rõ điểm cần thống nhất.
2. Kiểm tra request, response, lỗi, auth, phân trang và trạng thái thiếu/mất kết nối theo endpoint thực tế.
3. Cập nhật client và test, không sao chép validation nghiệp vụ từ BE trừ phần hỗ trợ nhập liệu được yêu cầu.
4. Nếu contract phải đổi, phối hợp thay đổi ở BE và xét tác động APP; nêu phần chưa được kiểm thử liên repo.

