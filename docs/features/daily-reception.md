# Điểm danh và sức khỏe trong ngày

Status: triển khai demo theo yêu cầu người dùng ngày 2026-10-12.

## Phạm vi đã chốt

- Web `/attendance`: hai cột, danh sách lớp bên trái và sức khỏe của trẻ đang chọn bên phải.
- Điểm danh có hai lựa chọn Có mặt/Vắng; báo ăn dùng một công tắc Tham gia ăn.
- Bổ sung theo yêu cầu người dùng 2026-10-12: nút Có mặt tất cả chọn các trẻ chưa điểm danh trong toàn bộ lớp, không ghi đè lựa chọn Vắng/Có mặt và công tắc ăn đã có. Xác nhận trước khi áp dụng; bật ăn theo đăng ký cho trẻ vừa chọn, chỉ đổi bản nháp, vẫn cần Lưu điểm danh. Nút không khả dụng sau khóa; không tạo ghi nhận sức khỏe tự động.
- Cập nhật theo yêu cầu người dùng 2026-10-12: tích Có mặt mở form sức khỏe ngay bằng bản nháp, không cần bấm lưu trước. Nút Lưu điểm danh & sức khỏe kiểm tra form, gọi service điểm danh nếu có thay đổi rồi mới gọi service sức khỏe. Hai request vẫn độc lập, không đảm bảo transaction chung.
- Nếu điểm danh thành công nhưng sức khỏe lỗi: giữ form và mã lần ghi nhận, báo rõ phần đã lưu, thử lại chỉ lưu sức khỏe khi điểm danh không thay đổi. Lỗi tải lại danh sách không unmount form. Không ghi nhận tự động cho cả lớp.
- Sau lần ghi nhận đầu có nút Thêm lần ghi nhận để mở form mới, kể cả sau khóa điểm danh. Chỉ cho nhập bản nháp khi điểm danh còn mở; sau khóa phải Có mặt đã lưu.
- Giáo viên chọn bất kỳ trẻ nào theo thứ tự đến lớp; sau khi lưu có thể chuyển đến trẻ tiếp theo.
- Khóa điểm danh không khóa ghi nhận sức khỏe; mỗi lần lưu sức khỏe thêm bản ghi mới và giữ lịch sử.
- Người dùng đã yêu cầu triển khai FE bằng dữ liệu demo trước ngày 2026-10-12. Chỉ sửa FE; không sửa BE/APP hay tạo endpoint thật chưa được chốt.

## Tương thích dữ liệu demo

### Báo nghỉ từ phụ huynh — demo 2026-10-12

Theo yêu cầu người dùng và flow `BE:docs/business/flows/leave-request.md` (ATT-04/05): chỉ đơn SUBMITTED đúng trẻ và khoảng ngày mới gắn nhãn Phụ huynh báo nghỉ; không có bước duyệt. Repository demo tạo một ví dụ giả cho trẻ chưa điểm danh mỗi lớp, một lần khi collection chưa tồn tại; không ghi đè lựa chọn cô đã lưu. Đơn đã hủy/ngày khác không gắn nhãn. Trẻ được tạo EXCUSED và tắt ăn trước tổng hợp sĩ số. Nhấn nhãn xem ngày/lý do trong modal nhỏ.

Người dùng đồng ý triển khai phương án đổi Có mặt khi trẻ thực tế đến lớp: phải xác nhận riêng, lưu kèm confirmedLeaveRequestId trong demo, không hủy đơn gốc. Repository chặn chuyển EXCUSED sang PRESENT thiếu xác nhận; tải lại không tự đưa trẻ về Vắng. Đây là lựa chọn demo, không nâng phần GV chỉnh của ATT-04 thành rule BE đã chốt.

Ví dụ dữ liệu giả ở lớp Chồi 1 khi khởi tạo ngày học còn trẻ chưa điểm danh: Đặng Tuấn Kiệt, lý do gia đình báo nghỉ trong ngày. Theo yêu cầu người dùng 2026-10-12, nhãn dưới tên hiện Vắng có phép · Phụ huynh báo nghỉ khi trạng thái là EXCUSED; nếu cô xác nhận trẻ đến lớp thì chỉ còn Phụ huynh báo nghỉ, không hiển thị nhãn Vắng sai trạng thái. Không ghi đè dữ liệu người dùng đã lưu hoặc reset storage để tạo ví dụ; sau tổng hợp suất ăn không tự tạo lại điểm danh demo.

