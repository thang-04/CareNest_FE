# CareNest Design System — web + app

| | |
| --- | --- |
| Phiên bản | 3.1 — 2026-10-09 |
| Trạng thái | **PROPOSED** — chờ team duyệt |
| Áp cho | Web `CareNest_FE` (React, CSS thuần) và app `CareNest_APP` (Flutter) |
| Bản gốc | `CareNest_FE/DESIGN.md` (file này). App chép nguyên thành `CareNest_APP/DESIGN.md` khi nối (Phụ lục A); sửa một bên thì chép sang bên kia trong cùng đợt |
| Nguồn token | Web: `src/styles/tokens.css` · App: `lib/core/constants/colors.dart`, `sizes.dart`, `motion.dart`. Hai nơi phải ra **cùng giá trị** ở bảng mục 3 |
| Xem mẫu | Web: trang `/ui-kit` (khi `npm run dev`: menu tài khoản → _Thư viện giao diện_). App: UiKitScreen (debug), demo `mockups/parent-app-demo/index.html` |
| Code (không phải giao diện) | Web: `docs/architecture/CODING_GUIDE.md` — chạy dự án, thư mục, CSS đặt ở đâu, luồng dữ liệu, thêm module, checklist PR |
| Không quyết | Nghiệp vụ, quyền, field hiển thị, endpoint — thuộc `CareNest_BE`; file này chỉ dẫn mã rule |

---

## 0. Cách dùng

**Cho người và AI sửa giao diện.** Đọc theo thứ tự: mục 1 (giống gì, khác gì) → mục 2 (luật cứng) → mục 3 (token) → mục 6 (component) → mục 8 (công thức màn) → mục 13 (tự kiểm trước khi báo xong).

**Ưu tiên khi mâu thuẫn:** yêu cầu rõ của user trong lượt hiện tại → file này → `CODING_GUIDE.md` (code) → mặc định của AI, Material hay trình duyệt. Làm theo user mà lệch file này ⇒ nói rõ "lệch design system ở …" trong báo cáo và PR, đề xuất sửa file này nếu thay đổi nên dùng lâu dài.

**Từ khóa:** **PHẢI** / **KHÔNG** = bắt buộc. **NÊN** = mặc định, lệch thì ghi lý do.

> Nguyên tắc vàng: **không tự chế** màu, nút, bảng, modal, badge. Dùng lại cái đã có; thiếu thì thêm vào phần dùng chung để cả nhóm cùng dùng.

---

## 1. Một style, hai nền tảng

### 1.1 Người dùng

| Nền tảng | Ai | Bối cảnh |
| --- | --- | --- |
| Web | System Admin, Hiệu trưởng, Phó hiệu trưởng (theo điểm trường), Tổ trưởng, Giáo viên, Bếp | Máy tính ≥1024px, tablet ≥768px; ngồi làm việc lâu, nhiều bảng, nhiều duyệt |
| App | Phụ huynh (chính), Giáo viên, Nhân viên bếp | Điện thoại 360–430pt, một tay, mỗi lần 30 giây – 2 phút, nhiều người bật chữ to |

### 1.2 Phải giống nhau

| Hạng mục | Chung |
| --- | --- |
| Màu | Cùng mã ở mục 3. Nút chính xanh trời `#4FB0F5` chữ xanh đậm `#0E3F63`; link `#0B72BC`; nền trời rất nhạt |
| Nghĩa của màu | Cùng tông cho cùng nghĩa (mục 3.2). "Đã duyệt" xanh lá ở web thì xanh lá ở app |
| Font | Be Vietnam Pro, độ đậm 400/500/600/700 |
| Hình dáng | Ngôn ngữ **viên thuốc và bo lớn**: nút, badge, chip, ô nhập một dòng, tab segmented tròn hai đầu; card, hộp thoại bo lớn |
| Bóng | Một bóng mềm ánh xanh cho card; lớp nổi bóng đậm hơn; nút không bóng |
| Icon | Bộ Tabler outline; cùng chức năng ⇒ cùng icon |
| Logo, tranh | Cùng logo (mục 4.1), cùng bộ 20 tranh sáp màu |
| Chuyển động | Cùng đường cong Material chuẩn, cùng thời lượng, không nảy |
| Mẫu tương tác | Hộp xác nhận icon lớn giữa; lớp phủ khi gửi form; toast nền màu có thanh đếm ngược; khung chờ nhịp thở; ba chấm màu logo; màn trống có tranh nhỏ, màn lỗi có icon |
| Câu chữ | Tiếng Việt, nút là động từ, cùng bảng thuật ngữ (mục 10) |
| Chế độ | Chỉ giao diện sáng |

### 1.3 Được khác (thích nghi thiết bị)

| Hạng mục | Web | App | Vì sao |
| --- | --- | --- | --- |
| Cỡ chữ thân | 14 | 16 | App đọc trên điện thoại, nhiều phụ huynh lớn tuổi |
| Cao nút / ô nhập | 36 | 52 | Chuột vs ngón tay (vùng chạm ≥48) |
| Bo card | 32 | 24 | Màn điện thoại hẹp, 32 ăn chỗ nội dung |
| Bề mặt card | Kính trắng 72% + blur trên tranh nền | Trắng đặc | Blur trong danh sách cuộn giật trên Android tầm trung |
| Tranh | Nền cả app (phủ trắng), dải đầu trang, dải chào dashboard | Hero màn Hôm nay, đăng nhập, màn trống | Mật độ màn khác nhau |
| Khung | Sidebar nổi + topbar | Thanh điều hướng đáy + AppBar | Quy ước nền tảng |
| Danh sách | Bảng sọc trong card | Dòng danh sách trong card | Không có chỗ cho nhiều cột |
| Xem nhanh chi tiết | Panel trượt phải | Bottom sheet hoặc màn con | Quy ước nền tảng |
| Toast | Góc trên phải, dưới topbar | Mép trên, dưới status bar | Vùng nhìn |
| Hover | Có (quầng sáng nút chính) | Không; thay bằng trạng thái nhấn | Không có chuột |
| In A4 | Có (`print.css`, font Tinos, nền trắng) | Không | Chỉ web in chứng từ |

Ngoài bảng 1.3, hai nền tảng **KHÔNG** được khác. Cần khác thêm ⇒ thêm dòng vào bảng này trước.

---

## 2. Luật cứng

### 2.1 Chung

1. **KHÔNG** viết mã màu ngoài file token (web `tokens.css`, `print.css`; app `colors.dart`, `AppShadows`). Ngoại lệ: màu từ dữ liệu (vd. `user.avatarColor`).
2. **KHÔNG** viết số cỡ chữ, khoảng cách, bo góc, bóng, thời lượng ngoài token. Thiếu token ⇒ mục 12.
3. **PHẢI** dùng component chung (mục 6). Thiếu ⇒ thêm vào phần dùng chung, **không** dựng tạm trong màn.
4. **KHÔNG** thêm variant mới cho component có sẵn khi chưa cập nhật file này.
5. Chữ trên nền `brand` **PHẢI** là `onBrand`. **KHÔNG** chữ trắng trên `brand` (2,4:1).
6. Màu trạng thái **KHÔNG** đứng một mình: luôn kèm chữ, thường kèm icon.
7. Tông `approval` (vàng) chỉ cho "chờ người duyệt". Không dùng làm màu trang trí.
8. **KHÔNG** tô màu đánh giá số đo sức khỏe khi BE không trả nhãn đánh giá (HLT-02, P-13).
9. Mỗi vùng thao tác (đầu trang, chân trang, chân modal, thanh đáy) **một** nút chính. App không dùng FAB.
10. Mọi màn tải dữ liệu **PHẢI** đủ trạng thái mục 9. Hành động không hoàn tác được **PHẢI** có hộp xác nhận.
11. **KHÔNG** dữ liệu hay ảnh trẻ thật trong mock, fixture, test, ảnh chụp, demo. Avatar mặc định là chữ cái.
12. **KHÔNG** tự lọc field, tự đếm tổng, tự tính trạng thái thay BE.
13. Chuyển động tôn trọng giảm chuyển động của hệ điều hành; chỉ giữ thanh đếm ngược toast.
14. Icon chỉ import ở **một file** mỗi repo (mục 5). Không dùng emoji làm biểu tượng.

