# Rà soát ba luồng sau bản sửa lịch sử — 03/11/2026

Source: working tree BE/FE tại D:/FULearning/Fall2026, gồm sửa chưa commit. Đọc menu → route → FE service → API/DTO/BE service → BUSINESS_RULES. Lượt này chỉ review, không sửa source sản phẩm, commit/push hay chỉnh PR.

## Kết luận và bằng chứng

Luồng chính đã có màn/API và các sửa lịch sử vừa làm vẫn còn. Chưa thể khẳng định mọi nghiệp vụ/đầu ra đều hoàn chỉnh. Không cần nhân bản màn theo vai trò; cần hoàn tất quyền đọc, hợp đồng dữ liệu và một số chức năng còn thiếu.

- Source sản phẩm không thay đổi sau full verify gần nhất: BE 750 test đạt, FE 499 test đạt. Không chạy lại full verify trong lượt này; kết quả này không chứng minh mọi hành trình API thật đã test.
- Lượt này mở Chrome 50 màn mock: HT 22, PHT 19, GV 9, có tiêu đề và không lỗi render JavaScript. Log .git/three-flow-screen-audit.json. Đây không phải real-API E2E.
- Chrome xác nhận nút Xuất Excel tải .csv; GV mở trực tiếp /attendance/meal-handover vẫn thấy “Nhận suất ăn từ bếp”. Script .git/export-route-audit.cjs.
- Node probe xác nhận PHT không quyền ghi bị chặn màn phân công GV, có quyền ghi vẫn bị chặn campus khác. Đối chiếu BE/AUTH-20 cho thấy quyền đọc FE sai.
- Hai review độc lập read-only kiểm cấu hình và điểm danh/suất ăn; không sửa file hay chạy full test.

## Màn và vai trò

| Nhóm màn | GV | PHT | HT | Trạng thái |
| --- | --- | --- | --- | --- |
| Năm học, readiness, kích hoạt | Dùng năm/lớp được phân công | Xem năm/xếp lớp | Thiết lập/kích hoạt/đóng | UI/API thật, transaction chuyển enrollment và snapshot |
| Nhóm tuổi & lớp | Xem theo phạm vi | Xem | Quản lý | Có màn/API |
| Điểm trường, phòng ban | Không quản trị | Xem | Quản lý | Gateway đã sửa quyền đọc phòng/xếp lớp; dev login còn lệch |
| Tài khoản, vai trò, phân công PHT | Không quản trị | Nhân sự theo quyền | Quản trị | Có route/API thật; không phải toàn bộ demo |
| Phân công GV/tổ trưởng | Không phân công | Đọc toàn trường, ghi theo quyền | Quản lý | FE gộp đọc vào quyền ghi, cần sửa |
| Cấu hình thời gian | Xem giờ áp dụng | Xem giờ áp dụng | Cấu hình | Có API giờ chốt; lịch nghỉ chưa liên kết điểm danh |
| Điểm danh/sức khỏe ngày | Nhập hợp lệ | Xem tổng hợp | Xem tổng hợp | Có API thật, điều phối lưu điểm danh/sức khỏe |
| Tổng hợp điểm danh | Lớp được phép | Theo scope BE | Toàn trường | Có lọc/phân trang; thiếu XLSX hai sheet |
| Mở lại điểm danh | Không tự mở | Campus được phép | Toàn trường | Menu/route/API thật, lý do/hạn/thu hồi |
| Sổ báo ăn | Điểm danh là nguồn | Xác nhận/điều chỉnh theo quyền | Theo quyền | API thật; số xác nhận không bị sửa ngầm |
| Liên hệ/báo phụ huynh | UI có | Theo dõi | Theo dõi | Contacts thật rỗng, thông báo thật chưa có |
| Ảnh bữa ăn thay nhận/bàn giao | Theo yêu cầu trước | Actor cần xác định | Xem nếu thuộc phạm vi | Chưa thấy luồng thay thế; nhận suất cũ vẫn truy cập được |
| Đánh giá ngày/theo mục tiêu | Nhập tại lớp | Xem qua Tổng quan | Xem qua Tổng quan | Có màn/API; không cần BGH dùng màn nhập GV |
| Nhận xét chung/Tổng quan | Ghi nhận xét ngày | Xem ngày/tuần/tháng | Xem ngày/tuần/tháng | Liên kết thật |
| Mở lại đánh giá ngày | Không tự mở | Theo quyền/campus | Theo quyền | Có menu/route/API |
| Hồ sơ/tiến độ | Xem trẻ phụ trách và lịch sử | Tiến độ | Tiến độ | Lịch sử đã sửa; thiếu dữ liệu khen thưởng/tăng trưởng liên tục |
| Nhận xét tháng/cuối năm | Lập/sửa/xác nhận | Xem đã xác nhận | Xem đã xác nhận | Có API; không phải luồng BGH duyệt nhận xét tháng |
| Nhận xét tuần/học kỳ độc lập | Chưa có | Chưa có phần xem tương ứng | Chưa có phần xem tương ứng | Thiếu so OBS-06; BE chỉ MONTH/YEAR |
| Phiếu bé ngoan | Chọn/phát hợp lệ | Tổng quan/Xem từng trẻ | Tổng quan/Xem từng trẻ | Có; lịch sử/cờ theo lớp đã sửa; căn cứ tuần đi theo trẻ, chống trùng |
| Khen thưởng cuối năm | Đề xuất danh sách | Xét/chuyển/trả lại | Duyệt/trả lại | Có màn/API; chưa trả kết quả duyệt vào hồ sơ phát triển |
| Chất lượng tháng/hoàn thành chương trình | Ghi nguồn | Xem tổng hợp | Xem tổng hợp | Có API; định nghĩa tính toán còn cần chốt |

