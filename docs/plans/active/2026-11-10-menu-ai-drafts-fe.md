---
title: Nối AI gợi ý thực đơn với BE (kế hoạch tuần, thay một món, mẫu ngày)
status: in-progress
owner: Thangnd04
jira: G94-200 / FE-FEAT-55
branch: feature/G94-200-FE-FEAT-55-menu-ai
modules: [nutrition, ai-assistance]
rules: [AI-01, AI-02, AI-03, AI-07, NUT-08, NUT-09, NUT-13]
risk: high
created: 2026-11-10
updated: 2026-11-10
---
# Nối AI gợi ý thực đơn với BE

## Context
BE (nhánh `feature/G94-200-BE-FEAT-28-ai-assessment-drafting`, commit `82563c4`) có `/nutrition/menu-ai-drafts`: tạo nháp tuần / mẫu ngày / thay một món, xem, bỏ, dùng (`apply`), đánh dấu đã dùng mẫu ngày (`mark-used`). Contract: `BE:specs/014-boarding-menu-ai/contracts/menu-ai-drafts.md`; tiêu chí: `BE:docs/quality/ai-menu-quality-criteria.md`; ADR: `BE:docs/decisions/ADR-0024-menu-ai-drafts-value-gate.md`. Trên `dev` FE, màn đang nối BE thật là `WeeklyPlanPage` (`mealPlanApi`) và `MenuTemplateEditorPage` (`menuTemplateApi`); `AiWeekComposer`, `AiTemplateComposer`, gợi ý thay món trong `WeeklyMenuPage` thuộc màn demo `/menu/*` cũ (module `menu-planning`, nguồn demo).

## Quyết định đã chốt
1. Nhánh `feature/G94-200-FE-FEAT-55-menu-ai`, worktree `CareNest_FE-menu-ai` từ `origin/dev` — user 10/11/2026.
2. Phần tiếp theo là Web 3 màn AI thực đơn — user 10/11/2026.

## Làm rõ nghiệp vụ
- **Hiểu nghiệp vụ:** PHT/HT có `MENU_MANAGE` nhận nháp AI (AI-01), xem nguồn/điểm/bảng kiểm, tự quyết dùng hay bỏ (AI-02); công bố tuần vẫn qua nút cũ (NUT-08). AI tắt/lỗi vẫn có phương án theo quy tắc (AI-03).
- **Đối chiếu thiết kế:** gắn AI vào màn đang nối BE thật, không vào màn demo cũ (màn demo dùng contract `/menu/ai-suggestions` không tồn tại ở BE).
- **Ảnh hưởng:** chỉ FE; không đổi route; thêm module `menu-ai` (nguồn `api`) trong `integrationModules.js`, lời gọi khai `pending` tới khi BE `dev` có route.

### Câu hỏi mở
Không chặn. Giả định agent (chờ soát): G1 "Dùng" tuần bị khóa khi màn còn thay đổi chưa lưu (ghi qua BE sẽ thay bản đang sửa); G2 thay một món chọn món từ bản đã lưu của khối; G3 mẫu ngày điền vào ngày đang sửa của form, rồi `mark-used` — chưa lưu mẫu thì người dùng vẫn phải bấm "Lưu mẫu".

## Acceptance criteria
- **AC-1** (AI-01, AI-02): Given PHT có quyền sửa tuần, When bấm "AI gợi ý" và tạo nháp, Then thấy nhãn nháp AI, nguồn (AI / Theo quy tắc + lý do), điểm, bảng kiểm, lưới món, lưu ý; "Dùng" ghi tuần qua BE và nạp lại, "Bỏ" gọi dismiss.
- **AC-2** (AI-03): Given BE trả `NO_FEASIBLE`, Then hiện nguyên nhân, không có nút "Dùng".
- **AC-7** (NUT-09; thêm 11/11/2026 theo phản hồi user khi thử màn): Given BE trả nháp `PENDING_REVIEW` có `feasible=false`, Then vẫn hiện lưới món kèm cảnh báo "Chưa đạt định mức, cần sửa tay" và lỗi theo ngày; nút dùng đổi nhãn "Dùng để sửa tiếp"; công bố vẫn do BE chặn.
- **AC-3** (NUT-08): Given màn có thay đổi chưa lưu, Then "Dùng" bị khóa kèm lời nhắc lưu nháp.
- **AC-4**: Thay một món: chọn ngày/bữa/món ⇒ nháp `MENU_DAY_FIX` ⇒ "Dùng" chỉ đổi đúng ô (BE quyết định), 409 hiện lỗi BE.
- **AC-5** (NUT-13): Mẫu ngày: nháp `MENU_DAILY` ⇒ "Điền vào ngày đang sửa" thay món các bữa của ngày đó trong form, gọi `mark-used`; chưa lưu mẫu.
- **AC-6**: Người không có quyền sửa không thấy nút AI.

