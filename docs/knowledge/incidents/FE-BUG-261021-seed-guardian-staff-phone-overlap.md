---
id: FE-BUG-261021-seed-guardian-staff-phone-overlap
type: bug
screens: [children/activation]
be_modules: [child, identity-access]
rules: []
status: fixed
date: 2026-10-21
keywords: [kích hoạt, activation, phụ huynh, giáo viên, nhân viên, SĐT trùng, seed, dữ liệu mẫu, teacherSeed, 409]
similar_to: []
---

# FE-BUG-261021-seed-guardian-staff-phone-overlap — phụ huynh mẫu trùng SĐT với giáo viên mẫu

## Symptom
Kích hoạt tài khoản cho một số phụ huynh của dữ liệu mẫu (vd. trẻ `ch_004`, SĐT `0948 212 284`) báo:
```text
Số điện thoại hoặc email đã được dùng cho tài khoản nhân viên. Không tạo được tài khoản phụ huynh.
```
Thêm phụ huynh ở màn Tài khoản phụ huynh với SĐT các phụ huynh này cũng bị `409` "Số điện thoại hoặc email thuộc tài khoản nhân sự."

## Điều kiện tái hiện
DB demo mới (`resetDb()`): 52 bản ghi phụ huynh mẫu có SĐT trùng SĐT nhân sự (đếm bằng script tạm ngày 2026-10-21).

## Attempts — đã thử (cập nhật mỗi phiên điều tra, để phiên sau không lặp lại)
| # | Cách thử | Kết quả | Vì sao không đúng / bài học |
| --- | --- | --- | --- |
| 1 | Test kích hoạt `tests/children/guardian-citizen-id.test.mjs` chọn trẻ `NOT_ACTIVATED` đầu tiên của c1 | `409` nhân viên, chưa tới bước CCCD | SĐT phụ huynh mẫu trùng giáo viên mẫu |
| 2 | Test lọc phụ huynh có SĐT không trùng nhân sự (`notStaff`) | Pass | Né trong test; dữ liệu mẫu chưa sửa |
| 3 | 2026-10-23: user bấm "Kích hoạt tài khoản" (khung Phụ huynh của bé, kích hoạt theo hồ sơ) cho Vũ Diệu Anh, Lớp Mầm 1 | `409` "Số điện thoại hoặc email thuộc tài khoản nhân sự." | Bố Vũ Văn Long `0928 332 124` trùng SĐT giáo viên mẫu `u_gv044`; 13 phụ huynh mẫu chưa kích hoạt bị như vậy |

## Root cause
`src/mocks/teacherSeed.js:55` sinh SĐT giáo viên bằng cùng công thức theo `n` với phụ huynh mẫu (`src/mocks/schoolSeed.js`, `src/mocks/classSeed.js`): `09${(n*37)%100} ${(n*53)%1000} ${(n*71)%1000}`, nên giáo viên và phụ huynh cùng `n` có cùng SĐT.

## Fix
2026-10-23 (user đồng ý): `teacherPhoneOf(n)` trong `src/mocks/teacherSeed.js` dùng đầu số `08` (phụ huynh mẫu vẫn `09`). DB demo đã lưu: `ensureSchoolSeeded` (`src/mocks/schoolMockRepository.js`, cờ `teacherPhones08`) đổi một lần SĐT của `u_gvNNN` còn đúng công thức cũ (`legacyTeacherPhoneOf`). Đăng nhập nhân sự bằng email nên không ảnh hưởng. Thử trên trình duyệt (DB cũ): `u_gv044` thành `0828 332 124`; kích hoạt bố của Vũ Diệu Anh (`0928 332 124`) tạo được tài khoản.

## Regression test
`tests/hardening/seed-integrity.test.mjs`: DB mới và DB cũ sau nâng cấp không có SĐT/email phụ huynh mẫu nào trùng nhân sự.
