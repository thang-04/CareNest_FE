# Thẻ UI — đọc file này trước khi viết hoặc sửa giao diện Web

Bản rút gọn của `DESIGN.md` cho người và AI agent. Đủ cho việc dựng/sửa màn thông thường; chỉ mở `DESIGN.md` khi cần chi tiết (token §3, danh mục đầy đủ §6.3, công thức màn §8, trạng thái §9, thuật ngữ §10).
Xem trực tiếp mọi component: chạy dev rồi mở `/ui-kit` (mục `#primitives` là khung màn chuẩn).

## 1. Dùng component nào

Màn mới và màn đang sửa **bắt buộc** dùng bảng này; không viết tay `<button>`, `<table>`, `<input>`, `<select>`, `<textarea>` trong `src/pages/**` và `src/components/<module>/**` (`check-design` chặn file mới và file tăng vi phạm).
Import từ `@/components` trừ khi cột "Từ" ghi khác.

| Cần | Dùng | Từ |
| --- | --- | --- |
| Khung màn danh sách (đầu trang + thẻ + lọc + bảng) | `ListPage` | `@/components` |
| Đầu trang (breadcrumb, tiêu đề, nút) | `PageHeader` | `@/components` |
| Bảng danh sách có đang tải / trống / lỗi / phân trang | `DataTable` | `@/components` |
| Nút (kể cả nút đang gửi) | `Button` — `variant`, `size`, `icon`, `loading` | `@/components` |
| Ô nhập có nhãn + lỗi | `TextField`, `SelectField`, `TextAreaField`; ô đặc biệt bọc `FormField` | `@/components` |
| Ngày, tuần, học kỳ, mật khẩu | `DateInput`, `WeekPicker`, `SemesterSelect`, `PasswordInput` | `@/components/form/…` |
| Chọn có tìm kiếm | `SearchSelect` | `@/components` |
| Ô tìm trong thanh lọc | `SearchSubmit` | `@/components/ui/SearchSubmit` |
| Bộ lọc đồng bộ URL + chip đang lọc | `useFilterParams` + `FilterChips` | `@/hooks/useFilterParams`, `@/components/ui/FilterChips` |
| Chọn điểm trường | `CampusFilter` | `@/components/ui/CampusFilter` |
| Tab | `Tabs` | `@/components/ui/Tabs` |
| Modal / form trong modal | `Modal` | `@/components` |
| Hộp xác nhận (xóa, gửi, duyệt) | `ConfirmationModal` (tự khóa nút khi đang chạy) | `@/components` |
| Đang tải / trống / lỗi ngoài bảng | `LoadingState`, `EmptyState`, `ErrorState` (tự xử lý 401/403/404) | `@/components` |
| Che màn khi đang gửi | `SubmitOverlay` | `@/components` |
| Thông báo kết quả | `useToast()` — lỗi: `toast.error(err, 'Tiêu đề')` | `@/contexts/ToastContext` |
| Nhãn trạng thái | `createStatusBadge` (mỗi feature một bảng map) | `@/components` |
| Thao tác trên dòng | `RowActions`, `RowMenu` | `@/components` |
| Hàng bảng bấm được | `clickableRowProps` (hoặc `onRowClick` của `DataTable`) | `@/utils/clickableRow` |
| Thẻ số liệu | `StatCard` | `@/components` |
| Icon | chỉ qua `@/components/ui/icons` | — |
| Nhãn lặp lại (Lưu, Hủy, Đóng, Đang lưu…) | `LABELS` | `@/components` |

Thiếu component ⇒ thêm vào `src/components/ui` (vùng dùng chung: in bản tác động trước, AGENTS.md › Chế độ làm việc) và thêm vào `/ui-kit`; không dựng bản riêng trong module. Màn mẫu: `src/pages/kitchen/SupplierListPage.jsx`.

## 2. Luật cứng

1. Màu, cỡ chữ, khoảng cách, bo góc, bóng, `z-index` chỉ qua `var(--token)` semantic trong `src/styles/tokens.css`. Không mã hex, không px cứng, không token nguyên thủy (`--blue-700`).
2. `style={{}}` chỉ cho giá trị động (chiều rộng %, màu từ dữ liệu). Khoảng cách/chữ dùng class tiện ích (`.mt-16`, `.text-sm`, `.fw-600`).
3. CSS module (`src/styles/modules/<module>.css`) chỉ chứa class có tiền tố của module; **không** viết lại `.btn`, `.card`, `.table`, `.modal`, `.tabs`, `.filter-bar`, `.page__head`. Cần biến thể ⇒ thêm vào phần chung.
4. Không import CSS của module khác. Class nhiều module cần ⇒ chuyển vào `src/styles/components.css`.
5. Mỗi vùng thao tác (đầu trang, chân modal, thanh lọc) một nút chính (`variant="primary"`). Chữ trên nút là động từ.
6. Màn tải dữ liệu đủ: đang tải, trống, lỗi, 403, 404. Thao tác ghi: khóa nút khi đang gửi (`loading`), giữ dữ liệu người dùng khi lỗi, hiện lỗi field BE trả về.
7. Hành động không hoàn tác được có `ConfirmationModal`.
8. Phần tử bấm được là `Button`/`a`; không `onClick` trên `div/tr/td` (hàng bảng dùng `clickableRowProps`). Nút chỉ có icon có `aria-label`.
9. Không cuộn ngang trang ở 360–1440px: bảng nằm trong `.table-wrap` (`DataTable` đã có).
10. Không tự tính nghiệp vụ ở UI (số suất, tổng hợp, trạng thái); hiển thị giá trị BE trả. Ẩn nút theo quyền chỉ là UX.
11. Màu trạng thái luôn kèm chữ. Không tô màu đánh giá số đo sức khỏe khi BE không trả nhãn.
12. Không dữ liệu/ảnh trẻ thật trong mock, test, ảnh chụp.
13. Hàm ngày/số dùng `src/utils/format.js`; thiếu thì thêm một lần ở đó, không viết lại trong module.

## 3. Tự kiểm trước khi báo xong

- [ ] Chỉ component ở mục 1 và token; `node scripts/check-design.mjs` pass.
- [ ] Một nút chính mỗi vùng; nhãn lấy từ `LABELS` khi có.
- [ ] Đủ đang tải / trống / lỗi / 403 / 404; nút gửi khóa khi đang gửi; có hộp xác nhận cho thao tác không hoàn tác.
- [ ] Có breadcrumb + tiêu đề trang (`PageHeader`/`ListPage`).
- [ ] Mở màn ở 360, 768, 1440px: không tràn ngang; dùng được bằng bàn phím (Tab, Enter).
- [ ] Thuật ngữ đúng `DESIGN.md` §10.2; không dữ liệu trẻ thật.
- [ ] Component chung mới đã có trong `/ui-kit` và bảng mục 1.
- [ ] Sửa `src/components/ui`, `src/styles/*.css`, layout, route/menu ⇒ đã in bản tác động (`node scripts/ai-layer/impact.mjs <file>`) và được người làm đồng ý.
