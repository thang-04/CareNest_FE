---
title: Bố cục màn thực đơn — hàng riêng cho thay đổi dị ứng, Thực đơn tuần tóm tắt đầu cột
status: done
owner: carenestg94@gmail.com
jira: none
branch: dev
modules: []
rules: []
risk: medium
created: 2026-10-20
updated: 2026-10-20
---
# Bố cục màn thực đơn — hàng riêng cho thay đổi dị ứng, Thực đơn tuần tóm tắt đầu cột

## Context
User 2026-10-20: "ở các màn thực đơn, thay đổi vẫn để 1 hàng riêng chứ không để luôn" + đề xuất bố cục mới cho Thực đơn tuần. Rà trình duyệt (PHT, 1440px, mock :5173):
- Bảng tuần nhét khối "Thay đổi cho trẻ dị ứng" vào trong ô món ⇒ ô cao gấp 3–4, các ngày lệch nhau: `PublishedMenuPage.jsx:181-189` (Thực đơn đã công bố, xem tuần), `KitchenFlowPage.jsx:346-350` (thực đơn trong ngày ở Quy trình bếp). Xem theo ngày đã là hàng riêng (`PublishedMenuPage.jsx:100-110`) — làm chuẩn.
- Thực đơn tuần: ghi chú dị ứng lặp dưới từng món (`WeekGrid.jsx:135-139`); form Thực đơn mẫu ghi chú nằm cạnh tên món (`MenuFormPage.jsx:172,330`).
- Thực đơn tuần (`WeeklyMenuPage.jsx:206-267`): 2 ô chọn + 3 nút dồn vào `.page__head`, mà `.page__head` ≥1024px đặt con cuối lên hàng breadcrumb (plan `2026-10-20-ui-feedback-docx` Phase 1 bổ sung) ⇒ bản nháp che crumb còn "Thực đơn tu…". Kcal/tiền ăn/đánh giá từng ngày chỉ có ở bảng cân đối cuối trang (`WeekBalanceTable.jsx:62-97`); "Cần xem lại" (`WeeklyMenuPage.jsx:381-447`) trùng ý cột "Đánh giá". × và "+ Thêm" luôn hiện ở mọi ô (`WeekGrid.jsx:141-180`).

## Quyết định đã chốt
1. "Thay đổi" = khối thay đổi/suất thay thế cho trẻ dị ứng ⇒ tách thành hàng riêng trong bảng, không để trong ô món — user, 2026-10-20.
2. Thực đơn tuần theo hướng "Tóm tắt ở đầu cột": thanh công cụ hàng riêng (tab nhóm tuổi, ‹ tuần ›, nút hành động phải); đầu cột ngày có kcal, tiền ăn, chip đánh giá; dị ứng thành hàng riêng; "Cần xem lại" + "Cân đối" gộp 2 tab — user, 2026-10-20.
3. Phạm vi cả nhóm Thực đơn — user, 2026-10-20 (Phase 3 liệt kê màn cụ thể).

## Làm rõ nghiệp vụ
- **Hiểu nghiệp vụ:** chỉ đổi trình bày. Actor/quyền giữ nguyên (PHT soạn/xuất bản, HT chỉ xem, bếp xem đã công bố). Không đổi service/mock/contract.
- **Đối chiếu thiết kế ban đầu:** plan `2026-10-08-ui-redesign-design-system-v2` giữ thực đơn tuần M1 "lưới ngày × bữa" — vẫn giữ, chỉ thêm tóm tắt đầu cột và hàng dị ứng.
- **Ảnh hưởng:** FE `/menu/weekly`, `/menu/menus/:id/edit`, `/menu/menus/new`, `/kitchen/published-menu` (xem tuần), `/kitchen` (thực đơn trong ngày), xem trước bản AI soạn tuần (`AiWeekComposer` dùng `WeekGrid`). Số kcal/tiền/đánh giá đầu cột lấy đúng hàm đang dùng ở bảng cân đối (`mealsTotals`, `compareToNorm`, `checkDayMenu`), không thêm phép tính mới.

