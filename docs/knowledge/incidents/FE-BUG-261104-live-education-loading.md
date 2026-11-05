---
id: FE-BUG-261104-live-education-loading
type: bug
screens: [education-plan]
be_modules: [education-plan]
rules: []
status: open
date: 2026-11-04
keywords: [live demo, education, loading, spinner]
similar_to: []
---

# FE-BUG-261104-live-education-loading — Màn kế hoạch giáo dục kẹt tải trên bản demo

## Symptom

Trên `https://web.carenest.edu.vn/`, nhiều route nhóm Kế hoạch giáo dục chỉ hiện `Đang tải dữ liệu...`; không có tiêu đề hoặc nội dung để thao tác. Quan sát với tài khoản demo Hiệu trưởng, Phó hiệu trưởng Cơ sở A và Giáo viên ngày 04/11/2026. Console do trình duyệt cung cấp không hiện lỗi; chưa có network trace.

## Điều kiện tái hiện

Đăng nhập tài khoản demo, vào menu Kế hoạch giáo dục hoặc mở trực tiếp `/education/school` (Hiệu trưởng), `/education/goals` (Phó hiệu trưởng/Giáo viên), `/education/branches`, `/education/class`, `/education/plan-reviews`, `/education/settings`, `/education/curriculum-sources` (theo menu từng vai trò). Chờ màn hoàn tất tải. Phạm vi và dữ liệu demo cụ thể cần kiểm tra lại.

## Attempts — đã thử

| #   | Cách thử                                                        | Kết quả                                                                                                                                                       | Bài học                                                                                                        |
| --- | --------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| 1   | Mở từng route bằng URL sau đăng nhập Hiệu trưởng                | `/education/school`, `/education/settings`, `/education/curriculum-sources` lặp lại trạng thái tải                                                            | Không thể đánh giá bố cục nội dung từ bản chạy này                                                             |
| 2   | Đăng nhập Phó hiệu trưởng, mở các route giáo dục trong menu     | `/education/goals`, `/education/plan-reviews`, `/education/settings`, `/education/curriculum-sources` không lên nội dung                                      | Không chỉ một vai trò                                                                                          |
| 3   | Đăng nhập Giáo viên, mở trực tiếp và thử lại các route giáo dục | `/education/goals`, `/education/branches`, `/education/class`, `/education/plan-reviews`, `/education/curriculum-sources` tiếp tục hiện `Đang tải dữ liệu...` | Cần kiểm tra request và timeout ở môi trường triển khai                                                        |
| 4   | Sau đợt kiểm tra, tải lại trang chủ trong phiên Giáo viên       | Cổng Oneshield trả HTTP 504, thông báo `Máy chủ web không phản hồi kịp thời`                                                                                  | Có dấu hiệu sự cố máy chủ/cổng trên bản demo; chưa chứng minh đây là nguyên nhân duy nhất của spinner giáo dục |

## Root cause

Chưa rõ. Cần network trace, trạng thái API và kiểm tra request khởi tạo trang. Có HTTP 504 sau lần kiểm tra, nhưng chưa xác định request nào của nhóm giáo dục bị ảnh hưởng.

## Fix

Chưa sửa. Sau khi xác định nguyên nhân, cần trạng thái lỗi/timeout và nút thử lại để người dùng không chờ vô hạn.

## Regression test

Chưa chạy. Cần kiểm tra điều hướng và dữ liệu thật cho ba vai trò trên bản triển khai sau khi sửa.

## Ảnh hưởng

Người dùng không thể thực hiện các luồng Kế hoạch giáo dục trên những route nêu trên trong lần kiểm tra này. Chưa xác định ảnh hưởng APP hoặc contract BE.

## Lesson

Ảnh chụp trạng thái tải không chứng minh màn nội dung đã hoạt động; báo cáo UI phải tách hai trạng thái này.