### 2.2 Riêng web

15. Dùng `var(--token)` lớp semantic/component (`--color-*`, `--tone-*`, `--btn-*`…); **KHÔNG** dùng primitive (`--blue-700`, `--sky-400`) trong component.
16. **KHÔNG** `style={{}}` cho màu, cỡ chữ, khoảng cách; chỉ cho giá trị động (chiều rộng %, màu từ dữ liệu). JSX dùng class tiện ích (`.text-sm`, `.fw-600`, `.mt-16`…).
17. CSS đặt và đặt tên theo `docs/architecture/CODING_GUIDE.md` mục 3 (BEM, tiền tố module, không `!important`).
18. Mọi phần tử bấm được dùng được bằng bàn phím và có focus ring (`--focus-ring`). Không `onClick` trên `tr/td/div` mà thiếu `tabIndex` + Enter. Nút chỉ có icon có `aria-label`.
19. Không cuộn ngang 768–1440px: bảng rộng cuộn trong `.table-wrap`; chữ dài xuống dòng (`overflow-wrap: anywhere`, ô lưới `min-width: 0`).

### 2.3 Riêng app

20. Widget đọc màu qua `Theme.of(context).colorScheme` / `AppStatusColors.of(context)`; chữ qua `textTheme`; số qua `AppSpacing` / `AppRadius` / `AppSizes`. Số trong `EdgeInsets`, `SizedBox`, `BorderRadius` chỉ được là `0` hoặc hằng của các lớp đó.
21. **KHÔNG** `BackdropFilter` trong item danh sách cuộn; kính chỉ ở hero màn Hôm nay.
22. **KHÔNG** khóa `textScaler`. Nội dung xuống dòng, không `ellipsis` (trừ tiêu đề AppBar, dòng danh sách tối đa 2 dòng).

---

## 3. Token

Cột "Web" là tên biến trong `tokens.css` (đã có). Cột "App" là tên trong Dart (đích; mục 14 ghi chỗ code app còn khác).

### 3.1 Màu nền tảng

| Vai trò | Mã | Web | App `AppColors` |
| --- | --- | --- | --- |
| Nền thương hiệu: nút chính, mục chọn đậm | `#4FB0F5` | `--color-brand` | `brand` |
| Thương hiệu khi rê chuột | `#71C6FD` | `--color-brand-hover` | — |
| Thương hiệu khi nhấn | `#95CFF9` | `--color-brand-active` | `brandPressed` |
| Chữ/icon trên nền thương hiệu (4,64:1) | `#0E3F63` | `--color-on-brand` | `onBrand` |
| Link, chữ màu, icon nhấn, focus (5,06:1) | `#0B72BC` | `--color-primary` | `primary` |
| Link khi rê/nhấn | `#0A6AAE` | `--color-primary-hover` | `primaryPressed` |
| Nền nhạt: mục chọn, ô icon | `#E2F2FD` | `--color-primary-soft` | `primarySoft` |
| Viền nhạt chọn | `#95CFF9` | `--color-primary-border` | `primaryBorder` |
| Vòng focus | `#C5E5FC` | `--color-focus-ring` | `focusRing` |
| Mint của logo | `#94DEBD` | `--color-accent` | `accent` |
| Nền mint | `#EEFAF4` | `--color-accent-soft` | `accentSoft` |
| Chữ trên nền mint (4,92:1) | `#1F7A59` | `--color-accent-fg` | `accentText` |
| Nền màn | `#F1F9FE` | `--color-bg` | `background` |
| Bề mặt: card, sheet, modal, ô nhập | `#FFFFFF` | `--color-surface` | `surface` |
| Bề mặt phụ trong card | `#F8FAFC` | `--color-surface-muted` | `surfaceMuted` |
| Chữ chính (15,6:1) | `#1B2433` | `--color-text` | `textPrimary` |
| Chữ phụ (7,5:1) | `#4A5568` | `--color-text-secondary` | `textSecondary` |
| Chữ mờ, placeholder (4,84:1) | `#66728A` | `--color-text-muted` | `textMuted` |
| Chữ vô hiệu | `#A3AEBD` | `--color-text-disabled` | `textDisabled` |
| Viền nhạt, kẻ phân cách | `#E3E9F2` | `--color-border` | `border` |
| Viền ô nhập, nút phụ | `#CDD6E3` | `--color-border-strong` | `borderStrong` |
| Viền vùng kéo-thả | `#B9C6D8` | `--color-border-dashed` | — |
| Rãnh segmented, khung chờ | `#EEF1F5` | `--skeleton` | `track` |
| Nền sau hộp thoại (không blur) | `#0E3F63` 32% | `--color-overlay` | `overlay` |

### 3.2 Tông trạng thái — badge, thẻ số liệu, thanh tiến trình, lịch, nhãn phân loại

Nền = tông pha 16% trên trắng, viền = 34%, chữ = `-fg`. Mọi cặp chữ/nền ≥5,1:1 (đã đo).

| Tông | Màu | Chữ | Nền 16% | Web | App enum | Nghĩa | Ví dụ |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `gray` | `#7B8AA0` | `#556377` | `#EAECF0` | `chip--gray` · `--tone-gray` | `gray` | Nháp, đã hủy, ngừng, chưa có | Bản nháp, Đã hủy |
| `orange` | `#F5820B` | `#944F06` | `#FDEBD8` | `chip--orange` · `--tone-orange` | `orange` | Chờ **người khác** làm, cần để ý | Chờ bàn giao, Nghỉ có báo |
| `blue` | `#2BA0F3` | `#0E3F63` | `#DDF0FD` | `chip--blue` · `--tone-blue` | `blue` | Đang thực hiện, đã gửi | Đang kiểm kê, Đã gửi |
| `approval` | `#F5B400` | `#835C00` | `#FDF3D6` | `chip--purple` · `--tone-approval` | `approval` | Chờ **duyệt / phê duyệt**, có chênh lệch | Chờ duyệt, Chờ xử lý chênh lệch |
| `red` | `#F0475A` | `#A63749` | `#FDE2E5` | `chip--red` · `--tone-red` | `red` | Cần xử lý, bị trả lại | Cần điều chỉnh, Nghỉ không báo |
| `green` | `#22B573` | `#176F51` | `#DCF3E9` | `chip--green` · `--tone-green` | `green` | Hoàn tất | Hoàn thành, Đã duyệt, Đã đến lớp |
| `teal` | `#13B5B1` | `#0F6C71` | `#D9F3F3` | `chip--teal` · `--tone-teal` | `teal` | Nhãn thông tin | Vai trò "Người nhận", bữa phụ |

- Web giữ tên `purple` (class `chip--purple`, `StatusBadge tone="purple"`, `--purple*`) cho tông vàng chờ duyệt để không đổi ~30 file; **đọc `purple` ở web = `approval`**. Code mới dùng `--tone-approval` khi viết CSS.
- Tông `blue` không có icon thì badge có chấm phát sáng (đang diễn ra).
- Trạng thái chờ ghi rõ **chờ ai** khi có dữ liệu: "Chờ Trần Thị Mai xác nhận nhận".