### Câu hỏi mở
(không còn)

## Acceptance criteria
- **AC-1**: Given bảng tuần ở Thực đơn đã công bố và thực đơn trong ngày ở Quy trình bếp, When có thay đổi dị ứng, Then khối "Thay đổi cho trẻ dị ứng" nằm ở hàng riêng ngay dưới hàng bữa đó (mỗi ngày/nhóm một ô), ô món chỉ còn tên món; hàng không xuất hiện khi bữa đó không có thay đổi.
- **AC-2**: Given Thực đơn tuần và xem trước bản AI, When món có chất mà nhóm có trẻ dị ứng, Then ghi chú nằm ở hàng "Dị ứng" cuối mỗi bữa (ghép theo ngày), không nằm dưới tên món; form Thực đơn mẫu đưa ghi chú xuống dòng phụ dưới món.
- **AC-3**: Given Thực đơn tuần ≥1024px, When mở bản nháp hoặc đã xuất bản, Then crumb cuối không bị che; tab nhóm tuổi, ‹ tuần ›, "Tuần này" và nút hành động nằm ở một hàng riêng dưới đầu trang; đổi nhóm/tuần vẫn ghi lên URL (`?ag=&week=`).
- **AC-4**: Given ngày có món, Then đầu cột hiện kcal, tiền ăn, chip đánh giá cùng giá trị và màu với bảng cân đối; ngày nghỉ/chưa có thực đơn hiện "Nghỉ"/"Chưa có thực đơn".
- **AC-5**: Given bản nháp, Then × và "+ Thêm" chỉ hiện khi rê chuột hoặc focus bàn phím vào ô (ô trống luôn hiện "+ Thêm"); dưới bảng có 2 tab "Cần xem lại (n)" và "Cân đối dinh dưỡng", nút "AI gợi ý cách sửa" ở tab đầu.
- **AC-6**: `node scripts/verify.mjs` → `VERIFY PASS full`, skip 0; ảnh chụp trước/sau 1440px và 1024px không vỡ bố cục, 0 lỗi console.

## Key decisions
| Quyết định | Chọn | Phương án khác | Vì sao |
| --- | --- | --- | --- |
| Hàng dị ứng ở Thực đơn tuần | 1 hàng cuối mỗi bữa | 1 hàng chung cuối bảng | Gần món gây dị ứng, vẫn bỏ được ghi chú khỏi ô |
| Số liệu đầu cột | Tách hàm `daySummary` dùng chung với `WeekBalanceTable` | Tính lại trong `WeekGrid` | Một nguồn số, đầu cột và bảng cân đối luôn khớp |
| Hàng thao tác Thực đơn tuần | Thanh công cụ trong thân trang, `.page__head` chỉ còn mô tả + chip | Sửa `.page__head` chung | `.page__head` thuộc plan ui-feedback-docx, tránh sửa chung |

## Phases
### Phase 1 — Hàng riêng cho thay đổi dị ứng (AC-1, AC-2)
- Files: M `src/pages/kitchen/PublishedMenuPage.jsx` (`WeekTable`), M `src/pages/kitchen/KitchenFlowPage.jsx`, M `src/styles/modules/kitchen.css` (khối gọn trong hàng), M `src/components/menu-planning/WeekGrid.jsx`, M `src/pages/menu-planning/MenuFormPage.jsx`, M `src/styles/modules/menu-planning.css`; C test `tests/menu/allergy-row-layout.test.mjs`.
- Steps: 1. Test RED: hàm chia hàng (`weekRows` thêm hàng dị ứng theo bữa; dữ liệu ghi chú theo ngày) + rà nguồn không còn `AllergyMenuChanges`/`td-week__allergy` trong ô món. 2. `WeekTable`/`KitchenFlowPage`: sau mỗi hàng bữa có thay đổi, thêm `<tr className="kb-tr--allergy">` nhãn "Thay đổi cho trẻ dị ứng", mỗi ô ngày một `AllergyMenuChanges`. 3. `WeekGrid`: hàng "Dị ứng" cuối mỗi bữa. 4. `MenuFormPage`: ghi chú xuống dòng phụ. 5. Chụp trước/sau.
- Exit: `node scripts/verify.mjs` → `VERIFY PASS full`, skip 0. **Dừng chờ user review.**

