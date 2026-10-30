# Validation — Cấu hình trường

Đối chiếu FE với BE `CareNest_BE` nhánh `feature/G94-235-BE-FEAT-03-school-config` (DTO `dto/organization/*Request`, service `service/organization/impl/*`, `service/child/impl/YearTransitionServiceImpl`). Cập nhật 22/10/2026.

## Cách hiển thị lỗi

- Lỗi của một ô: chữ đỏ dưới ô, viền đỏ (`FormField` → `field__error`, `is-invalid`).
- Vượt độ dài: báo ngay khi gõ (ô không chặn gõ). Lỗi khác: báo khi rời ô và khi bấm Lưu. Sửa ô ⇒ lỗi của ô đó mất.
- Bấm Lưu khi còn lỗi: không gửi lên BE.
- Lỗi BE (400/409): `src/services/http/beErrorMessages.js` đổi `desc` tiếng Anh thành câu tiếng Việt, gắn vào ô tương ứng; lỗi không gắn được ô hiện khung đỏ đầu form/hộp thoại (`errors._form`). Hộp xác nhận (xóa, kết thúc, kích hoạt, xếp tự động) giữ mở và báo đỏ trong hộp (`ConfirmationModal` prop `error`).

## Bảng quy tắc

Cột "Nguồn BE": DTO = annotation của request; SV = kiểm tra trong service (lỗi 400/409).

### Năm học (`/school/years/new`, `/school/years/:id/edit`)

| Ô                  | Quy tắc                                                                                                                                | Câu báo lỗi                                                                                | Nguồn BE                 |
| ------------------ | -------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------ | ------------------------ |
| Tên năm học        | Bắt buộc                                                                                                                               | Nhập tên năm học, ví dụ 2027-2028                                                          | DTO `@NotBlank`          |
| Tên năm học        | Dạng NNNN-NNNN, năm sau = năm trước + 1                                                                                                | Tên năm học có dạng NNNN-NNNN, năm sau lớn hơn năm trước 1 năm (ví dụ 2027-2028)           | DTO `@Pattern` + SV      |
| Tên năm học        | Không trùng năm khác                                                                                                                   | Năm học này đã tồn tại. Hãy xem lại năm học đã có.                                         | SV 409                   |
| Tên năm học        | Chỉ đổi khi năm chưa bắt đầu và chưa có lớp                                                                                            | Chỉ đổi được tên năm học khi năm học chưa bắt đầu / Năm học đã có lớp, không đổi được tên  | SV 409                   |
| Ngày bắt đầu       | Bắt buộc, ngày hợp lệ                                                                                                                  | Chọn ngày bắt đầu / Ngày bắt đầu không hợp lệ, nhập dạng dd/mm/yyyy                        | DTO `@NotNull`           |
| Ngày kết thúc      | Bắt buộc, ngày hợp lệ, sau ngày bắt đầu                                                                                                | Chọn ngày kết thúc / Ngày kết thúc phải sau ngày bắt đầu                                   | DTO `@NotNull` + SV 400  |
| Ngày kết thúc      | Không chồng thời gian năm khác                                                                                                         | Khoảng thời gian trùng với năm học …                                                       | SV 409                   |
| Hộp kích hoạt      | Gõ đúng tên năm                                                                                                                        | Gõ đúng "…" để xác nhận                                                                    | DTO `@NotBlank` + SV 400 |
| Hộp kích hoạt      | Chỉ năm chưa bắt đầu; từ 7 ngày trước ngày bắt đầu; đủ bước bắt buộc                                                                   | Chỉ kích hoạt được từ dd/mm/yyyy (7 ngày trước ngày bắt đầu) + các bước còn thiếu          | SV 409                   |
| Hộp kích hoạt      | Kích hoạt theo thứ tự: chỉ năm sắp diễn ra bắt đầu sớm nhất (nút Kích hoạt chỉ hiện ở năm đó)                                          | Kích hoạt năm học … trước                                                                  | SV 409                   |
| Hộp xóa / kết thúc | Xóa: năm chưa bắt đầu, chưa có lớp. Kết thúc: năm đang hoạt động, chỉ sau ngày kết thúc (trước đó mục menu mờ, ghi ngày được kết thúc) | Năm học đã có lớp, không xóa được / Chỉ kết thúc được năm học sau ngày kết thúc dd/mm/yyyy | SV 409                   |

