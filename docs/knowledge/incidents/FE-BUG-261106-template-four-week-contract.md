---
id: FE-BUG-261106-template-four-week-contract
type: bug
screens: [menu-templates, menu-template-editor, menu-weekly]
be_modules: [nutrition]
rules: [NUT-13]
status: workaround
date: 2026-11-06
keywords: [mẫu thực đơn ngày, bộ 4 tuần, weekNo, weekday, trùng key, dishIngredients, hợp đồng BE main]
similar_to: []
---

# FE-BUG-261106 — Mẫu thực đơn ngày: mỗi bữa lặp món 4 tuần, cảnh báo trùng key, thành phần trống

- **Vùng:** `/menu/templates` (danh sách, modal xem), `/menu/templates/:id` (sửa), `GET /nutrition/menu-templates` trên BE `main` (release v0.0.5).
- **Triệu chứng:** ở web.carenest.edu.vn Hiệu trưởng mở "Thực đơn mùa thu - Nhà trẻ": Bữa phụ sáng liệt kê Sữa chua, Chuối tiêu, Cam, Đu đủ, Dưa hấu rồi lặp lại; console đầy `Encountered two children with the same key`; mọi món "Chưa có thành phần".
- **Điều kiện tái hiện:** chạy BE `origin/main` + seed Thượng Hồng (Docker, gateway bật), đăng nhập Hiệu trưởng, mở một mẫu.

## Attempts

| # | Cách thử | Kết quả | Bài học |
| --- | --- | --- | --- |
| 1 | Gọi API trực tiếp bằng token `principal` | `GET /nutrition/menu-templates` 200, đủ quyền | Không phải lỗi quyền |
| 2 | So DTO `MenuTemplateResponse` BE `main` với worktree `CareNest_BE-day-boarding` | `main`: `Item(weekNo, weekday, session, dishId…)`, 120 món/bộ; hợp đồng mẫu một ngày chỉ là thay đổi chưa commit ở worktree day-boarding | FE (mẫu một ngày, NUT-13 đổi 04/11) và BE `main` (bộ 4 tuần) lệch hợp đồng |
| 3 | Chạy FE gateway tới stack BE `main` và mở modal | Tái hiện đúng: mọi ngày gộp vào một bữa; key = `dishId` bị lặp giữa các tuần | Dữ liệu 4 tuần bị gộp, không phải lỗi hiển thị riêng lẻ |
| 4 | Sửa util `toTemplateRequest` luôn gửi `weekNo/weekday` | `verify` fail: `tests/menu/menu-template-grid.test.mjs` khẳng định body chỉ có bữa + món | Test giữ hợp đồng mẫu một ngày; chỉ gửi ngày khi món có sẵn `weekNo` |

## Root cause

BE `main` còn hợp đồng bộ 4 tuần; FE `itemsBySession` gom mọi món theo bữa, bỏ qua `weekNo/weekday`. `TemplateMealSection` dùng `dishId` làm key nên món lặp giữa các tuần trùng key. `dishIngredients` của `POST /nutrition/menu-statistics` chỉ có ở nhánh `feature/G94-254-BE-FEAT-27-day-boarding`, `main` không trả ⇒ thành phần trống.

## Fix (FE, tạm)

`TemplateDayPicker` (Tuần 1–4 × Thứ 2–6) ở modal xem và trang sửa; chỉ hiện món của ngày đang chọn; `toTemplateRequest` giữ `weekNo/weekday` khi món có; thẻ danh sách tóm tắt ngày đầu + "Bộ 4 tuần · N món". Mẫu không có `weekNo` hiện như cũ. Câu thông báo thành phần phân biệt "máy chủ chưa trả" với "nhóm tuổi chưa có".

## Kế hoạch tuần điền theo mẫu (user chốt 2026-11-06: "ngày cùng thứ, tuần 1")

`applyTemplateDay` lấy các món của **Tuần 1, cùng thứ** với ngày kế hoạch (`templateItemsForDate`); mẫu một ngày giữ nguyên. Thứ chưa có món ⇒ báo lỗi "chưa có món cho ngày này", không thay món đang có. Bỏ quy tắc này khi BE đưa hợp đồng mẫu một ngày vào `main`.

## Đề xuất ghi cho BE (`BE:docs/knowledge/CROSS_MODULE_ISSUES.md`, chưa ghi)

NUT-13 chốt mẫu một ngày (04/11) nhưng `main` còn `MenuTemplateResponse.Item.weekNo/weekday` và thiếu `dishIngredients`; thay đổi `MenuTemplateRequest/Response` nằm chưa commit ở `CareNest_BE-day-boarding`. Cần merge vào `main` trước khi FE bỏ bộ chọn ngày.

## Regression test

`tests/menu/menu-template-grid.test.mjs` › "bộ 4 tuần: lọc món theo ngày, body lưu giữ weekNo + weekday của từng món".

- **Trạng thái:** workaround (2026-11-06).