## Key decisions
| Quyết định | Chọn | Phương án khác | Vì sao |
| --- | --- | --- | --- |
| Gắn ở đâu | `WeeklyPlanPage`, `MenuTemplateEditorPage` | Sửa `AiWeekComposer` demo | Màn demo không nối BE, contract khác |
| Thay một món | Chế độ trong cùng modal tuần | Nút trên từng ô `MealPlanGrid` | Không sửa lưới dùng chung; ít đụng code |
| Dữ liệu điểm/bảng kiểm | Hiển thị nguyên BE trả | Tính lại ở FE | Nguyên tắc 2: FE không tính nghiệp vụ |

## Phases
### Phase 1 — Service + 2 màn + test
- Files: C `src/services/menuAiDraftApi.js`, `src/utils/menu-planning/menuAiDraft.js`, `src/components/menu-planning/{MenuAiDraftResult,MenuAiWeekModal,MenuAiDailyModal}.jsx`, `tests/menu/menu-ai-draft.test.mjs` · M `WeeklyPlanPage.jsx`, `MenuTemplateEditorPage.jsx`, `menuPlanningConstants.js`, `integrationModules.js`, `package.json` (thêm test vào `test:menu` nếu cần), CSS module.
- Tests: AC-1..AC-6 → `tests/menu/menu-ai-draft.test.mjs` (api với client giả, hàm thuần, nguồn trang).
- Exit: `node scripts/verify.mjs` PASS.

## Test matrix
| AC | Test | Kết quả |
| --- | --- | --- |
| AC-1, AC-2, AC-4, AC-5 | `tests/menu/menu-ai-draft.test.mjs` | pass |
| AC-3, AC-6 | `tests/menu/menu-ai-draft.test.mjs` (đọc nguồn trang) | pass |

## Rủi ro & rollback
| Rủi ro | Tác động | Giảm thiểu | Rollback |
| --- | --- | --- | --- |
| BE `dev` chưa có route | Gọi thật 404 khi build nối BE | Khai `pending`; chỉ bật khi BE merge | Ẩn nút (bỏ import) |
| Gọi đồng bộ tới ~30s | Người dùng tưởng treo | `AiWorkingOverlay`, chặn bấm lặp | — |

## Validation log
- 2026-11-10: route/DTO đối chiếu contract BE; không placeholder; >8 file nhưng 1 phase.

