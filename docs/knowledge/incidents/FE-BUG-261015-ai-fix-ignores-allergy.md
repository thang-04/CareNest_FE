---
id: FE-BUG-261015-ai-fix-ignores-allergy
type: bug
screens: [menu/weekly, menu/menus]
be_modules: [nutrition]
rules: []
status: fixed
date: 2026-10-15
keywords: [AI gợi ý cách sửa, DAY_FIX, suggestWeek, dị ứng, suất thay thế, Tôm rim thịt, món mặn lặp]
similar_to: []
---
# FE-BUG-261015-ai-fix-ignores-allergy — Gợi ý AI đưa món có chất trẻ dị ứng, bản AI tuần báo "Đủ chất" sai

## Symptom
Thực đơn tuần (mock): "AI gợi ý cách sửa" đề xuất đổi sang "Tôm rim thịt" khi nhóm có trẻ dị ứng tôm, kèm "Sau khi đổi, ngày này đạt hết". Bản AI soạn tuần ghi "Đủ chất" cho ngày có món chứa sữa bò chưa có suất thay thế, rồi "Cần xem lại" lại báo ngày đó. Bấm một nút gợi ý cho cả tuần thì 3 ngày cùng được gợi ý một món mặn, đổi hết lại sinh món lặp.

## Attempts
| # | Cách thử | Kết quả | Bài học |
| --- | --- | --- | --- |
| 1 | Bộ chấm điểm sửa ngày chỉ tính định mức, giá, món mặn lặp | Probe trình duyệt: gợi ý món chứa tôm | Bộ sinh gợi ý phải dùng cùng dữ liệu kiểm tra với màn hình |
| 2 | Loại món có chất trẻ dị ứng khỏi danh sách thay; cộng điểm phạt món dị ứng chưa có suất thay thế; kiểm tra sau khi đổi có truyền số trẻ dị ứng + suất thay thế | Gợi ý hợp lệ; bản AI tuần không còn báo đạt sai | — |
| 3 | Gợi ý cả tuần chạy tuần tự, món mặn vừa gợi ý cho ngày trước được tính là đã dùng | 3 ngày nhận 3 món khác nhau | Gợi ý nhiều ngày một lần phải xét các gợi ý của nhau |

## Root cause
`suggestDayFix` / `suggestWeek` trong mock gọi kiểm tra tự động mà không truyền `allergyRows` / `allergyMenus`, và mỗi ngày được gợi ý độc lập.

## Fix
`menuPlanningMockRepository.js`: `allergyArgsOf` cấp số trẻ dị ứng + suất thay thế của thực đơn mẫu cho mọi lần kiểm tra trong AI mock; danh sách món thay bỏ món có chất trẻ dị ứng. `WeeklyMenuPage.askFixes` gửi `menuId` và cộng món đã gợi ý vào `recentMainIds`.

## Regression test
`tests/menu/ai-week.test.mjs`: gợi ý sửa ngày không đưa món có chất nhóm dị ứng; lý do bản AI tuần khớp kết quả kiểm tra có tính dị ứng.

## Ảnh hưởng
Chỉ bản mock (bộ sinh theo quy tắc). AI thật ở BE cần cùng ràng buộc: không gợi ý món có chất mà nhóm có trẻ dị ứng, và kiểm tra lại đề xuất bằng đúng quy tắc của màn hình.

## Lesson
Mọi đề xuất AI phải tự kiểm tra bằng cùng hàm kiểm tra tự động với đủ đầu vào (cả dị ứng) trước khi nói "đạt".
