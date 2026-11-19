---
title: Nhãn "Chỉ xem" và nút khóa có lý do (thiếu quyền, chưa đến hạn, quá hạn, đã khóa)
status: draft
owner: Thắng
jira: G94-378 / FE-FIX-08 (chờ user xác nhận hoặc tạo task riêng)
branch: fix/G94-378-FE-FIX-08-permission-gating
modules: [ui, menu-planning, kitchen, permissions, children]
rules: [AUTH-10, AUTH-20, NUT-11, NUT-17, CHD-11, CFG-YR-01]
risk: medium
created: 2026-11-19
updated: 2026-11-19
---
# Nhãn "Chỉ xem" và nút khóa có lý do

## Context

Hiện nay, khi người dùng thiếu quyền ghi, phần lớn màn **ẩn hẳn** nút. Người dùng không phân biệt được hai trường hợp: "không có quyền" và "màn này không có chức năng đó". Khi nút bị khóa do thời điểm, mỗi module tự viết câu và kiểu hiển thị riêng.

Hiện trạng code:
- **Có 3 kiểu thông báo chỉ xem khác nhau:**
  - Dải chữ của PHT chưa được giao mảng: `src/routes/RoleGuard.jsx:63-66`, class `.page-readonly-notice`.
  - Năm học đã kết thúc: `src/components/school-config/YearReadOnlyNotice.jsx`, dùng ở 5 file.
  - Chữ "Chỉ xem" riêng trong module thực đơn, dinh dưỡng, đánh giá.
- **Câu chữ khóa theo thời gian rải rác:** "Quá hạn — chờ Hiệu trưởng mở hạn.", "Đã khóa, không sửa", "Ngày đã chốt suất hoặc đã qua…".
- **Nút dùng `disabled` thật:** `src/components/ui/Button.jsx:30`. Nút disabled không nhận hover, không focus được, nên `title` không hiện và người dùng bàn phím không biết lý do. Đây chính là lỗi A-ST-1 (nút "Xác nhận" khóa không lý do) trong report rà quyền 15/11.
- **`PageHeader` và `ListPage` chưa có chỗ gắn nhãn trạng thái màn:** `src/components/ui/PageHeader.jsx:8`, `ListPage.jsx:10`.

## Quyết định đã chốt

1. **Hướng C, lai 2 tầng:** thiếu quyền cả màn thì đầu trang có nhãn "Chỉ xem", nút chính vẫn hiện nhưng khóa, nút trên từng dòng ẩn. Sai thời điểm thì luôn hiện nút khóa kèm lý do. (user, 19/11/2026)
2. **Nhãn "🔒 Chỉ xem" là chữ tĩnh, không bấm được.** Lý do nằm trong **tooltip của nút khóa**, mở được khi rê chuột, Tab tới hoặc chạm. (user chọn C ở mockup, 19/11/2026)
3. **Sai thời điểm hoặc trạng thái** hiển thị bằng **dòng chữ màu dưới tên mục**, ghi lý do đầy đủ và cách xử lý. Nút giữ nguyên tên hành động và bị khóa. (user chọn C ở mockup, 19/11/2026)
4. **Phạm vi:** dựng component chung, ghi luật vào `DESIGN.md`, rồi áp cho các màn của luồng G94-378 (thực đơn, kho/bán trú, phân quyền, duyệt hồ sơ trẻ). Module khác do chủ module tự áp sau theo luật mới. (user, 19/11/2026)
5. Quyết định này **thay vế "thiếu quyền ⇒ ẩn"** của rule gating đã chốt 15/11, nhưng chỉ cho **nút chính của màn**. Nút trên dòng và nút không áp dụng cho vai trò vẫn ẩn. (user, 19/11/2026)

## Làm rõ nghiệp vụ

- **Hiểu nghiệp vụ:**
  - Actor: HT, PHT, GV dùng Web.
  - Outcome: người dùng hiểu vì sao không thao tác được và cần làm gì tiếp.
  - Không đổi quyền hay rule nghiệp vụ nào: BE vẫn là nơi quyết định (`can*`, giờ khóa, hạn). Đây chỉ là đổi cách hiển thị.
- **Đối chiếu thiết kế ban đầu:**
  - `DESIGN.md` §9 chưa có trạng thái "chỉ xem" hay "khóa có lý do".
  - `UI_CARD.md` §2 luật 10 ghi "Ẩn nút theo quyền chỉ là UX". Luật này vẫn đúng: BE vẫn chặn.
