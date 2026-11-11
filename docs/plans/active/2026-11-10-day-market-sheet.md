---
title: Bảng đi chợ theo ngày (gộp Phiếu kê chợ + Bảng đi chợ của PMS)
status: approved
owner: thangnd
jira: G94-272 / FE-FIX-01
branch: fix/G94-272-FE-FIX-01-e2e-flow-fixes
modules: [kitchen]
rules: [NUT-07, NUT-11, NUT-18]
risk: medium
created: 2026-11-10
updated: 2026-11-10
---
# Bảng đi chợ theo ngày

## Context
- PMS có hai chứng từ theo ngày, có tiền: "Phiếu kê chợ" và "Bảng đi chợ" (user gửi ảnh 10/11). CareNest chỉ có số lượng theo tuần/kỳ:
  bản mẫu `src/pages/kitchen/WeeklyForecastPage.jsx:262` (hàng tươi theo ngày, đồ khô cần mua), bản nối BE
  `src/components/kitchen/FreshForecastDetail.jsx:52` (số trẻ theo nhóm tuổi, thực phẩm cần đặt).
- Mock đã tính lượng mua × đơn giá, thu, chi theo ngày ở `src/services/kitchen/mock/marketList.js:48` nhưng chưa màn nào hiện tiền.
- BE chưa có endpoint: bản dự trù BE chỉ lưu số lượng hàng tươi (`BE:docs/database/DATA_DICTIONARY.md` dòng `fresh_forecast_lines`).

## Quyết định đã chốt
1. Làm màn "Đi chợ theo ngày" với **một mẫu in gộp** theo "Bảng đi chợ", thêm nhóm Mua chợ / Xuất kho của "Phiếu kê chợ" — user, 2026-11-10.

## Làm rõ nghiệp vụ
- **Hiểu nghiệp vụ:** HT, PHT xem bảng đi chợ một ngày của một điểm trường; in, xuất Excel. Lượng theo NUT-07 (thực đơn đã công bố × số suất; ngày đã chốt dùng số chốt, chưa chốt dùng số dự trù), thải bỏ NUT-18, đồ khô xuất kho NUT-11.
- **Đối chiếu thiết kế ban đầu:** BE chỉ có bản dự trù hàng tươi theo kỳ, không có tiền. Yêu cầu thêm: đơn giá, thành tiền, chia nhóm tuổi, thu–chi ngày, thực đơn ngày.
- **Ảnh hưởng:** module kitchen (demo). `FE: /kitchen/market-day`. Không đổi dữ liệu cũ, không ghi gì.

### Câu hỏi mở
Không còn câu hỏi chặn. Giả định ghi ở Key decisions để user soát.

| Câu hỏi | Trả lời | Ai | Ngày | Rule/doc đã cập nhật |
| --- | --- | --- | --- | --- |
| Một mẫu in hay hai | Một mẫu gộp | thangnd | 2026-11-10 | plan này |

## Acceptance criteria
- **AC-1** (`NUT-07`): Given ngày học có thực đơn đã công bố · When mở Đi chợ theo ngày · Then mỗi thực phẩm có đơn vị, đơn giá, lượng xuất kho hoặc mua chợ, thành tiền; tổng chi = tổng thành tiền các dòng.
- **AC-2** (`NUT-07`): Then số lượng và tiền từng nhóm tuổi cộng lại đúng bằng dòng tổng của thực phẩm đó.
- **AC-3** (`NUT-11`): Then đồ khô nằm ở cột Xuất kho theo đơn vị kho; hàng tươi ở cột Mua chợ theo đơn vị mua.
- **AC-4** (`NUT-07`): Then có số suất, giá một suất từng nhóm, tổng thu, tổng chi, chênh lệch và thực đơn theo bữa; ngày chưa chốt ghi rõ "theo số dự trù".
- **AC-5**: Ngày nghỉ hoặc chưa có thực đơn ⇒ trạng thái trống có hướng dẫn; sai quyền điểm trường ⇒ 403.
- **AC-6**: In (A4 ngang) và Xuất Excel ra đúng các số trên màn.