**Khai báo badge cho module** (mỗi feature **một** bảng map; cùng mã BE ở hai nền tảng ⇒ cùng tông, cùng nhãn):

```jsx
// web: src/components/<module>/XStatusBadge.jsx
import { FileEdit, Clock, CircleCheck, CircleX } from '@/components/ui/icons';
import { createStatusBadge } from '@/components/ui/StatusBadge';
import { X_STATUS_LABELS } from '@/models/<module>/xConstants';

export const XStatusBadge = createStatusBadge(
  { DRAFT: ['gray', FileEdit], PENDING: ['orange', Clock], DONE: ['green', CircleCheck], CANCELLED: ['gray', CircleX] },
  X_STATUS_LABELS,
);
// dùng: <XStatusBadge status={item.status} />, đầu trang chi tiết: size="lg"
```

App: `features/<feature>/presentation/<feature>_status.dart` trả `(label, tone, icon)`.

**Bảng map đã chốt** (nhãn trước "/" cho phụ huynh, sau cho nhân viên):

| Feature | Trạng thái | Nhãn | Tông |
| --- | --- | --- | --- |
| Điểm danh | có mặt | Đã đến lớp / Có mặt | `green` |
| Điểm danh | vắng có phép / có thông báo nghỉ | Nghỉ có báo / Có phép | `orange` |
| Điểm danh | vắng không phép | Nghỉ không báo / Không phép | `red` |
| Thông báo nghỉ | `SUBMITTED` | Đã gửi | `blue` |
| Thông báo nghỉ | `CANCELLED` | Đã hủy | `gray` |
| Chứng từ có duyệt | chờ duyệt | Chờ duyệt | `approval` |
| Tình trạng tài sản | Tốt · Bình thường · Cần sửa · Hỏng | (web `<ConditionBadge>`, class `.cond--*`) | `green` · `blue` · `orange` · `red` |

**Nhãn phân loại** (không phải trạng thái) dùng cùng nghĩa màu: vai trò của tôi / người liên quan ("Người bàn giao", "Người nhận", "Tôi") `teal`; thiếu, hư hỏng, dị ứng `red`; thừa, lệch sổ sách `orange`; số đếm trong tab `.tab__count`.

### 3.3 Màu phản hồi — banner, toast, nút xác nhận, lỗi trường

| Nghĩa | Màu | Chữ | Nền | Viền | Web | App |
| --- | --- | --- | --- | --- | --- | --- |
| Thành công | `#12A150` | `#0B7A3B` | `#E7F7EE` | `#B5E5C8` | `--color-success*` | `success*` |
| Cảnh báo | `#E8890C` | `#9A5100` | `#FFF4E3` | `#F7D49C` | `--color-warning*` | `warning*` |
| Lỗi, nguy hiểm | `#E03131` | `#C92A2A` | `#FDECEC` | `#F6B9B9` | `--color-danger*` | `danger*` |
| Thông tin | `#0B72BC` | `#0E3F63` | `#E2F2FD` | `#95CFF9` | `--color-info*` | `info*` |

Dùng 3.3 cho **thông điệp** (có chuyện gì vừa xảy ra); dùng 3.2 cho **trạng thái của một bản ghi**. Chữ màu trên nền nhạt dùng bậc đậm (`-fg`, `-700`, `-800`), không dùng màu chính.

### 3.4 Chữ

Font `Be Vietnam Pro` (web: Google Fonts trong `index.html`, chỉ tải 400–700; app: đóng gói `assets/fonts/`). Số căn cột dùng chữ số đều (web `font-variant-numeric: tabular-nums`; app `FontFeature.tabularFigures()`).

| Vai trò | Web (token · px/đậm · class) | App (`TextTheme` · pt/đậm) |
| --- | --- | --- |
| Tiêu đề trang | `--fs-2xl` · 28/700 · `.page__title` | `headlineSmall` · 22/700 |
| Lời chào trên tranh | `--fs-2xl` · 28/700 | `displaySmall` · 26/700 |
| Số lớn (KPI, thẻ số liệu, số đo) | 28–40/700 (`clamp`) | `headlineMedium` · 28/700 |
| Tiêu đề hộp thoại, AppBar | `--fs-xl` · 18/600 · `.modal__title` | `titleLarge` · 18/600 |
| Tiêu đề card | `--fs-xl` · 18/700 · `.card__title` | `titleMedium` · 17/700 |
| Tiêu đề dòng, nhãn ô nhập, tiêu đề nhỏ | `--fs-title-sm` · 15/600 | `titleSmall` · 16/600 |
| Chữ thân | `--fs-md` · 14/400, dòng 1,5 · `.text-md` | `bodyLarge` · 16/400, dòng 1,5 |
| Chữ phụ, meta, nhãn bảng | `--fs-sm` · 13/400 · `.text-sm` | `bodyMedium` · 14/400 |
| Chữ nút | `--fs-md` · 14/700 | `labelLarge` · 16/700 |
| Badge, chip, ngày giờ phụ | `--fs-xs` · 12/600 · `.text-xs` | `labelMedium` · 13/600 |
| Nhãn nhóm in hoa | `--fs-2xs` · 11/600, giãn 0,05em · `.text-2xs` | `labelSmall` · 12/600, giãn 0,06em |

- Chỉ dùng các cỡ trên. Chữ 12 trở xuống chỉ cho nhãn, giờ phụ; không cho nội dung cần đọc.
- Độ đậm: 400 nội dung · 500 mục menu, tab · 600 tiêu đề nhỏ, nhãn, chữ nhấn (`.fw-600`), mã chứng từ · 700 tiêu đề trang/card, nút, số lớn. **KHÔNG** 800 (font không tải).
- App không khóa cỡ chữ hệ thống; kiểm ở 1,0 · 1,3 · 2,0.

### 3.5 Khoảng cách (lưới 4)

| Bậc | Giá trị | Web | App `AppSpacing` |
| --- | --- | --- | --- |
| 1 | 4 | `--space-1` | `space1` |
| 2 | 8 | `--space-2` | `space2` |
| 3 | 12 | `--space-3` | `space3` |
| 4 | 16 | `--space-4` | `space4` |
| 5 | 20 | `--space-5` | `space5` |
| 6 | 24 | `--space-6` | `space6` |
| 8 | 32 | `--space-8` | `space8` |
| 10 | 40 | `--space-10` | `space10` |

Web còn `--space-1-5` (6), `--space-2-5` (10), `--space-3-5` (14) cho CSS cũ; code mới không dùng. Class tiện ích web: `.gap-*`, `.mt-8/12/16/24`, `.mb-*`.

| Áp dụng | Web | App |
| --- | --- | --- |
| Lề trang/màn | `--page-padding` 20 | 16 (20 khi rộng ≥400) |
| Padding card | `--card-padding` 24, dày 16 | 20, dày 16 |
| Giữa card | 16–20 | 12 |
| Giữa section | 24 | 24 |

### 3.6 Bo góc

Một thang chung: 6 · 12 · 14 · 16 · 20 · 24 · 32 · tròn.

| Bậc | Giá trị | Web | App `AppRadius` |
| --- | --- | --- | --- |
| xs | 6 | `--radius-xs` | `xs` |
| sm | 12 | `--radius-sm` | `sm` |
| md | 14 | `--radius-md` | `md` |
| lg | 16 | `--radius-lg` | `lg` |
| xl | 20 | `--radius-xl` | `xl` |
| 2xl | 24 | `--radius-2xl` | `xxl` |
| 3xl | 32 | `--radius-3xl` | `xxxl` |
| full | 9999 | `--radius-full` | `pill` |