## Progress log
### 2026-11-10 — Phase 1 (đang làm)
- Tạo nhánh + worktree theo user; viết plan.
- Code: `menuAiDraftApi.js` (theo mẫu `mealPlanApi.js` ở gốc `services/`, không facade mock vì module chỉ có BE thật), `utils/menu-planning/menuAiDraft.js`, `MenuAiDraftResult`, `MenuAiWeekModal` (cả tuần + thay một món), `MenuAiDailyModal`; nút "AI gợi ý" ở `WeeklyPlanPage`, "AI gợi ý ngày" ở `MenuTemplateEditorPage` (chỉ khi sửa được); hằng `MENU_AI_*`; module `menu-ai` (nguồn `api`, 5 lời gọi `pending` vì route chỉ có ở nhánh BE AI). Màn demo cũ (`AiWeekComposer`, `AiTemplateComposer`, `WeeklyMenuPage`) giữ nguyên.
- Quyết định agent (chờ soát): đóng modal hoặc "Gợi ý lại" khi nháp còn chờ duyệt ⇒ gọi `dismiss` (BE đo đúng tỉ lệ dùng/bỏ); "Dùng" tuần khóa khi màn còn thay đổi chưa lưu; sau khi dùng nạp lại kế hoạch tuần từ BE.
- Cài phụ thuộc: `npm ci` lỗi `ERESOLVE` ⇒ dùng `npm ci --legacy-peer-deps` theo README (incident FE-ENV-261009 đã ghi).
- Verify lần 1 FAIL: `ui-table-standard` (bảng mới thiếu `table--grid`) ⇒ sửa; lần 2 FAIL: Prettier 2 file ⇒ format. Verify sau lần sửa cuối: `VERIFY PASS full`. Chưa mở trình duyệt chạy với BE thật (BE `dev` chưa có route); chưa commit.
- 2026-11-11 — User thử localhost 10/11: tuần Nhà trẻ không ghép được thực đơn đạt định mức nên màn chỉ hiện lỗi, không có món ("gợi ý món ăn mà"). BE đổi: tuần/mẫu ngày chưa đạt vẫn trả lưới món theo quy tắc, thêm `feasible` (contract BE `specs/014-boarding-menu-ai/contracts/menu-ai-drafts.md`). FE: `isUnmetDraft`, cảnh báo trong `MenuAiDraftResult`, nhãn nút và toast trong `MenuAiWeekModal`; mẫu ngày dùng chung cảnh báo, nút điền giữ nguyên. Thêm test AC-7.
- 2026-11-11 — User duyệt thiết kế hộp thoại gợi ý tuần dạng bảng 7:3 (spec BE `docs/superpowers/specs/2026-11-11-menu-ai-week-editor-design.md`). Code: `utils/menu-planning/menuAiDraftGrid.js` (hàm thuần lưới), `hooks/menu-planning/useMenuAiDraftEditor.js` (lưới đang sửa, hoàn tác, chấm lại sau 400ms, chỉ nhận kết quả mới nhất), `MenuAiDraftGrid` (bảng như sổ thực đơn tuần, dùng cho cả chế độ chỉ xem), `MenuAiDishPalette` (cột món ứng viên của BE, tìm/lọc, nhãn hợp mùa/đã nấu/kho khô hết), `MenuAiWeekEditor` (DndContext `@dnd-kit/core`, thanh điểm + 4 tiêu chí, bảng kiểm gập); `MenuAiWeekModal` cỡ `full` mới, hỏi xác nhận khi bỏ bản đã sửa, khóa "Dùng" khi đang chấm hoặc chấm lỗi; `menuAiDraftApi` thêm `getCandidates`, `evaluateDraft`, `applyDraft(id, grid)`; khai thêm 2 lời gọi pending. AC thêm: AC-8 bảng theo cột ngày/hàng ô; AC-9 thay món, đổi chỗ cùng hàng, luật thả, gửi lưới đã sửa; AC-10 số ngày chưa đạt và cột món theo ô đang chọn.
- Quyết định agent (chờ soát), khác spec: (a) màn dưới 1100px cột món xuống dưới bảng thay vì ngăn trượt (đơn giản hơn, vẫn dùng được cách chọn ô rồi bấm món); (b) kéo thả chỉ bật cho chuột và bàn phím (`MouseSensor`, `KeyboardSensor`), màn cảm ứng dùng cách chọn ô rồi bấm món, không theo ngưỡng 768px; (c) mẫu ngày và thay một món dùng `MenuAiDraftGrid` chỉ xem, kcal chỉ hiện ở gợi ý tuần (nơi có danh mục món của trang).
- 2026-11-11 — Tiếp phiên bị ngắt (user: "tiếp tục xử lý luồng AI"): icon kéo thả ở cột món đổi sang 6 chấm (`GripVertical`) theo ý user; hàng "Cả ngày" của bảng gợi ý thay câu lỗi dài bằng `DaySummary` (năng lượng thực tế / định mức, mỗi chỉ số chặn đang lệch một dòng có mũi tên; `daySummary` trong `menuAiDraftGrid.js` chỉ đọc `status` BE trả, bỏ dòng tùy chọn); dưới bảng hiện câu của tiêu chí BE `KCAL_REACH` (`dataLimitNote`) khi món ứng viên không thể tới định mức năng lượng. Test `menu-ai-draft.test.mjs` 15/15; `node scripts/verify.mjs` sau lần sửa cuối: `VERIFY PASS full`. Thử trên localhost (FE 5180 → BE nhánh AI 8095, tuần 16/11 Nhà trẻ, AI tắt): hàng "Cả ngày" và dòng giới hạn 534 kcal < 600 hiện đúng. Chưa thử: "Dùng cho tuần" trên trình duyệt, đổi chỗ hai ô bằng kéo, bàn phím, màn hẹp. Chưa commit.
- 2026-11-11 — User xem bản 5180 góp ý 3 lỗi UI. Đã sửa: (1) cột nhãn hàng của bảng gợi ý rộng 128px và cho xuống dòng (nhãn "Món bữa chiều" tràn sang cột thứ Hai); (2) bỏ ô "Cả ngày" dồn chữ, thay bằng dải "Dinh dưỡng cả ngày so với định mức" — mỗi chỉ số một hàng (năng lượng, đạm, béo, bột đường luôn có; hàng gam chỉ khi có ngày lệch; vi chất không vào), nhãn hàng ghi mức cần, ô ghi số thực tế + chữ Đạt/Thấp/Cao/Thiếu/Thừa (`nutritionRows` thay `daySummary` trong `menuAiDraftGrid.js`; hàng gam lọc theo trạng thái lệch, không theo cờ `optional` vì BE vẫn chặn khi đã đặt định mức gam); (3) bảng kiểm: cột nhãn trạng thái rộng cố định 92px (`.td-checks`) để chữ thẳng một lề. Chưa làm: bộ icon thay món / thông tin / xóa trên thẻ món — thuộc `MealPlanGrid` + `DishInfoModal` của `origin/dev` (nhánh này thiếu 25 commit), cần merge `dev` (tạo commit) nên chờ user cho phép. Thử trên localhost 5180: nhãn không tràn, 7 hàng dinh dưỡng đúng số BE, 24 dòng bảng kiểm cùng một lề trái.
- 2026-11-11 — User: "cho modal to hơn 1 chút". `.modal--full` (chỉ hộp gợi ý tuần dùng): rộng tối đa 1680px thay 1400px, lề quanh hộp 12px thay 24px, cao tối đa theo lề mới. Thử ở khung 1690×943: hộp gần kín màn hình, tên món nằm một dòng.
- 2026-11-12 — User hỏi lại bộ icon thay món / thông tin. Không merge `dev` (chưa được phép commit); lấy đúng phần cần từ `origin/dev` để sau này merge không lệch: `DishInfoModal.jsx` (nguyên bản), 1 dòng `foodName` trong `nutritionCatalogApi.js` (giống `dev`), CSS `.icon-action`, `.td-dish__actions`, `.td-dish-info*` chép tạm trong `menu-planning.css` (có `TODO(merge dev)` — xóa khi merge). Ô món của bảng gợi ý: tên món một dòng, dòng dưới kcal + icon thay món (chọn ô để lấy món ở cột bên phải; chỉ khi sửa được) + icon thông tin (mở `DishInfoModal`). Không có icon xóa: mỗi ô gợi ý phải có đúng một món. Tên món là tay kéo/nút chọn ô, icon nằm ngoài nút đó (không lồng nút). Thử localhost 5180: 30 icon thay + 30 icon thông tin; bấm thay ⇒ ô được chọn, cột món lọc 7 món cùng loại; bấm thông tin ⇒ hộp định lượng theo nhóm tuổi. Chưa thử lại kéo thả bằng chuột sau khi đổi cấu trúc thẻ, và tên thực phẩm trong hộp thông tin sau dòng `foodName`.
- 2026-11-12 — Verify lần 1 sau dòng `foodName`: `VERIFY FAIL` 2 test `nutrition-catalog-api.test.mjs` (mong `ingredients` không có `foodName`) ⇒ sửa 2 assert giống `origin/dev`. Verify sau lần sửa cuối: `VERIFY PASS full`. Chưa commit.
- 2026-11-13 — User: "tiếp tục làm đi" ⇒ merge `origin/dev` (`91d0ac6`) vào nhánh. Xung đột: `icons.js` (lấy `dev`: `DragHandle` = 6 chấm, cột món AI dùng `DragHandle` thay `GripVertical`), `WeeklyPlanPage.jsx` (giữ cả nút/hộp AI và Sửa ngày/Chép ngày của `dev`), `components.css` (lấy `.modal--full` kín khung của `dev`, bỏ bản 1680px). Xóa khối CSS chép tạm `TODO(merge dev)`. Cổng design mới của `dev` chặn file AI ⇒ nút `.btn` và ô nhập chuyển sang `Button`/`TextField`/`SelectField`; `.table.td-aig` đổi `.td-week.td-aig`; 3 chỗ 2px dùng token. Quyết định agent (chờ soát): ghi baseline `rawButton` 3 + 3 và `rawTable` 1 cho `MenuAiDishPalette`/`MenuAiDraftGrid` (chip lọc, thẻ món kéo thả, nút chọn ô, 2 `icon-action`, bảng lưới) vì chưa có component chung, cùng mức `MealPlanGrid` trên `dev`; `--update` hạ thêm vài mục cũ đã giảm. Test AC-3 đổi assert `<button` thành `<Button`. Verify lần 1 FAIL (cổng design), lần 2 FAIL (assert AC-3), sau lần sửa cuối: `VERIFY PASS full`. Chưa thử trình duyệt sau merge: DB thử `carenest_ai` nằm trong container đã dừng, cổng 5432 đang do stack khác dùng.
