# Đối chiếu nghiệp vụ BE/FE: cấu hình trường, điểm danh–suất ăn, đánh giá trẻ

Phạm vi: source hiện tại BE `185b337`, FE `6b9009c`; BUSINESS_RULES trong repo và các quyết định của người dùng trong cuộc trao đổi, gồm ảnh Zalo và yêu cầu cô mới xem lịch sử. Không kiểm App, không tuyên bố đã đọc lại toàn bộ bản SRS Word. Đây là review, chưa sửa code và chưa cập nhật PR.

## Kết luận

**BLOCKED để merge ở thời điểm review:** có lỗi tổng hợp dữ liệu qua lớp đã tái hiện trên PostgreSQL. Cần sửa các lỗi xác nhận bên dưới và bổ sung test. Bộ 731 test BE / 487 test FE trước đó là bằng chứng cho phạm vi cũ, không bao phủ đầy đủ các tình huống này.

## 1. Cấu hình trường

| Luồng | Code đang làm | Đối chiếu |
| --- | --- | --- |
| Năm học | PLANNED → ACTIVE → CLOSED; năm mới kích hoạt đóng năm cũ và chuyển trẻ trong transaction | Khớp CFG-YR-01..03 ở đường HTTP qua YearTransitionServiceImpl:272; không có lỗi bỏ qua readiness ở endpoint |
| Chuẩn bị năm mới | Nhóm tuổi, lớp, phòng, phân công, giờ chốt, xếp lớp; kiểm lại các bước bắt buộc trước kích hoạt | Đã có; phân công tương lai được hỗ trợ có chủ đích |
| Phòng ban | Mọi loại phòng có ô sức chứa; phòng học bắt buộc nhập, phòng khác cho phép nhập; chặn thấp hơn sức chứa lớp, mã/tên trùng và phụ thuộc sử dụng | Khớp yêu cầu có ô sức chứa cho mọi phòng; không suy diễn thành bắt buộc mọi loại |
| Điểm trường | HT quản lý; không ngừng điểm chính/đang có lớp hoặc phân công PHT; năm cũ giữ lịch sử | Đã có |
| Phân công giáo viên | Kiểm tài khoản, campus, lớp chủ nhiệm và việc thay thế giáo viên; lịch sử phân công | Đã có; quyền hiển thị FE còn lệch như C1/C2 |
| Năm cũ | Room/campus/age-group snapshots; các thao tác theo năm đóng chỉ đọc | Đã có cơ chế; chưa kết luận mọi màn lịch sử đều hoàn chỉnh |

**C1 — Medium, FE giấu phòng của campus khác đối với PHT.** AUTH-20 và BE cho PHT còn phân công đọc cấu hình cả trường. RoomListPage.jsx:49 dùng roomCampusIds, :171/:262 chỉ dựng nhóm campus lọc qua grant demo rooms VIEW_RESTRICTED. Runtime probe PHT c1 với danh mục c1/c2 trả `['c1']`. BE RoomServiceImpl.java:52–69 trả cả hai khi không truyền campus. Cần tách quyền xem thật khỏi mảng phân công demo; quyền ghi vẫn do BE quyết định.

**C2 — Medium, đăng nhập Keycloak dev vẫn lấy quyền giả cho phiên gọi BE thật.** authService.js:32–55 tải accounts/me nhưng gọi withPermissions từ authMockRepository.js:43–51, thay quyền/areas bằng mock và không giữ bePermissions như đường gateway :109–110. schoolConfigPermissions.js:133 fallback cho PHT thao tác phân công. Quyền BE đã thu hồi vẫn có thể hiện nút rồi nhận 403. Đây là lỗi UX/tích hợp quyền, chưa có bằng chứng vượt quyền phía server. Cả hai đường đăng nhập thật nên dùng quyền hiệu lực BE cho UI thật; demo chỉ trong chế độ demo.

## 2. Điểm danh và suất ăn

Luồng hiện tại: GV chọn lớp/ngày → Có mặt/Vắng → Có mặt được tính đủ bữa của nhóm tuổi → nhập sức khỏe bằng API riêng → chốt theo giờ cấu hình → PHT/HT có quyền mở lại đúng lớp/ngày, có lý do và hạn → thay đổi sau xác nhận làm số suất cần xác nhận lại.

| Nghiệp vụ | Kết quả đối chiếu |
| --- | --- |
| Chỉ GV lớp được ghi; năm đóng chỉ xem | Đã kiểm ở BE |
| Đơn nghỉ tự đặt Vắng có phép, không ăn; cô không ghi đè đơn còn hiệu lực | Đã sửa đúng quyết định mới của user |
| Hủy trước chốt cho phép điểm danh lại; giữ audit | Đã có, V52/test upgrade và cancellation |
| Sau khóa vẫn đo sức khỏe nhiều lần/ngày | API sức khỏe riêng; không phụ thuộc mở lại điểm danh |
| Lưu sức khỏe lỗi hoặc thông báo lỗi một phần | FE giữ trạng thái đã lưu và cho gửi lại, không đo lại chỉ để gửi thông báo |
| Suất ăn | Có mặt là ăn đủ bữa, không còn lựa chọn ăn riêng theo quyết định mới ATT-02; con số trước chốt là tạm, sau xác nhận mới dùng chính thức |
| Thiếu kiểm tra/thân nhiệt | Đã có nhắc sức khỏe trên dòng trẻ và luồng lưu; review này không chạy lại mọi thao tác trình duyệt |