| Thành phần | Web | App |
| --- | --- | --- |
| Nút, badge, chip, segmented, ô nhập một dòng | full | full |
| Ô nhập nhiều dòng | `--input-radius` 22 | xl 20 |
| Card, thẻ số liệu | 3xl 32 | 2xl 24 |
| Hộp thoại, sheet (mép trên), panel phải | 3xl 32 | 3xl 32 |
| Sidebar nổi | 3xl 32 | — |
| Banner/alert, toast, bảng trong card | lg 16 | lg 16 |
| Ô icon 32–40 | tròn (`--tile-radius`) | tròn |
| Ảnh thu nhỏ, ô lịch | sm 12 | sm 12 |

Bo lồng nhau: bo trong = bo ngoài − khoảng cách giữa hai mép.

### 3.7 Kích thước

| Thành phần | Web | App |
| --- | --- | --- |
| Nút thường / nhỏ / lớn | 36 / 32 / 40 (`--btn-height*`) | 52 / 44 / — |
| Ô nhập | 36 (`--input-height`) | 52 |
| Vùng chạm tối thiểu | — | 48 |
| Badge | ~22 (chữ 12) | 28 |
| Chip lọc | 32 | 36 |
| Dòng bảng / dòng danh sách | ≥44 | ≥64 |
| Ô icon đầu card | 32–40 | 40 |
| Icon trong dòng / ô icon / điều hướng | 16–18 / 20 / 20 | 20 / 22 / 24 |
| Topbar / AppBar | 64 | 56 |
| Sidebar / thu gọn | 256 / 72 | — |
| Thanh điều hướng đáy | — | 72 + safe area |

### 3.8 Bóng

| Dùng | Giá trị | Web | App `AppShadows` |
| --- | --- | --- | --- |
| Card | `0 1px 2px rgba(16,24,40,.04), 0 16px 40px -20px rgba(11,114,188,.25)` | `--card-shadow` | `card` |
| Card khi rê | `… 0 20px 40px -18px rgba(11,114,188,.35)` | `--card-shadow-hover` | — |
| Lớp nổi (modal, sheet, toast, dropdown) | `--shadow-xl` | `--shadow-xl` | `overlay` |
| Focus / được chọn | vòng 3px `--color-focus-ring` | `--focus-ring` | viền focus theme |

App viết bóng card: `BoxShadow(color: Color(0x0A101828), blurRadius: 2, offset: Offset(0, 1))`, `BoxShadow(color: Color(0x400B72BC), blurRadius: 40, spreadRadius: -20, offset: Offset(0, 16))`. Nút không bóng (web chỉ có quầng sáng khi rê nút chính). Không dùng bóng khác.

### 3.9 Chuyển động

| Token | Giá trị | Web | App `AppMotion` |
| --- | --- | --- | --- |
| Đường cong | `cubic-bezier(0.4, 0, 0.2, 1)` | `--ease-out` | `curve` |
| Nhanh: nhấn, tab, chip | 150ms | `--duration-fast` | `fast` |
| Lớp nổi mở | 180ms | `--duration-overlay` | `overlay` |
| Chuyển màn, mở rộng | 300ms | `--duration-base` | `base` |
| Toast / toast lỗi | 3,5s / 6s | `ToastContext` | `toast` / `toastError` |

| Tương tác | Hiệu ứng (hai nền tảng) |
| --- | --- |
| Nhấn nút | Lún 2% (`scale 0.98`) |
| Mở lớp nổi | Mờ 0→1 + scale 0,95→1 + dịch 4 |
| Tab segmented | Nền ô chọn trượt sang ô mới |
| Toast | Trồi từ mép; thanh đếm ngược co ngang |
| Khung chờ | Nhịp thở độ mờ 0,6↔1, 1,2s |
| Đang tải | Ba chấm `primary` · `brand` · `accent` nhảy lần lượt |
| Tiến trình đang chạy | Sọc chạy trên thanh |

Giảm chuyển động (web `prefers-reduced-motion`, app `MediaQuery.disableAnimations`) ⇒ tắt hết, **giữ** thanh đếm ngược toast.

---

## 4. Logo, tranh, bề mặt

### 4.1 Logo

| File | Dùng | Web | App |
| --- | --- | --- | --- |
| `logo-mark.png` | Biểu tượng (mẹ bế bé): sidebar, đầu bản in, splash | `<LogoMark />` | `AppLogo` mark |
| `logo-full.png` | Biểu tượng + chữ: đăng nhập | `<LogoFull />` | `AppLogo` full |
| Chữ "CareNest" hai màu | Cạnh biểu tượng: **Care** `#0269C5`, **Nest** `#4FB0F5` | `<Wordmark />` | `AppWordmark` |
| `mockups/brand/logo.jpg` | Nguồn gốc để cắt, không dùng trực tiếp | — | — |

Không kéo méo, đổi màu, thêm bóng; nền sau logo luôn sáng. Sidebar web: `<Logo />`, thu gọn `<Logo collapsed />`, bấm về Trang chủ; không thêm dòng phụ "Trường Mầm Non". Tên trường, địa chỉ trên bản in lấy từ `src/config/printTemplate.js`.

### 4.2 Tranh và bề mặt

Bộ 20 tranh sáp màu ở `src/assets/illustrations/scenes/` + `login-scene.webp`, `hero-scene.webp`. App đóng gói bản rộng 1080px, WebP ≤150 KB vào `assets/illustrations/`, đường dẫn tập trung ở `AppAssets`.

| Chỗ | Web | App |
| --- | --- | --- |
| Nền toàn app | Tranh mờ dưới lớp phủ trắng `--scene-veil` | Không; nền `background` trơn |
| Đầu trang | Dải `.page__head` cao 140, tranh bên phải mờ dần về phía chữ | Không |
| Dashboard / Hôm nay | Dải chào có `hero-scene` | Hero cao 224, đáy mờ về nền, khối chào kính |
| Đăng nhập | Tranh + khối giới thiệu kính, form kính | Tranh 42% trên, sheet trắng bo 32 |
| Màn trống | Tranh nhỏ ngẫu nhiên trong bộ đang bật | Tranh 168×124 bo 20 |
| Màn lỗi | Icon, không tranh | Icon, không tranh |

**Kính** (`--glass-bg` trắng 72%, `--glass-blur` 20px, viền trắng 85%): web cho card, dải đầu trang, thanh nút dính đáy; app chỉ khối chào trên hero.

Tranh theo dịp/giờ/mùa: web đang làm cấu hình cấp trường (`docs/plans/active/2026-10-09-giao-dien-tranh-nen.md`, API đề xuất `GET /school/appearance`). App dùng T0 Sân chơi tới khi API có.

---

## 5. Icon

- Bộ **Tabler outline**. Web nét mặc định của `@tabler/icons-react`; app nét 1,75.
- Mỗi repo **một file** import bộ icon, nơi khác dùng tên ánh xạ:
  - Web: `src/components/ui/icons.js` (tên trong app → icon Tabler, vd. `IconDeviceFloppy as Save`). Import `@/components/ui/icons`. Xem đủ danh sách ở `/ui-kit#icons`.
  - App: `lib/core/constants/app_icons.dart`, tên **giống** `icons.js` (lowerCamel: `Save` → `save`). Chưa có gói Tabler (cần duyệt dependency) ⇒ tạm trỏ `Icons.*_rounded`.
- Cùng chức năng ⇒ cùng tên icon ở hai repo. Icon mới ⇒ thêm ở `icons.js` trước, app chép tên.
- Icon một màu theo chữ cạnh nó; đứng trước chữ trong nút. Ô icon: nền `primarySoft` + icon `primary`, hoặc nền 16% + chữ `-fg` theo tông.
- Icon đứng một mình **PHẢI** có nhãn đọc màn hình (web `aria-label`; app `tooltip` hoặc `Semantics`).

