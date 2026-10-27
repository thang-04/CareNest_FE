---
id: FE-BUG-261020-weekly-draft-add-dish-422
type: bug
screens: [menu-weekly]
be_modules: [nutrition]
rules: []
status: workaround
date: 2026-10-20
keywords: [thêm món, thực đơn tuần, soạn tay, 422, chọn ít nhất một món, saveDayAdjustment, validateMenu]
similar_to: [FE-BUG-261020-weekgrid-native-select-overflow]
---

# FE-BUG-261020-weekly-draft-add-dish-422 — Tuần nháp không thêm được món vào ô trống

## Symptom

User: "sao tạo thực đơn tôi ko nhấn thêm món đc". Phó HT "Soạn tay" một tuần, bấm "Thêm" ở ô trống, chọn món ⇒ toast `Thất bại · Mã 422 — Chưa thực hiện được — Bữa trưa: chọn ít nhất một món.`; ô vẫn trống.

## Điều kiện tái hiện

Mock, Phó HT `lan.nguyen`, `/menu/weekly`, nhóm Nhà trẻ, tuần chưa có thực đơn ⇒ "Soạn tay" ⇒ "Thêm" ở bất kỳ ô ⇒ chọn món đầu danh sách.

## Attempts — đã thử

| # | Cách thử | Kết quả | Bài học |
| --- | --- | --- | --- |
| 1 | Thực đơn mẫu `/menu/menus/new` "Thêm món ăn" | Bấm được, chọn bữa đích bình thường | Không phải màn này |
| 2 | Chuột thật (agent-browser) bấm "Thêm" ở bảng tuần | Lần đầu không mở ô chọn; sau đó mọi cú bấm chuột thật trên mọi trang (kể cả `/ui-kit`) không phát sự kiện | Lỗi công cụ headless (`showPicker` mở danh sách gốc giữ input); kiểm bằng JS `click()` + `change` |
| 3 | JS bấm "Thêm" + chọn món | Toast 422 "Bữa trưa: chọn ít nhất một món." | Ra nguyên nhân thật |
| 4 | Sau sửa 422, user (port 5173, tuần `wm_auto_draft_20261019`): "dòng nào nhấn thêm cũng đều ko được", "không có món nào để thêm" | Profile đo dựng lại DB giống user (bản nháp cũ + bản xuất bản cùng tuần): mọi dòng có món (Cơm 2 … bữa chiều 25), JS chọn món lưu được | Không tái hiện được bằng script; khác biệt chỉ còn ở thao tác chuột thật với danh sách gốc mở bằng `showPicker()` (thêm cùng ngày ở `FE-BUG-261020-weekgrid-native-select-overflow`, ghi "chưa kiểm bằng trình duyệt") |
| 5 | Bỏ cơ chế nút "Thêm" → đổi sang `<select>` + `showPicker()` + `onBlur` đóng | "+ Thêm" là chính `<select>` gốc (một lần bấm mở danh sách trình duyệt, `value=""` luôn về "+ Thêm"); 30 ô, chọn món 30→31 không toast; lệnh `select` thật của công cụ 31→32 | Giả thuyết chưa chứng minh trên máy user — chờ user xác nhận |

## Root cause

FE mock (BE giả): `saveDayAdjustment` (`src/services/menu-planning/mock/menuPlanningMockRepository.js`) kiểm ngày bằng `validateMenu` của thực đơn mẫu ⇒ mọi bữa phải có món ở **mỗi lần lưu**. Bảng tuần lưu từng món một nên món đầu tiên của ngày trống luôn 422; bỏ món cuối của một bữa cũng 422. Trái nguyên tắc đã ghi ở `validateWeeklyMenu`: nháp chỉ cần tuần + nhóm tuổi, đủ món kiểm khi xuất bản (`publishWeeklyMenu` chặn "Ngày học chưa có món"). Lộ ra khi có luồng "Soạn tay" + ô "Thêm" từng món.

## Fix

`validateMenu(form, others, meals, { allowEmptyMeals })` (`src/utils/menu-planning/menuPlanningValidation.js`); `saveDayAdjustment` truyền `allowEmptyMeals: true`. Vẫn chặn hệ số khẩu phần ngoài 0,1–3 và món không `ACTIVE`. Thực đơn mẫu giữ bắt đủ bữa.

Lần 2 (cùng ngày): `src/components/menu-planning/WeekGrid.jsx` bỏ state `adding`, `showPicker()`, `onBlur`; ô "+ Thêm" là `<select className="td-week__add td-week__add-select">` (CSS `appearance: none`, viền focus); loại món chưa có món đang dùng ⇒ câu "Chưa có món … đang sử dụng." thay vì danh sách rỗng.

## Regression test

`tests/menu/weekly-day-draft-save.test.mjs`: thêm món đầu vào ngày trống (RED 422 → GREEN), bỏ món cuối của bữa, hệ số 9 vẫn 422, xuất bản tuần trống vẫn 422. Trình duyệt (mock, JS): 3 lần thêm ⇒ 1/2/3 món, không toast; bỏ 1 món ⇒ còn 2, không toast.

## Ảnh hưởng

Chỉ ngày của thực đơn tuần nháp. Khi nối BE thật: BE cần cùng hành vi (lưu nháp ngày cho phép bữa trống, chặn khi xuất bản) — đề xuất ghi `BE:docs/knowledge/CROSS_MODULE_ISSUES.md` nếu contract BE khác.

## Lesson

Validate dùng chung giữa "mẫu" và "nháp từng bước" phải có cờ cho trạng thái chưa xong. Công cụ headless: không dùng chuột thật với `<select>` có `showPicker()`.
