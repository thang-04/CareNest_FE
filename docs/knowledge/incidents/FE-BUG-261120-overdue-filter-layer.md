---
id: FE-BUG-261120-overdue-filter-layer
type: bug
screens: [education-overdue]
be_modules: [education-plan]
rules: [EDU-92, EDU-97]
status: fixed
date: 2026-11-20
keywords: [Lọc thêm, Kế hoạch quá hạn, z-index, backdrop-filter]
similar_to: [FE-BUG-261108-dropdown-behind-modal]
---

# Lọc thêm bị card bảng che

Trên màn Kế hoạch quá hạn, bấm **Lọc thêm** mở khung chọn trong DOM nhưng card bảng che nó. Nền mờ của từng card tạo lớp hiển thị riêng, nên chỉ tăng z-index trên khung con không đưa nó vượt lên trên card bảng.

Khi Lọc thêm mở, đặt card bộ lọc của trang lên lớp dropdown. Kiểm tra bằng Chromium trên cấu trúc hai card với CSS thật: trước sửa, điểm giữa ô chọn thuộc card bảng; sau sửa, ô chọn nhận được click. Build và lint đạt.
