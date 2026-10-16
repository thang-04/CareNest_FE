---
id: FE-BUG-261015-kitchen-reads-old-menu-shape
type: bug
screens: [kitchen/required-quantity, kitchen/published-menu, kitchen/meal-count]
be_modules: [nutrition, kitchen]
rules: [NUT-07]
status: fixed
date: 2026-10-15
keywords: [Định lượng thực phẩm, Khẩu phần & đi chợ, Không có thực đơn đã công bố, dishIds, meals items dishId, menusFromWeeklyMenus, gam kg]
similar_to: []
---
# FE-BUG-261015-kitchen-reads-old-menu-shape — Bếp không thấy thực đơn tuần đã xuất bản của luồng mới

## Symptom
Trang bếp "Định lượng thực phẩm" (mock) luôn báo "Không có thực đơn đã công bố" dù thực đơn tuần đã xuất bản. Khi có số, lượng là gam nhưng ghi đơn vị kg; không tính thải bỏ, định lượng theo nhóm tuổi, suất thay thế của thực đơn mẫu, Bữa phụ sáng và bữa thêm.

## Attempts
| # | Cách thử | Kết quả | Bài học |
| --- | --- | --- | --- |
| 1 | Đọc `menusFromWeeklyMenus` | Hàm tìm `dishIds`/`dishes`, thực đơn tuần lưu `days[].meals[].items[].dishId` ⇒ 0 món | Mock đọc chéo module phải theo đúng shape đang lưu, có test |
| 2 | Thêm `menusFromDays` + tính phiếu đi chợ riêng (`marketList.js`) dùng chung cho trang và phiếu xuất kho | Test 7/7, probe đúng số | — |

## Root cause
Mock bếp viết trước khi thực đơn tuần đổi shape; đọc "phòng thủ" theo tên trường cũ nên im lặng ra rỗng. `normalizeFood` lấy `purchaseUnit` làm đơn vị cho số gam.

## Fix
`src/services/kitchen/mock/kitchenMockRepository.js` (`menusFromDays`, `computeDay` dùng `computeMarket` cho danh mục thực đơn) + `src/services/kitchen/mock/marketList.js`.

## Regression test
`tests/kitchen/market-list.test.mjs`: đọc thực đơn đã xuất bản khuôn mới; phiếu xuất kho cùng số với phiếu đi chợ.

## Ảnh hưởng
Chỉ mock. BE cần một chỗ tính duy nhất (NUT-07) cho định lượng, phiếu đi chợ và phiếu xuất kho.

## Lesson
Đọc dữ liệu module khác theo shape cụ thể và có test chéo; đọc "phòng thủ" theo nhiều tên trường làm lỗi thành rỗng im lặng.
