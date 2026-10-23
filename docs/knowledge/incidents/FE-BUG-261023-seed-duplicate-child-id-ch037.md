---
id: FE-BUG-261023-seed-duplicate-child-id-ch037
type: bug
screens: [children-health-check-detail, children-list]
be_modules: [child]
rules: []
status: open
date: 2026-10-23
keywords: [dữ liệu mẫu, seed, trùng id, ch_037, HS26037, duplicate key, Lớp Mầm 1]
similar_to: [FE-BUG-261021-seed-guardian-staff-phone-overlap]
---

# FE-BUG-261023-seed-duplicate-child-id-ch037 — Hai trẻ mẫu cùng id `ch_037` ở Lớp Mầm 1

## Symptom
Đợt khám Campus 1 → Tiến độ theo lớp → mở Lớp Mầm 1: bảng trẻ có 27 dòng trong khi lớp có 26 trẻ; console:
```text
Warning: Encountered two children with the same key, `%s`. ... ch_037
```
DB demo có 2 bản ghi `children` cùng `id: 'ch_037'`, cùng mã `HS26037` nhưng khác người (Nguyễn Minh Đức, Phạm Gia Khánh).

## Điều kiện tái hiện
Khôi phục dữ liệu demo (hoặc `resetDb()` + `ensureChildRecordsSeeded()`), Hiệu trưởng mở `/children/health-checks/hc_c1_open?classId=cls_c1_m1`. Dữ liệu giả.

## Attempts — đã thử (cập nhật mỗi phiên điều tra, để phiên sau không lặp lại)
| # | Cách thử | Kết quả | Vì sao không đúng / bài học |
| --- | --- | --- | --- |
| 1 | Đếm `db.children` theo `id` trong trình duyệt | `ch_037` xuất hiện 2 lần | Xác nhận lỗi dữ liệu, không phải lỗi render |

## Root cause
FE (dữ liệu mẫu). `buildM1ExtraChildren` (`src/mocks/schoolSeed.js:131-135`) đánh số trẻ bổ sung Lớp Mầm 1 từ `seedClasses.length * 6 + 1` = 37 ⇒ trẻ bổ sung đầu tiên có id `ch_037`, trùng trẻ viết tay `ch_037` Phạm Gia Khánh (`src/mocks/schoolSeed.js:191`, trẻ 27 tháng cho câu "nguy cơ tự kỷ", được `childrenSeed.js` EXAM_CASES và `healthCheckSeed.js:273` dùng).

## Fix
Chưa sửa (chờ user đồng ý; ngoài phạm vi yêu cầu accordion 2026-10-23). Hướng đề xuất: đổi id trẻ viết tay sang số chưa dùng (vd. `ch_099`/`HS26099`) và cập nhật mọi tham chiếu seed, kèm nâng cấp DB demo một lần (đổi id bản ghi trùng thứ hai và các bản ghi sức khỏe, phiếu theo dõi, tài khoản phụ huynh gắn với nó).

## Regression test
Chưa có. Đề xuất: test seed "mọi `children.id` và `code` là duy nhất".

## Ảnh hưởng
Mọi màn dùng `childId` của Lớp Mầm 1 Campus 1: danh sách lớp trong đợt khám (key React trùng, có thể hiện sai dòng), hồ sơ trẻ, phiếu khám, phiếu theo dõi của 2 trẻ này có thể lẫn nhau. Xu hướng sức khỏe (2026-10-23): lọc sang lớp khác vẫn sót dòng "Nguyễn Minh Đức · Lớp Mầm 1" trong danh sách trẻ (React giữ phần tử trùng key). Không ảnh hưởng BE thật (id do BE sinh).

## Lesson
Seed viết tay chen vào dãy id sinh tự động phải lấy số ngoài dải sinh tự động; nên có test kiểm id duy nhất cho dữ liệu mẫu.