### Điểm trường (`/school/campuses/new`, `/:id/edit`)

| Ô              | Quy tắc                                                                                                                                        | Câu báo lỗi                                                                               | Nguồn BE                      |
| -------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------- | ----------------------------- |
| Mã điểm trường | Bắt buộc, tối đa 30 ký tự                                                                                                                      | Nhập mã điểm trường / Mã điểm trường tối đa 30 ký tự (đang n)                             | DTO `@NotBlank @Size(max=30)` |
| Mã điểm trường | Không trùng (không phân biệt hoa thường)                                                                                                       | Mã điểm trường đã tồn tại                                                                 | SV 409                        |
| Tên ngắn       | Bắt buộc, tối đa 50                                                                                                                            | Nhập tên ngắn / Tên ngắn tối đa 50 ký tự                                                  | DTO                           |
| Tên đầy đủ     | Bắt buộc, tối đa 150, không trùng                                                                                                              | Nhập tên điểm trường / Tên đầy đủ tối đa 150 ký tự / Tên điểm trường đã tồn tại           | DTO + SV 409                  |
| Địa chỉ        | Bắt buộc, tối đa 255                                                                                                                           | Nhập địa chỉ / Địa chỉ tối đa 255 ký tự                                                   | DTO                           |
| Số điện thoại  | Không bắt buộc; số Việt Nam: di động 10 số (03/05/07/08/09), cố định 11 số (02x); nhận +84/84, dấu cách, chấm, gạch ngang; lưu dạng 0xxxxxxxxx | Số điện thoại không đúng định dạng Việt Nam (VD: 0912345678)                              | DTO `@Pattern` + SV chuẩn hóa |
| Hộp xóa        | Không xóa điểm trường chính, điểm trường có lớp / phòng / nhân sự                                                                              | Không xóa được điểm trường chính / Điểm trường đã có lớp (phòng, nhân sự), không xóa được | SV 409                        |

### Phòng (`/school/rooms`, hộp Thêm/Sửa phòng)

| Ô                    | Quy tắc                                                                                   | Câu báo lỗi                                                                                                                             | Nguồn BE                |
| -------------------- | ----------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- | ----------------------- |
| Điểm trường          | Bắt buộc                                                                                  | Chọn điểm trường                                                                                                                        | DTO `@NotNull`          |
| Mã / số phòng        | Bắt buộc, tối đa 20, không trùng trong điểm trường                                        | Nhập mã/số phòng, ví dụ P.101 / Mã phòng tối đa 20 ký tự / Điểm trường đã có phòng cùng mã                                              | DTO + SV 409            |
| Tên phòng            | Bắt buộc, tối đa 50, không trùng trong điểm trường                                        | Nhập tên phòng / Tên phòng tối đa 50 ký tự / Điểm trường đã có phòng cùng tên                                                           | DTO + SV 409            |
| Loại phòng           | Bắt buộc; phòng đang là phòng học của lớp không đổi loại                                  | Chọn loại phòng / Phòng đang là phòng học của lớp, không đổi được loại phòng                                                            | DTO + SV 409            |
| Sức chứa             | Phòng học bắt buộc; số nguyên 1–32767; không nhỏ hơn sĩ số tối đa của lớp đang dùng phòng | Nhập sức chứa của phòng học / Sức chứa là số nguyên từ 1 đến 32767 / Lớp đang dùng phòng có sĩ số tối đa n, sức chứa không được nhỏ hơn | DTO `@Min(1) @Max` + SV |
| Người phụ trách      | Nhân sự của điểm trường                                                                   | Người phụ trách phải là nhân sự của điểm trường này                                                                                     | SV 400                  |
| Ghi chú              | Tối đa 500                                                                                | Ghi chú tối đa 500 ký tự                                                                                                                | DTO                     |
| Hộp xóa / ngừng dùng | Phòng đang là phòng học của lớp                                                           | Phòng đang là phòng học của …, không thực hiện được                                                                                     | SV 409                  |

