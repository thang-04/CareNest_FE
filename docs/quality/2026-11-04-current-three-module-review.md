# Rà soát ba phần của Cần — bản code hiện tại 04/11/2026

Mốc đọc: BE `29e1e5a`, FE `9c929d6`; đọc cả working tree, trong đó FE có thay đổi cục bộ tại AppRoutes. Không sửa source, không commit/push trong lượt review này. Không đọc/in nội dung cấu hình bí mật trong application.yml.

## Phát hiện cần sửa

| Mức | Lỗi và kịch bản | Vị trí chính | Bằng chứng / hướng xử lý |
| --- | --- | --- | --- |
| P2 | Phiếu cuối năm đã xác nhận vẫn thay danh sách/nội dung MT khi đổi bản kế hoạch năm đã duyệt | BE YearEndSheetServiceImpl:64, 206–212; ThemeEvaluationRepository:87–88 | Đã tái hiện trên service thật với repository giả: một phiếu từ 1 MT thành 2 MT, đổi lời MT. Cần snapshot metadata hoặc pin bản kế hoạch khi xác nhận. |
| P2 | Nhập thêm lưu ý/MT trong lúc lưu phiếu cuối năm bị mất khi tải lại thành công | FE YearEndSheetCard:38–40, 52, 174, 209 | Đã tái hiện trên component thật với thời điểm request điều khiển được. Khóa các ô trong suốt lưu/refetch hoặc hòa giải phần nhập sau snapshot. |
| P2 | Đánh giá kỹ năng mở nhập lại trước khi GET sau lưu xong; GET muộn ghi đè phần mới nhập | FE DailyGoalAssessmentPage:106–109, 166–168 | Kiểm chứng source: reload không được await, phase saved mở ô. Cần giữ trạng thái saving tới khi cập nhật baseline, hoặc hòa giải nháp. |
| P2 | Xác nhận trẻ cuối cùng nhưng phiếu kèm theo vẫn cho sửa và bản in thiếu ngày xác nhận | FE useAssessment:201–207; EvaluationReviewView:169–174, 407–414 | Kiểm chứng dependency source: chỉ refetch parent, sheet dùng cache theo cùng evaluationId. Refetch sheet khi status/confirmedAt đổi. BE vẫn chặn sửa đã xác nhận. |
| P2 | Hai thao tác phân công đồng thời đưa cùng GV vào hai lớp chính cùng năm | BE TeacherAssignmentServiceImpl:100–155; TeacherClassRules:61–86 | Kiểm chứng thứ tự đọc/ghi, chưa chạy hai transaction thật. Cần cùng khóa GV/năm trên mọi đường ghi và khóa lớp cho thay thế/sĩ số GV. |

## Đối chiếu yêu cầu và phạm vi

- OBS-28: phiếu cuối năm liên kết đánh giá cuối năm, GV lớp sửa, BGH/tổ trưởng chỉ xem bản xác nhận — đã có kiểm tra ở service. Yêu cầu chốt phiếu bất biến chưa đạt đầy đủ vì metadata MT vẫn lấy live.
- AUTH-24: đã có kiểm tra một lớp chính/GV/năm trong thao tác tuần tự; chưa bảo vệ trường hợp hai yêu cầu đồng thời.
- Điểm danh & suất ăn: các lỗi từng nêu về xác nhận ngày cũ, khóa nháp nhận xét tháng, lọc campus chất lượng tháng đã được sửa trong bản mới; không lặp chúng thành lỗi hiện tại. Chưa phát hiện lỗi mới đã xác minh trong phạm vi điểm danh/suất ăn được đọc lần này.
- Cảnh báo lưu khi mới mở và học kỳ bị giữ mốc của năm cũ đã được sửa ở source hiện tại. Các kết quả review cũ không dùng thay cho trạng thái mới.

## Cách kiểm tra lại

1. Phiếu cuối năm: xác nhận phiếu, thay bản kế hoạch duyệt (thêm/xóa/đổi lời MT), mở/in lại phiếu cũ — nội dung đã xác nhận phải giữ nguyên.
2. Mạng chậm: bấm Lưu phiếu, nhập thêm lưu ý khi request đang chạy; sau khi tải xong kiểm tra phần nhập thêm có còn không. Làm tương tự ở đánh giá kỹ năng, nhập ngay sau toast lưu thành công.
3. Xác nhận trẻ cuối cùng, không chuyển màn; phiếu phải khóa ngay và xem trước/in có ngày xác nhận.
4. Hai client HT/PHT hợp lệ cùng phân công một GV chưa có lớp vào hai lớp; chỉ một yêu cầu được thành công. Thử hai yêu cầu phân công ban đầu cho cùng một lớp.

## Giới hạn kiểm chứng

Hai probe điều khiển được đã tái hiện lỗi (service BE + component FE), không dùng DB hay thông tin trẻ thật. Ba lỗi còn lại được chứng minh bằng đường chạy source; chưa chạy E2E trình duyệt/API hoặc concurrency PostgreSQL cho chúng. Lượt này không chạy lại full verify và không phải một cuộc kiểm thử xâm nhập toàn bộ hệ thống. Chưa thấy đường vượt quyền trực tiếp trong các endpoint phiếu cuối năm đã đọc; điều đó không chứng minh toàn hệ thống hết lỗ hổng.

Kết luận: **PASS_WITH_RISK** — còn các lỗi P2 nêu trên, nên sửa trước khi nghiệm thu các luồng này. Chi tiết và nguyên nhân đã ghi trong incident/ISSUE_INDEX của hai repo.