---

## 6. Component

### 6.1 Tương đương web ↔ app

Web: `src/components/ui/`, import `@/components`; CSS `src/styles/components.css`. App: `lib/core/widgets/` (*mới* = chưa có).

| Thành phần | Hình chung | Web | App |
| --- | --- | --- | --- |
| Nút | Viên thuốc, chữ 700; chính nền `brand` chữ `onBrand`; phụ nền trắng viền `borderStrong`; nguy hiểm nền đỏ nhạt chữ đỏ | `.btn` + `--primary` / (mặc định) / `--ghost` / `--danger` | `AppButton(variant: primary/secondary/text/danger)` |
| Ô nhập | Viên thuốc, viền `borderStrong`; focus viền `primary` + vòng `focusRing`; nhãn trên, gợi ý và lỗi dưới | `<FormField>` bọc `.input`; `<PasswordInput>` | `AppTextField`, `AppPasswordField` |
| Card | Bo lớn, bóng card; đầu card: ô icon + tiêu đề + link | `.card` (`__header`, `__title`, `__body`, `__section`) | `AppCard` |
| Badge trạng thái | Viên thuốc, icon 14 + chữ, nền 16%, viền 34% | `<StatusBadge tone>` / `createStatusBadge` | `AppStatusBadge(tone:)` |
| Chip lọc | Viên thuốc viền; chọn: nền `primarySoft` chữ `onBrand` | `.chip` | `AppFilterChip` *mới* |
| Thẻ số liệu | Nhãn trên, số to màu đậm theo tông, icon lớn mờ ở góc, nền chuyển nhẹ theo tông, › khi bấm được | `.stat-grid` > `button.stat-card--<tông>` + `StatCardIcon` | `AppStatCard` *mới* |
| Tab | Segmented: rãnh xám, ô chọn trắng trượt; số đếm `.tab__count` | `.tabs` > `button.tab` | `AppSegmented` *mới* |
| Banner trong trang | Nền màu nhạt đặc theo nghĩa (3.3), không viền, icon trơn, bo 16 | `.alert--<nghĩa>` | `AppBanner` *mới* |
| Toast | Nền màu theo loại, icon tròn, thanh đếm ngược 3px | `useToast().success/error/warning/info(msg, title?)` | `AppToast` *mới* |
| Hộp xác nhận | Icon lớn giữa trong vòng tròn tông, tiêu đề, mô tả; nút ghi đúng hành động | `<ConfirmationModal danger onConfirm>` | `AppConfirmationDialog` |
| Lớp nổi chung | Bo 32, bóng xl, nền sau xanh đậm 32% không blur, Esc đóng, giữ tiêu điểm | `<Modal size="md|lg|xl">` | `AppBottomSheet` *mới* |
| Xem nhanh chi tiết | Trượt vào, có nút "Mở toàn trang" | `<SidePanel>` | `AppBottomSheet` hoặc màn con |
| Gửi form | Lớp phủ trắng: ba chấm "Đang gửi…" → ✓ "Đã gửi" → hoặc lỗi + "Thử lại", giữ dữ liệu | `<SubmitOverlay state>` | `AppSubmitOverlay` *mới* |
| Đang tải | Ba chấm màu logo | `<Spinner>`, `<LoadingState>` | `AppLoading` |
| Khung chờ | Đúng hình nội dung, nhịp thở | `.skeleton`, `<SkeletonRows>` | `AppSkeleton` |
| Rỗng | Tranh nhỏ + tiêu đề + câu giải thích (+ nút nếu có việc làm được) | `<EmptyState>` | `AppEmptyState` |
| Lỗi | Icon + câu nói chuyện gì xảy ra và làm gì + "Thử lại" | `<ErrorState onRetry>` | `AppErrorState` |
| Thanh tiến trình | Chuyển sắc cùng họ + sọc chạy; xong ⇒ xanh lá "Hoàn thành"; tổng 0 ⇒ "—" | `<ProgressBar value total tone>` | `AppProgressBar` *mới* |
| Avatar | Tròn, chữ cái đầu tên, nền pastel theo tên (6.2) | `<Avatar>` | `AppAvatar` *mới* |
| Nhãn – giá trị | Nhãn chữ mờ, giá trị chữ chính; trống ⇒ "Chưa cập nhật" | `dl.info-list`, `.info-columns` | `AppInfoList` *mới* (một cột) |
| Danh sách nhiều bản ghi | Trong card, sọc / kẻ nhạt, cả dòng bấm được | `.table-wrap` > `table.table` + `<Pagination>` | `AppListRow` *mới* + tải thêm |
| Bước | Bước ngang, bước hiện tại `primary` | `<Stepper>` (wizard), `<ProgressSteps>` (tiến trình chứng từ) | `AppStepper` *mới* |
| Logo | Mục 4.1 | `<Logo>`, `<LogoMark>`, `<Wordmark>` | `AppWordmark` |

### 6.2 Avatar

Tông = tổng mã ký tự của tên mod 5 (web `avatarTone` trong `src/utils/format.js`; app dùng đúng công thức này để cùng người cùng màu):

| # | Nền | Chữ |
| --- | --- | --- |
| 0 | `#E2F2FD` | `#0B72BC` |
| 1 | `#FCE7F3` | `#BE185D` |
| 2 | `#DCFCE7` | `#15803D` |
| 3 | `#FEF3C7` | `#B45309` |
| 4 | teal 14% | `#0F6C71` |

Ảnh thật chỉ khi BE trả URL qua API có quyền; không ảnh trẻ trong mock.

### 6.3 Danh mục riêng web

| Nhu cầu | Component / class |
| --- | --- |
| Nút | `.btn` + `--primary` `--outline-primary` `--danger` `--outline-danger` `--success` `--warning` `--ghost`; cỡ `--sm` `--lg`; rộng hết `--block` |
| Ô nhập HTML thuần | `.field` > `.field__label` + `.input/.select/.textarea` + `.field__hint` `.field__error`; lỗi thêm `.input--error`; bắt buộc `<span className="req">*</span>` |
| Form nhãn ngang | `.form-row` > `.form-row__label` + `.form-row__control` |
| Chọn có tìm kiếm | `<SearchSelect options value onChange />` |
| Bộ lọc | `.filter-bar` + `.search-box` |
| Bố cục | `.detail-layout` (`__main` 2/3, `__aside` 1/3), `.split-2`, `.grid-2`, `.grid-3` |
| Nút cuối trang | `.page-actions` (trái: Quay lại; phải: nút chính **cuối cùng bên phải**); có nút chính thì thành thanh kính dính đáy |
| Biểu đồ nhỏ | `@/components/charts/MiniCharts` (`RingChart`, `BarList`, `DonutChart`) — chỉ vẽ số BE trả |
| Chữ ký | `<SignaturePicker>`, ô ký `.sig-slots` > `.sig-slot` (`--signed`, `--me`) |
| Upload | `<FileUploader>` (≤10MB), `<ImageUploader max={3}>` (tự nén) |
| Tài sản | `<AssetThumb>`, `<ConditionBadge>`, `<ConditionSelect>` |
| In A4 | `.print-sheet` + `<PrintHeader />` + class `ps-*`; `<PrintToolbar>` (Xuất Excel · Xuất PDF · In) |
| Tiện ích | `.row` `.stack` `.muted` `.text-2` `.text-xs/.text-sm/.text-md/.text-lg` `.fw-600` `.nowrap` `.sr-only` |

### 6.4 Câu trên nút và hộp thoại

