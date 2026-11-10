# Rà soát ba luồng BE và FE — 08/11/2026

## Phạm vi và phương pháp

Đọc bản làm việc tại `D:/FULearning/Fall2026/CareNest_BE` và `D:/FULearning/Fall2026/CareNest_FE`, gồm thay đổi staged/unstaged. Không sửa source hoặc thay quyết định nghiệp vụ. Xem cấu hình trường, điểm danh/suất ăn/sức khỏe và đánh giá trẻ. Các lỗi đọc tĩnh dưới đây chưa được gọi API bằng tài khoản thật để tái hiện.

## Phát hiện cần xử lý

1. **High — Cuối chủ đề lệch quy tắc 50% đang ghi trong OBS-27.** `BE:src/main/java/com/carenest/service/observation/impl/ThemeEvaluationServiceImpl.java:385` dùng anyMet. Một hoạt động Đạt trong bốn hoạt động đã chấm vẫn Đạt. Dòng 399–405 còn gán Chưa đạt cho mục tiêu chưa chấm. Học kỳ/cuối năm dùng `PeriodGoalResults` tính tỷ lệ từ 50%, không có kết quả để trống. Đây là thay đổi unstaged, test unstaged cũng đổi expectation theo anyMet. Cần xác minh quyết định nghiệp vụ mới nhất trước khi chỉnh code/test.

2. **High — Bảng cuối chủ đề đã chốt vẫn đổi danh sách mục tiêu theo kế hoạch mới.** `BE:src/main/java/com/carenest/service/observation/impl/ThemeEvaluationServiceImpl.java:335` lấy cột và danh sách trẻ trực tiếp, nhánh confirmed chỉ giữ kết quả ô ở dòng 351. Test `confirmedTableSurvivesNewYearPlanVersion` tạo bản kế hoạch mới chỉ còn một mục tiêu nhưng không assert số cột hoặc nội dung cũ. Cần snapshot mục tiêu, metadata và roster khi xác nhận.

3. **High — HT có thể gửi ID người không phải giáo viên vào phân công lớp.** `BE:src/main/java/com/carenest/service/organization/impl/TeacherClassRules.java:41` bỏ qua kiểm danh sách giáo viên khi anyCampus. Bước trước chỉ tìm tài khoản bị khóa, không kiểm role/existence. ID phụ huynh/bếp ACTIVE có thể được ghi thành phân công TEACHER. Cần kiểm đúng đối tượng cho tất cả actor, chỉ bỏ giới hạn campus với HT.

4. **Medium — Tổ trưởng chọn lớp trong tổ ở màn học kỳ nhưng không được xem.** `BE:src/main/java/com/carenest/service/observation/impl/SemesterAssessmentServiceImpl.java:88` dùng canView của lớp, thiếu quyền đọc của tổ trưởng nhóm tuổi. Nguồn dropdown Theme listClasses lại có phạm vi này. Cần thống nhất policy đọc, giữ quyền sửa theo lớp được phân công.

5. **Medium — Phiếu cuối năm lịch sử không mở được cho giáo viên mới.** `BE:src/main/java/com/carenest/service/observation/impl/ChildEvaluationServiceImpl.java:168` cho đọc đánh giá đã xác nhận qua canReadChildHistory, nhưng `YearEndSheetServiceImpl.java:85` thiếu điều kiện đó. Khi trẻ chuyển lớp và giáo viên mới mở đánh giá lịch sử, phần đánh giá tải được nhưng phiếu lỗi quyền. Cần dùng chung policy đọc lịch sử đã xác nhận.

6. **Medium — Xem năm đã kết thúc mất hiển thị tổ trưởng.** `BE:src/main/java/com/carenest/service/organization/impl/TeacherAssignmentServiceImpl.java:333` lọc phân công bằng mốc max(today, year.start), loại phân công đã kết thúc cùng năm học cũ. Cần dùng mốc lịch sử phù hợp cho đường đọc như danh sách giáo viên lớp.

7. **Medium — Đã đón sớm nhưng sức khỏe vẫn báo chờ đón.** `src/services/daily-health/api/dailyHealthApi.js:34` gán earlyPickup=null, dù day có handedOverAt. Đã tái hiện bằng fixture qua adapter và actionSummary, cho kết quả handedOver=true nhưng nhãn Chờ đón sớm. Cần nối trạng thái trả trẻ vào lịch sử/tổng hợp sức khỏe. Chi tiết tại incident FE-BUG-261108-early-pickup-health-status.

8. **Low — Màn học kỳ dùng dấu tích nhưng bản in/Excel vẫn dùng x.** `src/utils/assessment/semesterAssessmentDoc.js:6` vẫn trả x. Đã gọi trực tiếp hai hàm sinh tài liệu bằng fixture để xác nhận. Yêu cầu đồng nhất dấu tích trong chat chưa được áp dụng tới đầu ra xuất.

## Rủi ro chưa kiểm thử song song

- Phân công tổ trưởng đang check-then-insert, chưa có khóa chung hoặc ràng buộc chống chồng lấn được xác định trong đường ghi.
- Ghi sức khỏe và trả trẻ thiếu khóa chung cho bước kiểm trạng thái rồi ghi. Hai lần trả trẻ đồng thời có thể đụng unique và nhận lỗi 500.

Các điểm này được suy ra từ lịch xen kẽ transaction, chưa coi là lỗi đã tái hiện.

## Kiểm thử

- FE `node scripts/verify.mjs` đạt `VERIFY PASS full | npm run verify | log verify.log`.
- BE `mvnw.cmd -q -Dtest=SemesterDomainResultTest,ThemeEvaluationIntegrationTest test` đạt 11 test, không lỗi/skip. Test hiện tại chưa bao phủ đủ các nhánh nêu trên và đã đổi expectation theo anyMet.
- Đã chạy Node fixture cho trạng thái đón sớm và ký hiệu đầu ra học kỳ, không dùng dữ liệu thật.
- Nhóm phân công giáo viên, phân công đồng thời, điểm danh, đơn nghỉ và trả trẻ đạt thêm 55 test, không lỗi/skip. Tổng hai lượt chạy chọn lọc là 66 test.
- Chưa kiểm UI qua ba tài khoản thật trong lượt rà soát. Sau khi user báo lỗi màn học kỳ, phát hiện thêm lỗi seed snapshot=[] và xử lý riêng theo incident BUG-261108-semester-demo-array-snapshot. Các phát hiện phía trên chưa được sửa trong lượt rà soát.