### Nhóm tuổi (`/school/classes`, hộp Thêm/Sửa nhóm tuổi)

| Ô                  | Quy tắc                                                    | Câu báo lỗi                                                                                                 | Nguồn BE        |
| ------------------ | ---------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------- | --------------- |
| Tên nhóm tuổi      | Bắt buộc, tối đa 50, không trùng                           | Nhập tên nhóm tuổi / Tên nhóm tuổi tối đa 50 ký tự / Tên nhóm tuổi đã tồn tại                               | DTO + SV 409    |
| Tên ngắn           | Bắt buộc, tối đa 50                                        | Nhập tên ngắn / Tên ngắn tối đa 50 ký tự                                                                    | DTO             |
| Bữa ăn             | Chọn ít nhất 1                                             | Chọn ít nhất một bữa ăn trong ngày                                                                          | DTO `@NotEmpty` |
| Độ tuổi từ         | Số nguyên 0–72 tháng                                       | Độ tuổi từ là số tháng nguyên từ 0 đến 72                                                                   | DTO             |
| Độ tuổi đến        | Số nguyên 1–72, lớn hơn "từ", không trùng khoảng nhóm khác | Độ tuổi đến là số tháng nguyên từ 1 đến 72 / Độ tuổi đến phải lớn hơn độ tuổi từ / Độ tuổi trùng với nhóm … | DTO + SV        |
| Sĩ số tối đa / lớp | Số nguyên 1–32767; không hạ dưới sĩ số lớp đang có         | Sĩ số tối đa / lớp là số nguyên từ 1 đến 32767 / Không hạ được: …                                           | DTO + SV 409    |
| Yêu cầu dinh dưỡng | Tối đa 500                                                 | Ghi chú dinh dưỡng tối đa 500 ký tự                                                                         | DTO             |
| Hộp xóa            | Nhóm có lớp hoặc có tổ trưởng                              | Nhóm tuổi đã có lớp (tổ trưởng), không xóa được                                                             | SV 409          |

### Lớp (`/school/classes`, hộp Thêm/Sửa lớp, Sao chép lớp)

| Ô                                      | Quy tắc                                                                              | Câu báo lỗi                                                                                                    | Nguồn BE       |
| -------------------------------------- | ------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------- | -------------- |
| Tên lớp                                | Bắt buộc, tối đa 50, không trùng trong điểm trường + năm học                         | Nhập tên lớp / Tên lớp tối đa 50 ký tự / Điểm trường đã có lớp cùng tên trong năm học này                      | DTO + SV 409   |
| Điểm trường, Nhóm tuổi, Năm học, Phòng | Bắt buộc                                                                             | Chọn điểm trường / Chọn nhóm tuổi / Chọn năm học / Chọn phòng học                                              | DTO `@NotNull` |
| Phòng                                  | Thuộc điểm trường đã chọn, đang dùng, chưa có lớp khác trong năm                     | Phòng không thuộc điểm trường đã chọn / Phòng đã ngừng sử dụng / Phòng đã được lớp khác dùng trong năm học này | SV             |
| Nhóm tuổi                              | Lớp đã có trẻ không đổi nhóm tuổi                                                    | Lớp đã có trẻ, không đổi được nhóm tuổi                                                                        | SV 409         |
| Sĩ số tối đa                           | Số nguyên từ max(1, số trẻ đang học) đến min(sĩ số tối đa nhóm tuổi, sức chứa phòng) | Sĩ số tối đa từ … đến … (theo nhóm tuổi / sức chứa phòng)                                                      | DTO + SV 400   |
| Hộp xóa lớp                            | Lớp đã có trẻ                                                                        | Lớp đã có trẻ, không xóa được                                                                                  | SV 409         |
| Hộp sao chép lớp                       | Năm nguồn khác năm đích                                                              | Chọn năm học khác với năm đang cấu hình để sao chép                                                            | SV 400         |