### Phase 2 — Thực đơn tuần: thanh công cụ + tóm tắt đầu cột + tab (AC-3, AC-4, AC-5)
- Files: M `src/pages/menu-planning/WeeklyMenuPage.jsx`, M `src/components/menu-planning/WeekGrid.jsx`, M `src/components/menu-planning/WeekBalanceTable.jsx`, C `src/utils/menu-planning/daySummary.js`, M `src/styles/modules/menu-planning.css`; M `tests/menu/weekly-page.test.mjs`.
- Steps: 1. Test RED cho `daySummary` (giá trị khớp `WeekBalanceTable`, ngày nghỉ/trống). 2. Thanh công cụ: `.tabs--pill` nhóm tuổi, nút ‹ › + chọn tuần + "Tuần này", nút hành động phải; `.page__head` còn mô tả + chip trạng thái/phiên bản. 3. Đầu cột ngày: chọn mẫu, "Nghỉ", tóm tắt. 4. × / "+ Thêm" hiện khi `:hover`/`:focus-within`. 5. 2 tab dưới bảng (`.tabs`, `role="tablist"`). 6. Chụp 1440/1024, PHT bản nháp + đã xuất bản, HT chỉ xem.
- Exit: như Phase 1. **Dừng chờ user review.**

### Phase 3 — Đồng bộ các màn còn lại trong nhóm Thực đơn
- Màn: Cân đối dinh dưỡng (`NutritionBalancePage`, đã có thẻ ngày ⇒ dùng chung `daySummary` + thanh chọn nhóm tuổi/tuần kiểu Phase 2), Gợi ý AI cũ (`AiMenuSuggestionPage`, nếu còn chọn nhóm/tuần), xem trước bản AI (`AiWeekComposer`, kiểm lại sau Phase 1–2). Thực đơn mẫu, Món ăn, Thực phẩm, Thực đơn thay thế, Giá suất ăn đã có thanh lọc trong thẻ ⇒ chỉ rà, không đổi nếu đã khớp.
- Không đụng thanh lọc `PublishedMenuPage.jsx:235-249` (thuộc plan ui-feedback-docx Phase 4).
- Exit: như Phase 1; cập nhật `DESIGN.md` mục bảng tuần (hàng dị ứng riêng, tóm tắt đầu cột) + `node scripts/check-ai-layer.mjs`. **Dừng chờ user review.**

## Test matrix
| AC | Rule | Test (tầng) | Phase | Kết quả |
| --- | --- | --- | --- | --- |
| AC-1, AC-2 | — | `tests/menu/allergy-row-layout.test.mjs` (unit + rà nguồn), ảnh chụp | 1 | pass |
| AC-3–AC-5 | — | `tests/menu/weekly-page.test.mjs` (`daySummary`), ảnh chụp | 2 | pass |
| AC-6 | — | `node scripts/verify.mjs`, ảnh chụp | 1–3 | pass |

## Rủi ro & rollback
| Rủi ro | Tác động | Giảm thiểu | Rollback |
| --- | --- | --- | --- |
| Plan `2026-10-20-ui-feedback-docx` (đang làm) sửa `.page__head`, bảng, thanh lọc `PublishedMenuPage` | Xung đột cùng file | Không sửa `components.css`/`.page__head`; ở `PublishedMenuPage` chỉ sửa `WeekTable`; báo session kia trước khi sửa | Revert theo phase |
| Plan `2026-10-20-style-sync-by-flow` Phase 6 (Thực đơn + Bếp) chưa bắt đầu | Rà lại các file này sau | Ghi vào Progress log plan đó khi xong | — |
| Hàng dị ứng làm bảng dài thêm khi nhiều bữa có thay đổi | Cuộn nhiều | Khối gọn (1 dòng/thay món, nút "N trẻ / M lớp") | Revert class |
| Ẩn × / "+ Thêm" làm khó thấy thao tác | Người soạn không biết sửa được | Hiện khi focus bàn phím; ô trống luôn hiện | Bỏ rule CSS ẩn |