- Nút ghi động từ cụ thể: "Gửi phiếu", "Lưu nháp", "Duyệt", "Hủy thông báo nghỉ". **KHÔNG** "OK", "Đồng ý", "Có", "Submit", "Xác nhận" chung chung.
- Hộp xác nhận: nút hành động lặp lại đúng hành động ("Hủy phiếu", "Ký và nộp phiếu"); "Quay lại" là nút phụ. Xóa/hủy dùng variant nguy hiểm, icon tông đỏ.
- In / Xuất / Xem trước là nút thường, trừ trang in (In là nút chính). Nút chính trong dòng bảng: `.btn--primary.btn--sm`.

---

## 7. Khung và điều hướng

### 7.1 Web

```
┌───────────┬──────────────────────────────────────────────┐
│ Sidebar   │ Topbar 64: tìm chức năng (Ctrl K) · Tạo nhanh │
│ nổi, cách │            · năm học · chuông                  │
│ mép 12,   ├──────────────────────────────────────────────┤
│ bo 32     │ Breadcrumb                                    │
│ logo + ⇤  │ Dải đầu trang 140 (tiêu đề + tranh)           │
│ MENU      │ Nội dung trên tranh nền mờ                     │
│ CHUNG     │ (thanh nút kính dính đáy khi là form)          │
│ tài khoản │ Footer                                        │
└───────────┴──────────────────────────────────────────────┘
```

| Phần | File | Quy tắc |
| --- | --- | --- |
| Sidebar | `layouts/Sidebar.jsx` + `menuConfig.js` | Một kiểu cho mọi vai trò; mỗi mục khai báo **một lần**, `MENUS` chỉ chọn vai trò thấy gì. Cùng chức năng cùng tên, icon, vị trí. Mục chọn nền `primarySoft` chữ `primary`; tài khoản ghim đáy |
| Topbar | `layouts/Header.jsx`, `HeaderSearch.jsx`, `QuickCreateMenu.jsx` | Giống mọi vai trò: tìm chức năng, Tạo nhanh (ẩn khi vai trò không có mục), năm học, chuông. Không thêm nút riêng module |
| Năm học | `contexts/SchoolYearContext.jsx` | `useSchoolYear()`; module phụ thuộc năm học truyền vào service |
| Thông báo | `layouts/NotificationBell.jsx` | Không tự làm chuông riêng |
| Footer | `layouts/Footer.jsx` | Lấy từ `config/app.js`; không sửa trong trang |
| Breadcrumb | `<Breadcrumb items />` | **Bắt buộc** đầu mọi trang trong app, bắt đầu `{ label: 'Trang chủ', to: '/' }`; mục cuối thành tiêu đề tab (`<tên trang> · CareNest`) |
| Tiêu đề trang | `.page__head` (dải có tranh) hoặc `h1.page__title` | Ngay dưới breadcrumb, trùng hoặc rõ hơn mục cuối breadcrumb |
| Trang ngoài app | `layouts/AuthLayout.jsx` | Đăng nhập, quên mật khẩu, OTP, đặt lại mật khẩu |

Mốc màn: ≥1366 mục tiêu · ≤1280 lưới 2–3 cột về ít cột · <1024 sidebar thành ngăn kéo (Esc, bấm nền, đổi trang đều đóng) · ≤900 đăng nhập ẩn khối giới thiệu · ≥768 mức hỗ trợ thấp nhất (không làm bản điện thoại cho web).

### 7.2 App

```
┌──────────────────────────┐
│ status bar               │
│ (hero tranh ở Hôm nay)   │
│ AppBar 56 ở màn con      │
│ nội dung một cột         │
│ (nút chính dính đáy)     │
├──────────────────────────┤
│ thanh điều hướng 3–5 mục │
└──────────────────────────┘
```

- Mục chọn ở thanh đáy: viên 64×32 nền `primarySoft` sau icon, icon + nhãn `primary`. Nhãn luôn hiện. Số chưa đọc: viên đỏ chữ trắng.
- Màn tab: tiêu đề lớn trong nội dung. Màn con: AppBar trắng, nút ←, tiêu đề căn trái.

| Vai trò | Tab |
| --- | --- |
| Phụ huynh | Hôm nay · Bé · Thông báo · Tài khoản |
| Giáo viên | Hôm nay · Lớp · Thông báo · Tài khoản (PROPOSED) |
| Bếp | Hôm nay · Bếp · Thông báo · Tài khoản (cần đối chiếu phạm vi) |

- Ngữ cảnh đang chọn (con, lớp, điểm trường) hiện bằng chip có avatar/tên + mũi tên, chạm mở sheet chọn.

---

## 8. Công thức màn

### 8.1 Bảng đối chiếu

| Loại | Web | App |
| --- | --- | --- |
| Tổng quan | Dải chào + hàng lối tắt + thẻ số liệu tự giãn (`auto-fit`) + board 2/3 việc cần xử lý · 1/3 thông tin hôm nay | Hero + card theo mức quan trọng (tối đa 3) + 1–2 lối tắt |
| Danh sách | Dải đầu trang + nút chính bên phải → thẻ số liệu (lọc nhanh) → card gồm `filter-bar` + bảng sọc + `‹ 1 2 3 ›`. Rỗng: `EmptyState` có nút | AppBar + segmented/dải ngày + card chứa dòng danh sách nhóm theo ngày + tải thêm |
| Danh sách việc của tôi | Banner hướng dẫn → tab theo trạng thái có số đếm → bảng có nút chính từng dòng | Segmented theo trạng thái → dòng danh sách |
| Chi tiết ngắn | Panel phải 480–560 có "Mở toàn trang" | Bottom sheet |
| Chi tiết chứng từ | Tiêu đề + badge `size="lg"` + nút hành động → `<ProgressSteps>` → banner việc cần làm → `.detail-layout` 2/3 thông tin · 1/3 lịch sử → **khối chữ ký cuối** → `.page-actions` | Màn con: card thông tin xếp dọc, lịch sử dưới, nút dính đáy |
| Tạo / sửa | Một cột, các khối `card`; wizard thì `<Stepper>`; thanh nút kính dính đáy (trái Quay lại, phải Lưu nháp + nút chính) | Một cột, nút dính đáy |
| Thao tác của người được giao | Banner hướng dẫn → thông tin → bảng nhập → chữ ký của tôi → nút | Tương tự, một cột |
| Hồ sơ | Đầu hồ sơ (avatar, mã · lớp) + 2 tab segmented | Đầu hồ sơ + danh sách lối vào |
| In | Trái Quay lại, phải `<PrintToolbar>` → `.print-sheet` A4 | — |
| Đăng nhập | `AuthLayout`: chia đôi tranh + giới thiệu kính · form kính; ≤900 form lên đầu | Tranh trên, sheet form dưới |

Một màn **không** tự thêm khối ngoài phạm vi chức năng (không khối gợi ý, không số liệu bịa).

### 8.2 Màn phụ huynh (app)

Field thật theo DTO BE (P-13b PENDING) — field không có thì bỏ dòng. Mẫu: `mockups/parent-app-demo/`.