Có mặt tất cả chỉ đổi trẻ không có bản ghi, không có trạng thái nháp và không có đơn SUBMITTED. Không sửa trẻ vắng/có mặt đã có, không mở ăn cho trẻ báo nghỉ, không tạo sức khỏe tự động.

Chưa triển khai gửi/hủy đơn trên App hoặc xử lý đơn tới sau sĩ số đã tổng hợp: repository demo không âm thầm tạo/chỉnh điểm danh khi đã có mealCounts ngày đó (ATT-05b/07 cần contract BE). Không sửa BE/APP; không tự đặt endpoint. Health vẫn chỉ ghi cho PRESENT đã lưu.

Các trạng thái vắng cũ được giữ nguyên khi không đổi điểm danh. Chọn Vắng mới sử dụng trạng thái UNEXCUSED của repository hiện tại; giao diện màn tiếp nhận chỉ hiển thị Vắng. Cần BE chốt mã vắng chung trước khi tích hợp thật.

Bữa ăn theo nhóm tuổi (người dùng chốt 2026-10-13): Hiệu trưởng cấu hình nhóm tuổi ăn những bữa nào (`ageGroup.mealSessions`: MORNING/LUNCH/AFTERNOON). Trẻ Có mặt mặc định ăn đủ các bữa của nhóm tuổi của lớp; trẻ không ăn thì cô tắt công tắc "Tham gia ăn" (hủy mọi bữa trong bản nháp). Bỏ ngoại lệ "ăn 1 bữa/ngày" theo từng trẻ (`childMealPlans`, màn `/attendance/meals`). Sĩ số suất ăn, xác nhận, bàn giao bếp tạo theo từng bữa mà ít nhất một lớp của điểm trường có; bản ghi cũ có bữa ngoài nhóm tuổi bị bỏ qua. BE cần trả `mealSessions` của lớp kèm danh sách điểm danh (PENDING BE). Bếp (`kitchenConstants`) chưa lập chế biến cho bữa phụ sáng nên bàn giao bữa này không chờ trạng thái bếp. Không sửa số suất đã xác nhận ở client.

## Liên hệ và thông báo phụ huynh — demo 2026-10-12

Người dùng xác nhận “Chỉ FE demo trước” và yêu cầu thu gọn UI: khi chọn NOTED, form chỉ hiện nút Liên hệ phụ huynh. Nhấn nút mở modal nhỏ gồm tên, quan hệ, số điện thoại, nút `tel:` và Đóng. Bỏ kết quả trao đổi, ghi chú nội bộ và nội dung preview khỏi form; dữ liệu cũ đã lưu không bị xóa. Bấm Gọi không tự đánh dấu đã trao đổi. Khi lưu NOTED, vẫn điều phối attendance (nếu cần) → health → notification demo; ghi nhận bình thường không tạo cảnh báo.

Outbox `parentHealthNotifications` tham chiếu `healthEntryId`, `childId`, người nhận, nội dung, thời gian và trạng thái DEMO_QUEUED. Chỉ dùng guardian ACTIVE có email làm khóa demo; không giả lập userId App. Retry dedup theo lần ghi nhận/người nhận. Thông báo lỗi không rollback health; UI hiện Gửi lại thông báo trên bản ghi cũ. Không gửi request mạng hoặc push thật, không cho rằng phụ huynh đã đọc.

Nội dung thông báo demo vẫn được tạo từ quan sát, thân nhiệt, biểu hiện, ghi chú sức khỏe, nhưng không hiển thị preview dài trên Web. Lịch sử chỉ hiện nhãn thông báo và Gửi lại khi cần. Ghi chú trao đổi nội bộ cũ không gửi. Push payload chỉ có thông báo chung, không tên trẻ/số đo/triệu chứng. Đây là nội dung demo, không quyết định policy công bố thật. Theo `BE:docs/decisions/ADR-0010-parent-visibility-policy.md`, field công bố thật còn P-13b: phải có policy/DTO phụ huynh riêng, GuardianChildLink, quyền chỉ xem con mình và deep link do BE/APP chốt. Chỉ sửa FE; không tạo endpoint thật.