- **Ảnh hưởng:**
  - Chỉ đổi FE. Đổi component chung: `Button`, `PageHeader`, `ListPage`, `RoleGuard`/`AreaGate`.
  - Màn áp: xem Phase 3.
  - Không đổi API. Chỗ nào BE chưa trả giờ hay mã lý do thì liệt kê thành đề xuất BE, FE không tự tính.

### Câu hỏi mở

- [ ] Dùng task Jira G94-378 hiện có hay tạo task con mới (ví dụ `[FE-FIX-08] readonly states`)?

| Câu hỏi | Trả lời | Ai | Ngày | Rule/doc đã cập nhật |
| --- | --- | --- | --- | --- |
| Hướng hiển thị | C, lai 2 tầng | user | 19/11 | `DESIGN.md` §9 (phase 2) |
| Lý do khi thiếu quyền | Nhãn tĩnh + tooltip nút | user | 19/11 | như trên |
| Lý do khi sai thời điểm | Dòng chữ màu dưới tên mục | user | 19/11 | như trên |
| Phạm vi | Luồng G94-378 | user | 19/11 | plan này |

## Acceptance criteria

- **AC-1:** Given PHT có quyền đọc nhưng không có quyền ghi ở một màn trong phạm vi. When mở màn. Then:
  - Đầu trang có "🔒 Chỉ xem" cạnh tiêu đề.
  - Nút chính hiện, khóa, có icon khóa.
  - Không có nút ghi trên từng dòng.
- **AC-2:** Given nút có `disabledReason`. When rê chuột, Tab tới hoặc chạm vào nút. Then:
  - Tooltip hiện lý do. Phần tử có `aria-disabled="true"` và `aria-describedby` trỏ tới lý do.
  - Bấm hoặc nhấn Enter không gọi handler. Esc đóng tooltip.
- **AC-3:** Given một mục có quyền nhưng chưa đến hạn, quá hạn hoặc đã khóa (theo dữ liệu BE). When hiện mục đó. Then:
  - Dưới tên mục có dòng `LockNote` đúng tông màu (⏳ xanh / ⚠ vàng / 🔒 xám), kèm chữ lý do và cách xử lý.
  - Nút giữ tên hành động, khóa với `disabledReason` ngắn.
- **AC-4:** Given `AreaGate` báo PHT chỉ xem mảng, hoặc năm học đã kết thúc. When mở màn. Then đầu trang hiện `ReadOnlyTag`, và dải chữ cũ (`.page-readonly-notice`, `YearReadOnlyNotice`) không còn ở các màn trong phạm vi.
- **AC-5:** Không có giờ, hạn hay lý do nào do UI tự tính. Chữ lấy từ cờ hoặc giá trị BE, map qua `models/<module>/*Constants.js`.
- **AC-6:** Ở 360px và 1440px không tràn ngang. Tooltip không bị cắt ở mép màn.

## Key decisions

| Quyết định | Chọn | Phương án khác | Vì sao |
| --- | --- | --- | --- |
| Khóa nút | `aria-disabled` + chặn click | `disabled` + `title` | `disabled` mất hover/focus, nên không hiện được lý do (A-ST-1) |
| Tooltip | Component nhẹ tự viết trong `components/ui` | Thư viện ngoài | Không thêm dependency (AGENTS.md › Hỏi trước khi làm) |
| Nhãn màn | Prop `readOnly` ở `PageHeader`/`ListPage` + context từ `AreaGate` | Mỗi page tự đặt | Một chỗ, đồng bộ mọi màn |
| Nút trên dòng khi thiếu quyền | Ẩn | Hiện khóa | Bảng gọn, tránh đầy nút xám (phương án B bị loại) |

## Phases

### Phase 1: Component chung (vùng dùng chung, in bản tác động trước khi sửa)

- **Files:**
  - C: `src/components/ui/Tooltip.jsx`, `src/components/ui/ReadOnlyTag.jsx`, `src/components/ui/LockNote.jsx`.
  - M: `src/components/ui/Button.jsx` (prop `disabledReason`), `PageHeader.jsx`, `ListPage.jsx` (prop `readOnly`), `src/components/index.js` (export), `src/styles/components.css` (`.btn--locked`, `.tooltip`, `.readonly-tag`, `.lock-note--notyet|overdue|locked`, chỉ dùng token semantic), trang `/ui-kit` (thêm mục mẫu).
