# Thông báo nhà trường — Web

Phạm vi theo PAR-05/07/08/09/10 và hợp đồng `specs/902-notification-client-readiness/contracts/backend-api-map.md`. HT/PHT mở quản trị thông báo và mẫu; chỉ HT mở quy tắc và lịch. Server xác định quyền, phạm vi, số người nhận, trạng thái và `canEdit`; UI không tự cấp quyền hoặc tính lịch nghiệp vụ.

- Danh sách gọi A01 phân trang từ server; soạn/sửa gọi A03..A05 với preview, part `data` JSON và `files` lặp, lưu tệp cũ bằng ID. Hủy lịch qua A06; 409 giữ bản nhập và tải trạng thái để đối chiếu.
- Mẫu dùng A09..A12; quy tắc A13/A14 gửi đủ ba field để không mất câu chữ khi bật/tắt; lịch A15..A18 gửi lại đầy đủ cấu hình, hiển thị `nextRunAt` từ BE.
- Thông báo nhận qua A19/A20, số chưa đọc dùng server; tin trường mở A07 để đọc toàn văn, tệp A08 tải qua request có xác thực. Tiền chốt 17/11/2026: mọi tin trong danh sách/chuông mở `/notifications/:id` để đọc trước; nút **Xem chi tiết** mới đi theo `link` sang hồ sơ liên quan. Không có link thì không hiện nút. Giữ quyền nội dung theo EDU-73/74 và guard của từng module; không đổi quyền hoặc đường dẫn hồ sơ.
- `announcements` chọn mock hoặc API qua `sourceOf`; mock là dữ liệu giả trong phiên và không chứng minh quyền thật hay gửi push thật. Mọi lỗi API giữ nguyên, không tự chuyển sang mock.

Chưa xác minh trên môi trường thật, điện thoại hoặc e2e; xem `specs/902-notification-client-readiness/verification-readiness.md` để biết kết quả và phần còn thiếu.

## Giao diện đồng bộ — Tiền yêu cầu 17/11/2026

- Các trang thông báo dùng cùng PageHeader, thẻ, thanh công cụ, bảng và nhãn trạng thái của design system mà kế hoạch năm học đang dùng; không import CSS/component riêng của giáo dục.
- Danh sách nhà trường đưa Soạn thông báo/Mẫu thông báo lên PageToolbar ghim dưới header (theo yêu cầu tiếp 17/11); trạng thái hiện bằng tiếng Việt, thời gian dùng formatter chung. Không tính tổng người nhận từ dữ liệu trang ở client.
- Form soạn/sửa chia khối nội dung, người nhận, thời gian, đính kèm. Tiền chốt tiếp 17/11/2026: chỉ một thanh header gồm Quay lại và Gửi thông báo/Hẹn gửi thông báo/Lưu thay đổi, bỏ nút cuối form. Dùng chung ResponsiveToolbar với giáo dục, nút outline-primary cỡ sm; thiếu chiều rộng thì chuyển thành menu ba gạch, không xuống hàng. Ngoại lệ này thay quy tắc nút đầu/cuối của form dài tại UI_CARD §2.14 cho riêng form thông báo.
- Bấm gửi/lưu tự gọi preview mới, hiển thị số người nhận trong hộp xác nhận; chỉ xác nhận mới gọi create/update. Không bắt buộc bấm Xem trước người nhận thủ công để mở khóa nút. Nhóm trống/chưa chọn vai trò/lỗi API báo rõ, giữ nội dung; khóa thao tác khi kiểm tra/gửi, bỏ kết quả preview cũ. Người nhận cuối cùng vẫn do BE xác định theo PAR-05/07/08, không đổi payload hoặc quyền.
- Mẫu dùng bảng cùng form modal; lịch gửi tạo/sửa ở trang riêng `/announcement-schedules/new` và `/:id/edit` dùng chung form soạn thông báo (chọn mẫu để điền nhanh hoặc soạn riêng); quy tắc dùng bảng, xem/sửa qua cột Thao tác, quyền theo trường backend. Xóa/hủy dùng ConfirmationModal; lưu/tải có trạng thái đang xử lý.
- Hai màn thông báo cá nhân dùng thẻ và nút chung, nội dung giữ xuống dòng; tệp tải bằng API có xác thực. Tiền điều chỉnh mới nhất 17/11: danh sách Thông báo của tôi dùng nền xanh nhạt cho cả dòng chưa đọc kèm chấm xanh (aria-label Chưa đọc), tin đã đọc nền trắng; hover giữ nguyên màu theo trạng thái. Bỏ badge Chưa đọc. Icon chuông nền trong suốt/màu trung tính, giữ nhãn loại thông báo và focus bàn phím. Giữ Đánh dấu tất cả đã đọc và hành vi mở/đánh dấu đã đọc. Module account tiếp tục dùng service và style account, không import component riêng của announcement.
- Chưa kiểm trực quan ở các kích thước màn hình, chưa thử trên môi trường thật hoặc chạy e2e. Kết quả native checks ghi ở plan `docs/plans/completed/2026-11-17-notification-ui-consistency.md`.

