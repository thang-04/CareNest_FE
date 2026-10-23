---
id: FE-BUG-261023-health-follow-up-verification
type: bug
screens: [health-exam, health-follow-up]
be_modules: [health]
rules: []
status: open
date: 2026-10-23
keywords: [follow-up-exam, verify, Phiếu chưa đủ thông tin, FOLLOW_UP_CONTACT_REQUIRED]
similar_to: []
---

# FE-BUG-261023-health-follow-up-verification — 5 test theo dõi không đạt

## Symptom

Trong task xuất sơ đồ `.drawio`, `node scripts/verify.mjs` dừng tại nhóm `tests/health/follow-up-exam.test.mjs`: 12 test, 7 đạt, 5 không đạt. Chưa xác nhận đây là lỗi ứng dụng hay fixture kiểm thử.

```text
Phiếu chưa đủ thông tin. Kiểm tra các ô được đánh dấu.
Expected FOLLOW_UP_CONTACT_REQUIRED; actual undefined
```

## Điều kiện tái hiện

- Working tree có sẵn thay đổi ở health mock, hồ sơ và fixture trước khi xuất sơ đồ.
- Chạy `node scripts/verify.mjs`, hoặc nhóm `npm run test:health` dùng mock và dữ liệu kiểm thử.
- Task sơ đồ không sửa source hay test. Không dùng dữ liệu trẻ thật.

## Attempts — đã thử

| # | Cách thử | Kết quả | Vì sao không đúng / bài học |
| --- | --- | --- | --- |
| 1 | Chạy cổng chuẩn trong sandbox | `spawn EPERM`, chưa chạy được nhóm test | Đây là hạn chế tạo tiến trình con, không phải bằng chứng lỗi ứng dụng |
| 2 | Chạy lại cùng lệnh ngoài sandbox, xem log lỗi | `VERIFY FAIL full`; 5 test không đạt như trên | 4 test bị validation khi lưu kết luận; 1 test khác kỳ vọng chặn công bố nhưng nhận undefined. Chưa đủ bằng chứng xác định nguyên nhân |
| 3 | Chạy lại cổng sau khi ghi tài liệu | Nhóm health 19/19 đạt; toàn bộ 269 test đạt và lint đạt; dừng ở `format:check` của `src/components/children/exam/ExamSummary.jsx` | Lỗi test ban đầu không tái hiện ở lần này; tác vụ sơ đồ không sửa source/test nên chưa khẳng định nguyên nhân hay bản sửa. Không tự format file đang có thay đổi ngoài phạm vi |

## Root cause

Chưa rõ. Stack validation tại `src/services/children/mock/healthExamMockRepository.js:500`. Các test không đạt bắt đầu tại dòng 138, 181, 206, 227 và 314 của `tests/health/follow-up-exam.test.mjs` tại thời điểm ghi nhận. Không suy luận thay đổi contract hay quy định nghiệp vụ từ kết quả này.

## Fix

Chưa sửa; ngoài phạm vi xuất sơ đồ. Cần điều tra riêng dữ liệu đầu vào bắt buộc và điều kiện công bố trước khi sửa code hoặc fixture.

## Regression test

Nhóm `tests/health/follow-up-exam.test.mjs` có 5 ca không đạt ở lần đầu, nhưng nhóm health đạt 19/19 ở lần chạy sau. Chưa xác định nguyên nhân thay đổi kết quả; task sơ đồ không sửa source/test. Kết quả cổng cuối nằm trong `verify.log` và báo cáo bàn giao.

## Ảnh hưởng

Cổng lần đầu chưa tới nhóm children; lần sau đã tới format nhưng chưa tới check:design/build. XML, Unicode và tham chiếu của file `.drawio` đã kiểm riêng; không thay đổi BE/APP.

## Lesson

Khi bàn giao tài liệu, báo riêng kết quả kiểm artifact và cổng verify repo; không coi test thất bại là lý do tự đổi nghiệp vụ hay sửa source ngoài phạm vi.