- **Steps:**
  1. `Tooltip`: mở khi hover, focus hoặc chạm; Esc đóng; `role="tooltip"` + id cho `aria-describedby`; tự lật vị trí khi sát mép.
  2. `Button`: khi có `disabledReason` thì đặt `aria-disabled`, class `btn--locked`, icon `Lock`; chặn `onClick` và Enter/Space; bọc `Tooltip`. Prop `disabled` và `loading` giữ nguyên hành vi cũ.
  3. `ReadOnlyTag` + prop `readOnly` cho `PageHeader`/`ListPage`.
  4. `LockNote` với `kind` = `notYet`, `overdue` hoặc `locked`, cùng `children` là chữ.
  5. Thêm mục mẫu vào `/ui-kit`.
- **Tests:**
  - `npm run lint`, `node scripts/check-design.mjs`, build.
  - Trên trình duyệt: mở `/ui-kit`, Tab tới nút khóa thấy tooltip, Enter không chạy handler.
- **Exit:** lint, check-design và build pass, `/ui-kit` hiện đủ 4 component.
- **Dừng chờ user review.**

### Phase 2: Luật + nguồn chỉ xem chung

- **Files:**
  - M: `DESIGN.md` §9 (thêm 3 trạng thái), `docs/design/UI_CARD.md` (bảng §1 thêm 4 component, §2 thêm luật).
  - M: `src/routes/RoleGuard.jsx` (`AreaGate` đưa `readOnly` qua context thay cho dải chữ), `src/contexts/` (context nhỏ `PageReadOnlyContext` nếu cần).
  - M: các nơi dùng `YearReadOnlyNotice` nằm trong phạm vi.
- **Steps:**
  1. Ghi bảng tình huống (thiếu quyền cả màn / nút không áp dụng / sai thời điểm / năm đã kết thúc).
  2. `AreaGate` dùng context để đầu trang hiện `ReadOnlyTag`; bỏ `.page-readonly-notice`.
- **Tests:** test auth sẵn có (`npm run test:auth`); trên trình duyệt kiểm bằng PHT chưa được giao mảng thực đơn.
- **Exit:** lint, `test:auth` và build pass.
- **Dừng chờ user review.**

### Phase 3: Áp cho màn của luồng G94-378

| Nhóm | Màn | Việc |
| --- | --- | --- |
| Thực đơn | `/menu/foods`, `/dishes`, `/suppliers`, `/templates`, `/templates/new`, `/weekly`, `/setup` | `readOnly` + nút chính khóa (lý do "Bạn chỉ có quyền xem…"); bỏ chữ "Chỉ xem" riêng; `/templates/new` khi không có quyền thì bỏ panel dinh dưỡng thừa |
| Kho/bán trú | `/kitchen/stock-receipts` + chi tiết | Hủy phiếu `canCancel=false` thì `LockNote locked` "Không hủy được: thực phẩm đã xuất dùng" thay cho câu ghép trong note |
| Kho/bán trú | `/kitchen/forecast` | Điểm trường ngoài quyền thì `readOnly` + "Lập bản dự trù" khóa (cần cờ BE theo điểm trường, xem rủi ro) |
| Kho/bán trú | `/kitchen/fresh-receipts`, `/kitchen/inspections` | Biểu mẫu chưa có dòng thì `LockNote notYet` + nút khóa có lý do |
| Phân quyền | Ngoại lệ, lịch sử quyền | Thiếu `ACCOUNT_MANAGE` thì `readOnly` + nút khóa |
| Hồ sơ trẻ | Màn duyệt sửa hồ sơ; màn sửa có banner chờ duyệt | Chờ duyệt thì `LockNote locked` "Đang chờ duyệt yêu cầu gửi lúc…"; bị từ chối thì `LockNote overdue` kèm lý do (module của Giáp: báo trước khi sửa) |

- **Tests:**
  - `npm run test:menu`, `test:kitchen`, `test:auth`, `test:children`, lint, build, `check-api-contract`.
  - Trên trình duyệt với HT, PHT CS1, PHT CS2, GV.
- **Exit:** mọi lệnh trên pass. Ảnh chụp 1 màn mỗi nhóm.
- **Dừng chờ user review.**

## Test matrix