## Sidebar — Tiền yêu cầu 17/11/2026

Mọi role dùng một nhóm **Thông báo** trong menu chính. Mục **Thông báo của tôi** có cho mọi role; HT/PHT có thêm Thông báo nhà trường và Mẫu thông báo; chỉ HT có Quy tắc thông báo và Lịch gửi thông báo (PAR-05/07..10). Không thêm route soạn/sửa/chi tiết vào sidebar: các trang con mở từ danh sách, làm sáng mục cha và giữ breadcrumb theo nhóm. Nhóm dùng cơ chế đóng/mở, bàn phím và flyout của Sidebar hiện có; các route/guard và API giữ nguyên.

## Nhãn loại — Tiền yêu cầu cả FE/BE 17/11/2026

Danh sách, chuông và chi tiết dùng nhãn tiếng Việt từ `NotificationResponse.typeLabel` của BE; badge loại màu trung tính, độc lập với badge Chưa đọc. Adapter giữ nhãn qua service/account detail; helper chung `src/utils/notificationLabel.mjs` chỉ fallback cho mock hoặc BE cũ chưa có trường mới. Mã chưa biết không phơi ra UI, dùng Thông báo hệ thống. Giữ `type`, link, announcementId và hành vi đánh dấu đã đọc; điều hướng qua bước đọc thông báo theo quyết định cùng ngày ở trên. Thay đổi nhãn áp dụng cả dữ liệu cũ khi đọc API, không cần migration DB.

Known pitfall: không dùng `!preview?.total` để vô hiệu hóa nút gửi; xem [nút gửi bị khóa](../knowledge/incidents/FE-BUG-261117-announcement-submit-preview.md). Form này dùng chung cho cả tạo mới và sửa lịch gửi, cần kiểm cả hai khi đổi luồng xác nhận.

## Form gọn và đính kèm — Tiền yêu cầu tiếp 17/11/2026

- Yêu cầu tiếp của Tiền: ô mẫu một hàng ngắn tối đa 22rem; **Tiêu đề riêng một dòng**, nội dung nằm dòng tiếp theo. Khung nhập tối đa 64rem, ô nội dung tối đa 80ch. Các ô phạm vi/điểm trường/nhóm tuổi/lớp khoảng 18rem, giờ gửi tối đa 20rem. Màn nhỏ tự xếp cột, không ép ô ngắn chạy hết chiều ngang màn lớn. Ô tên/phạm vi mẫu trong modal tối đa 22rem; ngày trong tháng/giờ của lịch lặp khoảng 12rem.
- Đính kèm tham khảo phần thêm học liệu kế hoạch ngày: nút Thêm tệp outline-primary, bộ đếm, trạng thái trống và thẻ tệp có tên/dung lượng/thao tác. Chọn thêm nhiều lần nối vào danh sách chờ, bỏ riêng từng tệp; reset input để có thể chọn lại tệp vừa bỏ. Tệp cũ có Bỏ/Giữ lại; chỉ thay đổi keepAttachmentIds khi lưu. Màn chi tiết chỉ đọc vẫn tải tệp qua API có xác thực.
- Chọn tệp kiểm ngay định dạng/kích thước/tổng số tệp mới + giữ lại bằng cùng helper với submit; lỗi không làm mất danh sách đã chọn. Đủ 5 tệp thì khóa thêm. Chọn ở máy chưa tải lên server; chỉ xác nhận gửi/lưu mới upload. Giữ giới hạn PAR-08, không thêm kho học liệu/link/video của giáo dục vào thông báo.
- Đối chiếu EDU-82/83/87 chỉ để hiểu màn tham chiếu; không sửa giao diện/nghiệp vụ giáo dục, không đổi component/CSS nền.
- Kiểm chứng lượt này: `announcement-model.test.mjs` 9/9 đạt (có render form, tệp chờ và màn chỉ đọc; giới hạn tệp), lint/format/build theo báo cáo bàn giao. Chưa kiểm trình duyệt/BE thật; không chạy e2e.