| Màn | Thành phần theo thứ tự |
| --- | --- |
| Đăng nhập | Tranh · logo · "Chào mừng phụ huynh" · tài khoản · mật khẩu · "Quên mật khẩu" · "Đăng nhập". Không nút đăng ký |
| Hôm nay | Hero + chào + chip chọn con · card Điểm danh (badge + giờ) · card Bữa ăn hôm nay · card Cập nhật mới. Trường nghỉ ⇒ banner xám thay card Điểm danh |
| Bé | Avatar + chip chọn con + lớp · điểm trường · card lối vào (Điểm danh, Thực đơn, Sức khỏe, Cập nhật phát triển, Thông báo nghỉ) · card Thông tin của bé |
| Điểm danh | Segmented Tuần · Tháng · lịch tháng chấm theo tông 3.2 + chú giải · dòng tổng chỉ khi BE trả |
| Thực đơn | Dải ngày · banner dị ứng (cam) nếu BE trả · mỗi bữa một card, mỗi món một dòng; chỉ thực đơn đã công bố (NUT-08) |
| Sức khỏe | Card lần đo gần nhất (số lớn) · biểu đồ một màu `primary` · danh sách lần khám; không màu đánh giá; diễn giải AI chỉ khi đã duyệt (HLT-05) |
| Cập nhật phát triển | Dòng thời gian theo tháng, trích 3 dòng; chỉ mục đã duyệt (OBS-03/05) |
| Thông báo nghỉ | Danh sách (Đã gửi / Đã hủy, không chờ duyệt — ATT-05) · form Từ–Đến ngày, lý do chip, ghi chú · lớp phủ gửi · chi tiết + toast + banner phản hồi BE · nút nguy hiểm "Hủy thông báo nghỉ" |
| Thông báo | Nhóm Hôm nay / Hôm qua / Trước đó, chấm chưa đọc |
| Tài khoản | Avatar + tên + SĐT · Con của tôi · cài đặt · "Đăng xuất" nguy hiểm |

---

## 9. Trạng thái bắt buộc

| Trạng thái | Hiển thị | Web | App |
| --- | --- | --- | --- |
| Tải lần đầu | Khung chờ đúng hình | `<SkeletonRows rows cols>`, `.skeleton`, `<LoadingState>` | `AppSkeleton` |
| Tải lại | Giữ dữ liệu, chỉ báo mảnh | `reload({ silent: true })` | kéo xuống + thanh mảnh dưới AppBar |
| Rỗng | Tranh nhỏ + câu nói khi nào sẽ có / làm gì tiếp | `<EmptyState title description action>` | `AppEmptyState` |
| Lọc không ra kết quả | Rỗng + nút "Đặt lại bộ lọc" | `EmptyState` | `AppEmptyState` |
| Mất mạng / lỗi tải | Icon + câu cụ thể + "Thử lại" | `<ErrorState error onRetry>` | `AppErrorState` |
| Không có quyền / không còn | "Bạn không có quyền xem nội dung này" / "Nội dung không còn" + nút về trang chủ | `RoleGuard` hoặc `EmptyState` icon `Lock` | `AppErrorState` |
| Lỗi trường | Dưới ô, màu lỗi + icon; lỗi 400 BE map đúng trường | `.field__error` | `errorText` |
| Đang gửi form | Lớp phủ gửi, khóa gửi lặp | `<SubmitOverlay>` | `AppSubmitOverlay` |
| Thao tác nhỏ đang chạy | Nút `disabled` + ba chấm nhỏ trong nút | `<Spinner small>` | `AppButton(isLoading)` |
| Kết quả thao tác | Toast nền màu | `toast.success` / `toast.error(err.message, 'Không … được')` | `AppToast` |
| Hành động không hoàn tác | Hộp xác nhận | `<ConfirmationModal danger>` | `AppConfirmationDialog` |
| Field thiếu | Ẩn dòng hoặc "Chưa cập nhật" (phụ huynh: "Nhà trường chưa cập nhật") | | |

Không spinner giữa màn cho lần tải đầu. Lỗi dùng icon, không tranh.

---

## 10. Câu chữ

### 10.1 Quy tắc

- Tiếng Việt có dấu, câu ngắn, chủ động, xưng hô trung tính ("bạn"). Nút là động từ (mục 6.4).
- Lỗi nói **cái gì sai + làm gì để sửa**, không đổ lỗi: "Ghế nhựa: lệch sổ sách, bắt buộc ghi chú"; "Chưa chọn ngày bắt đầu nghỉ". Không "Dữ liệu không hợp lệ".
- Nhãn ô nhập bắt buộc có `*`; placeholder chỉ gợi ý định dạng, không thay nhãn.
- Ngày `dd/mm/yyyy` (`formatDate`), ngày giờ `dd/mm/yyyy HH:mm` (`formatDateTime`); app ngày gần "Thứ Sáu, 9/10"; giờ 24h; số thập phân dấu phẩy "104,5 cm".
- Mã chứng từ in đậm màu `primary`.
- Không hiện mã kỹ thuật (`APPROVED`, `null`, ID) cho người dùng. Không emoji.

### 10.2 Thuật ngữ

| Dùng (nhân viên — web, app GV/bếp) | Dùng (phụ huynh) | Không dùng |
| --- | --- | --- |
| trẻ | bé, con | học sinh |
| giáo viên | cô giáo | GVCN (trong câu) |
| Ban giám hiệu, Hiệu trưởng, Phó hiệu trưởng | nhà trường | admin, BGH (trong câu) |
| điểm trường | điểm trường | campus, cơ sở |
| thông báo nghỉ | thông báo nghỉ, báo nghỉ | đơn nghỉ, đơn xin phép |
| thực đơn, suất ăn | thực đơn, bữa sáng/trưa/chiều | MealPlan |
| chờ duyệt, đã duyệt, trả lại | — | pending, approved |
| Chưa cập nhật | Nhà trường chưa cập nhật | null, Không có dữ liệu |

---

## 11. Trợ năng và riêng tư

- Tương phản ≥4,5:1 cho chữ (chữ ≥18,66px: ≥3:1); mọi cặp trong mục 3 đã đo. Thêm cặp mới ⇒ đo và ghi số vào bảng.
- Không truyền thông tin chỉ bằng màu: badge có chữ, lịch có chú giải, dị ứng có chữ/icon.
- Web: điều khiển được bằng bàn phím, focus ring luôn thấy, modal giữ tiêu điểm, Esc đóng lớp nổi.
- App: vùng chạm ≥48, `Semantics` cho icon đơn và chấm chưa đọc, chữ 2,0 không cắt nội dung.
- Thông báo đẩy, màn khóa không mang dữ liệu sức khỏe.
- Đổi tài khoản/đăng xuất ⇒ không thoáng hiện dữ liệu tài khoản trước.

---

## 12. Thêm hoặc đổi style

| Việc | Làm |
| --- | --- |
| Màu mới | Đặt tên theo nghĩa → đo tương phản → thêm vào **cả** `tokens.css` và `colors.dart` → thêm dòng mục 3 |
| Cỡ chữ mới | Không thêm; chọn vai trò gần nhất ở 3.4. Thật sự thiếu ⇒ sửa file này trước |
| Component mới | Kiểm mục 6 → thêm vào phần dùng chung của repo đang làm → thêm vào `/ui-kit` hoặc UiKitScreen đủ trạng thái → thêm dòng mục 6 (ghi *mới* cho repo chưa có). Mẫu dùng ≥2 chỗ thì phải chuyển lên dùng chung |
| Map trạng thái mới | Thêm dòng bảng 3.2; cùng tông ở cả hai repo |
| Ngoại lệ một chỗ | Comment 1 dòng nói lý do + ghi trong PR "lệch design system ở …" |
| Đổi giá trị token | PR riêng: token cả hai repo + file này + ảnh `/ui-kit` / UiKitScreen trước–sau |
| Khác giữa web và app | Thêm dòng bảng 1.3 kèm lý do trước khi làm |

Mỗi lần sửa: tăng phiên bản đầu file, ghi một dòng mục 16, chép file sang repo còn lại (khi đã nối).

---

## 13. Tự kiểm trước khi báo xong

### 13.1 Web (gốc `CareNest_FE`)