| AC | Test (tầng) | Phase | Kết quả |
| --- | --- | --- | --- |
| AC-2 | `/ui-kit` trên trình duyệt: hover/Tab/Enter/Esc | 1 | |
| AC-1, AC-4 | PHT CS2 ở `/menu/foods`, PHT chưa giao mảng (trình duyệt) | 2, 3 | |
| AC-3 | Phiếu nhập #4, biểu mẫu kiểm thực trống, màn sửa hồ sơ chờ duyệt (trình duyệt) | 3 | |
| AC-5 | Review code: grep các phép tính giờ trong page/component | 3 | |
| AC-6 | `resize_window` 360/1440 | 1, 3 | |

## Rủi ro & rollback

| Rủi ro | Tác động | Giảm thiểu | Rollback |
| --- | --- | --- | --- |
| Đổi `Button` dùng chung | Mọi màn | Prop mới chỉ có tác dụng khi truyền vào; `disabled` cũ giữ nguyên | Revert commit phase 1 |
| `/kitchen/forecast` không có cờ quyền theo điểm trường | Nút khóa sai điểm trường | Đề xuất BE trả `canManage` theo điểm trường; tạm thời giữ hành vi hiện tại (BE chặn 403) | Bỏ dòng này khỏi phase 3 |
| Module thuộc người khác (kho, hồ sơ trẻ) | Đụng code chủ module | In bản tác động, hỏi trước khi sửa (AGENTS.md › điểm dừng 3) | Bỏ màn đó khỏi phase 3 |

## Validation log

- [x] Khẳng định về code có `file:line`
- [x] Không đổi contract API
- [x] Mỗi AC có cách kiểm; mỗi phase có Exit
- [x] Không dùng rule PENDING/OPEN
- [ ] >8 file: plan có 3 phase, mỗi phase dừng review; có thể tách phase 3 thành plan riêng nếu user muốn

## Progress log

### 2026-11-19 — Spec (chờ user duyệt)

- Chốt hướng qua mockup: nhãn tĩnh + tooltip nút (thiếu quyền), dòng chữ màu dưới tên mục (sai thời điểm), phạm vi luồng G94-378.
- Chưa code, chưa commit.

### 2026-11-19 — Phase 1 (chờ review)

- Đã duyệt spec, user chọn làm phase 1. Bản tác động được in trước khi sửa: `Button` lan tới 68 màn, `PageHeader` lan tới 58 màn. Các prop mới mặc định tắt.
- Tạo mới:
  - `Tooltip`: mở khi hover, focus hoặc chạm; Esc đóng; chạm ra ngoài thì đóng; tự lật vị trí khi sát mép.
  - `ReadOnlyTag`.
  - `LockNote`: `notYet`, `overdue`, `locked`.
- Sửa:
  - `Button`: thêm `disabledReason` (dùng `aria-disabled`, chặn click và Enter/Space, kể cả nút submit).
  - `PageHeader` / `ListPage`: thêm `readOnly`.
  - CSS chung `.btn--locked`, `.tooltip`, `.readonly-tag`, `.lock-note--*`, chỉ dùng token.
  - Thêm mục `/ui-kit#locks`.
- Kết quả kiểm:
  - `npm run lint`: pass.
  - `node scripts/check-design.mjs`: ok, không vượt baseline.
  - `npm run build`: pass.
- Kiểm trên trình duyệt `/ui-kit#locks` (mock, hiệu trưởng demo):
  - Nhãn "Chỉ xem" hiện; 4 nút khóa có `aria-disabled`, icon khóa, `aria-describedby` trỏ đúng lý do.
  - Hover, click, Tab đều mở bóng chữ; click và Enter không chạy hành động; Esc đóng.
  - 3 màu `LockNote` đúng token (info / warning / muted).
  - Không tràn ngang; ở khung hẹp bóng chữ tự lật `tooltip--end`.
  - Lỗi tìm thấy và đã sửa: `.btn--locked` đè `box-shadow` nên nút khóa mất vòng focus. Đã thêm rule `:focus-visible` riêng; kiểm lại thì vòng focus hiện.
  - Chưa có ảnh chụp: pane trình duyệt bị ẩn nên không chụp được. Khung hẹp chỉ giả lập được 629px, chưa đúng 360px.
- Chưa commit.

### 19/11/2026 — Phase 2

- Tạo `src/contexts/PageReadOnlyContext.jsx`:
  - `PageReadOnlyContext` và `READ_ONLY_REASON`.
  - `usePageReadOnly()` trả `{ readOnly, reason }` và nhận việc hiện nhãn.