## API cần thống nhất

`BE:docs/modules/attendance.md` và `BE:docs/modules/health.md` chưa có API; sức khỏe nhiều lần/ngày là yêu cầu bổ sung, không phải số đo định kỳ. Service mới chỉ dùng mock; ở chế độ API thật trả lỗi chưa hỗ trợ, không phát request tới endpoint tự đặt.

Đề xuất BE thống nhất hai nhóm: điểm danh/báo ăn lớp-ngày và danh sách/thêm ghi nhận sức khỏe trẻ-ngày. Ghi nhận cần thời gian, thân nhiệt tùy chọn, quan sát, biểu hiện, ghi chú, người ghi, khóa chống gửi trùng và quyền ghi trả từ backend. Cần chốt quyền xem trên APP phụ huynh riêng trước khi công bố dữ liệu.

## Trạng thái và lưu

Theo yêu cầu người dùng 2026-10-12, nhắc màu cam chỉ hiện khi Có mặt đã được lưu và bản nháp vẫn Có mặt, không hiện ngay khi mới tích Có mặt: Chưa ghi nhận sức khỏe nếu chưa có bản ghi trong ngày, hoặc Chưa ghi thân nhiệt nếu đã có bản ghi nhưng mọi lần đều thiếu số đo. Nhấn nhãn chọn trẻ để nhập; panel giải thích thông tin còn thiếu. Repository demo trả healthSummary cho cả hai màn, không tự suy luận bệnh/ngưỡng hay gửi nhắc này cho phụ huynh. Chỉ bản ghi đã lưu mới xóa nhắc; một lần có thân nhiệt trong đúng ngày là đủ, lần theo dõi sau thiếu số đo không làm nhắc xuất hiện lại. Nhắc không chặn lưu điểm danh, thân nhiệt vẫn tùy chọn; sau khóa vẫn thêm lần ghi nhận cho trẻ Có mặt đã lưu. Lưu sức khỏe riêng hoặc lỗi thông báo sau khi sức khỏe đã lưu đều làm mới nhãn, giữ nguyên bản nháp điểm danh của các trẻ khác. Contract thật cho summary còn cần BE chốt; không đặt endpoint.

Người dùng yêu cầu bỏ nhận/bàn giao suất ăn khỏi giao diện giáo viên: bỏ nút Nhận suất ăn dưới màn điểm danh, mục Bàn giao suất ăn trong menu TEACHER và KPI/việc nhận suất ăn trên trang chủ TEACHER, không tải widget bàn giao cho giáo viên. Giữ công tắc Tham gia ăn, giao diện bếp và menu/trang chủ tổ trưởng (quyền tổ trưởng chưa chốt thay đổi). Đây là thay đổi lối vào UI, không đổi route guard hoặc quyền repository/BE; đường dẫn trực tiếp vẫn theo quyền cũ. Màn ảnh bữa ăn đề xuất riêng còn chờ chốt phạm vi.

Chọn lại trẻ qua dòng danh sách hoặc ô Có mặt/Vắng đã tích vẫn chuyển panel: radio đã checked không phát `change`, nên chọn trẻ không được chỉ dựa vào thay đổi điểm danh. Form đang nhập dở vẫn yêu cầu xác nhận bỏ trước khi đổi trẻ.

Loading/empty/error/403/404 dùng component chung. Form lỗi giữ dữ liệu; khóa double-submit; không đổi trẻ/lớp/ngày khi form đang có thay đổi mà chưa xác nhận bỏ. Nhập sức khỏe được phép ngay khi chọn Có mặt; repository chỉ nhận lưu khi Có mặt đã được lưu cho ngày hôm nay và giáo viên được phân công, không kiểm giờ khóa điểm danh. Bản ghi không chẩn đoán hay tự gán nhãn dinh dưỡng.

## Kiểm chứng

