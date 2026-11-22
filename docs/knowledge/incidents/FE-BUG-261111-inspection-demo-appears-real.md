---
id: FE-BUG-261111-inspection-demo-appears-real
type: bug
screens: [kitchen-inspections]
be_modules: [nutrition]
rules: [P-27]
status: open
date: 2026-11-11
keywords: [kiểm thực ba bước, dữ liệu demo, biểu mẫu, 11 dòng]
similar_to: [FE-CASE-261104-nutrition-demo-route]
---

# FE-BUG-261111-inspection-demo-appears-real — Biểu mẫu mẫu trông như dữ liệu thật

## Symptom

Trên `dev.carenest.edu.vn/kitchen/inspections`, tài khoản PHT thấy các thẻ M1–M3 với số dòng và nút “Mở biểu mẫu”, nhưng không thấy nhãn dữ liệu demo. Tester có thể hiểu nhầm là bản ghi từ hệ thống.

## Điều kiện tái hiện

Đăng nhập PHT trên dev, mở An toàn thực phẩm → Kiểm thực ba bước, ngày học 11/11/2026.

## Attempts — đã thử

| # | Cách thử | Kết quả | Bài học |
| --- | --- | --- | --- |
| 1 | Đối chiếu màn dev với `src/config/integrationModules.js` và BE | `kitchen-inspection` vẫn là `demo`; BE chưa có API ghi kiểm thực, P-27 còn mở | Không dùng biểu mẫu mẫu để nghiệm thu |
| 2 | Đối chiếu `DemoDataBanner.jsx` với màn dev | Mã nguồn cục bộ có logic hiện nhãn, bản dev không hiện | Chưa xác định bản deploy tương ứng; cần kiểm lại sau triển khai |

## Root cause

Luồng kiểm thực chưa có BE API (`src/config/integrationModules.js`), nhưng route nối BE vẫn hiển thị trang dùng dữ liệu mẫu (`src/routes/AppRoutes.jsx`). Nguyên nhân riêng của việc bản dev không hiện nhãn demo chưa xác định.

## Fix

Mã nguồn cục bộ thay route nối BE bằng trang trạng thái “Chưa có dữ liệu hệ thống” và dẫn tới Kiểm nhận hàng tươi, Lưu mẫu thực phẩm. Bản build mock giữ biểu mẫu cũ. Chưa triển khai dev.

## Regression test

`node scripts/verify.mjs` đạt sau sửa. Chưa kiểm lại route trên dev sau triển khai.

## Ảnh hưởng

PHT/HT có thể dùng nhầm dữ liệu mẫu. Luồng kiểm thực thật cần chốt P-27 và BE API riêng trước khi mở lại biểu mẫu.

## Lesson

Màn dùng dữ liệu trình duyệt không được hiển thị như một bước vận hành trên môi trường nối BE.
