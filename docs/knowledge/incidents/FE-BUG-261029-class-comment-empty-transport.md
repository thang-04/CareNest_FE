---
id: FE-BUG-261029-class-comment-empty-transport
type: bug
screens: [daily-assessment]
be_modules: [learning-observation]
rules: [OBS-19]
status: fixed
date: 2026-10-29
keywords: [classComment, chuỗi rỗng, null, xóa nhận xét, beClient]
similar_to: []
---
# Xóa nhận xét lớp bị đổi thành không sửa qua transport

## Symptom / tái hiện

PUT General với `entries: [], classComment: ''` phải xóa nội dung, nhưng beClient chuyển thành null. BE coi null là giữ nguyên nên trả 7312 khi không có trẻ cần lưu, hoặc giữ nhận xét cũ nếu lưu kèm trẻ.

## Attempts

| # | Cách thử | Kết quả |
| --- | --- | --- |
| 1 | Reviewer đối chiếu adapter + toBe + DTO/service BE | Mock/fake client thuần không bắt được lỗi serializer |
| 2 | Test dùng beClient thật với Axios adapter giả, không mạng/token thật | 5/6 đạt, test transport fail `null !== ''` |
| 3 | Option `preserveEmptyStrings` riêng PUT General, giữ classComment | 6/6 đạt; request không bật option vẫn đổi số/id và chuỗi rỗng như cũ |

## Root cause / Fix

`beClient` đổi mọi field rỗng thành null để hỗ trợ ô số/id. Contract OBS-19 phân biệt thiếu/null (giữ) và rỗng (xóa). Bổ sung option serializer cho PUT, adapter General chọn `classComment`; không đổi mặc định các endpoint khác.

## Regression test

`tests/dashboard/class-comments.test.mjs`, ca "transport BE giữ chuỗi rỗng để xóa nhận xét…" kiểm đúng dữ liệu JSON sau Axios transform. Không truy cập browser/BE/DB thật.

## Ảnh hưởng / Lesson

Chỉ request nhận xét lớp bật option; không đổi auth hay endpoint. Với API có patch semantics, kiểm cả serializer HTTP chứ không chỉ mock payload trước transport.
