---
id: FE-CASE-261104-nutrition-demo-route
type: edge-case
screens: [weekly-menu, nutrition-balance]
be_modules: [nutrition]
rules: []
status: open
date: 2026-11-04
keywords: [cân đối khẩu phần, dữ liệu demo, menu tuần, hai nguồn]
similar_to: []
---

# FE-CASE-261104-nutrition-demo-route — Màn cân đối mẫu nằm cạnh kế hoạch tuần thật

## Symptom

Trong cùng menu Thực đơn & dinh dưỡng của Phó hiệu trưởng trên `web.carenest.edu.vn`, `/menu/weekly` là màn Kế hoạch tuần mới, còn `/menu/nutrition` hiển thị banner `Dữ liệu demo — chức năng này chưa nối hệ thống CareNest`, số liệu mẫu ở trình duyệt và các bảng tính riêng. Người xem có thể tưởng hai màn đang dùng cùng kế hoạch tuần. `BE:docs/business/flows/meal-management-permissions.md` mục Menu Web mô tả cân đối dinh dưỡng là tab trong kế hoạch tuần.

## Điều kiện tái hiện

Đăng nhập Phó hiệu trưởng demo, mở Kế hoạch tuần & công bố rồi Cân đối khẩu phần trong cùng nhóm menu.

## Attempts — đã thử

| #   | Cách thử                                     | Kết quả                                                                                            | Bài học                                                          |
| --- | -------------------------------------------- | -------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------- |
| 1   | Mở hai route trên cùng phiên Phó hiệu trưởng | Route cân đối có banner demo và mã thực đơn mẫu riêng; route kế hoạch tuần có trạng thái `Chỉ xem` | Cần tách rõ dữ liệu mẫu khỏi luồng thật trong tài liệu hướng dẫn |

## Root cause

Chưa đối chiếu mã; có thể là route demo cũ còn trong menu. Chưa kết luận lệch contract.

## Fix

Chưa sửa. Khi thiết kế lại luồng, quyết định điểm vào duy nhất cho cân đối theo contract BE; trong lúc đó cần nhãn rõ `Demo` ở menu và không dẫn người dùng từ kế hoạch tuần thật sang dữ liệu mẫu như một bước nghiệp vụ.

## Regression test

Chưa chạy. Cần kiểm tra menu theo quyền, đường đi từ kế hoạch tuần và nguồn dữ liệu của từng màn.

## Ảnh hưởng

Hướng dẫn bán trú dễ nhầm giữa dữ liệu thử và kết quả BE. Không sửa BE khi chưa có yêu cầu.

## Lesson

Một nhóm menu có màn từ nhiều nguồn dữ liệu phải nói rõ ranh giới ngay tại điểm điều hướng.