## Key decisions
| Quyết định | Chọn | Phương án khác | Vì sao |
| --- | --- | --- | --- |
| Nơi tính | Mock repo (BE giả) `dayMarket.js`; giao diện chỉ hiển thị | Tính ở component | `AGENTS.md` bất biến 2 |
| Chia theo nhóm tuổi | Chia tổng đã làm tròn theo tỷ lệ lượng ăn từng nhóm, phần lẻ dồn nhóm cuối | Làm tròn riêng từng nhóm | Các nhóm cộng lại phải bằng tổng như mẫu PMS |
| Cột nhóm tuổi | Theo nhóm tuổi CareNest | Gộp Nhà trẻ / Mẫu giáo | Định lượng, giá suất đang theo nhóm tuổi (giả định, user soát) |
| "Số tiền hôm trước" cộng dồn | Chưa làm; chỉ thu, chi, chênh trong ngày | Cộng dồn như PMS | BE chưa có rule (giả định, user soát) |
| Đường dẫn | `/kitchen/market-day` (module `kitchen` demo ⇒ bản nối BE tự hiện nhãn "Dữ liệu demo") | Dưới `/kitchen/forecast` | Tiền tố forecast là module đã nối BE, sẽ mất nhãn demo |
| Chữ ký | Ba ô ký tay: Người đi chợ, Người giám sát, Người kiểm tra | Ảnh chữ ký | Chưa có yêu cầu ký số cho mẫu này |

Contract cần BE (đề xuất, chưa thống nhất): `GET /kitchen/day-market?campusId&date` trả
`{ campusId, date, status, basis, confirmedAt, groups[], lines[], totals, menu[], warnings[], campuses[] }` như mock.

## Phases
### Phase 1 — Mock + facade + màn + in + Excel
- Files: C `src/services/kitchen/mock/dayMarket.js` · C `src/pages/kitchen/DayMarketPage.jsx` · C `src/components/kitchen/DayMarketBlocks.jsx` · C `src/components/kitchen/DayMarketPrint.jsx` · C `tests/kitchen/day-market.test.mjs` · M `weeklyForecast.js`, `kitchenMockRepository.js`, `kitchenApi.js`, `kitchenService.js`, `useKitchen.js`, `kitchenExport.js`, `KitchenFilters.jsx`, `breadcrumbs.js`, `AppRoutes.jsx`, `WeeklyForecastPage.jsx`, `kitchen.css`
- Tests: AC-1..AC-5 → `tests/kitchen/day-market.test.mjs`; AC-6 → dòng Excel trong cùng file test + xem trên trình duyệt.
- Exit: `node scripts/verify.mjs` → `VERIFY PASS`.

## Test matrix
| AC | Rule | Test (tầng) | Phase | Kết quả |
| --- | --- | --- | --- | --- |
| AC-1..3 | NUT-07, NUT-11 | `day-market.test.mjs` (mock) | 1 | |
| AC-4..5 | NUT-07 | `day-market.test.mjs` (repo) | 1 | |
| AC-6 | — | `day-market.test.mjs` (dòng Excel) + trình duyệt | 1 | |

## Rủi ro & rollback
| Rủi ro | Tác động | Giảm thiểu | Rollback |
| --- | --- | --- | --- |
| Tách hàm trong `weeklyForecast.js` làm lệch dự trù tuần | Phiếu đặt hàng tuần sai | Giữ nguyên công thức, chạy `weekly-forecast.test.mjs` | Bỏ các file mới, hoàn `weeklyForecast.js` |
| Bản nối BE chỉ có dữ liệu mẫu | Người dùng nhầm là số thật | Nhãn "Dữ liệu demo" tự hiện theo module | — |

## Validation log
- [x] Khẳng định về code có `file:line`
- [x] Đổi contract ⇒ consumer cụ thể (chỉ màn `/kitchen/market-day`)
- [x] Mỗi AC có test; phase có Exit
- [x] >8 file: một phase vì các file phụ thuộc nhau, không tách được phần chạy độc lập
- [x] Không dùng rule PENDING/OPEN như đã chốt
- [x] Tự review