## Validation log
- [x] Khẳng định về code có `file:line`
- [x] Không đổi contract BE
- [x] Mỗi AC có test hoặc ảnh chụp; mỗi phase có Exit = `node scripts/verify.mjs` → `VERIFY PASS full`
- [x] ~13 file, 3 phase độc lập theo màn ⇒ dừng được sau từng phase; không tách plan
- [x] Không dùng rule PENDING/OPEN
- [x] Tự review: không placeholder · không mâu thuẫn

## Progress log
### 2026-10-20 — Duyệt
- Nguồn: user "duyệt /goal" ⇒ làm liền 3 phase.
- Khác plan: không dừng review giữa phase (user yêu cầu chạy tới đích); vẫn verify + ghi log từng phase.
- Commit: chưa commit. Verify: `VERIFY PASS full | npm run verify | log verify.log` (trước khi sửa source).
- Tiếp: Phase 1.

### 2026-10-20 — Phase 1 (done)
- Đã làm: tách hàm bảng tuần sang `src/utils/menu-planning/weekGridLayout.js` (`weekRows`, `withAllergyRows`, `dayAllergyNotes`); Thực đơn tuần có hàng "Dị ứng" cuối mỗi bữa (ghi chú "Món: N trẻ X → món thay", thiếu suất thay thế tô đỏ); Thực đơn đã công bố (xem tuần) và "Thực đơn trong ngày" ở Quy trình bếp có hàng "Thay đổi cho trẻ dị ứng" dưới bữa/nhóm tuổi, `AllergyMenuChanges compact` bỏ tiêu đề và khung; form Thực đơn mẫu ghi chú xuống dòng phụ dưới món (thêm "· chưa có suất thay thế" cho rõ như Thực đơn tuần).
- Test RED trước: `tests/menu/allergy-row-layout.test.mjs` (3 test, fail vì chưa có module) → pass.
- Kiểm (agent-browser, PHT, 1440px, mock :5173): `/menu/weekly` tuần 26/10, `/kitchen/published-menu?view=week`, `/kitchen` (1 hàng dị ứng, 0 ô món chứa khối thay đổi), `/menu/menus/mn_mgn_3/edit`.
- Verify: `node scripts/verify.mjs` → `VERIFY PASS full | npm run verify | log verify.log`.
- Commit: chưa commit.
- Tiếp: Phase 2.

### 2026-10-20 — Phase 2 (done)
- Đã làm: `src/utils/menu-planning/daySummary.js` (`daySummary`, `fmtNum`) dùng chung cho đầu cột `WeekGrid` (kcal tô màu thấp/cao, tiền ăn, chip đánh giá; "Chưa có thực đơn" khi trống) và `WeekBalanceTable`. `WeeklyMenuPage`: hàng 1 tab nhóm tuổi (`.tabs--pill`) + ‹ chọn tuần › + "Tuần này"; hàng 2 chip trạng thái/phiên bản (trái) + nút thao tác (phải); `.page__head` chỉ còn mô tả nên crumb không bị che. "Cần xem lại (n ngày)" và "Cân đối dinh dưỡng" thành 2 tab của một thẻ, nút "AI gợi ý cách sửa" chỉ ở tab đầu. × / "+ Thêm" ẩn tới khi rê chuột hoặc focus (`@media (hover: hover)`, ô trống luôn hiện).
- **Khác plan:** nút thao tác chuyển sang hàng 2 cùng chip trạng thái (để chung hàng 1 thì 1440px bị rớt dòng lẻ).
- Test RED trước: `tests/menu/weekly-page.test.mjs` thêm 1 test `daySummary` (fail vì chưa có module) → pass; menu 66/66.
- Kiểm (agent-browser, mock :5173): PHT 1440px bản nháp 26/10 (MG nhỡ) + tab Cân đối + đã xuất bản 19/10 (Nhà trẻ); focus bàn phím vào × ⇒ opacity 1; HT 1024px chỉ xem (chip "Chỉ xem"), trang không cuộn ngang (1024/1024), bảng cuộn trong `.table-wrap`. 0 lỗi console.
- Verify: `node scripts/verify.mjs` → `VERIFY PASS full | npm run verify | log verify.log`.
- Commit: chưa commit.
- Tiếp: Phase 3.