Nhắc sức khỏe: smoke repository PASS các trạng thái chưa có bản ghi → bản ghi thiếu thân nhiệt → có số đo đã lưu; lần ghi nhận sau thiếu số đo không khôi phục nhắc, kể cả sau khóa. Browser demo trước thay đổi thời điểm nhắc PASS lưu quan sát không thân nhiệt đổi nhãn, lưu sức khỏe riêng có thân nhiệt xóa nhắc trên cả danh sách/panel. Không kiểm BE/App thật; responsive của phần nhắc chưa kiểm lại trên mobile.

Liên hệ/thông báo: smoke repository PASS cho recipient/entry linkage, idempotency, generic push, 403/422/409 và giữ health sau lỗi thông báo; test điều phối PASS thứ tự attendance → health → notification và lỗi notification trả healthSaved. Browser demo PASS hiện contact khi NOTED, lưu và xem trạng thái DEMO_QUEUED, xem nội dung gửi không có ghi chú nội bộ. Chưa gửi thật/kiểm App native. `node scripts/verify.mjs` PASS; AI layer 0 lỗi, 17 cảnh báo có sẵn.

Lint, format, build: `VERIFY PASS full` sau chỉnh code cuối. Smoke repository PASS: lưu hai lần sau khóa, chống gửi trùng, chưa Có mặt/ngày quá khứ/format sai/403/404 bị từ chối, ghi nhận sức khỏe không sửa điểm danh, tổng đếm nhất quán.

Browser mock: lưu Có mặt mở form sức khỏe, lưu hai lần giữ lịch sử, đổi trẻ hỏi bỏ thay đổi và Quay lại giữ dữ liệu; 1366px hai cột, 390px một cột không tràn trang. Backend thật/APP native và luồng chuyển trẻ kế tiếp chưa được kiểm browser. Chi tiết tại `docs/plans/active/2026-10-12-daily-reception.md`.

## Tổng hợp sức khỏe đầu ngày cho HT/PHT — PROPOSED 2026-10-13

Màn `/attendance/health` (chỉ xem): Hiệu trưởng toàn trường hoặc chọn điểm trường, Phó hiệu trưởng chỉ điểm trường của mình (mock trả 403 nếu xin campus khác), giáo viên không vào. Có số có mặt / đã kiểm tra / có dấu hiệu / đã báo phụ huynh, bảng theo lớp, danh sách "Trẻ cần chú ý" (lần ghi nhận mới nhất là NOTED) và lịch sử trong ngày của từng trẻ. Thân nhiệt tô màu theo mức cố định (xem mục dưới). Chỉ tính lớp của năm học đang hoạt động. PENDING BE: `GET /daily-health/overview`, `GET /daily-health/history` (xem `src/services/daily-health/api/dailyHealthApi.js`).

**Liên hệ phụ huynh (người dùng chốt 2026-10-13):** web chỉ hiện tên + SĐT bố/mẹ lấy từ hồ sơ nhập học ("Chưa có số" nếu thiếu); không có nút Gọi (chỉ trên App), không ghi kết quả gọi. Lưu lần ghi nhận "Có dấu hiệu cần lưu ý" luôn gửi thông báo tới tài khoản phụ huynh; HT/PHT thấy trạng thái "Đã gửi thông báo phụ huynh" + giờ, bấm cả dòng trẻ để xem chi tiết kèm SĐT bố mẹ.

**Mức thân nhiệt (người dùng chốt 2026-10-14):** đo ở nách, cố định cho mọi nhóm tuổi, không có màn cấu hình — dưới 35,5 °C "Thân nhiệt thấp" (xanh); 35,5–37,4 bình thường (không tô); 37,5–37,9 "Sốt nhẹ" (vàng); 38,0–38,4 "Sốt" (cam); 38,5–38,9 "Sốt cao" (đỏ); từ 39,0 "Sốt rất cao" (nền đỏ đậm). Thẻ trên dòng điểm danh chỉ hiện nhiệt độ (màu theo mức) và/hoặc "Cần chú ý" khi cô chọn "Có dấu hiệu"; mức, biểu hiện, ghi chú ở tooltip và khung sức khỏe. Gợi ý mức dưới ô nhập thân nhiệt, lịch sử ghi nhận và màn tổng hợp HT/PHT dùng cùng mức. Lọc / đếm "Có dấu hiệu cần lưu ý" gồm trẻ cô chọn "Có dấu hiệu" hoặc thân nhiệt lần mới nhất từ "Sốt nhẹ" trở lên. Hệ thống không tự chọn "Có dấu hiệu" hay tự tích biểu hiện. Ngưỡng ở `src/utils/attendance/temperatureLevels.js`; PENDING BE trả `level` cùng lần ghi nhận.

