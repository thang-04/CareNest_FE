---
id: FE-BUG-261023-pickup-seed-quota
type: bug
screens: [pickup]
be_modules: []
rules: []
status: fixed
date: 2026-10-23
keywords: [đón trẻ, pickup, localStorage, quota, 507, Bộ nhớ trình duyệt đã đầy, dữ liệu mẫu]
similar_to: [FE-BUG-261019-assessment-seed-quota]
---

# FE-BUG-261023-pickup-seed-quota — Mở "Đón trẻ" báo "Bộ nhớ trình duyệt đã đầy"

## Symptom
Giáo viên demo (Lớp Chồi 1) mở `/pickup`: tab Chờ đón 0, ErrorState "Không tải được dữ liệu":
```text
Bộ nhớ trình duyệt đã đầy. Hãy dùng ảnh nhỏ hơn hoặc reset dữ liệu demo.
```
(`src/mocks/mockDatabase.js` persist, 507).

## Điều kiện tái hiện
Mock mode, DB demo đã mở nhiều module (đánh giá, điểm danh, bếp, sức khỏe…) và đã dùng một thời gian, chưa từng mở Đón trẻ; mở Đón trẻ lần đầu. Dữ liệu giả.

## Attempts — đã thử (cập nhật mỗi phiên điều tra, để phiên sau không lặp lại)
| # | Cách thử | Kết quả | Vì sao không đúng / bài học |
| --- | --- | --- | --- |
| 1 | Đo DB demo mới, gọi list/get của gần hết mock repository (localStorage giả 5 triệu ký tự) | Tổng 4,30 triệu; `pickups` 348 nghìn (2 ngày × mọi lớp có điểm danh) | DB demo mới còn ~0,7 triệu; DB đã dùng (thêm bản ghi, ảnh) dễ vượt khi ghi 348 nghìn của lần đầu mở Đón trẻ |

## Root cause
FE (dữ liệu mẫu). `buildPickupSeed` (`src/mocks/pickupSeed.js`) tạo lịch sử đón cho mọi lớp có điểm danh của 2 ngày gần nhất; `pickupMockRepository.ready()` ghi toàn bộ ở lần đầu mở trang. Cùng gốc với FE-BUG-261019-assessment-seed-quota (seed theo ngày × số trẻ).

## Fix
Lịch sử đón mẫu chỉ cho lớp có tài khoản giáo viên demo (`DEMO_CLASS_IDS`, chuyển sang `src/mocks/demoClasses.js`, dùng chung với dữ liệu mẫu đánh giá). `pickups` 348 nghìn ⇒ 47 nghìn; DB demo đủ module 4,30 ⇒ 4,00 triệu ký tự. DB đã gần đầy từ trước vẫn có thể cần "Khôi phục dữ liệu demo".

## Regression test
`tests/hardening/pickup-seed-size.test.mjs`: lịch sử đón mẫu chỉ thuộc lớp demo, < 100.000 ký tự, lớp demo vẫn có trẻ đã đón ngày trước. Trước fix: có lớp ngoài demo, 348 nghìn ký tự.

## Ảnh hưởng
Đón trẻ của lớp ngoài 6 lớp demo không có lịch sử 2 ngày trước (hôm nay vẫn hiện danh sách chờ đón theo điểm danh). Không ảnh hưởng BE thật.

## Lesson
Mock DB dùng chung một khóa localStorage (~5 triệu ký tự); seed theo ngày × số trẻ phải giới hạn lớp demo. DB đủ module đã ~4,0 triệu: thêm seed lớn phải đo lại tổng.
