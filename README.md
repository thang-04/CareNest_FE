# CareNest – Web

Frontend ReactJS + Vite cho hệ thống quản lý trường mầm non CareNest.
Web phục vụ 5 vai trò theo SRS 4.4: Hiệu trưởng, Phó hiệu trưởng, Tổ trưởng nhóm tuổi, Giáo viên, Nhân viên bếp
(phụ huynh dùng app mobile, không có màn hình web). Menu và route được chặn theo ma trận quyền.

Module: tài khoản, cấu hình trường, quản lý trẻ & sức khỏe, điểm danh & suất ăn, đón trẻ, kế hoạch giáo dục,
đánh giá trẻ & khen thưởng, thực đơn & dinh dưỡng, bếp & kho, cơ sở vật chất (sự cố, đề nghị, đề xuất,
luân chuyển, kiểm kê), dashboard theo vai trò và danh sách chờ duyệt.

Thư mục `docs/`, `.ai/`, `.claude/` và file `AGENTS.md` là tài liệu, quy tắc làm việc của repo.

> 📘 **Trước khi code: đọc [DESIGN.md](./DESIGN.md)** (màu sắc, component, bố cục, quy trình thêm module, quy tắc nghiệp vụ chung)
> và mở trang **`/ui-kit`** trong app để xem component chạy thật.
> Ảnh thiết kế gốc: thư mục [`mockups/`](./mockups/README.md).

## Chạy

```bash
npm install
npm run dev      # http://localhost:5173
npm run check    # lint + format + build – chạy trước khi push
```

`.env` (copy từ `.env.example`): `VITE_API_BASE_URL`, `VITE_USE_MOCK=true` (dữ liệu giả lưu localStorage).

## Đăng nhập (chế độ mock)

Mở app → tự chuyển `/login`. Mật khẩu chung: **`123456`** (bấm tài khoản trong danh sách demo dưới form để điền nhanh).

| Email                      | Họ tên         | Vai trò                                       | Dữ liệu mẫu                                                                                                                               |
| -------------------------- | -------------- | --------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| hung.pham@carenest.edu.vn  | Phạm Văn Hùng  | Hiệu trưởng                                   | Cấu hình năm học, điểm trường, phân công PHT, vai trò; duyệt khen thưởng; xem toàn trường                                                 |
| lan.nguyen@carenest.edu.vn | Nguyễn Thị Lan | Phó hiệu trưởng                               | Tiếp nhận/xếp lớp trẻ, thực đơn, bếp & kho, CSVC; tạo/duyệt luân chuyển, đợt kiểm kê; mục tiêu năm học, phê duyệt kế hoạch chủ đề/giáo án |
| duc.trinh@carenest.edu.vn  | Trịnh Văn Đức  | Phó hiệu trưởng – Campus 2                    | Luân chuyển của Campus 2 (LC004), chỉ thao tác phiếu gửi từ Campus 2                                                                      |
| ha.tran@carenest.edu.vn    | Trần Thu Hà    | Tổ trưởng nhóm tuổi Mẫu giáo nhỡ (lớp Chồi 2) | Kế hoạch chủ đề, duyệt giáo án, giáo án lớp mình                                                                                          |
| minhanh.le@carenest.edu.vn | Lê Minh Anh    | Giáo viên – Lớp Chồi 1                        | Kế hoạch tuần, giáo án ngày                                                                                                               |
| an.nguyen@carenest.edu.vn  | Nguyễn Văn An  | Giáo viên – Lớp Mầm 1                         | Bàn giao LC006, LC003                                                                                                                     |
| mai.tran@carenest.edu.vn   | Trần Thị Mai   | Giáo viên – Lớp Chồi 2                        | Nhận LC006                                                                                                                                |
| binh.do@carenest.edu.vn    | Đỗ Văn Bình    | Nhân viên bếp – Campus 1                      | Nhận LC002, LC004                                                                                                                         |
| cuong.bui@carenest.edu.vn  | Bùi Văn Cường  | Nhân viên bếp – Campus 2                      | Bàn giao LC004                                                                                                                            |
| yen.dang@carenest.edu.vn   | Đặng Hải Yến   | Nhân viên bếp – Văn phòng/Kho                 | Bàn giao LC002, kiểm kê KK002-01                                                                                                          |
| huong.pham@carenest.edu.vn | Phạm Thu Hương | Giáo viên – Phòng Âm nhạc                     | Kiểm kê KK002-03                                                                                                                          |
| thu.ngo@carenest.edu.vn    | Ngô Minh Thư   | Nhân viên bếp – Phòng Y tế                    | Kiểm kê KK002-02                                                                                                                          |

