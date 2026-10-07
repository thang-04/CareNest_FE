# Review UI/UX – Cơ sở vật chất (CSVC)

Ngày 08/10/2026. Chưa commit.

**Phạm vi.** Màn hình CSVC đang có code thật:
- **Luân chuyển tài sản:** danh sách, tạo/sửa (wizard), chi tiết, bàn giao, nhận, xử lý chênh lệch, in.
- **Kiểm kê tài sản:** danh sách, tạo đợt, chi tiết đợt, phiếu kiểm kê, in.

Các mục còn lại của menu CSVC (Tổng quan, Danh mục tài sản, Cấp phát, Mượn trả, Báo hỏng, Đề nghị mua thêm) hiện chỉ là trang `ComingSoonPage`, chưa có giao diện để review.

**Nguồn quy tắc.**
- `DESIGN.md` của repo là chuẩn bắt buộc.
- Skill **ui-ux-pro-max** (repo `nextlevelbuilder/ui-ux-pro-max-skill`, bản 2.13.0 đã cài sẵn trong Claude Code) chỉ dùng làm tài liệu tham khảo, không cài vào project:
  - `data/ux-guidelines.csv`, các mục số:
    - #28 Focus States, #33 Error Feedback, #35 Confirmation Dialogs
    - #36 Color Contrast, #37 Color Only, #40 ARIA Labels, #41 Keyboard Navigation, #43 Form Labels
    - #54 Input Labels, #65 Breakpoint Testing, #69 Horizontal Scroll, #71 Table Handling
    - #76 Contrast Readability, #79 Empty States, #104 Target Size, #111 Long Token Wrapping
  - `SKILL.md` (bảng ưu tiên: Accessibility → Interaction → Layout → Typography/Color → Forms).
  - Quy tắc "SVG icons, no emoji" trong `references/quick-reference.md`.

## Cách kiểm tra

Chạy http://localhost:5180 với 3 tài khoản: PHT `lan.nguyen`, giáo viên `an.nguyen` (bàn giao), giáo viên `huong.pham` (phiếu kiểm kê). Kích thước màn hình 1366×860 và 1024×768.

Script đo trong trình duyệt kiểm các mục sau:
- nút không có tên
- ô nhập không có nhãn
- ảnh thiếu `alt`
- target < 24px
- tương phản chữ so với nền thật
- trang cuộn ngang
- bảng tràn khung

Ngoài ra rà tĩnh code tìm màu hex, `fontSize` inline, emoji, `!important`.

Ảnh chụp lưu ở `ui-review/before/` và `ui-review/after/`. Tên file trùng nhau giữa hai thư mục thì là cùng một màn hình.

## Phát hiện → đã sửa

