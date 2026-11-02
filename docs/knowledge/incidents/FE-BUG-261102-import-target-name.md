---
id: FE-BUG-261102-import-target-name
type: bug
screens: [education-goals]
be_modules: [education-plan]
rules: [EDU-46]
status: fixed
date: 2026-11-02
keywords: [targetName, trùng mã, nhập file năm học]
similar_to: []
---

# FE-BUG-261102-import-target-name — test nhập file thiếu tên chủ đề đích

## Symptom
Cổng đầy đủ dừng tại test `trùng mã nhưng khác tên báo rõ chủ đề tay được giữ và đích ghép dấu tích`: `prepared.themes[0].targetName` là undefined thay vì tên chủ đề gõ tay.

## Điều kiện tái hiện
`node --import ./scripts/register-auth-test-loader.mjs --test tests/education-plan/full-year-file-import.test.mjs`; fixture tổng hợp có cùng mã MN nhưng tên chủ đề nguồn và đích khác nhau.

## Attempts
| # | Cách thử | Kết quả | Bài học |
| --- | --- | --- | --- |
| 1 | Chạy cổng đầy đủ khi đồng bộ giao diện chi tiết/chỉnh sửa | Suite education-plan đạt 126/127; test targetName thất bại | Test và model nhập file không bị sửa trong diff giao diện |
| 2 | Chạy riêng với `--test-name-pattern 'trùng mã nhưng khác tên'` và kiểm diff test/model | Tái hiện cùng assertion, diff hai file rỗng | Lỗi tồn tại độc lập với thay đổi bố cục |

| 3 | Triển khai rule replacement đã được user duyệt, giữ dữ liệu fixture trùng mã/khác tên và đổi expectation tương ứng | Model11/11, modal7/7, giáo dục133/133, full369/369 | Đóng nhánh additive đã bị thay; không tuyên bố targetName getter cũ đã sửa |

## Root cause
Luồng additive cũ trả existing/targetAbbr nhưng không trả targetName hoặc cảnh báo khác tên mà test kỳ vọng. Đây là thiếu thông tin preview của luồng cũ, độc lập với bố cục. Quyết định mới EDU-46 của user đã thay luồng additive bằng hai chế độ replacement; không còn ghép/giữ chủ đề tay khi phần chủ đề được thay.

## Fix
Đóng do luồng gây lỗi được thay theo spec009/EDU-46 đã duyệt, không phải thêm getter targetName để lách test. Khi phần chủ đề có trong file, cả hai mode thay nguyên danh sách; tên/mã tay cũ không giữ và không gây ambiguity với nguồn. Full/present thiếu phần được kiểm riêng; UI preview nói đúng kết quả. Test cũ được thay bằng ca cùng dữ liệu trùng mã/khác tên nhưng kỳ vọng đúng quy tắc mới.

## Regression test
`tests/education-plan/full-year-file-import.test.mjs`: ca tên/mã tay cũ không giữ/gây mơ hồ ở cả mode; ca remap khi giữ mục tiêu và thay chủ đề. RED10/11 fail với model cũ → GREEN11/11 sau model mới; modal7/7, suite giáo dục133/133, cổng đầy đủ369test fail0/skip0 ở lượt đầu sau source cuối.

## Ảnh hưởng
Cổng đầy đủ đã có VERIFY PASS full sau source replacement. Chỉ thay Web, không source/API/DB BE/APP. Lưu/mở lại BE thật chưa kiểm vì thiếu E2E_DEV_PASSWORD, dù dịch vụ BE/Keycloak đang chạy.

## Lesson
Phân biệt kiểm chứng giao diện với lỗi suite nhập dữ liệu hiện hữu; không báo toàn bộ cổng đạt khi còn test thất bại.