- `AreaGate` (`RoleGuard.jsx`) bọc màn chỉ xem bằng `ReadOnlyArea`:
  - Cấp context cho màn bên trong.
  - Dải chữ `.page-readonly-notice` chỉ còn làm dự phòng: màn nào đã gọi `usePageReadOnly()` (qua `PageHeader`/`ListPage` hoặc tự gọi) thì dải chữ ẩn.
  - Lý do: phần lớn màn trong `isVpReadOnlyPage` có đầu trang viết tay. Bỏ hẳn dải chữ thì các màn đó mất thông báo tới khi làm phase 3.
- `PageHeader` tự bật `readOnly` theo context.
- Luật:
  - `DESIGN.md` §9: thêm 3 dòng (chỉ xem cả màn / có quyền nhưng sai thời điểm / không áp dụng).
  - `UI_CARD.md` §1: thêm 4 dòng component.
  - `UI_CARD.md` §2: thêm luật 18.
- Không đụng `YearReadOnlyNotice`: chỉ dùng ở 4 màn school-config, ngoài luồng G94-378.
- Kết quả kiểm:
  - `npm run lint`: pass.
  - `npm run test:auth`: 98/98 pass.
  - `check-design`: ok.
  - `check-ai-layer`: 0 lỗi; 24 cảnh báo có sẵn từ trước, không phải từ file sửa lần này.
  - `npm run build`: pass.
- Chạy lại các cổng sau lần sửa cuối: lint, test:auth (98/98), check-design, check-ai-layer (0 lỗi) và build đều pass.
- Trình duyệt (mock): `/ui-kit#locks` vẫn hiện nhãn "Chỉ xem"; không có dải chữ thừa; không có lỗi console.
- Chưa kiểm luồng PHT chỉ xem thật: cần BE thật (`isVpReadOnlyPage` bỏ qua bản demo) và tài khoản PHT chưa được giao mảng thực đơn. Kiểm ở phase 3 khi bật BE.
- Lưu ý: màn có `PageHeader` nhưng đang tải (chưa hiện đầu trang) sẽ thấy dải chữ dự phòng chớp ngắn, rồi đổi sang nhãn khi tải xong.
- Chưa commit.

### 19/11/2026 — Phase 3

- `VIEW_ONLY_REASON`: lý do chung khi màn tự biết người dùng chỉ xem (cờ quyền BE), không qua AreaGate.
- Thực đơn:
  - Danh mục:
    - `FoodListPage`, `DishListPage`, `NutritionSetupPage`: đầu trang chuyển sang `PageHeader readOnly`; nút chính hiện, khóa kèm lý do.
    - Nút phụ ẩn: thực phẩm ẩn "Nhập Excel" và "Sửa hàng loạt"; thiết lập dinh dưỡng ẩn "Hủy".
  - Mẫu thực đơn:
    - `MenuTemplateListPage` và `TemplateCards`: nút "Tạo mẫu" khóa.
    - `MenuTemplateEditorPage`: bỏ chip "Chỉ xem" ở thẻ; "Lưu mẫu" khóa.
    - `/templates/new` không có quyền: bỏ bảng dinh dưỡng thừa.
  - `WeeklyPlanPage`:
    - `readOnly` theo `canEdit`.
    - "Công bố tuần" khóa khi thiếu quyền, hoặc khi chưa lưu nháp (lý do "Lưu nháp trước khi công bố." trước đây nằm ở `title` nên không hiện được).
    - Tuần đã công bố: `LockNote locked`.
  - `SupplierListPage`: `ListPage readOnly`; nút thêm khóa.
- Kho/bán trú:
  - `StockReceiptEditorPage`:
    - Nhãn chỉ xem khi `!canManage`.
    - "Hủy phiếu" dùng `disabledReason` khi `canCancel=false`.
    - Lý do ghép trong câu được tách ra `LockNote locked`.
  - `DryStockLedgerPage`: `readOnly`; "Lập phiếu nhập" khóa.
  - `FreshForecastList`: `readOnly`; "Lập bản dự trù" khóa (chỉ theo `STOCK_MANAGE`, xem câu hỏi mở).
  - `FreshCheckPage`: `readOnly` thay dải chữ "chỉ được xem".
  - `FreshRoundCard`: lần chưa mở dùng `LockNote notYet` với lý do BE trả.
  - `InspectionFormModal`: "Ký xác nhận" chuyển từ `disabled`+`title` (lỗi A-ST-1) sang `disabledReason`; "Đã ký nên đang khóa" dùng `LockNote`; xóa `.kr-lock` không còn dùng.