| # | Màn hình | Vấn đề (trước) | Sửa | File |
|---|---|---|---|---|
| 1 | Mọi màn hình (toàn app) | Chữ `.muted`/placeholder `--text-3 #8592a6` chỉ đạt **3.15:1** trên nền trắng (cần 4.5:1, guideline #36/#76). Chip cam 4.29, chip teal 3.89, `.text-success` 3.37, `.req`/`.text-danger` 4.31 | Token: `--text-3 → #66728a` (4.84:1), `--warning-700 → #9a5100` (5.4:1), thêm `--teal-700 #0a6e7f` cho `.chip--teal`. `.text-success`, `.text-danger`, `.req` dùng token `-700`. Đo lại: **0 lỗi tương phản** ở 6 trang CSVC | `styles/tokens.css`, `styles/components.css`, `styles/utilities.css` |
| 2 | Danh sách luân chuyển (PHT) | Bảng 11 cột tràn ngang ở 1366px, mất cột "Thao tác". Ô Từ/Đến gãy 4 dòng (guideline #69/#71) | Gộp thành 8 cột: "Ngày lập / dự kiến" (2 dòng), "Loại" (nhãn ngắn, `title` là nhãn đầy đủ), "Từ → Đến" (1 ô 2 dòng có mũi tên), "Bàn giao / Nhận". Kết quả: không tràn ở 1366px, ở 1024px bảng cuộn trong `.table-wrap` | `pages/facility-transfer/TransferListPage.jsx`, `models/facility-transfer/transferConstants.js` (`TRANSFER_TYPE_SHORT_LABELS`), `styles/modules/facility-transfer.css` (`.transfer-route`) |
| 3 | Chi tiết phiếu (1024px) | **Cả trang cuộn ngang 85px** do tên file đính kèm dài trong lưới `info-columns` (guideline #111) | `.info-columns > * { min-width: 0 }`, `.info-list dd { overflow-wrap: anywhere }`. Đo lại 5 trang chi tiết/đợt: 0px | `styles/components.css` |
| 4 | Chi tiết đợt kiểm kê | Bảng phiếu tràn 18px ở 1366px | "Nộp lúc" hiện ngày + giờ 2 dòng | `pages/inventory-inspection/InspectionRoundDetailPage.jsx` |
| 5 | Bàn giao / Nhận (giáo viên) | Tiêu đề và breadcrumb trùng trang chi tiết ("Chi tiết phiếu luân chuyển"), không nói người dùng đang làm gì (DESIGN §8.2, §13) | "Bàn giao tài sản - LCxxx", "Xác nhận nhận tài sản - LCxxx" (tab trình duyệt đổi theo) | `HandoverPage.jsx`, `ReceivePage.jsx` |
| 6 | Wizard tạo phiếu | "Ngày lập" cho sửa nhưng server tự gán ngày khi gửi, nên ô này gây hiểu nhầm | Ô chỉ đọc + gợi ý "Hệ thống ghi ngày gửi phiếu" (`aria-describedby`) | `components/facility-transfer/wizard/StepGeneralInfo.jsx` |
| 7 | Phiếu kiểm kê | Emoji "✓" làm biểu tượng | Icon `CheckCircle2` (`aria-hidden`) | `InspectionSheetPage.jsx` |
| 8 | Badge / ô chọn tình trạng | Màu viết inline (`style={…}`), `<option>` có `#fff` cứng – trái DESIGN §4 | Class `.cond--good/normal/need-repair/broken`, `.cond-select--filled` | `components/asset/AssetVisuals.jsx`, `styles/components.css` |
| 9 | Ảnh tài sản bấm được | `span` có `onClick` nhưng không dùng được bằng bàn phím (guideline #41) | `role="button"`, `tabIndex`, `aria-label`, Enter/Space | `AssetVisuals.jsx` |
| 10 | Chi tiết, chênh lệch, tạo đợt, danh sách/phiếu kiểm kê, chọn tài sản | `fontSize` inline (9 chỗ) – trái DESIGN §5 | Class `.text-xs/.text-sm`, thêm utility `.text-h2` cho số tổng lớn | 6 file trang/component + `styles/utilities.css` |

**Đã đạt sẵn, không cần sửa:**
- 0 nút thiếu tên, 0 ô nhập thiếu nhãn, 0 ảnh thiếu `alt`, không có target < 24px.
- Có trạng thái loading / rỗng (kèm nút "Đặt lại bộ lọc" / "Tạo phiếu") / lỗi.
- Có hộp xác nhận cho hủy, gửi, xóa chữ ký.
- Badge trạng thái có icon + chữ, không chỉ dựa vào màu.
- Mỗi vùng hành động có 1 nút primary. Breadcrumb + `h1` ở mọi trang.
- Nút động từ tiếng Việt.

## Thay đổi DESIGN.md

- §4: giá trị mới `--text-3 #66728a`, `--warning-700 #9a5100`, thêm `--teal-700`. Các thay đổi này áp dụng cho toàn app (cả giáo án), giúp toàn app đạt AA.
- §5: thêm `.text-h2` vào danh sách class cỡ chữ.
- §6: màu tình trạng tài sản đặt ở class `.cond--*`.
- §17 checklist: thêm 3 mục:
  - tương phản AA
  - không cuộn ngang ở 1024px (giá trị dài phải xuống dòng)
  - không dùng emoji làm icon, nút chỉ-icon phải có `aria-label`

## Xung đột giữa skill và DESIGN.md (DESIGN.md thắng)

- **Cỡ chữ.** Skill khuyên body 16px, tối thiểu 12px. DESIGN dùng body 14px và có `--fs-2xs` 11px cho nhãn phụ. Giữ DESIGN, vì đây là app desktop ≥1366px.
- **Mobile-first, chạm ≥44px.** Skill hướng mobile; DESIGN tối ưu desktop với 2 mốc 1280/900. Chỉ kiểm tới 1024px như yêu cầu. Target hiện ≥ 24px (WCAG 2.2 mức tối thiểu).
- **Logo.** Chữ "Nest" `--brand-sky-400` chỉ đạt 2.37:1. Theo DESIGN §3 không đổi màu logo; WCAG cũng miễn yêu cầu tương phản cho logo.
- **Bảng trên màn hẹp.** Skill gợi ý chuyển sang dạng thẻ. DESIGN dùng `.table-wrap` cuộn ngang, nên giữ cuộn trong khung.
- **Font.** Skill có gợi ý font khác; DESIGN cố định Be Vietnam Pro.

## Kết quả

- `npm run format`, `npm run lint` (0 lỗi, 0 cảnh báo), `npm run build`, `npm run check`: pass.
- Đo lại sau sửa:
  - tương phản 0 lỗi ở 6 trang CSVC (PHT)
  - không trang nào cuộn ngang ở 1366 và 1024px
  - bảng danh sách luân chuyển và đợt kiểm kê không tràn ở 1366px
- Các sửa luật luân chuyển trước đó giữ nguyên. Chỉ thêm hằng nhãn ngắn, không đổi service.

## Còn lại

- Thanh lọc danh sách luân chuyển vẫn xuống 2 dòng ở 1366px vì có 2 ô ngày có nhãn. Có thể gộp thành một bộ chọn khoảng ngày, nhưng DESIGN chưa có component đó.
- Ở 1024px các bảng rộng cuộn trong khung (đúng DESIGN). Chưa làm dạng thẻ cho màn hẹp.
- Màn hình CSVC còn lại (Tổng quan, Danh mục, Cấp phát, Mượn trả, Báo hỏng, Đề nghị mua thêm) chưa có giao diện thật.
- Chưa test bằng trình đọc màn hình thật. Mới kiểm bằng script DOM, bàn phím và nhãn.