### Giờ chốt điểm danh (`/school/cutoff`)

| Ô               | Quy tắc                    | Câu báo lỗi                                               | Nguồn BE               |
| --------------- | -------------------------- | --------------------------------------------------------- | ---------------------- |
| Giờ chốt        | Bắt buộc, dạng HH:mm       | Nhập giờ chốt / Nhập giờ hợp lệ dạng HH:mm, ví dụ 08:45   | DTO `@NotNull` `HH:mm` |
| Ngày áp dụng    | Bắt buộc, trong năm học    | Chọn ngày áp dụng / Ngày áp dụng phải nằm trong năm học … | DTO + SV 400           |
| Giờ chốt + ngày | Phải khác bản đang áp dụng | Giờ chốt và ngày áp dụng chưa thay đổi                    | SV 400                 |
| Ghi chú         | Tối đa 500                 | Ghi chú tối đa 500 ký tự                                  | DTO                    |
| Năm học         | Năm đã kết thúc chỉ xem    | Năm học … đã kết thúc, chỉ xem được                       | SV 409                 |

### Phân công giáo viên / tổ trưởng (`/school/teacher-assignments`)

| Ô             | Quy tắc                                                                                                                                                                                                                                                                                                 | Câu báo lỗi                                                                            | Nguồn BE                    |
| ------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------- | --------------------------- |
| Giáo viên lớp | 0–2 giáo viên khác nhau, cùng điểm trường của lớp; 0 = gỡ hết (hỏi xác nhận). Lớp 1 giáo viên lưu được (tag "Thiếu 1 GV"). Kích hoạt năm học bị chặn khi có lớp 0 giáo viên hoặc chưa có chủ nhiệm; lớp thiếu 1 GV (có chủ nhiệm) chỉ cảnh báo vàng                                                     | Mỗi lớp tối đa 2 giáo viên / Chỉ phân công giáo viên thuộc điểm trường của lớp         | DTO `@Size(max=2)` + SV 400 |
| Gỡ giáo viên  | Năm học đang hoạt động không được gỡ hết: phải chọn giáo viên thay thế (cùng điểm trường, chưa dạy lớp khác, tổng ≤ 2) trong cùng hộp. Năm sắp tới được gỡ hết (hỏi xác nhận)                                                                                                                           | Năm học đang hoạt động: chọn giáo viên thay thế / Tích giáo viên cần gỡ khỏi lớp       | FE + SV 400                 |
| Giáo viên lớp | Mỗi giáo viên dạy một lớp trong năm học (giáo viên đang dạy lớp khác bị khóa chọn, ghi "Đang dạy …"); tài khoản bị khóa không chọn được                                                                                                                                                                 | Giáo viên … đang dạy lớp …; gỡ ở lớp đó trước / Tài khoản giáo viên đã bị khóa         | SV 409 / 400                |
| Chủ nhiệm     | Hộp Phân công / Đổi / Phân công thêm: có giáo viên thì phải tích chủ nhiệm (chọn trong giáo viên đang có và người mới). Hộp Gỡ: không thêm ai mà gỡ chủ nhiệm, lớp còn 1 cô ⇒ cô đó tự làm chủ nhiệm; có thêm người thay thế ⇒ phải tích chủ nhiệm. Kích hoạt năm học bị chặn khi lớp chưa có chủ nhiệm | Chọn giáo viên chủ nhiệm / Giáo viên chủ nhiệm phải là một trong các giáo viên của lớp | FE + SV 400                 |
| Tổ trưởng     | Là giáo viên đang làm việc, tài khoản không bị khóa (bỏ trống = gỡ tổ trưởng)                                                                                                                                                                                                                           | Tổ trưởng phải là giáo viên đang làm việc / Tài khoản giáo viên đã bị khóa             | SV 400                      |