## Những phần chưa hoàn chỉnh

1. **Medium — quyền đọc phân công GV của PHT.** schoolConfigPermissions.js:149–169 và AppRoutes.jsx:265–269 chặn người không có STAFF_ASSIGNMENT_MANAGE, giới hạn campus. BE TeacherAssignmentServiceImpl.java:66 cho đọc theo AUTH-20. Tách đọc khỏi ghi. Source + Node probe; xem incident real-ui-permission-scope.
2. **Medium — dev login còn quyền demo.** authService.js:32–55 tải accounts/me nhưng dùng withPermissions, không giữ bePermissions; sửa quyền gateway không áp vào nhánh này. Có thể ẩn sai màn/hiện sai nút rồi 403, chưa chứng minh vượt quyền server.
3. **Thiếu đầu ra Excel hai sheet.** AttendanceSummaryPage.jsx:67–83 xuất CSV trong khi :108 ghi Xuất Excel. Chrome đã xác nhận. Theo ngày/Theo trẻ phải nằm trong workbook thật với toàn bộ bộ lọc, không chỉ trang đang xem. Lọc quá 31 ngày/phân trang đã có.
4. **Nhận/bàn giao suất còn sót; ảnh bữa ăn chưa có.** Route AppRoutes.jsx:398 vẫn cho GV; ClassTodayPanel.jsx:35 chỉ ẩn với TEACHER, tổ trưởng còn mục ở :237–245. Nguồn là demo. Chưa tìm thấy màn gửi ảnh thay thế như user yêu cầu; cần xác định actor/contract, không tự thêm luồng bàn giao khác.
5. **Liên hệ/thông báo sức khỏe chưa nối thật.** daily-health/api/dailyHealthApi.js:53/:109 trả contacts rỗng; DailyHealthPanel.jsx:333–354 chỉ render danh sách. dailyHealthService.js:13 tắt thông báo khi nối BE; adapter :73 trả null; BE không có endpoint gửi tương ứng. Lưu sức khỏe vẫn có tác dụng; chưa được nói đã thông báo phụ huynh. Đây là khoảng thiếu BE/Web, không chỉ vì App chưa làm.
6. **Thiếu nhận xét tuần/học kỳ độc lập so OBS-06.** EvaluationPeriodType chỉ MONTH/YEAR. PeriodicEvaluationListPage.jsx:15 là Đánh giá tháng; filter tuần/học kỳ trong DevelopmentProfileView chỉ đổi khoảng xem, không lập/lưu/xác nhận nhận xét theo kỳ đó. Cần triển khai hoặc cập nhật phạm vi tài liệu sau khi được duyệt; phiếu tuần không thay nhận xét tuần.
7. **Hồ sơ chưa gom đầy đủ kết quả nguồn.** DevelopmentProfileView.jsx:103/:235 chờ rewards, nhưng DevelopmentResponse/ChildEvaluationServiceImpl.development không trả khen thưởng đã duyệt. Cân đo/tăng trưởng cũng không có trong DTO/đường đọc của hồ sơ này; sức khỏe quan sát ngày không thay thế số đo. OBS-03 yêu cầu view liên tục. Nối các kết quả đã công bố từ module nguồn, không lộ đề xuất/phiếu nháp.

