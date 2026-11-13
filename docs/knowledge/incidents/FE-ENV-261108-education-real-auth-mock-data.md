---
id: FE-ENV-261108-education-real-auth-mock-data
type: env
screens: [education-goals, education-class-plans]
be_modules: [education-plan]
rules: [EDU-06]
status: fixed
date: 2026-11-08
keywords: [gateway, VITE_USE_MOCK, giáo viên, kế hoạch đã ban hành, empty]
similar_to: [FE-BUG-261108-goal-list-rows-compatibility]
---

# Giáo viên đăng nhập BE nhưng kế hoạch giáo dục vẫn dùng dữ liệu demo

## Symptom

Giáo viên/Tổ trưởng mở Kế hoạch năm học nhưng thấy Chưa có kế hoạch năm học, trong khi PHT đã ban hành kế hoạch.

## Root cause

Local bật VITE_AUTH_MODE=gateway và VITE_SCHOOL_CONFIG_API=true nhưng chưa đặt VITE_USE_MOCK. USE_MOCK mặc định true. educationPlanService chọn mock dựa trên USE_MOCK, nên đọc kế hoạch/lớp/nhóm tuổi từ localStorage nhưng nhận thông tin nhân sự và năm học từ BE. GoalListPage lọc theo phạm vi mock với ID BE khác ID mẫu, có thể loại hết danh sách. VITE_SCHOOL_CONFIG_API không quyết định nguồn dữ liệu kế hoạch giáo dục.

## Attempts

| Cách thử | Kết quả |
| --- | --- |
| Đọc cấu hình local và educationPlanService | Xác nhận USE_MOCK mặc định true, đăng nhập gateway |
| Query tổng hợp metadata kế hoạch DB local | Có bốn bản APPROVED ở bốn nhóm tuổi của năm học id 1 |
| Đặt VITE_USE_MOCK=false trong .env.local | Vite phục vụ env mới với VITE_USE_MOCK=false |
| Test mapper/API kế hoạch và nhãn danh sách | 16 test đạt |
| Chrome dùng API giả cho Giáo viên/Tổ trưởng | Hiện kế hoạch đã ban hành, chọn mục tiêu cho chủ đề lớp và thấy MT1 trong gợi ý hoạt động giáo án tuần; không pageerror/API ghi |
| Full verify FE sau đổi môi trường local | VERIFY PASS full |

## Fix

Đã chuyển cấu hình local sang VITE_USE_MOCK=false để các module đã tích hợp đọc API thật. File .env.local không được commit. Các module được khai báo demo tiếp tục theo INTEGRATION_MODULES khi dùng sourceOf. Không đổi mặc định build hoặc sửa dữ liệu kế hoạch trong DB.

## Regression test

`tests/education-plan/year-plan-api.test.mjs` và `goal-list-status.test.mjs` đạt 16 test. Cần kiểm lại phiên giáo viên thực tế sau tải lại trang để xác nhận phân công/nhóm tuổi BE có hiệu lực.

## Lesson

Đăng nhập thật và nguồn dữ liệu nghiệp vụ là hai cấu hình riêng. Khi thử luồng nhiều vai trò qua BE, kiểm cả VITE_AUTH_MODE và VITE_USE_MOCK.