Thử thêm tệp: chọn 2 tệp hợp lệ → bấm Thêm tệp lần nữa chọn 1 tệp → thấy 3 thẻ → bỏ 1 thẻ rồi chọn lại chính tệp đó. Với bản sửa, bỏ tệp cũ rồi Giữ lại; khi đủ 5 tệp nút thêm bị khóa. Tệp sai đuôi hoặc lớn hơn 10 MB báo lỗi và giữ nguyên các thẻ cũ. Màn chi tiết chỉ hiện danh sách/tải, không có nút thêm/bỏ.

## Header toàn module — Tiền yêu cầu tiếp 17/11/2026

Chín route (8 component trang) dùng PageToolbar chung: thông báo của tôi, chi tiết cá nhân, danh sách nhà trường, soạn mới, sửa, chi tiết nhà trường, mẫu, quy tắc, lịch gửi. Thanh ghim dưới header với cùng offset/token như giáo dục, nền và viền dưới; summary trái, nút phải, không xuống hàng và chuyển menu ba gạch khi thiếu chiều rộng. Trang quy tắc không có thao tác tổng nên chỉ hiện summary, không sinh menu trống. Nút tạo/sửa/gửi/lưu/tải dùng outline-primary cỡ sm, bỏ/hủy lịch dùng outline-danger; modal và menu dòng vẫn dùng component chung và trạng thái cảnh báo/xác nhận hiện có. Nút Quay lại/Xem chi tiết lên header, không lặp ở cuối. Màn soạn/sửa vẫn có header Quay lại khi tải/lỗi/không được sửa.

Tiền điều chỉnh tiếp 17/11/2026: Quay lại nằm trong `leading` bên trái, Gửi/Xem chi tiết và các hành động khác ở nhóm phải. Thanh thao tác sát dưới header chung, trước thẻ lọc/tab; `.page--toolbar` bỏ khoảng đệm đầu trang và khung tiêu đề ẩn gây khoảng trống. Áp đồng thời với EDU-92 mới của giáo dục, không đổi quyền/luồng nghiệp vụ.

PageToolbar là primitive dùng chung và CSS opt-in; không sửa ResponsiveToolbar, Button, Modal. Chi tiết cá nhân chỉ dùng primitive chung, giữ ranh giới account/announcement. Quyền canEdit/mandatory/editable, payload, preview, đánh dấu đã đọc và link đích giữ nguyên. Khác quy tắc form dài UI_CARD §2.14 cho module này: chỉ một thanh thao tác header theo yêu cầu mới nhất.

Test thủ công thêm: cuộn trang dài để kiểm thanh thao tác ghim; thu khung/zoom hoặc mở sidebar tới khi thiếu chỗ, bấm menu ba gạch bằng chuột và Enter, dùng Tab/Escape. Đối chiếu đủ hành động, trạng thái disabled và hộp xác nhận. Kiểm cả HT/PHT và tài khoản chỉ nhận thông báo; lịch/quy tắc vẫn chỉ HT theo guard/API. Chưa thực hiện kiểm trực quan hay API thật trong lượt sửa này.

## Test thủ công thanh header và gửi thông báo

1. Đăng nhập HT/PHT, vào Thông báo → Thông báo nhà trường → Soạn thông báo. Chỉ có một cặp nút ở header; thu hẹp khung trang tới khi thiếu chỗ thì hiện menu ba gạch.
2. Nhập tiêu đề/nội dung thử, chọn phạm vi hợp lệ và vai trò có người nhận; để trống giờ gửi. Không bấm Xem trước, bấm Gửi: có trạng thái kiểm tra, sau đó hộp xác nhận hiện số người nhận. Bấm Quay lại trong hộp: chưa gửi và nội dung vẫn giữ nguyên.
3. Bấm Gửi và xác nhận: khi API thành công chuyển sang chi tiết thông báo. Kiểm tra trạng thái Đã gửi; dùng tài khoản người nhận thuộc nhóm để kiểm tra tin trong Thông báo của tôi. Chỉ thực hiện trên môi trường thử với tài khoản/dữ liệu thử.
4. Bỏ chọn hết vai trò rồi bấm Gửi: báo chọn vai trò. Nhóm không có người nhận hoặc API preview lỗi: báo rõ, không mở hộp xác nhận/gọi tạo thông báo, không mất nội dung.
5. Chọn thời gian tương lai theo giờ Việt Nam: nhãn thành Hẹn gửi thông báo. Xác nhận xong mở chi tiết trạng thái Đã hẹn gửi; mở sửa lịch, kiểm tra cùng một header và thao tác Lưu thay đổi.

## Xóa thông báo đã hủy — PAR-13 (Tiền chốt 17/11/2026)

