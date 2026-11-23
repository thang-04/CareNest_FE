# Giao diện tiếp nhận trẻ theo bố cục phiếu khám

Nguồn: user ngày 05/11/2026 yêu cầu chỉnh UI Tiếp nhận trẻ, tham khảo Phiếu khám sức khỏe. Làn M, chỉ trình bày trong module children; không đổi BE, contract, trường dữ liệu, quyền hoặc luồng lưu.

Actor: Hiệu trưởng/Phó hiệu trưởng có quyền tiếp nhận hiện có. Rule và luồng nguồn: BE docs/modules/child.md, CHD-01/05 và AUTH-20; lựa chọn một phụ huynh theo Spec013. Các hành động tiếp nhận/xếp lớp/khai báo/xác nhận giữ nguyên.

## Trình bày
- Bước thông tin chia ba phần theo thứ tự: I. Thông tin của trẻ; II. Thông tin hành chính; III. Phụ huynh/người giám hộ.
- Tái sử dụng ExamSheetTable/ExamSheetBand và FormField: dải tiêu đề, số thứ tự, nhãn và ô nhập thẳng hàng như phiếu khám. Không đưa kết luận khám hoặc chẩn đoán vào tiếp nhận.
- Máy tính: ảnh chân dung đặt bên trái, thông tin ở bảng bên phải; phần hành chính rộng toàn khối. Điện thoại: ảnh ở trên, nhãn phía trên ô nhập, không ép CCCD/SĐT vào cột hẹp.
- Phụ huynh nhận tài khoản có viền nhấn, radio rõ và StatusBadge dùng tông role teal. Tất cả phụ huynh vẫn có ảnh/liên hệ; người không chọn không được mô tả là sắp tạo tài khoản.
- Chế độ sheet chỉ dùng cho tiếp nhận. Màn sửa hồ sơ dùng mặc định của ChildInfoFields/ChildProfileFields. Các input giữ callback, lỗi và liên kết nhãn; không thay logic tải ảnh, chọn người, chống trùng hoặc lưu.

## Thay đổi 22/11/2026 (user chốt; plan `docs/plans/active/2026-11-22-placement-age-group-history-rename.md`)
- Ngày sinh (Tiếp nhận, Sửa hồ sơ) và ngày tiếp xúc người bệnh lao dùng `DateInput`: gõ dd/mm/yyyy, có nút lịch. Để trống ⇒ "Chọn ngày sinh của trẻ"; gõ chưa thành ngày có thật ⇒ "Nhập ngày sinh theo dạng dd/mm/yyyy".
- Hồ sơ trẻ có tab "Lịch sử sửa hồ sơ" đọc `child.history` BE trả: tiếp nhận, sửa hồ sơ (kể cả đổi "Báo ăn", BE:CHD-13), nghỉ học, tiếp nhận lại; mới nhất trước; mỗi thay đổi "Nhãn: cũ → mới".
- Màn module Trẻ gọi "Khai báo ăn và sức khỏe" (trang khai báo, khối tóm tắt, câu lỗi, câu báo). Tên quyền ở màn Phân quyền giữ tên cũ.
- Chưa làm: chọn lớp khác nhóm tuổi (tạm hoãn vì sửa code của Cần).

## Thay đổi 23/11/2026 (user chốt, Cần đề nghị; BE:G94-180/CHD-14, plan `docs/plans/completed/2026-11-22-intake-start-date.md`)
- Tiếp nhận, mở lại hồ sơ, hộp Nhập Excel: ô "Năm học tiếp nhận" bắt buộc, không chọn sẵn, không theo năm ở header; trang và hộp không còn khóa theo header (`IntakeStartFields`). Chọn năm ⇒ ô "Ngày bắt đầu đi học" (`DateInput`): năm đang học mặc định ngày học gần nhất từ hôm nay, năm sau mặc định ngày học đầu tiên từ ngày bắt đầu năm HT cấu hình. Thứ 7, chủ nhật, ngày nghỉ của năm (đọc `GET /school-years/{id}/holidays`, `useYearHolidays`) ⇒ lỗi ở ô; BE vẫn kiểm. Excel: một ngày cho cả file.
- Xếp lớp: ô "Ngày vào lớp" (xếp lần đầu, mặc định max(hôm nay, ngày bắt đầu đi học)) hoặc "Ngày chuyển lớp" (mặc định ngày học gần nhất từ hôm nay). Ngày tương lai là lịch: danh sách, hồ sơ hiện "Sẽ chuyển sang X từ dd/mm" (`nextClass` của BE); lớp chưa bắt đầu hiện "(từ dd/mm)"; nút "Hủy lịch chuyển" / "Hủy xếp lớp" gọi `DELETE /children/{id}/placement/scheduled`; xếp / chuyển lần nữa thay lịch cũ.
- Trẻ chờ xếp lớp đã tới ngày bắt đầu đi học (`startDue` của BE): nhãn "Đã tới ngày đi học, chưa có lớp", đưa lên đầu ở Danh sách trẻ và Xếp lớp; dòng nhắc "N trẻ chưa được xếp lớp, trong đó M trẻ đã tới ngày bắt đầu đi học" cho HT và PHT (nhắc kích hoạt tài khoản giữ cho PHT).
- Hồ sơ trẻ: thêm "Ngày bắt đầu đi học"; Lịch sử xếp lớp ghi "từ dd/mm/yyyy" (`effectiveFrom`) và "Đã hủy lịch" (`cancelledAt`).
- Mock (BE giả) theo BE; lời gọi cũ không gửi ngày (test) giữ như trước: tiếp nhận năm đang học = hôm nay, xếp lớp = mốc sớm nhất, không kiểm ngày học.

## Kiểm chứng
Kết quả lệnh và browser sau source cuối ghi tại docs/quality/VERIFICATION.md. Browser dùng dữ liệu tổng hợp, chạy UI thật ở 1440/375; không tuyên bố kiểm FE nối BE thật.

Sau source cuối: VERIFY PASS full, 808 tests không fail/skip; browser1440/375 đạt flow nhập/lưu/ảnh/người nhận tài khoản với 0 lỗi JavaScript và không tràn ngang. Check-ai-layer0lỗi. Không commit/push.
