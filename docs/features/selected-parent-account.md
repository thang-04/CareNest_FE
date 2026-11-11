# Thiết kế — Chọn một phụ huynh nhận tài khoản

Nguồn user ngày 05/11/2026: chỉ chọn một phụ huynh làm tài khoản; Excel nhập hồ sơ trước, kích hoạt sau ở màn Tài khoản phụ huynh; form tiếp nhận kích hoạt người được chọn ngay khi lưu. User đã duyệt và yêu cầu triển khai; luồng này đã được thực hiện ở FE và BE.

## Luồng và thời điểm

| Màn hình | Người dùng thao tác | Kết quả |
| --- | --- | --- |
| Tiếp nhận trẻ bằng form | Nhập phụ huynh, chọn một người nhận tài khoản, xác nhận lưu | Lưu đủ hồ sơ; chỉ tạo/liên kết tài khoản cho người được chọn theo quyền hiện có |
| Nhập Excel | Tải file, chọn người nhận tài khoản cho mỗi trẻ ở bảng xem trước | Lưu đủ phụ huynh và lựa chọn; chưa kích hoạt tài khoản |
| Tài khoản phụ huynh | Mở trẻ, kiểm tra người đã chọn, bấm kích hoạt | Chỉ người được chọn được tạo/liên kết tài khoản; những người khác không có trong danh sách kích hoạt |

## Tiếp nhận trẻ — bước Thông tin trẻ và phụ huynh

Giữ nguyên các thẻ phụ huynh và ảnh vừa triển khai. Mỗi thẻ có lựa chọn radio **Nhận tài khoản phụ huynh**. Các radio chung một nhóm, chỉ chọn được một người.

```text
Phụ huynh 1 — Bố                         Phụ huynh 2 — Mẹ
[Ảnh]  Họ tên, SĐT, CCCD, email          [Ảnh]  Họ tên, SĐT, CCCD, email
( ) Nhận tài khoản phụ huynh             (●) Nhận tài khoản phụ huynh

Chỉ người được chọn được tạo hoặc liên kết tài khoản khi lưu.
Các phụ huynh khác vẫn được lưu trong hồ sơ để liên hệ và đối chiếu đón trẻ.
```

- Có đúng một người: tự chọn người đó, hiện nhãn **Người nhận tài khoản**.
- Thêm người thứ hai: giữ lựa chọn rõ ràng đã có; nếu chỉ có lựa chọn tự động của form một người thì yêu cầu chọn rõ trong nhóm radio.
- Từ hai người trở lên mà chưa có lựa chọn: chặn sang bước tiếp theo, báo **Chọn một phụ huynh nhận tài khoản**.
- Xóa người đang chọn: nếu chỉ còn một người thì tự chọn người còn lại; nếu còn từ hai người thì bỏ lựa chọn và yêu cầu chọn lại.
- Lựa chọn đi theo đúng phụ huynh khi thay đổi thứ tự; không chuyển theo vị trí thẻ. Thông tin và ảnh vẫn nằm ở đúng người.
- Bước Xem lại: ghi riêng **Phụ huynh nhận tài khoản: họ tên · quan hệ · SĐT**, đồng thời vẫn liệt kê đầy đủ phụ huynh.
- Người lưu không có quyền kích hoạt: vẫn lưu hồ sơ và lựa chọn; người mới chờ người có quyền kích hoạt sau, theo quy định quyền hiện có.

## Excel — file và bảng xem trước

Mỗi dòng vẫn là một trẻ. Mở rộng các nhóm cột phụ huynh để nhận nhiều người, tối đa theo giới hạn hiện tại là ba; nhóm thứ hai/thứ ba tùy chọn. Tên cột phụ huynh đầu tiên cũ vẫn được nhận.

Có thể thêm cột tùy chọn **CCCD phụ huynh nhận tài khoản** để chọn sẵn. Cột này phải khớp đúng một phụ huynh của cùng dòng, không nhận CCCD của dòng khác. Tệp không có cột này vẫn đọc được.

| Trẻ | Phụ huynh của trẻ | Phụ huynh nhận tài khoản | Trạng thái nhập |
| --- | --- | --- | --- |
| Trẻ A | Bố — SĐT; Mẹ — SĐT | Danh sách chọn: Mẹ — SĐT | Hợp lệ |
| Trẻ B | Mẹ — SĐT | Tự chọn Mẹ | Hợp lệ |
| Trẻ C | Bố — SĐT; Bà — SĐT | Chưa chọn | Cần chọn phụ huynh |