```bash
# Mã màu ngoài file token (phải giảm dần về 0; mục 14)
grep -rnoE "#[0-9a-fA-F]{6}\b|#[0-9a-fA-F]{3}\b" src --include=*.css --include=*.jsx --include=*.js | grep -vE "tokens\.css|print\.css"
# Bo góc, cỡ chữ viết px; đậm 800
grep -rnE "border-radius: *[0-9]+px|font-size: *[0-9]+px|font-weight: *800" src --include=*.css | grep -v tokens.css
# Icon import ngoài file ánh xạ
grep -rln "@tabler/icons-react" src | grep -v "components/ui/icons.js"
# Inline style trong file vừa sửa (chỉ giá trị động)
git diff --name-only | grep "\.jsx$" | xargs -r grep -n "style={{"
```

Rồi `node scripts/verify.mjs`. Dòng mới sinh ra từ thay đổi của mình phải bằng 0.

### 13.2 App (gốc `CareNest_APP`)

```bash
grep -rnE "Color\(0x|Colors\.(white|black|grey|red|blue|green)" lib --include=*.dart | grep -vE "core/constants/(colors|sizes)\.dart"
grep -rnE "fontSize:|fontWeight:" lib/features --include=*.dart
grep -rnE "BorderRadius\.circular\([1-9]|EdgeInsets\.[a-zA-Z]+\([^)]*[1-9]|SizedBox\((width|height): *[1-9]" lib/features --include=*.dart
grep -rnE "Icons\.|TablerIcons\." lib/features --include=*.dart
grep -rn "BackdropFilter" lib --include=*.dart | grep -v "app_hero_scene.dart"
grep -rnE "\b(ElevatedButton|AlertDialog|SnackBar|ListTile|CircleAvatar)\(" lib/features --include=*.dart
```

Rồi `node scripts/verify.mjs`.

### 13.3 Checklist

- [ ] Chỉ token và component chung (mục 2).
- [ ] Một nút chính mỗi vùng; câu nút là động từ.
- [ ] Đủ trạng thái mục 9; hành động không hoàn tác có hộp xác nhận.
- [ ] Màu trạng thái đúng bảng 3.2, cùng tông với nền tảng kia.
- [ ] Thuật ngữ đúng bảng 10.2 theo người đọc.
- [ ] Web: breadcrumb + tiêu đề trang; không tràn ngang 768–1440; bàn phím dùng được. App: 360pt và chữ 2,0 không cắt.
- [ ] Không dữ liệu/ảnh trẻ thật.
- [ ] Component mới có trong `/ui-kit` / UiKitScreen và mục 6.
- [ ] Phần code: checklist `docs/architecture/CODING_GUIDE.md` mục 9.

---

## 14. Nợ hiện tại

### 14.1 Web (đo 2026-10-09)

| Mục | Hiện tại | Đích |
| --- | --- | --- |
| Mã màu ngoài token | 71 chỗ | 0 (trừ màu từ dữ liệu) |
| `style={{` | 452 | <80, chỉ giá trị động (AC-6 plan v2) |
| `border-radius` px ngoài token | 48 | 0 |
| `font-weight: 800` | 4 chỗ (vd. `.stat-card__value`); font chỉ tải 400–700 nên trình duyệt tự làm đậm | 700 |
| Tên tông `purple` | Tông vàng chờ duyệt | Giữ; code mới dùng `--tone-approval` |

### 14.2 App

| File | Hiện tại | Đích |
| --- | --- | --- |
| `colors.dart` | `primary #1565E0`, `background #F5F8FC`, `textMuted #8592A6`, tông `purple` | Mục 3.1–3.3 |
| `app_status_colors.dart` | `enum AppStatusTone { neutral, info, warning, purple, danger, success, teal }` | `{ gray, orange, blue, approval, red, green, teal }` — cùng tên web |
| `app_text_styles.dart` | titleLarge 20, titleMedium 16, labelLarge 14, labelMedium 12/500 | Mục 3.4 |
| `sizes.dart` | Radius 8/12/20, nút 48, `space7 = 32`, `cardPadding 16` | Mục 3.5–3.7 |
| `app_button.dart` | `danger` đỏ đặc chữ trắng; loading vòng quay | Nền đỏ nhạt chữ đỏ; ba chấm |
| `app_status_badge.dart` | Padding 8/2, chữ 12 | Cao 28, chữ 13/600, nền 16%, viền 34% |
| Chưa có | — | `motion.dart`, `app_icons.dart`, `AppShadows`, widget *mới* ở mục 6 |
| `CareNest_APP/DESIGN.md` §3–9 | Theo web v1 | Thay bằng file này (Phụ lục A) |

Đổi token app = làn L ở APP (đổi nền dùng chung): một PR "theme v2" trước khi dựng màn mới.

---

## 15. Điểm còn mở

| # | Điểm | Ai chốt | Tạm thời |
| --- | --- | --- | --- |
| 1 | Field phụ huynh được xem (P-13b) | BGH + BE | Dựng khung, field không có thì bỏ dòng |
| 2 | Gói Tabler cho Flutter | Team APP (dependency) | `AppIcons` trỏ Material rounded |
| 3 | Cấu hình tranh cấp trường (`GET /school/appearance`) | BE | Web mock; app cố định T0 |
| 4 | Ngưỡng tham chiếu sức khỏe (P-13) | BGH + BE | Không màu, không nhãn đánh giá |
| 5 | Tab và màn của giáo viên, bếp trên app | Team | Dùng token + component này; công thức màn bổ sung sau |
| 6 | Đăng nhập: form app/web hay Keycloak | BE | Giữ tranh + logo; phần form theo kết quả |
| 7 | Một nguồn token sinh tự động cho web + app | Team | Hai file token chép tay, kiểm bằng bảng mục 3 |
| 8 | Nối file này vào `CareNest_APP` | User | Chưa nối; APP vẫn dùng `DESIGN.md` riêng |

---

## 16. Lịch sử

| Phiên bản | Ngày | Thay đổi |
| --- | --- | --- |
| 1.0 | 2026-10-09 | Spec app phụ huynh, dịch từ web v2 |
| 2.0 | 2026-10-09 | Luật cho AI, token dạng Dart, lệnh tự kiểm cho app |
| 3.0 | 2026-10-09 | Design system chung web + app: bảng giống/khác, token hai cột tên, component tương đương |
| 3.1 | 2026-10-09 | Thay toàn bộ `DESIGN.md` cũ (v1) của web; thêm logo, danh mục web, công thức trang web, trạng thái, câu chữ từ bản cũ; phần code chuyển sang `docs/architecture/CODING_GUIDE.md` |

---

## Phụ lục A — Nối vào repo để AI tự đọc

**Web (`CareNest_FE`)** — đã nối: `AGENTS.md` mục Stack trỏ tới file này; `.claude/rules/ui-style.md` tự nạp khi sửa `src/**/*.jsx`, `src/**/*.css`.

**App (`CareNest_APP`)** — chưa nối, cần cho phép sửa repo APP:
1. Tách phần không phải giao diện của `CareNest_APP/DESIGN.md` (mục 1–2, 10–18: chạy dự án, thư mục, kiến trúc, auth/token, API, nối Spring Boot…) sang `docs/architecture/CODING_GUIDE.md`, rồi thay `DESIGN.md` bằng file này. Cập nhật comment `DESIGN.md §…` trong `lib/`.
2. `AGENTS.md` mục Stack: `Giao diện: theo DESIGN.md (chung với web). Luật cứng mục 2, tự kiểm mục 13.2.`
3. Tạo `.claude/rules/ui-style.md` (paths `lib/features/**/presentation/**/*.dart`, `lib/core/widgets/**/*.dart`, `lib/core/theme/**/*.dart`, `lib/core/constants/**/*.dart`) tóm mục 2.1, 2.3, 3.2, 9, 10, 13.2.
4. Chạy `node scripts/check-ai-layer.mjs` và `node scripts/verify.mjs` ở APP.