**T1 — Tích hợp còn thiếu:** daily-health/api/dailyHealthApi.js:53/:109 trả `contacts: []`, :73 notifyDailyHealth là no-op ở bridge BE. Liên hệ phụ huynh có UI/demo nhưng chưa có dữ liệu liên hệ thật trong luồng này. Không tính việc chưa làm App là lỗi; đây là phần BE/FE chưa nối trọn. Không được báo rằng API thật đã gửi thông báo.

**T2 — Tích hợp còn thiếu:** thông báo tự động khi đổi giờ chốt/phân công còn TODO tại AttendanceCutoffServiceImpl:80, TeacherAssignmentServiceImpl:160. CutoffSettingPage.jsx:264 đã nói rõ phải báo trực tiếp, không giả vờ đã gửi.

**D1 — Tài liệu chưa đồng bộ:** ATT-04/P-20 vẫn ghi PENDING trường hợp trẻ có đơn nghỉ mà tới lớp, trong khi user đã chốt phải hủy đơn trước chốt. Code theo quyết định mới nhưng BUSINESS_RULES cần cập nhật nguồn chốt trước dùng làm oracle test/SRS.

## 3. Đánh giá trẻ

Luồng đang có: điểm danh Có mặt → đánh giá ngày hai view chung dữ liệu/nhận xét → nhận xét chung lớp → BGH xem tổng quan → bản nhận xét tháng/cuối năm do GV chỉnh/xác nhận → phiếu tuần/tháng và đề xuất danh sách khen thưởng → PHT xét, HT quyết định.

| Hạng mục | Code hiện tại / khoảng thiếu |
| --- | --- |
| Đánh giá ngày | Mặc định Hoạt động chung, chỉ sửa bất thường; không tự chấm Đạt cho MT chưa đánh giá; một nhận xét/trẻ/ngày; nhận xét chung lớp không giới hạn ký tự |
| Khóa/mở lại | Giờ trường, lớp/ngày, hạn, lý do và scope; năm không ACTIVE chỉ xem |
| MT giáo án | Dùng bài đã duyệt và lineage projection; khi chuyển lớp vẫn cần xử lý nguồn theo lịch sử từng lớp, xem A1 |
| Nhận xét tháng/cuối năm | Có bản nháp nền từ số liệu, GV chỉnh/xác nhận, BGH xem; không phải chuỗi BGH duyệt nhận xét định kỳ |
| Tuần/học kỳ | **Chưa có bản nhận xét độc lập trên BE:** EvaluationPeriodType chỉ MONTH/YEAR; FE API kind chỉ đổi MONTH/YEAR. Bộ lọc tuần/học kỳ ở DevelopmentProfileView:28–63 chỉ đổi khoảng xem, không phải lập/lưu/xác nhận nhận xét tuần/học kỳ (OBS-06) |
| Phiếu bé ngoan | Có tuần/tháng, điều kiện hiện tại ≥4 ngày/≥3 cờ, ≥3 phiếu tuần/tháng; GV chọn và phát; lịch sử sau chuyển/nghỉ còn A4 |
| Khen thưởng | Danh sách GV → PHT → HT, có căn cứ đánh giá cuối năm; hồ sơ phát triển chưa trả reward results như UI chờ, xem A6 |

### Lỗi xác nhận

**A1 — High: bản đánh giá gắn lớp bị trộn dữ liệu của lớp khác.** EvaluationSources.java:74–91 đọc điểm danh/quan sát/kỹ năng theo childId + khoảng ngày, không giới hạn lớp/enrollment; giáo án lại lấy chỉ một cls.id. Sau chuyển A → B giữa tháng, bản nhận xét A có thể lấy cả dữ liệu B; không chỉ sai số còn có nguy cơ cô A đọc dữ liệu của lớp không thuộc quyền. Runtime PostgreSQL: A có một ngày, B một ngày; chi tiết đánh giá tháng A trả presentDays=2, mong đợi 1. Cần phân biệt nguồn thống kê lớp với timeline liên tục của trẻ; dùng lớp tại ngày ghi nhận, giữ dữ liệu cũ.

**A2 — Medium: hồ sơ trẻ học/nghỉ hoàn toàn bên trong khoảng lọc không mở được.** ChildEvaluationServiceImpl.java:426–433 chỉ thử lớp ở cuối khoảng rồi đầu khoảng. Trẻ học 10–20/9, lọc 1–30/9 ⇒ cả hai mốc không có lớp, dù 15/9 có dữ liệu. Runtime PostgreSQL tái hiện DEVELOPMENT_CHILD_NO_CLASS. Cần tìm lịch sử overlap cả khoảng rồi áp quyền, không chỉ thử hai đầu.