## Quy tắc cần chốt, chưa tự sửa

- QualityReportServiceImpl.java:215–224 dùng số ngày lớp có bản ghi; possibleDays = số trẻ × số ngày đó. Trẻ vào/nghỉ giữa tháng chưa có mẫu số riêng theo enrollment. Giữ nguyên theo quyết định đợt sửa trước.
- Báo cáo Bé ngoan/Bé ngoan toàn diện tính tuần đủ điều kiện; màn phiếu dùng phiếu đã phát. Hai số có thể khác; cần thống nhất nhãn/nguồn chính thức, không tự đổi ngưỡng.
- Tổng toàn trường cộng số trẻ các lớp; trẻ chuyển lớp trong tháng có thể thành hai lượt. Chốt “trẻ duy nhất” hay “lượt trẻ theo lớp”.
- EDU đã có đợt nghỉ; AttendanceDayRules.java:54–58 chỉ dùng T2–T6. Việc lấy lịch nghỉ để khóa điểm danh còn P-19. Không kết luận thiếu màn lịch nghỉ hoàn toàn hoặc tự nối khi chưa chốt.
- ATT-04/P-20 vẫn ghi pending trái quyết định mới về đơn nghỉ; module cards/phạm vi đọc PHT cần đồng bộ AUTH-20. Tài liệu cũ không nên dùng làm oracle test.

## Thiếu kiểm chứng, không phải lỗi đã chứng minh

Chưa chạy toàn bộ GV → PHT → HT trên browser nối BE thật; smoke 50 màn dùng mock. Chưa tìm thấy test BE riêng chạy trọn khen thưởng: đề xuất → trả lại/gửi lại → PHT chuyển → HT duyệt. Chuyển năm đã có integration test nhưng thiếu ép lỗi giữa activation/enrollment qua transaction độc lập và concurrent config/activation.

## Ưu tiên đề nghị

Sửa quyền đọc PHT/profile dev–gateway, Excel và route bàn giao còn sót trước. Nối liên hệ/thông báo và kết quả khen thưởng vào hồ sơ. Chốt actor ảnh bữa ăn, phạm vi tuần/học kỳ và định nghĩa báo cáo rồi mới bổ sung. Sau đó test thật xuyên vai trò trên DB test, gồm năm đóng và trả lại/gửi lại.

Chuyển lớp/thôi học thông thường vẫn chưa triển khai theo phạm vi user đã xác nhận; không đưa lại thành lỗi phải sửa ở đợt này. Cơ sở vật chất đã chủ động bỏ, App chưa làm. Không sửa lại các phần lịch sử vừa test đạt chỉ vì báo cáo audit cũ còn liệt kê chúng.