- Chọn/sửa trực tiếp ở dropdown của dòng, không phải sửa file rồi tải lại chỉ để đổi người nhận tài khoản.
- Chưa chọn khi có nhiều người, CCCD chọn không khớp hoặc nhóm phụ huynh nhập dở: đánh dấu lỗi đúng dòng; dòng đó chưa được nhập. Giữ cách xử lý các dòng hợp lệ của màn hiện có, báo rõ số dòng chưa nhập.
- Sau nhập: thông báo **Đã nhập hồ sơ. Kích hoạt tài khoản cho phụ huynh đã chọn tại Tài khoản phụ huynh.** Có lối mở màn này.
- Trong thiết kế này, nhập Excel chỉ lưu hồ sơ/lựa chọn; thao tác tạo hoặc liên kết tài khoản được thực hiện ở nút kích hoạt sau đó.

## Tài khoản phụ huynh

Mỗi dòng trẻ hiển thị tối đa một phụ huynh nhận tài khoản:

| Trẻ | Phụ huynh nhận tài khoản | SĐT / tên đăng nhập | Trạng thái | Thao tác |
| --- | --- | --- | --- | --- |
| Trẻ A | Mẹ — họ tên | SĐT | Chưa kích hoạt | Kích hoạt tài khoản |
| Trẻ B | Bố — họ tên | SĐT | Đã có tài khoản, chờ liên kết | Liên kết tài khoản |
| Trẻ C | Bà — họ tên | SĐT | Đang hoạt động | Các thao tác tài khoản theo quyền hiện có |

- Panel/hộp xác nhận chỉ hiện người được chọn; bỏ câu chữ **kích hoạt tất cả phụ huynh/cả nhà**.
- Bộ lọc **Chưa có tài khoản** và các số đếm dựa trên người được chọn, không dựa trên việc một người khác của trẻ đã có tài khoản hay chưa.
- Tài khoản đã có được dùng lại; không tạo bản sao, không tự đổi mật khẩu hoặc mở khóa tài khoản đang bị khóa.
- Các phụ huynh không được chọn vẫn có mặt trong **Hồ sơ trẻ** và màn **Đón trẻ**, kèm ảnh; danh sách tài khoản và danh sách người đón là hai dữ liệu khác nhau.
- BE phải trả đúng người và kiểm lựa chọn khi kích hoạt; không chỉ lọc/ẩn ở trình duyệt.

## Hồ sơ cũ và thay đổi lựa chọn

- Không tự khóa hoặc xóa tài khoản, không tự thu hồi liên kết cũ khi nâng cấp.
- Hồ sơ chỉ có một phụ huynh, hoặc chỉ có một phụ huynh đã liên kết tài khoản: có thể điền người đó khi chuyển dữ liệu.
- Hồ sơ còn nhiều khả năng lựa chọn: ghi **Cần chọn phụ huynh nhận tài khoản**, cho mở hồ sơ để chọn; không đoán Bố/Mẹ hay người đứng đầu.
- Nếu hồ sơ cũ đã có nhiều liên kết, ghi rõ còn liên kết cũ; lựa chọn người nhận tài khoản không tự xóa các quyền truy cập cũ. Việc thu hồi các liên kết đó cần thao tác quản lý riêng.
- Thay người trước kích hoạt: cho sửa theo quyền hồ sơ/quản lý phụ huynh. Sau kích hoạt: không thay ngầm; hiển thị tình trạng liên kết để người quản lý xử lý có chủ đích.

## Nguồn kỹ thuật và kiểm chứng

Plan chính: [BE](../../../CareNest_BE/docs/plans/completed/2026-11-05-selected-parent-account.md). Domain/contract: BE `specs/013-selected-parent-account/`. API và migration V70 được triển khai tại BE; mock FE hỗ trợ CSV/XLSX, XLS đi qua parser BE. Module children/pickup giữ nguồn demo/API hiện có, không chuyển toàn module trong thay đổi này. Không đổi cơ chế mật khẩu/SMS, không sửa APP, không thêm nhận diện khuôn mặt hay quyền đón hộ.