## Xử trí sức khỏe trong ngày — demo 2026-10-16

Cần chốt 2026-10-15, căn cứ TTLT 13/2016/TTLT-BYT-BGDĐT Điều 9 (theo dõi thường xuyên, sơ cứu, thông báo gia đình khi cần, chuyển cơ sở khám chữa bệnh) và Thông tư 52/2020/TT-BGDĐT (Điều lệ trường mầm non).

- Lần ghi nhận "Có dấu hiệu cần lưu ý" có thêm mục Xử trí (tích nhiều): Theo dõi tại lớp · Đưa phòng y tế · Đã gọi điện cho phụ huynh (cô tự gọi; thông báo App luôn tự gửi) · Báo phụ huynh đón về sớm · Chuyển cơ sở y tế / cấp cứu. Danh mục `HEALTH_ACTIONS` ở `src/utils/dailyHealthValidation.js`.
- Giáo viên chỉ ghi việc đã làm, không chẩn đoán; chẩn đoán và sổ khám bệnh (mẫu A1/YTCS) là việc của nhân viên y tế, ngoài phạm vi V1.
- Vết lưu: mỗi bước là một lần ghi nhận mới (giờ, người ghi), không sửa lần cũ. Ví dụ: 07:30 bình thường → 09:10 38,2 °C, Sốt, đưa phòng y tế → 09:30 báo phụ huynh đón về sớm → 10:17 cô trả trẻ cho bố ở màn Đón trẻ.
- "Báo phụ huynh đón về sớm" (Cần chốt 2026-10-16): không nhập trước người đón, giờ đón. Trẻ hiện nhãn "Chờ đón sớm · sức khỏe" và lên đầu danh sách Đón trẻ; khi phụ huynh đến, cô trả trẻ như thường (xác minh ảnh hoặc gọi điện, GBR-CP-03), giờ đón là lúc trả thật. Bản ghi trả trẻ lưu `reason = HEALTH_EARLY` và `healthEntryId` để truy vết; Sức khỏe trong ngày, màn BGH, Đánh giá hằng ngày đọc giờ đón từ bản ghi này ("Về sớm 10:17"), chưa trả thì "Chờ đón sớm". Điểm danh vẫn Có mặt, suất ăn không đổi.
- "Chuyển cơ sở y tế / cấp cứu": nơi chuyển, giờ, người đi cùng.
- Thông báo phụ huynh kèm xử trí, nơi chuyển; báo đón về sớm thì kèm "Phụ huynh vui lòng đến trường đón bé sớm". Lúc trả trẻ phụ huynh nhận thông báo kết quả trả trẻ như thường.
- Liên kết: Sức khỏe đầu ngày (BGH) có cột Xử trí và lịch sử trong ngày; Đánh giá hằng ngày hiện xử trí dưới ô Sức khỏe; tổng hợp tuần/tháng và bản nháp AI đếm số ngày theo xử trí.
- PENDING BE: `POST /daily-health-entries` thêm `actions[]`, `referral { place, time, escort }`; bảng trả trẻ trả `earlyRequest`, bản ghi trả trẻ thêm `reason`, `healthEntryId`.
- Báo phụ huynh (Cần chốt 2026-10-16): **mọi lần lưu ghi nhận sức khỏe** đều gửi thông báo, kể cả "Không ghi nhận bất thường" (vd. "16/10/2026 lúc 14:00: nhà trường cập nhật sức khỏe của … : không ghi nhận bất thường. Thân nhiệt 36,8 °C."). Bản ghi cũ trạng thái `NOT_REQUIRED` giữ nguyên. Trẻ chưa có tài khoản phụ huynh hoạt động thì báo "Chưa gửi được" và có nút Gửi lại.