Danh sách nhà trường có tìm theo tiêu đề/nội dung (Enter hoặc Tìm) và lọc trạng thái; đổi filter về trang 1. Danh sách có checkbox cho tin canDelete; header checkbox chọn mọi tin đã hủy khớp filter trên mọi trang. Có thể bỏ tick từng tin sau chọn tất cả; giữ lựa chọn khi đổi trang và bỏ chọn khi đổi bộ lọc. Header chỉ có Xóa đã chọn (N), không có Xóa tất cả; chi tiết vẫn có nút Xóa một thông báo đã hủy. Tổng tin chọn được do BE trả cancelledCount, không lấy số dòng trang làm tổng. Cả hai có xác nhận nêu không hoàn tác và tệp đính kèm sẽ bị xóa. Thành công giữ bộ lọc, tải lại/về trang 1; lỗi giữ filter và báo ở modal, timeout yêu cầu tải lại kiểm tra thay vì tự retry. Mock và API cùng contract; canDelete do BE trả. Không xóa thông báo đã gửi hoặc mẫu/lịch.

Test tay: tạo/hẹn rồi hủy ít nhất 2 tin với tiêu đề riêng → tìm từ khóa và chọn Đã hủy → xóa 1 ở menu dòng/chi tiết → kiểm tin còn lại → Xóa tất cả đã hủy, kiểm nội dung xác nhận áp mọi trang → xác nhận và kiểm không còn kết quả. Tin đã gửi hoặc ngoài filter/scope phải giữ nguyên. Dùng tài khoản thử trên môi trường thử; thao tác thật là xóa vĩnh viễn.

PAR-07 không tự nhận đã được BE resolver và mock áp dụng trước đếm/ngay/hẹn/lặp; regression kiểm người gửi mang nhiều vai trò. Nhắc điểm danh OBS-30 mới: từ 08:00 đến trước giờ khóa cấu hình, mỗi 5 phút cho lớp chưa điểm danh, dừng khi đã điểm danh/khóa/ngày nghỉ. Thử với cutoff 08:12 trên môi trường thử: dự kiến lượt 08:00, 08:05, 08:10; không có lượt 08:15.

## Test chọn dòng / cấu hình thời gian — 17/11/2026

Lọc Đã hủy với hơn 20 kết quả → tick header, kiểm số đã chọn là tổng mọi trang → đổi trang, bỏ tick một tin → Xóa đã chọn, xác nhận → chỉ tin bỏ tick còn lại. Chọn riêng các tin trên nhiều trang rồi xóa cũng chỉ xóa đúng ids; lọc mới phải bỏ lựa chọn cũ. Dữ liệu sai trạng thái/ngoài scope chặn ở BE trước mọi thao tác xóa.
Cấu hình đọc ở CareNest_BE/src/main/resources/application.yml, các nhóm push/announcement/notification-reminders; comment ghi đơn vị, cron 6 phần, giờ Việt Nam và restart. Ví dụ đổi attendance-interval-minutes từ 5 thành 10: cron và slot dedupe cùng đổi, không sửa Java. Giờ khóa điểm danh vẫn theo cấu hình trường, giờ hẹn/lặp vẫn theo lịch đã lưu.

## Lịch gửi: checkbox và công tắc (Tiền 17/11/2026)

Danh sách lịch có cột checkbox như trang thông báo nhà trường: tick từng lịch hoặc header chọn tất cả (list không phân trang). Header có Bật đã chọn, Tắt đã chọn, Xóa đã chọn (N); xóa một (menu dòng) và xóa nhiều dùng chung hộp xác nhận, BE `POST /announcement-schedules/delete-selection` xóa nguyên tử. Form lịch có công tắc Bật lịch gửi, lịch mới mặc định bật; tắt thì lưu lịch nhưng không gửi tới khi bật lại. Test tay: tạo lịch không mẫu và từ mẫu, tắt công tắc khi tạo; tick 2 lịch → Xóa đã chọn → xác nhận → toast và danh sách còn lại đúng.

## Cột Thao tác và tick (Tiền 17/11/2026, bản sau)

Mọi bảng (thông báo nhà trường, mẫu, quy tắc, lịch gửi) có cột Thao tác: Xem chi tiết (icon mắt), Sửa khi có quyền, menu "…" cho thao tác khác. Bấm vào dòng không mở chi tiết nữa để không lẫn với tick. Header checkbox trang thông báo luôn bấm được khi có dữ liệu: chọn mọi tin đã hủy; không có tin đã hủy thì báo toast. Trang lịch: tick được mọi lịch, header chọn tất cả; Bật đã chọn áp cho lịch đã tắt trong lựa chọn, Tắt đã chọn áp cho lịch đang bật; Xóa đã chọn chỉ bấm được khi mọi lịch đã chọn đều đã tắt; xóa lịch đang bật bị khóa (BE 1215). Mẫu/quy tắc xem ở modal chỉ đọc; lịch có trang chi tiết riêng.
