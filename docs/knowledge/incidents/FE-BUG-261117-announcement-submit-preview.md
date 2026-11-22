---
id: FE-BUG-261117-announcement-submit-preview
type: bug
screens: [announcement-compose, announcement-edit]
be_modules: [announcement]
rules: [PAR-05, PAR-07, PAR-08]
status: fixed
date: 2026-11-17
keywords: [thông báo, nút gửi bị khóa, preview, header]
---

# Nút gửi thông báo bị khóa khi chưa xem trước thủ công

## Symptom và tái hiện
HT/PHT soạn nội dung và chọn người nhận nhưng nút Gửi vẫn bị khóa. User xác nhận trực tiếp triệu chứng này ngày 17/11/2026. Form còn lặp cả Quay lại/Gửi ở đầu và cuối.

## Root cause
`AnnouncementForm.jsx` dùng `disabled={!preview?.total || previewBusy}`. State preview khởi tạo null và chỉ được nạp qua nút Xem trước; nhập đầy đủ form không kích hoạt preview. Đây là chặn ở FE, chưa gọi API tạo thông báo.

## Attempts
| Cách kiểm | Kết quả |
| --- | --- |
| Lần theo form → coordinator → service/API multipart và mock catalog | Xác định điều kiện disabled; catalog mock đã map ID số, không phải lỗi ép ID. |
| Tự kiểm tra preview khi submit, giữ bước xác nhận | Test nghiệp vụ helper và API/mock đạt. |
| Render form bằng Vite SSR để kiểm nút thật | Fixture thiếu window; thêm EventTarget. Load trực tiếp package router qua ssrLoadModule gặp CJS module; đổi sang import package chuẩn. Sau đó test đạt, còn cảnh báo useLayoutEffect do SSR không chạy layout. |

## Fix
Một ResponsiveToolbar dùng chung, hai nút outline-primary sm, không lặp cuối form. Submit gọi `prepareAnnouncementSubmission` để kiểm input và lấy preview mới, rồi mới mở xác nhận. Nhóm trống/lỗi API không mở xác nhận. Nút khóa trong lúc kiểm tra/gửi; có ref chống submit đồng thời. ConfirmationModal nằm ngoài form. Không đổi BE, API payload, phân quyền hoặc cách server chốt người nhận.

## Regression test và bằng chứng
- `tests/notifications/announcement-model.test.mjs`: render form chỉ một header/cặp nút, nút Gửi bật khi chưa preview và khóa khi busy; tự preview, vai trò trống, nhóm trống, lỗi API, kết quả cũ, giờ Việt Nam, tệp sai.
- `node --import ./scripts/register-auth-test-loader.mjs --test tests/notifications/*.test.mjs`: 21/21 đạt trước khi thêm test render.
- Sau khi thêm test render, chạy lại đúng file model: 8/8 đạt; 14 test độc lập trong lần chạy trên không thay đổi.
- ESLint hai file logic thay đổi đạt; `npm run build` đạt (cảnh báo eval/annotation ở module khác).
- Chưa kiểm trực quan hoặc gửi qua BE thật; không chạy e2e vì user chưa yêu cầu.

## Ảnh hưởng và bài học
Tạo mới, hẹn gửi và sửa thông báo đều dùng chung form; API create/update, coordinator và mock resolver đã được đối chiếu. Không sửa ResponsiveToolbar hoặc nút/modal nền nên các màn giáo dục và module khác không đổi.
Không khóa nút chính bằng kết quả của một thao tác phụ mà người dùng chưa thực hiện; thao tác chính cần kiểm tra và phản hồi rõ trước bước xác nhận.
