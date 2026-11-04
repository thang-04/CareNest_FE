---
id: FE-BUG-261027-import-template-misaligned-row
type: bug
screens: [children-import]
be_modules: [child]
rules: []
status: fixed
date: 2026-10-27
keywords: [nhập Excel, file mẫu, tiếp nhận trẻ, lệch cột, nguồn chi trả, BHYT, IMPORT_COLUMNS]
similar_to: []
---

# FE-BUG-261027-import-template-misaligned-row — Dòng mẫu của file mẫu nhập trẻ lệch một cột

## Symptom
"Tải file mẫu" ở `/children/import` cho file có 23 cột tiêu đề nhưng dòng mẫu 24 giá trị. Từ cột "Nhóm máu" trở đi giá trị lệch một cột: Nhóm máu = "BHYT", Tỉnh/thành trống, Phường/xã = "Hải Phòng", Tiền sử bản thân = địa chỉ, Ngày tiếp xúc lao = "Không".

## Điều kiện tái hiện
Mock, Phó hiệu trưởng hoặc Hiệu trưởng, `/children/import` → Tải file mẫu, mở file, so tiêu đề với dòng 2.

## Attempts — đã thử
| # | Cách thử | Kết quả | Vì sao không đúng / bài học |
| --- | --- | --- | --- |
| 1 | Sinh CSV thử từ `IMPORT_COLUMNS` và dòng mẫu của trang (task Hiệu trưởng tiếp nhận trẻ) | Script báo 23 tiêu đề, 24 giá trị | Lộ lệch cột khi ghép dòng mẫu với danh sách cột |
| 2 | Bỏ "BHYT" khỏi dòng mẫu, nhập lại CSV 23 cột trên trình duyệt (Hiệu trưởng, Campus 2) | Xem trước 1 dòng hợp lệ, nhập thành công | Dòng mẫu khớp cột |

## Root cause
FE: ngày 2026-10-23 bỏ cột "Nguồn chi trả" khỏi `IMPORT_COLUMNS` (`src/models/children/childrenConstants.js`) nhưng dòng mẫu trong `downloadTemplate` (`src/pages/children/ImportChildrenPage.jsx`) còn giá trị "BHYT".

## Fix
Bỏ "BHYT" khỏi dòng mẫu; comment ghi mỗi giá trị ứng một cột `IMPORT_COLUMNS`.

## Regression test
Chưa có test tự động (dòng mẫu nằm trong page). Kiểm tay: dòng mẫu 7 + 3 + 9 + 4 = 23 giá trị, khớp 23 cột.

## Ảnh hưởng
Chỉ file mẫu tải về; file người dùng tự điền đúng tiêu đề không bị ảnh hưởng. Không cần BE đổi.

## Lesson
Thêm/bỏ cột nhập Excel thì sửa cùng lúc `IMPORT_COLUMNS`, dòng mẫu của file mẫu và bộ đọc CSV.
