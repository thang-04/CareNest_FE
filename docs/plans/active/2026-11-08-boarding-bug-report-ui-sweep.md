---
title: Bán trú — sửa báo cáo lỗi 08/11 và rà lỗi UI cơ bản
status: in-progress
owner: thangnd
jira: G94-272 / FE-FIX-01
branch: fix/G94-272-FE-FIX-01-e2e-flow-fixes
modules: [menu-planning, kitchen, layouts]
rules: []
risk: medium
created: 2026-11-08
updated: 2026-11-08
---

# Bán trú — sửa báo cáo lỗi 08/11 và rà lỗi UI cơ bản

- Làn L (>8 file, 2 nhóm màn). Nguồn: `Report_bug_bantru.docx` của user (9 nhóm lỗi, ảnh chụp trên `dev.carenest.edu.vn`) và yêu cầu rà hết lỗi cơ bản: lệch, không căn lề, vỡ layout, sát nhau, thông báo quá dài, filter sai, chỗ có chỗ không badge màu, chỗ bảng chỗ không.
- Chế độ tự chạy: phương án do agent chọn, ghi ở "Quyết định" để user soát.
- Không sửa BE. Các việc cần BE (loại mẫu ngày/tuần/tháng/kỳ, xóa mẫu, nhãn "Hay dùng") chờ user chốt.

## Nguyên nhân tìm được

| # | Màn | Nguyên nhân |
| --- | --- | --- |
| 1 | Toast điền mẫu | `WeeklyPlanPage` đưa cả tên mẫu và hướng dẫn vào một câu |
| 2 | Lọc loại món | `.search-select__panel` z-index 300 thấp hơn modal 1000 ⇒ danh sách xổ nằm sau modal |
| 3 | Ô điểm trường lệch | `origin/dev` (`0d363e7`) xóa nhãn trong `CampusFilter` ⇒ ô không nhãn, lệch ô bên cạnh |
| 4 | Nút tạo mẫu sát mép | `.td-tpl-toolbar` là `.card` nhưng không có padding |
| 5 | Dòng món dính nhau | `gap` đặt ở `.td-pick__list` chỉ tách nhóm, dòng trong `<section>` không có khoảng cách |
| 6 | Vỡ form dự trù | `.kb-forecast-form` `align-items: end` ⇒ ô có lỗi đẩy ô khác; câu lỗi 6041 của BE dài, hiện hai lần |
| 7 | Badge lệch | LOW/HIGH tô ngược nhau giữa bảng (`td-daynut`, `td-eval`) và badge (`MenuStatistics`, `MenuBadges`); OK không có màu |

## Quyết định (user soát)

- D1 Chọn tuần: `WeekPicker` mở danh sách tuần của năm học (nhóm theo tháng), giữ nút tuần trước/sau. Chỉ đổi sang tuần ở màn cần theo tuần; màn gọi API theo ngày giữ chọn ngày.
- D2 Dự trù: chọn kỳ bằng Tuần này / Tuần sau / Chọn tuần / Tùy chọn ngày; giữ tùy chọn ngày vì BE cho kỳ bất kỳ đến 31 ngày; đổi kỳ tự tính xem trước.
- D3 Modal thêm món: chỉ kcal và nhãn dị ứng (user chốt 08/11).
- D4 Thống kê: khối Món ăn thành bảng, số từng món đọc từ danh mục món (`nutritionByAgeGroup`), không tính ở UI.
- D5 Màu trạng thái định mức: một bảng chung, Thiếu đỏ, Vượt cam, Đạt xanh.
- D6 Thẻ mẫu: menu ba chấm Xem, Chỉnh sửa, Nhân bản, Ngừng dùng/Dùng lại. Nhân bản mở modal xem trước, đặt tên rồi bấm Lưu bản sao mới tạo (user chốt 08/11), làm ở FE bằng đọc mẫu rồi tạo mới; chưa có Xóa vì BE chưa có API.
- D10 Chọn loại mẫu: nút Tạo mẫu mở hộp chọn Mẫu ngày, tuần, tháng rồi vào trang tạo đúng loại. BE chưa lưu loại nên FE suy từ các ngày có món; mẫu ngày điền được vào mọi thứ. Đổi tên màn thành "Mẫu thực đơn".
- D7 Nhánh đang chậm 17 commit so với `origin/dev`, tua nhanh (`--ff-only`, không tạo commit) để sửa đúng bản user test.

