---
id: FE-CASE-261016-health-follow-up-repeat-close-watch
type: edge-case
screens: [health-follow-ups, health-measurement-form]
be_modules: [health]
rules: [HLT-01]
status: fixed
date: 2026-10-16
keywords: [phiếu theo dõi, follow-up, Cần theo dõi sát, CLOSE_WATCH, lần khám sau, ghi thêm kết quả, trao đổi lần 2, 409]
similar_to: [FE-BUG-261016-health-follow-up-duplicate-on-edit, FE-CASE-261016-health-follow-up-child-withdrawn]
---

# FE-CASE-261016-health-follow-up-repeat-close-watch — lần khám sau lại "Cần theo dõi sát" khi phiếu cũ đã qua bước trao đổi thì kết quả mới không có bước trao đổi nào

## Symptom
Trẻ có phiếu đang mở, phiếu đã ghi trao đổi với phụ huynh (bước ② hoặc ③). Lần khám sau trẻ lại ở mức "Cần theo dõi sát". Khi đó:
- Kết quả mới được ghi thêm vào phiếu cũ. Trạng thái phiếu giữ nguyên và không ai nhận thông báo.
- Giáo viên không ghi được lần trao đổi mới về kết quả mới:
```text
409 Phiếu đã ghi trao đổi với phụ huynh.
```
- Giáo viên đóng phiếu cũ thì kết quả mới vẫn thuộc phiếu đã đóng. Hệ thống không mở phiếu nào cho kết quả mới.

## Điều kiện tái hiện
Mock backend, dữ liệu demo, giáo viên lớp của trẻ:
1. Trẻ `ch_019` có phiếu `fu_ch_019` ở trạng thái "Đã có kết quả khám bên ngoài".
2. Nhập kết quả mới ở mức "Cần theo dõi sát": phiếu có 2 kết quả, trạng thái không đổi, 0 thông báo.
3. Ghi trao đổi lần 2: lỗi 409.
4. Đóng phiếu: trẻ không còn phiếu đang mở, kết quả mới vẫn thuộc phiếu đã đóng.

## Attempts — đã thử
| # | Cách thử | Kết quả | Vì sao không đúng / bài học |
| --- | --- | --- | --- |
| 1 | Kịch bản backend giả trong scratchpad theo các bước trên | Đúng như Symptom | Xác nhận hành vi |

## Root cause
Hai quy tắc đã chốt không khớp nhau:
- Mỗi trẻ tối đa 1 phiếu đang mở; kết quả "Cần theo dõi sát" mới được ghi thêm vào phiếu đó.
- Mỗi bước của phiếu chỉ ghi 1 lần (1 lần trao đổi, 1 kết quả khám bên ngoài).

Phiếu đã qua bước trao đổi thì không còn chỗ ghi việc trao đổi về kết quả mới.

## Fix
User chọn **1 phiếu dài hạn cho mỗi trẻ** (2026-10-16, PROPOSED), không chọn "mỗi vòng 1 phiếu". Plan `docs/plans/completed/2026-10-16-health-follow-up-long-lived.md`:
- `history` của phiếu là dòng thời gian, mỗi sự kiện mang dữ liệu (ngày trao đổi, nội dung, ngày hẹn khám lại, kết quả khám).
- `followUpState` (`src/services/children/mock/healthCheckRule.js`) tính vòng theo dõi và trạng thái từ dòng thời gian. Kết quả "Cần theo dõi sát" mới sau khi vòng trước đã trao đổi mở vòng mới, phiếu về "Chờ trao đổi phụ huynh", hạn mới 7 ngày.
- Ghi trao đổi nhiều lần ở mọi trạng thái chưa đóng; ghi kết quả khám bên ngoài nhiều lần sau khi vòng hiện tại đã trao đổi.

## Regression test
Kịch bản backend giả trong scratchpad (không lưu vào repo): phiếu ở bước "Đã có kết quả khám bên ngoài" nhận kết quả mới thì về "Chờ trao đổi phụ huynh", hạn mới, có thông báo; ghi trao đổi lần 2 được; DB v3 nâng cấp giữ nội dung.

## Ảnh hưởng
BE cần cùng quy tắc khi làm HLT-09.

## Lesson
Quy tắc "ghi thêm vào bản ghi đang mở" phải xét bản ghi đó còn bước nào để xử lý phần mới thêm vào.