- Phân quyền: bỏ qua. Ngoại lệ, lịch sử, vai trò đều chỉ Hiệu trưởng vào được (route), không có trường hợp chỉ xem.
- Hồ sơ trẻ: chưa sửa, chờ user.
  - `ProfileChangeNotice` là thông báo trạng thái, không phải khóa: khi đang chờ duyệt vẫn gửi lại được.
  - Đổi sang `LockNote` sẽ báo sai. Đề xuất bỏ mục này.
- Câu hỏi mở:
  - Bản dự trù và kho khô chưa có cờ quyền theo điểm trường từ BE. PHT CS1 xem CS2 vẫn thấy nút ở trạng thái mở (BE vẫn chặn khi gửi).
  - Cần BE trả `canManage` theo điểm trường cho danh sách.
- Kết quả kiểm:
  - lint: pass.
  - `test:menu`: 221/221 pass.
  - `test:kitchen`: 167/167 pass.
  - `test:auth`: 98/98 pass.
  - `check-design`: ok.
  - build: pass.
- Chưa kiểm trên trình duyệt; chưa có ảnh chụp.
- Chưa commit.
- Kiểm trình duyệt (Playwright, bản mock, PHT Cơ sở 1 demo):
  - `/menu/suppliers`: đạt.
    - Nhãn "Chỉ xem" hiện; "Thêm nhà cung cấp" khóa.
    - Focus vào nút thì bóng chữ hiện lý do; không tràn ngang.
  - Chưa kiểm được trong bản mock:
    - `/menu/templates`, `/menu/weekly`, kho khô, bản dự trù, hàng tươi đi trang demo cũ (cờ `*_API` tắt), phải nối BE mới tới trang đã sửa.
    - Thực phẩm, món, thiết lập dinh dưỡng: PHT demo có quyền sửa nên không vào trạng thái chỉ xem.
  - Cần kiểm lại với BE thật (HT, PHT chưa giao mảng, PHT CS2).

### 19/11/2026 — Quyền kho, dự trù theo điểm trường

- Câu hỏi mở "PHT CS1 xem CS2 vẫn thấy nút mở" đã xử lý ở FE, không cần BE đổi contract.
  - BE đã chặn ghi theo điểm trường từ trước (`CampusAccessPolicy.canEditCampus` trong tạo/xóa dự trù, kiểm nhận, phiếu nhập, vá sổ), nên dữ liệu không bị ghi sai. Lỗi nằm ở FE: nút vẫn mở.
- Thêm `canManageStockAt(user, campusId)` (`utils/kitchen/kitchenPermissions.js`), bám luật BE:
  - Có `STOCK_MANAGE`.
  - HT: mọi điểm trường.
  - PHT: điểm trường được phân công, hoặc mọi điểm trường nếu được cấp phạm vi cả trường.
- `useCanManageStock(campusId)` nhận điểm trường đang xem. Đã cập nhật: dự trù, kho khô (tồn, phiếu nhập, phần thiếu).
- Lập phiếu nhập mới: chỉ cho chọn điểm trường được ghi; mặc định điểm đang xem nếu được ghi.
- Test mới `tests/kitchen/stock-campus-permission.test.mjs` (4 ca).
- Kết quả kiểm:
  - `test:kitchen`: 171/171 pass (gồm 4 ca mới).
  - `test:auth`: pass.
  - lint, `check-design`, build: pass.
- Trình duyệt với BE thật (g94-377, port 8082, dataset), đăng nhập PHT CS2 (`0376860053`, có `STOCK_MANAGE`):
  - CS2: dự trù, kho khô, phiếu nhập, kiểm nhận đều mở nút chính, không có nhãn.
  - CS1: cả 4 màn hiện "Chỉ xem". "Lập bản dự trù", "Lập phiếu nhập" khóa kèm lý do. Kiểm nhận không có nút ghi (theo cờ `canManage` BE).
  - `/kitchen/stock-receipts/new?campusId=1`: ô điểm trường chỉ còn Cơ sở 2, mặc định Cơ sở 2.
  - Không có request `/be-api` ≥ 400 trong phiên kiểm.