**A3 — Medium / thiếu so với yêu cầu user mới: cô mới thấy nội dung đã xác nhận nhưng mở chi tiết lịch sử lớp cũ bị 403.** development() trả confirmed evaluations của trẻ ở nhiều lớp, FE ChildDevelopmentProfilePage.jsx:25 dựng link chi tiết, nhưng get() tại ChildEvaluationServiceImpl.java:147–151 chỉ cho GV của lớp gắn bản đánh giá hoặc BGH đúng scope. Cần đường đọc lịch sử theo trẻ hiện tại được phân công; không cấp quyền sửa bản cũ hay mở cả lớp cũ.

**A4 — Medium: tổng hợp/phát phiếu còn bỏ sót trẻ đã chuyển/nghỉ.** BehaviourTicketServiceImpl.java:188 lấy roster tại hôm nay (clamp vào năm) kể cả xem tháng cũ; :403–404 lấy roster cuối kỳ để phát. Trẻ đã có phiếu trước khi nghỉ/chuyển có thể biến mất khỏi tổng hợp cũ; trẻ rời giữa tuần không xuất hiện ở kỳ dù có dữ liệu. Không được xóa phiếu, cần roster lịch sử phù hợp kỳ. Static confirmation, chưa chạy test runtime riêng.

**A5 — Khoảng thiếu chức năng:** nhận xét tuần/học kỳ theo OBS-06 chưa có storage/API/workflow thật như dòng bảng trên. Cần thống nhất triển khai hay cập nhật phạm vi tài liệu; phiếu tuần không thay thế nhận xét tuần.

**A6 — Khoảng thiếu liên kết:** DevelopmentProfileView.jsx:103/:235–256 mong `rewards`, nhưng DevelopmentResponse ở EvaluationDtos.java không có field và service không lấy danh hiệu đã duyệt. Hồ sơ qua BE thật không thể hiện khen thưởng dù màn khen thưởng đã phê duyệt. OBS-03 yêu cầu view liên tục gồm cả khen thưởng; thêm thông tin đã duyệt, không lộ đề xuất nháp.

## 4. Những quy tắc cần chốt rõ, chưa tự coi là lỗi để sửa

1. **Mẫu số chuyên cần cho trẻ vào/nghỉ giữa tháng:** hiện dùng số ngày lớp có bản ghi điểm danh (`sd`) và children × sd, chưa theo số ngày từng trẻ thuộc lớp. Ví dụ trẻ vào ngày 20 và đi đủ các ngày còn lại vẫn có thể không đạt 90%. Zalo chốt tính trẻ vào/nghỉ trong tháng, chưa xác định mẫu số. Đề xuất dùng ngày phải học trong thời gian enrollment, có lịch nghỉ; cần trường xác nhận.
2. **Bé ngoan của báo cáo = đủ điều kiện hay phiếu đã phát?** QualityReportServiceImpl:226–291 tính tuần đủ điều kiện trực tiếp từ điểm danh/cờ, không đọc phiếu đã phát. Màn Phiếu đọc BehaviourTicket đã lưu. Do đó hai màn có thể khác số mà không có lỗi lưu. Đề xuất tách rõ đủ điều kiện và đã phát, báo cáo chính thức dùng nguồn đã thống nhất.
3. **Tổng số trẻ toàn trường khi chuyển lớp trong tháng:** mỗi lớp đúng là có trẻ từng học, nhưng totalOf tại :315 cộng số trẻ các lớp, nên một trẻ học hai lớp có thể tính hai lượt. Cần phân biệt số trẻ duy nhất toàn trường và lượt trẻ theo lớp.
4. **Read scope PHT:** AUTH-20 nói đọc mọi campus, OBS-20 vẫn ghi campus mình, rules đánh giá theo leadsCampus. Cần đồng bộ ma trận từng màn với quyết định mới nhất, giữ riêng phạm vi ghi/mở khóa cơ sở mình. Không tự mở quyền hàng loạt khi còn mâu thuẫn tài liệu.

## 5. Bằng chứng và bước sửa đề nghị

- Review read-only source + module rules; review phụ cấu hình trường xác nhận C1/C2, runtime probe C1.
- Hai test audit chạy bằng Spring/PostgreSQL thật: 2 test, 1 failure (2 thay vì 1), 1 error (DEVELOPMENT_CHILD_NO_CLASS), không skip. Log `CareNest_BE/target/flow-audit.log`. Fixture source và class tạm đã dọn, không đụng source sản phẩm.
- Không chạy lại full verify và không thay kết quả cũ bằng một claim pass mới. Không gọi các test audit thất bại là lỗi hạ tầng.
- Thứ tự: (1) sửa A1/A2/A3 và test đọc/sửa qua chuyển lớp, (2) sửa C1/C2 theo quyền thật, (3) đồng bộ lịch sử phiếu/khen thưởng A4/A6, (4) chốt bốn quy tắc và phạm vi A5, (5) test luồng FE nối BE thật cho GV/PHT/HT trước merge.
- Chưa sửa code, chưa commit/push hoặc chỉnh PR trong lượt review này.