### 2026-10-20 — Phase 3 (done)
- Đã làm: Cân đối dinh dưỡng (`NutritionBalancePage`): bỏ thẻ lọc, dùng thanh `.td-week-toolbar` (tab nhóm tuổi "Tất cả" + 4 nhóm, chọn thực đơn tuần) và hàng trạng thái như Thực đơn tuần; thẻ ngày lấy số từ `daySummary` (ngày đang sửa tính theo món chưa lưu), thêm dòng "Tiền ăn", ngày trống hiện "Chưa có thực đơn"; bỏ 3 inline style tĩnh. Xem trước "AI soạn tuần" dùng `WeekGrid` nên tự có tóm tắt đầu cột + hàng dị ứng (kiểm: 1 hàng dị ứng, 5 tóm tắt). `DESIGN.md` §8.1 thêm công thức "Bảng tuần (thực đơn)".
- Rà, không đổi: Gợi ý AI cũ (nhóm tuổi/tuần là ô form, không phải thanh lọc); Thực đơn mẫu, Món ăn, Thực phẩm, Thực đơn thay thế, Giá suất ăn đã có thanh lọc trong thẻ.
- Kiểm (agent-browser, PHT 1440px, mock :5173): `/menu/nutrition`, modal AI soạn tuần tuần 26/10. 0 lỗi console.
- Verify: `node scripts/verify.mjs` → `VERIFY PASS full | npm run verify | log verify.log`; `check-ai-layer` 0 lỗi.
- Commit: chưa commit.

### 2026-10-20 — Bổ sung: Thực đơn tuần "lưới gom theo bữa" (done)
- Nguồn: user thấy màn vẫn khó nhìn; xem 3 phương án (artifact "Phương án Thực đơn tuần"), chọn "A kèm thanh định mức của C", cùng bố cục cho mọi vai trò.
- Đã làm: `weekSections` (dải tiêu đề từng bữa; bữa trưa tách loại món; bản chỉ xem ẩn loại món cả tuần không dùng), `groupIssues` (gom lưu ý trùng nội dung + các ngày); `WeekGrid` đầu cột chỉ còn mẫu, nhãn "Đạt"/"N lưu ý" (bấm mở chi tiết) và ô Nghỉ; dị ứng gom 1 hàng "Suất dị ứng" cuối bảng (bỏ hàng dị ứng theo bữa); `DayNormDetail` (Modal: thanh năng lượng, đạm/béo/bột %, tiền ăn so định mức + lưu ý của ngày); `WeeklyMenuPage` thay 2 tab bằng khối "Cần sửa trước khi xuất bản"/"Lưu ý trong tuần" gom theo vấn đề, chip ngày bấm mở chi tiết, bảng cân đối thu gọn trong `<details>`, gợi ý AI hiện riêng theo ngày.
- **Khác plan:** bỏ hàng dị ứng theo từng bữa (Phase 1) và tóm tắt kcal·tiền đầu cột (Phase 2) theo lựa chọn mới của user.
- Test RED trước: `tests/menu/allergy-row-layout.test.mjs` thay test hàng dị ứng theo bữa bằng `weekSections` + `groupIssues` (fail vì chưa có hàm) → pass; menu 67/67.
- Kiểm (agent-browser, PHT 1440px, mock :5173): bản nháp MG nhỡ 26/10, đã xuất bản Nhà trẻ 19/10 (ẩn 3 hàng trống), modal chi tiết ngày; 1024px không cuộn ngang. 0 lỗi console.