## Progress log
### 2026-11-10 — Lập plan
- User duyệt đề xuất trong chat ("Duyệt, một mẫu gộp"). Giả định: mã Jira theo nhánh hiện tại.

### 2026-11-10 — Phase 1 (chờ review)
- Commit: chưa commit
- Verify: `node scripts/verify.mjs` → `VERIFY PASS full | npm run verify | log verify.log`; `tests/kitchen/day-market.test.mjs` 7/7.
- Trình duyệt (bản mẫu, PHT Campus 1, 10/11/2026): bảng 4 nhóm tuổi, thu 5.320.000 đ, chi 3.574.800 đ, còn thừa 1.745.200 đ; xem trước in A4 ngang không tràn; console không lỗi. Chưa bấm tải file Excel/PDF thật.
- Khác plan:
  - `dayMarket.js` không import util của module menu-planning (ESLint chặn import chéo). Thay vào đó `computeMarket` trả thêm `meals[].dishes` và `foods[].stockUnitPrice` (`marketList.js`).
  - Chưa đụng `kitchen.css` (đủ class chung).
  - Thêm `docs/architecture/ROUTE_MAP.md` (route mới).
- Hạn chế:
  - Bản nối BE: route `/kitchen/market-day` có sẵn với dữ liệu mẫu + nhãn demo, nhưng chưa có nút vào (màn Bản dự trù hàng tươi của BE chưa gắn nút); chưa kiểm trên bản nối BE.
  - Màn rộng 1440 bảng thực phẩm 15 cột cuộn ngang trong thẻ (4 nhóm tuổi × 2 cột).
- 22:55 — user duyệt gắn nút: thêm nút "Đi chợ theo ngày" ở đầu trang Bản dự trù hàng tươi (`FreshForecastList.jsx`), không kèm `campusId` vì mã điểm trường BE khác dữ liệu mẫu. Verify lại `VERIFY PASS full`. 23:05 — đã xem trên bản nối BE (cổng 5181, tài khoản thử PHT): nút hiện ở Bản dự trù hàng tươi, mở màn đi chợ có nhãn "Dữ liệu demo", đủ bảng 4 nhóm tuổi; màn này không gọi BE.
- Tiếp: user soát giả định ở Key decisions; thống nhất contract `GET /kitchen/day-market` với BE.

### 2026-11-11 — Nối BE thật (user: "xử lý BE, không dùng demo")
- BE: endpoint mới `GET /nutrition/day-market?campusId&date` viết ở worktree `CareNest_BE-day-boarding` (nhánh `feature/G94-254-BE-FEAT-27-day-boarding`), plan `BE:docs/plans/active/2026-11-11-day-market-sheet.md` (giả định G1–G6 cần user soát). Chưa commit.
- FE: `freshGoodsApi.getDayMarket` + mapper `toDayMarket` (đổi lượng đơn vị gốc sang đơn vị mua, tiền giữ nguyên số BE), hook `useDayMarket` chuyển sang `useFreshGoods.js`, màn dùng `useStockCampus` (điểm trường trên URL); route `/kitchen/market-day` chuyển sang module `fresh-goods` (source `api`) ⇒ hết nhãn "Dữ liệu demo"; nút ở Bản dự trù kèm `?campusId=`. `docs/integration/be-api-routes.json` thêm tay `GET /nutrition/day-market` (BE chưa merge).
- Khác bản mẫu: đồ khô hiện theo đơn vị mua (BE không có đơn vị kho); chưa chốt suất ⇒ tính theo số trẻ đang học (BE không có bản dự trù tuần); BE không trả phần thừa thiếu khi còn nhóm chưa có giá tiền ăn ⇒ ẩn dòng đó; cảnh báo chỉ còn "nhóm chưa có giá tiền ăn".
- Còn lại của bản mẫu: `mock/dayMarket.js`, `kitchenService.getDayMarket`, `kitchenApi.getDayMarket` (`/kitchen/day-market`, BE không có) và `tests/kitchen/day-market.test.mjs` không còn màn nào dùng — chờ user quyết xóa.
- Verify: `node scripts/verify.mjs` → `VERIFY PASS full | npm run verify | log verify.log`; `check-ai-layer` 0 lỗi.