Đổi vai trò: menu tài khoản → _Đăng xuất_ → đăng nhập tài khoản khác. _Khôi phục dữ liệu demo_ cũng nằm trong menu tài khoản.

## Routes chính

Mỗi module có nhóm route riêng; vai trò được phép xem ở `src/routes/AppRoutes.jsx`, menu ở `src/layouts/menuConfig.js`.

| Route                                                                                                             | Màn hình                                                                                 |
| ----------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| `/` , `/approvals`                                                                                                | Dashboard theo vai trò, danh sách chờ duyệt                                              |
| `/account/*`, `/forgot-password`, `/verify-otp`, `/reset-password`                                                | Hồ sơ, đổi mật khẩu, quên mật khẩu                                                       |
| `/school/*`                                                                                                       | Năm học, nhóm tuổi & lớp, giờ chốt, điểm trường, phân công PHT/giáo viên, vai trò        |
| `/children/*`                                                                                                     | Danh sách trẻ, tiếp nhận, import, xếp lớp, tài khoản phụ huynh, sức khỏe                 |
| `/attendance/*`, `/pickup/*`                                                                                      | Điểm danh, báo ăn, tổng hợp, sĩ số suất ăn, bàn giao suất ăn, đón trẻ                    |
| `/assessment/*`                                                                                                   | Đánh giá hằng ngày, tuần/tháng, cuối năm, phiếu bé ngoan, đề xuất khen thưởng            |
| `/menu/*`                                                                                                         | Thực phẩm, món ăn, giá suất ăn, thực đơn, thực đơn dị ứng, thực đơn tuần, AI, dinh dưỡng |
| `/kitchen/*`                                                                                                      | Nhập/xuất kho, chế biến, thực đơn đã công bố, định lượng, báo thiếu thực phẩm            |
| `/facility/assets`, `/facility/issues`, `/facility/requests`, `/facility/proposals`, `/facility/my-reports`       | Tài sản, sự cố, đề nghị bổ sung, đề xuất mua sắm/sửa chữa                                |
| `/facility/transfers`                                                                                             | Danh sách phiếu luân chuyển (PHT) / Phiếu của tôi (giáo viên, nhân viên)                 |
| `/facility/transfers/new`, `/:id`, `/:id/edit`, `/:id/handover`, `/:id/receive`, `/:id/discrepancy`, `/:id/print` | Tạo, chi tiết, điều chỉnh, bàn giao, nhận, xử lý chênh lệch, in                          |
| `/facility/inspections`                                                                                           | Đợt kiểm kê (PHT) / Phiếu kiểm kê của tôi                                                |
| `/facility/inspections/new`, `/:id`, `/:id/sheets/:sheetId`, `/:id/print`                                         | Tạo đợt, chi tiết đợt, kiểm đếm/duyệt phiếu, biên bản                                    |
| `/education/goals` (`/new`, `/:id`, `/:id/edit`)                                                                  | Mục tiêu năm học (PHT tạo, tổ trưởng xem)                                                |
| `/education/themes` (`/new`, `/:id`, `/:id/edit`)                                                                 | Kế hoạch chủ đề (tổ trưởng)                                                              |
| `/education/overview`                                                                                             | Mục tiêu & chủ đề đã duyệt (giáo viên, tổ trưởng)                                        |
| `/education/lessons` (`/new`, `/:id`, `/:id/edit`)                                                                | Giáo án của lớp: kế hoạch tuần / giáo án ngày                                            |
| `/education/reviews`, `/:id`                                                                                      | Tổ trưởng duyệt giáo án                                                                  |
| `/education/approvals`, `/:kind/:id`                                                                              | PHT phê duyệt kế hoạch chủ đề và giáo án                                                 |
| `/login`                                                                                                          | Đăng nhập                                                                                |
| `/ui-kit`                                                                                                         | Thư viện giao diện (chỉ khi `npm run dev`)                                               |

## Nối Spring Boot

`VITE_USE_MOCK=false`. Endpoint đề xuất trong `src/services/<module>/api/*.js` và `src/services/*Service.js`.
Luật nghiệp vụ backend cần làm theo nằm ở `src/services/<module>/mock/*MockRepository.js`. Chi tiết: DESIGN.md §16.