### Xếp lớp năm mới (`/school/placements`)

| Ô               | Quy tắc                                                              | Câu báo lỗi                                                                                    | Nguồn BE |
| --------------- | -------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------- | -------- |
| Lớp mới của trẻ | Lên lớp / ở lại phải chọn lớp của năm mới                            | Chọn lớp năm học mới                                                                           | SV 400   |
| Lựa chọn        | Nhóm tuổi lớn nhất chỉ Ra trường hoặc Ở lại; lớp đích đúng nhóm tuổi | Trẻ nhóm tuổi lớn nhất chỉ chọn Ra trường hoặc Ở lại / … không đúng nhóm tuổi cho lựa chọn này | SV 400   |
| Sĩ số           | Không vượt sĩ số tối đa lớp mới                                      | Vượt sĩ số tối đa: …                                                                           | SV 409   |
| Năm học         | Chỉ năm kế tiếp (năm chưa bắt đầu sớm nhất), có năm đang hoạt động để chuyển trẻ; màn hình hiện cố định năm kế tiếp | Chỉ xếp lớp cho năm học kế tiếp … / Không có năm học đang hoạt động để chuyển trẻ | SV 409   |

### Tài khoản nhân sự (`/school/staff`, hộp Thêm/Sửa tài khoản, Sửa hồ sơ) — chưa có BE, kiểm ở FE/mock

| Ô             | Quy tắc                                                                                                      | Câu báo lỗi                                                                                             | Nguồn         |
| ------------- | ------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------- | ------------- |
| Họ tên        | Bắt buộc, 2–100 ký tự, chỉ chữ cái (gồm tiếng Việt có dấu) và dấu cách                                       | Nhập họ tên / Họ tên chỉ gồm chữ cái và dấu cách / Họ tên tối thiểu 2 ký tự / Họ tên tối đa 100 ký tự   | FE (PROPOSED) |
| Email         | Bắt buộc, đúng định dạng, tên miền cấp cao ≥ 2 chữ cái, tối đa 255, không trùng (không phân biệt hoa thường) | Nhập email / Email không đúng định dạng (VD: ten@truong.edu.vn) / Email đã được dùng cho tài khoản khác | FE (PROPOSED) |
| Số điện thoại | Như số điện thoại điểm trường; lưu dạng 0xxxxxxxxx                                                           | Số điện thoại không đúng định dạng Việt Nam (VD: 0912345678)                                            | FE (PROPOSED) |
| Vai trò       | Bắt buộc                                                                                                     | Chọn vai trò                                                                                            | FE            |
| Điểm trường   | Bắt buộc với Giáo viên, Nhân viên bếp; Phó hiệu trưởng phân công điểm trường ở màn Phân công PHT             | Chọn điểm trường                                                                                        | FE            |

### Phòng — người phụ trách

- Phòng bếp: chỉ chọn nhân viên bếp của điểm trường. Khi nối BE thật chỉ chọn được người có id của BE (chưa có API `/users`), nên hiện chưa chọn được người phụ trách bếp; để trống vẫn lưu được.

## Còn mở

- **Mã lỗi BE (PROPOSED):** BE chỉ trả `desc` tiếng Anh cho lỗi nghiệp vụ, không có field. FE đang dịch theo nội dung `desc` (`beErrorMessages.js`), dễ vỡ khi BE đổi câu. Đề xuất BE trả `data = [{field, message}]` (tiếng Việt) hoặc mã lỗi cho lỗi 400/409 — cần nhóm thống nhất contract.
- Ngoài phạm vi: Phân công PHT, Vai trò & quyền, Tài khoản nhân sự (chưa có BE).
