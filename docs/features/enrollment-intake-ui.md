# Giao diện tiếp nhận trẻ theo bố cục phiếu khám

Nguồn: user ngày 05/11/2026 yêu cầu chỉnh UI Tiếp nhận trẻ, tham khảo Phiếu khám sức khỏe. Làn M, chỉ trình bày trong module children; không đổi BE, contract, trường dữ liệu, quyền hoặc luồng lưu.

Actor: Hiệu trưởng/Phó hiệu trưởng có quyền tiếp nhận hiện có. Rule và luồng nguồn: BE docs/modules/child.md, CHD-01/05 và AUTH-20; lựa chọn một phụ huynh theo Spec013. Các hành động tiếp nhận/xếp lớp/khai báo/xác nhận giữ nguyên.

## Trình bày
- Bước thông tin chia ba phần theo thứ tự: I. Thông tin của trẻ; II. Thông tin hành chính; III. Phụ huynh/người giám hộ.
- Tái sử dụng ExamSheetTable/ExamSheetBand và FormField: dải tiêu đề, số thứ tự, nhãn và ô nhập thẳng hàng như phiếu khám. Không đưa kết luận khám hoặc chẩn đoán vào tiếp nhận.
- Máy tính: ảnh chân dung đặt bên trái, thông tin ở bảng bên phải; phần hành chính rộng toàn khối. Điện thoại: ảnh ở trên, nhãn phía trên ô nhập, không ép CCCD/SĐT vào cột hẹp.
- Phụ huynh nhận tài khoản có viền nhấn, radio rõ và StatusBadge dùng tông role teal. Tất cả phụ huynh vẫn có ảnh/liên hệ; người không chọn không được mô tả là sắp tạo tài khoản.
- Chế độ sheet chỉ dùng cho tiếp nhận. Màn sửa hồ sơ dùng mặc định của ChildInfoFields/ChildProfileFields. Các input giữ callback, lỗi và liên kết nhãn; không thay logic tải ảnh, chọn người, chống trùng hoặc lưu.

## Kiểm chứng
Kết quả lệnh và browser sau source cuối ghi tại docs/quality/VERIFICATION.md. Browser dùng dữ liệu tổng hợp, chạy UI thật ở 1440/375; không tuyên bố kiểm FE nối BE thật.

Sau source cuối: VERIFY PASS full, 808 tests không fail/skip; browser1440/375 đạt flow nhập/lưu/ảnh/người nhận tài khoản với 0 lỗi JavaScript và không tràn ngang. Check-ai-layer0lỗi. Không commit/push.