- D11 User chốt 08/11: bỏ loại mẫu "theo kỳ". Loại mẫu chỉ có ngày, tuần, tháng; BE giữ giới hạn 4 tuần.

## Progress log

### 2026-11-08 — khảo sát xong, bắt đầu làm

- Đọc báo cáo, đối chiếu FE và BE.

### 2026-11-08 — sửa xong báo cáo lỗi, rà 20 màn bằng tài khoản HT và PHT

- User cấp tài khoản local nên đã rà trên BE thật (`carenest-fe-mainstack`, cổng 5181, dữ liệu seed). Không ghi mật khẩu vào repo.
- Rà thêm: nút "Tuần này" và mặc định của Thực đơn tuần vào cuối tuần mở tuần đã qua, nay theo `schoolWeekStart` như các màn khác. Sửa `resolveWeekStart` và test tương ứng.
- Chuyển hàm tuần sang `src/utils/week.js` vì `components/kitchen` không được import model của menu-planning.
- Ô chọn `SearchSelect` cao 40px, ô thường 36px làm thanh lọc lệch; đưa về `--input-height`.

### 2026-11-08 — thống nhất căn cột, làm lại Lịch sử nhập/trừ

- D8 User chê ba kiểu căn trong một bảng. Quy tắc mới: chữ, mã, ngày, trạng thái, đơn vị căn trái; mọi con số căn phải; chỉ ô tích, icon, ảnh căn giữa. Thay quyết định 20/10/2026 (số căn giữa). Áp ở `components.css` nên có hiệu lực toàn app; cột "Trạng thái" đổi ở 19 file.
- D8b User chốt lại 08/11 (cách lai): chữ dài căn trái, mọi giá trị ngắn (số, tiền, ngày, trạng thái, mã, đơn vị, số điện thoại) căn giữa; không còn căn phải. Thay D8.
- D9 Lịch sử nhập/trừ: gom theo ngày, dải ngày bấm mở/đóng (mặc định mở ngày đầu, đang lọc thì mở hết); ẩn cột Lý do, Người thực hiện khi cả trang trống; số lượng theo g, kg, ml, lít thay vì "0,502 chai 500 ml"; badge "Trừ theo suất" đổi xanh ngọc, bỏ chấm nhấp nháy dành cho việc đang chạy.

### 2026-11-08 — kiểm chứng, chờ user soát

- Kết quả ở `docs/quality/VERIFICATION.md` mục G94-272. Chưa làm, cần BE: lưu loại mẫu, Xóa mẫu, nhãn "Hay dùng".

### 2026-11-08 — rà tự động mọi màn, ưu tiên bán trú và phân quyền

- Script Playwright đăng nhập 4 tài khoản (HT, PHT, 2 GV), đi mọi mục sidebar, từng tab, trang chi tiết đầu tiên; đo tràn trang/bảng, dính mép card, lệch và lệch chiều cao ô lọc, thiếu viền, căn cột số/chữ, tiêu đề lệch ô, chữ bị cắt, lộ mã, chữ "undefined", màn lỗi, lỗi JS. Thêm lượt 375px.
- Sửa: thanh lọc mở lại đánh giá lệch (do trả nhãn `CampusFilter`), bảng kiểm dinh dưỡng tràn và lệch cột, STT căn giữa, nút cao 32 cạnh ô 36, bảng tràn ở Đợt khám, Xếp loại nhóm lớp, Tổng hợp điểm danh, form món; nhìn ảnh thêm: cảnh báo Chất lượng tháng dài cả trang, ô hạn dùng phiếu nhập bị cắt, mã điểm trường xuống dòng, cột tên quá hẹp; Phiếu bé ngoan của giáo viên hiện mã điểm trường "1" thay tên (lớp API gán mã khi thiếu danh mục).
- Lượt cuối 1440px: 0 lỗi ở HT (66 route), PHT (64), GV (35). Màn Phân công Phó hiệu trưởng báo "Hệ thống tài khoản đang gián đoạn" (BE 503 mã 1111 từ dịch vụ tài khoản local), không phải lỗi giao diện.
- Ảnh trước/sau 18 cảnh: `ui-review/boarding-ui-fix-2026-11-08/index.html`. Theo user, dừng sau khi xong bán trú.

