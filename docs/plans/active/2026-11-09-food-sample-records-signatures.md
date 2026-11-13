---
title: Kiểm thực ba bước (M1–M3) do PHT điền trên Web, lưu mẫu (M4, M5) do bếp ghi, chữ ký ảnh và xuất văn bản
status: approved
owner: carenestg94@gmail.com
jira: chưa có / FE-FEAT-?   # cần tạo task Jira riêng (gồm task BE, APP) trước khi commit
branch: fix/G94-272-FE-FIX-01-e2e-flow-fixes   # nhánh hiện tại; đổi sang nhánh feature riêng khi có mã Jira
modules: [kitchen, account]
rules: [NUT-21, AUTH-20, AUTH-21, AUTH-22]
risk: high
created: 2026-11-09
updated: 2026-11-09
---

# Kiểm thực ba bước (M1–M3) do PHT điền trên Web, lưu mẫu (M4, M5) do bếp ghi, chữ ký ảnh và xuất văn bản

Plan làm theo chế độ tự chạy (CLAUDE.md, user chốt 2026-10-23): các lựa chọn ở "Key decisions" và "Giả định" là phương án khuyến nghị agent tự chọn, chờ user soát. Plan FE; phần BE/APP chỉ liệt kê contract cần thống nhất, plan chính phải đặt ở `BE:docs/plans/active/` (cần user cho phép sửa repo BE). Chưa code gì.

## Context

- Yêu cầu user 2026-11-09: làm các màn văn bản giống PMS để xử lý biên bản và xuất văn bản; thay ô nhập họ tên bằng **ảnh chữ ký** người dùng tải lên và lưu kèm văn bản.
- **Phân vai user chốt 2026-11-09:** PHT điền thông tin các mẫu **M1, M2, M3** (kiểm thực ba bước) trên Web; **lưu mẫu do bếp ghi** (M5, nhãn M4), như luồng hiện có trên App.
- PMS (`qlmn.vn`, xem chỉ đọc 09/11, ngày 06/11 có dữ liệu): các mẫu theo Số 1246/QĐ-Bộ Y tế, đều là **bảng nhập ngay trên trang in** có nút In / Excel / Lưu; dòng món, bữa, số suất tự điền từ thực đơn ngày, các ô còn lại gõ chữ tự do:
  - **M1 tươi** (Bước 1, Mẫu 1, mục I): thực phẩm tươi sống — thời gian nhập, khối lượng, nơi cung cấp (tên cơ sở, địa chỉ + điện thoại, người giao hàng), chứng từ/hóa đơn, giấy ĐK VS thú y, giấy kiểm dịch, cảm quan (Đạt/Không), xét nghiệm nhanh (Đạt/Không), biện pháp xử lý.
  - **M1 khô** (Mẫu 1, mục II): thực phẩm khô/bao gói — cơ sở sản xuất, địa chỉ sản xuất, thời gian nhập, khối lượng, nơi cung cấp, hạn sử dụng, điều kiện bảo quản, chứng từ, cảm quan (nhãn, bao bì, hạn dùng), biện pháp xử lý.
  - **M2** (Bước 2, Mẫu 2): kiểm tra khi chế biến — theo bữa/món: nguyên liệu chính, số suất, giờ sơ chế xong, giờ chế biến xong, vệ sinh (người tham gia, dụng cụ, khu vực), cảm quan, biện pháp xử lý.
  - **M3** (Bước 3): kiểm tra trước khi ăn — số suất, giờ chia xong, giờ bắt đầu ăn, dụng cụ chia đựng, cảm quan, biện pháp xử lý. Bản gộp M3 + lưu mẫu cũng có.
  - **M5** theo dõi lưu và hủy mẫu: khối lượng/thể tích, dụng cụ chứa, nhiệt độ bảo quản, giờ lấy mẫu, giờ hủy mẫu, ghi chú chất lượng, người lưu/hủy mẫu. **M4** nhãn dán hộp mẫu (tên món theo bữa, giờ lấy mẫu, ba chữ ký).
  - Chân trang ký: Người trực tiếp nấu ăn, Người kiểm tra (hai ô), NV Y tế hoặc thanh tra. PMS chỉ nhập họ tên bằng chữ; không có trạng thái duyệt, không kiểm 24 giờ; nhiều ô sai cột/sai ngày.
- Hiện trạng CareNest:
  - **Chưa có** màn kiểm thực M1–M3 nào. Phần liên quan có sẵn: kiểm nhận hàng tươi hai lần (`GET|PUT /nutrition/fresh-checks`, `BE:docs/modules/nutrition.md:41`) và phiếu nhập kho khô; web ghi bởi PHT theo `STOCK_MANAGE`.
  - Bản ghi lưu mẫu BE chỉ có món, giờ lấy mẫu, ghi chú, người ghi, trạng thái duyệt/hủy (`BE:src/main/resources/db/migration/V61__create_kitchen_records.sql:3-35`); **không có** khối lượng, dụng cụ chứa, nhiệt độ, chữ ký. Bếp ghi qua App, Web chỉ xem và duyệt (`src/pages/kitchen/FoodSampleQueuePage.jsx:63`, `src/services/kitchenRecordsApi.js:3-5`).
  - Bản in lưu mẫu hiện có là sổ chung, ô ký để trống, ghi rõ "mẫu sổ chưa chốt (P-26)" (`src/components/kitchen/FoodSampleFormPrint.jsx:7-9`, `:25-27`); xuất Excel chỉ 8 cột (`src/utils/kitchen/kitchenExport.js:19-21`).
  - Chữ ký: FE đã có `SignaturePicker`, `SignatureUploader` (PNG/JPG ≤2 MB, nén, ≤5 chữ ký/tài khoản — `src/components/signature/SignatureUploader.jsx:7-27`, `src/mocks/signatureMockRepository.js:4-26`) nhưng service chỉ chạy **demo** (`src/config/integrationModules.js:205-209`), gọi `/signatures/me` mà **BE chưa có** (`src/services/signatureService.js:6-11`). Chuẩn chữ ký trên chứng từ đã viết ở `docs/architecture/CODING_GUIDE.md:256-261`; in/xuất chuẩn ở `:263-268`.
  - Công cụ xuất có sẵn, không cần dependency mới: `window.print()`, `exportElementToPdf` (jspdf + html2canvas), Excel `downloadXlsx`/`exportWithPreview` (`src/components/ui/ExportPreview.jsx:1-30`).
- Rule liên quan: NUT-21 nói bếp ghi trên App, PHT duyệt, **chữ ký lấy trên giấy ngoài hệ thống** (`BE:docs/business/BUSINESS_RULES.md:124`); P-26 (mẫu sổ lưu mẫu) và P-27 (kiểm thực ba bước) còn mở (`:369-370`). Phân vai mới **khớp** AUTH-21 (bếp chỉ dùng App, `:35`) và AUTH-22 (tổ bếp dùng chung tài khoản, `:36`): PHT làm trên Web, bếp vẫn trên App.

## Quyết định đã chốt

1. Làm màn văn bản giống PMS và có xuất văn bản — user, 2026-11-09.
2. Chữ ký là **ảnh do người dùng tải lên** và lưu kèm văn bản, không chỉ nhập họ tên — user, 2026-11-09.
3. **PHT điền M1–M3** (Web); **bếp ghi lưu mẫu** (App, như hiện có) — user, 2026-11-09.

## Làm rõ nghiệp vụ

Theo `.ai/workflows/clarify-business.md`.
- **Hiểu nghiệp vụ:** actor = PHT dinh dưỡng (điền, ký M1–M3, duyệt lưu/hủy mẫu), bếp (ghi lưu/hủy mẫu trên App) · outcome = hồ sơ kiểm thực ba bước và lưu mẫu của từng ngày–điểm trường, ký ảnh, xuất In/PDF/Excel dùng cho lưu hồ sơ và thanh tra · rule NUT-21 (CONFIRMED, cần sửa phần "ký giấy"), P-26, P-27 (OPEN) · flow `[B]` điền + ký, `[S]` xuất file.
- **Đối chiếu thiết kế ban đầu:** NUT-21 giữ ký giấy ngoài hệ thống (`BUSINESS_RULES.md:124`); bước 5 "Tiếp nhận" ghi nhận hàng tươi/khô nhưng chưa có kiểm thực M1 (`BE:docs/business/flows/meal-management-permissions.md`, bảng bước 5–8).
- **Ảnh hưởng:** nutrition (BE: bảng + API kiểm thực, mở rộng lưu mẫu, mã quyền), identity-access (chữ ký tài khoản) · quyền/scope theo điểm trường (`FOOD_SAFETY_APPROVE`, `KITCHEN_RECORD`) · dữ liệu dẫn xuất: món, bữa, số suất từ thực đơn công bố và suất đã xác nhận, hàng nhập từ kiểm nhận/phiếu nhập (BE trả, FE không tính) · FE: `/kitchen/inspections/:date` (mới), `/kitchen/food-samples`, `/account/signatures` · APP: màn bếp ghi lưu mẫu thêm khối lượng/dụng cụ/nhiệt độ · dữ liệu cũ: bản ghi lưu mẫu hiện có hiển thị bình thường, trường mới để trống.

### Giả định đã tự chọn (chờ user soát)

- PHT làm M1–M3 dùng mã quyền hiện có `FOOD_SAFETY_APPROVE` (mặc định PHT dinh dưỡng, theo điểm trường, HT cấp — AUTH-20); không thêm mã mới.
- Dữ liệu M1 lấy sẵn từ kiểm nhận hàng tươi và phiếu nhập kho khô BE đã có; PHT chỉ bổ sung các trường kiểm thực (chứng từ, giấy VS thú y, kiểm dịch, cảm quan, xét nghiệm nhanh, biện pháp xử lý…), không nhập lại số liệu.
- Ô ký của **bếp** ("Người trực tiếp nấu ăn", người lưu/hủy mẫu) và **NV Y tế/thanh tra** không ký ảnh trong V1: bản in có ô trống để ký tay (bếp không dùng Web, tài khoản bếp dùng chung — AUTH-21/22). Chỉ PHT ký ảnh ở ô "Người kiểm tra".
- Bếp ghi lưu mẫu trên App như cũ, chỉ thêm các trường khối lượng/thể tích, dụng cụ chứa, nhiệt độ; PHT thấy và duyệt trên Web, không sửa nội dung bếp ghi.
- Ảnh chữ ký chỉ thay chữ ký tay trong hồ sơ nội bộ; **không phải chữ ký số có giá trị pháp lý**.
- Không kiểm khoảng nhiệt độ hay mốc đạt/không đạt ở FE; chỉ lưu giá trị nhập, cảnh báo (nếu có) do BE trả.
- M3 gộp, M3 riêng, M4 chỉ là cách in lại từ dữ liệu M3 (PHT) và lưu mẫu (bếp), không nhập hai lần.

### Câu hỏi mở
Còn `- [ ]` ⇒ không được `approved` (check-ai-layer E5).
- [x] Đổi NUT-21 (chữ ký ảnh trong hệ thống cho PHT thay vì giấy), đóng P-26 theo M4/M5 của PMS, đóng P-27 (kiểm thực M1–M3 ghi trên hệ thống do PHT điền): user xác nhận.
- [x] Ô ký của bếp và NV Y tế/thanh tra để trống ký tay sau khi in (giả định) hay bếp cũng phải ký ảnh: user duyệt plan giữ giả định, không có yêu cầu khác.
- [x] Ảnh chữ ký có đủ giá trị với thanh tra/Phòng GD hay phải in ký tay thêm: user duyệt plan giữ giả định (ảnh chữ ký không phải chữ ký số); bản in vẫn có ô ký tay.
- [x] M1 điền sẵn từ kiểm nhận và phiếu nhập kho khô đã có là đủ, hay trường muốn PHT nhập riêng một bảng kiểm thực độc lập: user duyệt plan giữ giả định (điền sẵn).

| Câu hỏi | Trả lời | Ai | Ngày | Rule/doc đã cập nhật |
| --- | --- | --- | --- | --- |
| Đổi NUT-21, đóng P-26, P-27 | Xác nhận | user | 2026-11-09 | chưa cập nhật `BE:docs/business/BUSINESS_RULES.md` (cần user cho phép sửa repo BE) |
| Ba câu còn lại | Duyệt plan, giữ giả định | user | 2026-11-09 | — |

## Acceptance criteria

- **AC-1** (`P-27`): Given PHT có quyền ở điểm trường, ngày có thực đơn công bố · When mở "Kiểm thực" ngày đó · Then có bốn tab M1 tươi, M1 khô, M2, M3; dòng món/bữa/số suất/hàng nhập do BE điền sẵn, các ô còn lại nhập được; ngày chưa có thực đơn thì EmptyState rõ lý do.
- **AC-2** (`P-27`): Given biên bản nháp · When lưu nháp rồi mở lại · Then dữ liệu giữ nguyên, chưa tính là đã ký.
- **AC-3** (`NUT-21`): Given PHT đã có chữ ký · When bấm Ký · Then bản ghi lưu kèm bản sao ảnh chữ ký chụp lúc ký (không đổi khi tài khoản đổi/xóa chữ ký sau đó), tên người ký, giờ ký, phiên bản; chưa có chữ ký thì dẫn tới "Chữ ký của tôi".
- **AC-4** (`NUT-21`): Given biên bản đã ký bị sửa nội dung · When lưu · Then chữ ký cũ `valid=false` kèm lý do, phải ký lại (`CODING_GUIDE.md:259-260`).
- **AC-5** (`NUT-21`): Given bếp ghi lưu mẫu trên App kèm khối lượng, dụng cụ, nhiệt độ · When PHT mở sổ lưu mẫu · Then thấy đủ các cột này, duyệt lưu mẫu rồi duyệt hủy mẫu (≥24 giờ, BE kiểm); mỗi lần duyệt có chữ ký ảnh của PHT; BE từ chối bước sớm/sai trạng thái, FE hiện đúng thông điệp BE.
- **AC-6** (`AUTH-20`): Given người không có quyền ở điểm trường · When mở hoặc gọi · Then chỉ xem (hoặc 403 hiện đúng); nút ghi/ký/duyệt ẩn theo cờ `can*` của BE.
- **AC-7** (`NUT-21`): Given biên bản đã ký/duyệt · When bấm In / Xuất PDF / Xuất Excel cho M1 (tươi, khô), M2, M3, M3 gộp, M4, M5 · Then bản xuất có đủ cột như PMS, tiêu đề đúng mẫu (Số 1246/QĐ-Bộ Y tế), ảnh chữ ký PHT ở ô "Người kiểm tra", các ô ký khác để trống ký tay; bản chưa ký hiện "Chưa xác nhận".
- **AC-8** (`AUTH-21`): Given người dùng Web · When vào "Chữ ký của tôi" · Then tải PNG/JPG ≤2 MB, xem trước, đặt mặc định, xóa; tối đa 5; ảnh chỉ tải qua API có xác thực, không URL công khai.
- **AC-9**: Given bản ghi lưu mẫu cũ chưa có trường mới · When xem · Then hiển thị bình thường, trường thiếu để trống, không lỗi.

## Key decisions

| Quyết định | Chọn | Phương án khác | Vì sao |
| --- | --- | --- | --- |
| Mô hình dữ liệu | **Mỗi bước một bản ghi chuẩn hóa** theo ngày–điểm trường (M1 tươi/khô, M2, M3 do PHT; lưu mẫu do bếp); các bản in (M3 gộp, M3 riêng, M4, M5) chỉ ghép từ cùng dữ liệu | Mỗi mẫu một bảng riêng như PMS | PMS lặp dữ liệu giữa mẫu nên lệch (giờ lấy mẫu 25/10 trong biên bản 06/11); phân vai mới còn tách người nhập (PHT vs bếp) nên không thể gộp nhập |
| Nguồn dữ liệu M1 | Điền sẵn từ kiểm nhận hàng tươi và phiếu nhập kho khô đã có; PHT bổ sung trường kiểm thực | Bảng kiểm thực độc lập nhập tay | Tránh nhập hai lần cùng số liệu (đã có sổ tiếp nhận BE) |
| Kiểu ô nhập | Số + đơn vị, giờ chuẩn, Đạt/Không đạt dạng chọn, ô chọn gợi ý cho dụng cụ/điều kiện | Chữ tự do như PMS | Xuất Excel/in đồng nhất; ngưỡng đạt/không do BE |
| Lưu chữ ký | Ảnh ở kho tệp BE (khóa tệp, nhận diện loại theo byte đầu như ảnh bữa ăn), **chụp bản sao vào biên bản lúc ký** | Data URL trong DB/FE; tham chiếu chữ ký tài khoản | Biên bản là chứng từ, không đổi sau khi ký; không đưa ảnh vào JSON/log; `CODING_GUIDE.md:307` đã ghi hướng upload file |
| Thư viện chữ ký | Dùng chung (`/signatures/me`) cho mọi module; biên bản kiểm thực là consumer đầu tiên | Thư viện riêng | `SignaturePicker` đã dùng chung ở giáo án (`src/components/education-plan/eduUi.jsx:255`); FE chuyển `signatures` demo → api cùng đợt |
| Luồng trạng thái | M1–M3: Nháp → Đã ký (khóa, sửa ⇒ chữ ký mất hiệu lực); lưu mẫu giữ chuỗi hiện có (ghi → PHT duyệt → hủy → PHT duyệt) thêm chữ ký ở mỗi lần duyệt | Thêm chuỗi duyệt cho M1–M3 | PHT là người kiểm tra nên không cần người duyệt thứ hai |
| Xuất file | In + PDF + Excel trên một khung in dùng chung | Sinh file ở BE | Công cụ có sẵn, không thêm dependency; ảnh chữ ký tải qua client có token rồi nhúng |
| Tách thực hiện | **3 plan:** A thư viện chữ ký; B kiểm thực M1–M3; C lưu mẫu (M4, M5) + in/xuất chung. Làm A trước, rồi B, rồi C | Một plan lớn | >8 file và >3 phase; A dùng được độc lập (giáo án đã cần) |

Quyết định kiến trúc (lưu chữ ký chứng từ, bất biến sau ký) ⇒ ADR mới ở `BE:docs/decisions/`.

## Phases

> Phase 1–2 chủ yếu BE/APP (plan chính ở BE repo, cần user cho phép sửa BE). Phase 3–6 là FE; FE làm trước trên mock (`sourceOf`) để user nhìn được màn, rồi nối API khi BE sẵn sàng. Web của user đang nối BE thật (cổng 5181 → API 8090), nên màn mới chỉ thấy dữ liệu khi BE có API hoặc khi bật mock.

### Phase 0 — Chốt nghiệp vụ (không code)
- Files: M `BE:docs/business/BUSINESS_RULES.md` (NUT-21, P-26, P-27), `BE:docs/modules/nutrition.md`, `BE:docs/business/flows/meal-management-permissions.md`, `docs/features/nutrition-inventory.md` — chỉ sau khi user trả lời "Câu hỏi mở".
- Steps: 1. User soát giả định và 4 câu hỏi. 2. Cập nhật rule theo `update-knowledge.md`. 3. Tạo task Jira (FE, BE, APP).
- Exit: "Câu hỏi mở" hết `- [ ]`; user duyệt plan ⇒ `status: approved`.
- **Dừng chờ user review.**

### Phase 1 — BE: chữ ký tài khoản (plan A, BE)
Contract cần thống nhất (FE không tự giả định):
- `GET /signatures/me` · `POST /signatures/me` (multipart ảnh PNG/JPG ≤2 MB, nhận diện loại theo byte đầu) · `PATCH /signatures/me/{id}/default` · `DELETE /signatures/me/{id}` · `GET /signatures/{id}/content` (có xác thực; chỉ chủ ảnh hoặc người xem biên bản chứa chữ ký đó). Tối đa 5 chữ ký/tài khoản.
- Bảng `user_signatures` (tài khoản, khóa tệp, loại tệp, kích thước, mặc định, ngày tạo).
- Exit: test BE (tải đúng/sai loại, quá cỡ, quá 5, đổi mặc định, xóa) → pass.

### Phase 2 — BE/APP: kiểm thực M1–M3 và mở rộng lưu mẫu (plan B, C)
Contract cần thống nhất:
- **Kiểm thực theo ngày–điểm trường:** `GET /inspections/day?campusId&date` trả khung M1 tươi, M1 khô, M2, M3 (món, bữa, số suất theo nhóm Nhà trẻ/Mẫu giáo, hàng nhập từ kiểm nhận/phiếu nhập, dữ liệu đã nhập, cờ `can*`); `PUT` lưu nháp từng tab; `POST .../sign` ký (nhận id chữ ký, BE chụp bản sao); trạng thái `DRAFT`/`SIGNED`; bản ghi theo dòng với các cột như Context.
- **Chữ ký trên chứng từ:** vai trò, người ký, bản sao ảnh lúc ký, giờ ký, phiên bản, `valid`, lý do mất hiệu lực.
- **Lưu mẫu (APP + BE):** thêm khối lượng/thể tích + đơn vị, dụng cụ chứa, nhiệt độ bảo quản vào bản ghi và vào màn bếp ghi lưu mẫu; `approve` và `approve-disposal` nhận chữ ký của PHT.
- Quyền: `FOOD_SAFETY_APPROVE` (giả định) cho điền/ký/duyệt, theo điểm trường; bếp giữ `KITCHEN_RECORD`.
- Exit: test BE (khung ngày, lưu nháp, ký, sửa sau ký ⇒ mất hiệu lực, quyền theo điểm trường, hủy <24 giờ bị chặn, bản cũ không lỗi) → pass.

### Phase 3 — FE: thư viện chữ ký (nối API)
- Files: M `src/services/signatureService.js`, `src/config/integrationModules.js`, `src/mocks/signatureMockRepository.js` · C `src/services/api/signatureApi.js` (theo cấu trúc facade `services/<module>/`), `src/pages/account/MySignaturesPage.jsx`, route + menu Tài khoản · M `src/components/signature/SignaturePicker.jsx` (bắt buộc có chữ ký mới ký được).
- Steps: 1. Chuyển `signatures` demo → api, giữ mock cho demo. 2. Trang "Chữ ký của tôi" dùng `SignatureUploader`. 3. Ảnh qua client có token, không `img src` công khai. 4. Mock dùng chữ ký giả (`src/mocks/signatureArt.js`), không dùng chữ ký thật.
- Tests: AC-8 → `tests/` cho facade + hook.
- Exit: `node scripts/verify.mjs` → `VERIFY PASS full`, skip 0.
- **Dừng chờ user review.**

### Phase 4 — FE: màn Kiểm thực M1–M3 của PHT (điền và ký)
- Files: C `src/pages/kitchen/InspectionDayPage.jsx`, `src/components/kitchen/inspection/` (bốn bảng tab M1 tươi, M1 khô, M2, M3, khối chữ ký, thanh trạng thái), `src/hooks/kitchen/useInspectionDay.js`, `src/utils/kitchen/inspectionForm.js` (chuyển form ↔ request, chỉ định dạng/kiểm ô nhập) · M `src/services/kitchenRecordsApi.js` (hoặc `inspectionApi.js` mới), `src/routes/AppRoutes.jsx`, `src/layouts/menuConfig.js`, `src/utils/kitchen/kitchenPermissions.js` · CSS `src/styles/modules/kitchen-records.css`.
- Steps: 1. Màn `/kitchen/inspections/:date` chọn điểm trường + ngày, bốn tab theo bố cục PMS. 2. Hành động theo cờ `can*`: Lưu nháp, Ký. 3. Đủ trạng thái loading/empty/error/403/404 (`.claude/rules/component.md`). 4. Bảng theo `DESIGN.md` (một thông tin một cột, ngắn căn giữa, chữ dài căn trái). 5. Cảnh báo rời trang khi chưa lưu (`useLeaveGuard`).
- Tests: AC-1, AC-2, AC-3, AC-4, AC-6 → unit `inspectionForm`, hook, quyền; kiểm bằng mock.
- Exit: verify pass; ảnh chụp màn hình các vai trò khi báo xong.
- **Dừng chờ user review.**

### Phase 5 — FE: sổ lưu mẫu (PHT xem, duyệt có chữ ký)
- Files: M `src/pages/kitchen/FoodSampleQueuePage.jsx` (thêm cột khối lượng, dụng cụ, nhiệt độ), `src/utils/kitchen/kitchenRecords.js`, `src/components/kitchen/SampleRecordBadges.jsx`; duyệt bằng `SignaturePicker`.
- Steps: 1. Hiển thị cột mới, bản ghi cũ để trống. 2. Duyệt lưu mẫu / duyệt hủy mẫu kèm chọn chữ ký (theo cờ `canApprove`).
- Tests: AC-5, AC-9.
- Exit: verify pass.
- **Dừng chờ user review.**

### Phase 6 — FE: in và xuất văn bản
- Files: C `src/components/kitchen/inspection/InspectionPrint.jsx` (khung in M1 tươi, M1 khô, M2, M3, M3 gộp, M4, M5 từ cùng dữ liệu, `ps-sign` có ảnh chữ ký PHT, ô khác để trống) · M `src/utils/kitchen/kitchenExport.js` (Excel đủ cột), `src/components/kitchen/FoodSampleFormPrint.jsx` (thay ô ký trống bằng ảnh chữ ký, bỏ ghi chú "mẫu chưa chốt" khi P-26 đóng).
- Steps: 1. Một khung in, chọn mẫu bằng tab. 2. In, PDF, Excel qua công cụ có sẵn. 3. Bản chưa ký hiện "Chưa xác nhận". 4. Tải ảnh chữ ký qua client có token rồi nhúng; lỗi tải ảnh thì ô ký hiện cảnh báo, không chặn in.
- Tests: AC-7 → unit hàng Excel; chụp bản in.
- Exit: verify pass.
- **Dừng chờ user review.**

### Phase 7 — Seed và tài liệu
- Files: M `docs/features/nutrition-inventory.md`, `docs/architecture/ROUTE_MAP.md`, `DESIGN.md` §6.3 (khối chữ ký nếu thêm component chung), `/ui-kit` · seed dev kiểm thực (BE repo, cần user cho phép; tạm: script ngoài repo như đã làm với `food_samples`).
- Exit: `node scripts/check-ai-layer.mjs` pass; verify pass.

## Test matrix
| AC | Rule | Test (tầng) | Phase | Kết quả |
| --- | --- | --- | --- | --- |
| AC-1..AC-4, AC-6 | P-27, NUT-21, AUTH-20 | BE service + FE unit/hook | 2, 4 | chưa chạy |
| AC-5, AC-9 | NUT-21 | BE service + FE unit | 2, 5 | chưa chạy |
| AC-7 | NUT-21 | FE unit xuất + chụp bản in | 6 | chưa chạy |
| AC-8 | AUTH-21 | BE controller + FE facade | 1, 3 | chưa chạy |

## Rủi ro & rollback
| Rủi ro | Tác động | Giảm thiểu | Rollback |
| --- | --- | --- | --- |
| Ảnh chữ ký là dữ liệu cá nhân, có thể bị lộ hoặc dùng sai | Giả mạo ký | Chỉ tải qua API có xác thực và phạm vi điểm trường, không URL công khai, không ghi log, không đưa vào fixture thật (invariant 5), bản sao bất biến sau ký | Tắt tải ảnh ở API; biên bản vẫn xem được, ô ký hiện "Đã ký" không ảnh |
| Rule NUT-21, P-26, P-27 chưa chốt | Làm sai nghiệp vụ | Phase 0 chặn: không code khi user chưa duyệt | Không có gì để rollback ở FE |
| App bếp không thêm trường lưu mẫu mới cùng đợt | Biên bản thiếu cột | Trường mới tùy chọn; plan APP cùng đợt | Ẩn cột mới trên Web đến khi App xong |
| FE chạy trên BE thật không có API mới | Màn trống/lỗi | Làm sau cờ module (`demo` → `api` khi BE đủ endpoint), `check-api-contract` | Giữ `demo` |
| Dữ liệu M1 điền sẵn từ kiểm nhận bị thiếu/sai | PHT thấy hàng không khớp | Hiển thị đúng số BE trả, cho PHT ghi chú; không tự sửa số kiểm nhận ở màn kiểm thực | Ẩn tab M1 đến khi nguồn dữ liệu ổn |
| Sửa sau ký làm mất chữ ký | Phiền người dùng | Chỉ mất hiệu lực khi nội dung thật sự đổi; cảnh báo trước khi lưu | Cho phép ký lại một chạm bằng chữ ký mặc định |

## Validation log
- [x] Khẳng định về code có `file:line` (Context)
- [ ] Đổi contract ⇒ consumer cụ thể: BE Phase 1–2 liệt kê endpoint; consumer FE = `signatureService.js`, `kitchenRecordsApi.js`, `FoodSampleQueuePage.jsx`, `SignaturePicker.jsx`; APP: màn bếp ghi lưu mẫu — chờ plan BE/APP
- [x] Mỗi AC có test; mỗi phase có Exit
- [x] >8 file hoặc >3 phase ⇒ đã đề xuất tách (Key decisions: plan A chữ ký, B kiểm thực, C lưu mẫu + in/xuất)
- [ ] Không dùng rule PENDING/OPEN như đã chốt: NUT-21 cần sửa, P-26 và P-27 cần đóng, hiện ghi là câu hỏi mở
- [x] Tự review: không placeholder · không mâu thuẫn · scope vừa (nếu tách) · không câu mơ hồ

## Progress log
### 2026-11-10 — User bỏ hàng "Điền nhanh", trả nút "Điền cột" ở từng cột
- User: hàng gõ rồi Enter khó dùng, muốn chọn điền ở từng cột như ban đầu. Đã thay `InspectionFillRow` bằng biểu tượng bút cạnh nhãn từng cột nhập chữ/giờ/ngày/lựa chọn (nút chữ "Điền cột" bị user chê to, đã bỏ), mở `ColumnFillDialog` (ô giờ/ngày gõ liền, hai thẻ chọn áp dòng trống hay mọi dòng, Enter áp dụng); bỏ ô "ghi đè" ở thanh công cụ. Cột có đơn vị khác nhau (kg, bìa 200 g...) lệch ô nhập ⇒ lưới số + đơn vị rộng cố định `kr-qty--unit`. Ô "Lý do sửa lại" thêm lề dọc (`kr-reason`).
- User xin kéo điền như Excel: nhập một ô rồi kéo chấm ở góc ô xuống/lên, vùng kéo được tô, thả chuột chép ô nguồn sang vùng (`fillRange` + chấm `kr-handle`, bảng tự cuộn khi kéo sát mép). Áp cho cột chữ/giờ/ngày/lựa chọn/số; ô tích không kéo (đã có ô tích cả cột). Ctrl+D vẫn dùng cho bàn phím. Kiểm trình duyệt: nhập 07:45 dòng 2, kéo tới dòng 6 ⇒ dòng 2–6 cùng 07:45.
- User xin xóa nội dung cả cột và điền/xóa chỉ một số dòng: hộp thoại đổi thành "Điền hoặc xóa cả cột" (`ColumnFillDialog`): thao tác Điền giá trị / Xóa nội dung; áp cho dòng còn trống (kèm số dòng), tất cả, hoặc tích chọn một số dòng (`RowPicker`, kèm giá trị hiện có); nút xác nhận ghi số ô ("Điền 3 ô", "Xóa 2 ô"). Cột số cũng có biểu tượng bút. `fillRows` thay `fillColumn` ở màn hình (`fillColumn` còn dùng cho "Chọn nhà cung cấp"). Cột khối lượng căn giữa (đệm trái bằng cột đơn vị). Kiểm trình duyệt: điền dòng 1/3/5, xóa dòng 1/5, xóa cả cột đều đúng.
- Kiểm: trình duyệt (mock) 5 nút ở M1 tươi, điền giờ 730 cho cả cột → 07:30, không lỗi console. `VERIFY PASS full | npm run verify | log verify.log`. Commit: chưa commit.

### 2026-11-10 — Xung đột phiên bản + user chốt giữ chặn ký
- Commit: chưa commit
- User chốt "giữ": chặn ký khi Không đạt thiếu biện pháp xử lý (BE 6090, FE khóa nút Ký), không nới thành cảnh báo.
- Đã làm: lưu bị 409 (có người lưu hoặc ký trước) ⇒ hộp xác nhận "Mẫu này vừa được người khác thay đổi" với "Tải bản mới" (bỏ phần chưa lưu, nạp lại từ BE) hoặc "Giữ lại" (để chép phần đã gõ); tự lưu dừng khi đang hỏi để không báo lặp. Mock BE nay kiểm `version` như BE (lệch ⇒ 409). Đóng hạn chế "409 chỉ báo lỗi chung".
- Verify: Playwright hai tab cùng trình duyệt (tab B lưu trước, tab A lưu sau ⇒ hộp xác nhận hiện, "Tải bản mới" nạp đúng bản của B, console không lỗi); `node scripts/verify.mjs` FE: `VERIFY PASS full | npm run verify | log verify.log`.

### 2026-11-10 — Phase 4 vòng 4: nhập liệu gõ tay + rule QĐ 1246 (chờ review)
- Commit: chưa commit
- Verify: FE `node scripts/verify.mjs` → `VERIFY PASS full`; `node --test tests/kitchen/inspection-form.test.mjs tests/kitchen/inspection-rules.test.mjs` 22 pass; chạy tay bằng Playwright trên mock (Chrome): ngày/giờ gõ liền, điền nhanh cả cột, Không đạt → chip biện pháp xử lý + khóa Ký, Ctrl+D, không còn ô chọn ngày/giờ của trình duyệt trong biểu mẫu, console không lỗi. BE: xem plan BE.
- Phản hồi user: (1) icon "điền chung cả cột" nhỏ; (2) giờ/ngày mở bảng chọn thay vì gõ; (3) muốn nhập văn bản tiện nhất và đúng rule theo `qd-1246-huong-dan-kiem-thuc-3-buoc-attp-va-luu-mau-tp_26202310.pdf`. Đã đọc bản scan QĐ 1246 (Điều 3–8, Mẫu 1–5): cột Mẫu 1–5 khớp màn hiện có; rule mới lấy từ văn bản: không đạt ⇒ ghi rõ biện pháp xử lý (Điều 3.1, 4.2, 5.5), mẫu lưu ≥ 100 g / 150 ml (Điều 7), 2–8 °C (Điều 8), lưu ≥ 24 giờ (đã có NUT-21).
- Quyết định (tự chọn theo chế độ tự chạy; phương án khác đã cân nhắc): **điền cả cột** = hàng "Điền nhanh" ngay dưới tiêu đề (gõ rồi Enter) thay nút icon + hộp thoại; không chọn "popover bấm vào icon to hơn" vì vẫn phải mở thêm một lớp, không chọn "kéo thả ô như Excel" vì khó dùng bằng bàn phím và trên màn cảm ứng. **Giờ/ngày** = ô chữ có mặt nạ, bỏ ô chọn của trình duyệt vì mỗi lần nhập phải mở bảng chọn rồi bấm; giữ giá trị lưu HH:MM và YYYY-MM-DD nên BE không đổi. **Văn bản** = Enter/Shift+Enter/Ctrl+D, gợi ý từ giá trị đã nhập, chip biện pháp xử lý.
- Đã làm: `InspectionInputs.jsx` (`TimeInput`, `DateInput`), `InspectionCells.jsx` (ô thân bảng, chip biện pháp xử lý, cảnh báo M5), `InspectionFillRow.jsx`; `InspectionSheet.jsx` viết lại gọn (phần đầu: Người kiểm tra, ngày + giờ gõ tay, "Bây giờ"); bỏ `ColumnFillDialog`, nút icon điền chung; `inspectionForm.js` (`normalizeDate`, `maskDate`, `toDisplayDate`, `splitDateTime`/`joinDateTime`, `copyDown`; form header đổi thành `checkedDate` + `checkedTime`), `inspectionRules.js` (`actionsMissing`, `sampleWarning`), `INSPECTION_ACTIONS`; chip tiến độ "Không đạt chưa ghi biện pháp xử lý" khóa nút Ký; mock BE phản chiếu rule 6090; CSS dùng token/rem. BE: INS-02 thêm biện pháp xử lý bắt buộc (mã 6090) ở `InspectionColumns.actionMissing` + test.
- Giả định cần user soát: (a) INS-02 mở rộng theo văn bản: ký bị chặn khi còn dòng Không đạt (cảm quan hoặc xét nghiệm nhanh) chưa có ghi chú — user yêu cầu "rule chuẩn theo nghị định" nên ghi CONFIRMED ở BUSINESS_RULES, user soát lại nếu muốn nới (vd. chỉ cảnh báo); (b) cảnh báo số liệu lưu mẫu chỉ hiện ở M5 trên Web (bếp ghi trên App, App nên cảnh báo từ lúc nhập); (c) chưa kiểm thứ tự giờ (chế biến xong ≥ sơ chế xong, bắt đầu ăn ≥ chia xong) vì văn bản không quy định; (d) Mẫu 2 ghi "ngày, giờ" cho giờ sơ chế/chế biến: ô hiện chỉ nhập giờ (ngày = ngày biên bản).

### 2026-11-10 — FE: lớp API khớp contract BE (chưa bật, chờ BE lên môi trường)
- Commit: chưa commit
- Verify: `node scripts/verify.mjs` → `VERIFY PASS full` (sau khi sửa); `node --test tests/kitchen/inspection-mapper.test.mjs` 9 pass.
- Đã làm: `services/kitchen/api/inspectionMapper.js` (hàm thuần: `sheets[]` HOA → `tabs` thường, `canEdit`/`canReopen` theo mẫu, ô nhập thiếu điền rỗng, chữ ký `imageKey` → `imageUrl`, lịch sử `actorName` → `byName`, nhà cung cấp `deliveryPerson` → `contactName`, bỏ CCCD) và `inspectionApi.js` dùng mapper (`PUT` gửi `expectedVersion`, đổi mã mẫu sang HOA, ảnh chữ ký tải blob qua `GET /inspections/signatures/{imageKey}`); `signatureService.js` nguồn API: tải ảnh `GET /signatures/me/{id}/content` thành `imageUrl`, `POST` multipart từ data URL (`dataUrlToBlob` ở `utils/file.js`); `services/http/blobUrlCache.js` (cache object URL theo khóa); trang kiểm thực gửi `version` khi lưu.
- **Chưa** đổi `kitchen-inspection` và `signatures` từ `demo` sang `api` trong `integrationModules.js`: BE chưa commit/chưa chạy trên môi trường, đổi bây giờ làm hỏng demo. Khi BE lên: đổi hai cờ, chạy tay luồng PHT (tải chữ ký → điền M1 → ký → sửa lại) trên API thật.
- Hạn chế đã biết: object URL của ảnh chữ ký nằm trong bộ nhớ tab tới khi tải lại trang (chưa thu hồi khi đăng xuất); lỗi 409 `6082` (có người lưu trước) hiện chỉ báo lỗi chung, chưa có nút "Tải lại"; mock chưa mô phỏng khóa phiên bản.
- Phát hiện khi đối chiếu: FE chỉ gửi ô PHT nhập nên bản chụp lúc ký ở BE từng thiếu ô hệ thống (tên món, suất); đã sửa ở BE (gộp với khung nguồn lúc ký) và thêm test.

### 2026-11-10 — BE Phase 3 (trường lưu mẫu Mẫu 5) xong, chờ review
- Ở BE (chưa commit): `V86`; `POST|PUT /nutrition/food-samples` nhận `dishDetails[{dishId, weight, container, temperature}]` (chuỗi tự do, không bắt buộc; null khi sửa ⇒ giữ, `[]` ⇒ xóa); `GET` trả `dishes[].weight|container|temperature` (rỗng với bản cũ). M5 của biên bản kiểm thực điền sẵn ba cột từ đây (nhiều món khác giá trị ⇒ "Tên món: giá trị; …").
- FE khi nối API: trang lưu mẫu Web chỉ xem (bếp ghi trên App) nên chỉ cần hiển thị ba cột mới ở danh sách/chi tiết bản lưu mẫu; mock FE hiện tại đã có ba cột này theo từng món — đổi sang đọc `dishes[]` khi nối API. Việc nhập thuộc App.
- Tiếp: Phase 4 BE (module card, hợp đồng, CURRENT_STATE) rồi chuyển FE `kitchen-inspection`, `signatures` từ `demo` sang `api`.

### 2026-11-10 — BE Phase 2 lát 2b (M1 tươi/khô, nhà cung cấp trên kiểm nhận) xong, chờ review
- Ở BE (chưa commit): M1 tươi dựng từ kiểm nhận hàng tươi trong ngày (lần 2 nếu đã ghi, không thì lần 1) kèm nhà cung cấp, kg/lít; M1 khô dựng từ lô đã trừ kho cho bữa ăn của ngày kèm nhà cung cấp, ngày nhập, hạn dùng (không phải phiếu nhập của ngày). Kiểm nhận hàng tươi nhận thêm `supplierId` (không bắt buộc) và trả `rounds[].supplier {id, name, phone, address, deliveryPerson}`; không tồn tại ⇒ 404 `6025`.
- FE khi nối API: form kiểm nhận hàng tươi gửi `supplierId` (chọn nhà cung cấp, thay nút "nhà cung cấp cho tất cả" ở biên bản M1 tươi); ô "Tên cơ sở sản xuất", "Địa chỉ sản xuất" của M1 khô vẫn để PHT nhập (kho chưa lưu nhà sản xuất); khóa dòng M1 là `food:{foodId}` (tươi) và `lot:{lotId}` (khô), khác khóa mock hiện tại.
- Tiếp: `verify.mjs` đầy đủ ở BE, rồi chuyển FE `kitchen-inspection` và `signatures` từ `demo` sang `api`.

### 2026-11-10 — BE Phase 2 lát 2a (biên bản, ký, M2/M3/M5) xong, chờ review
- Ở BE (chưa commit): `V85`, API `GET /inspections/day?campusId&date`, `PUT /inspections/day/{tab}`, `POST …/sign`, `POST …/reopen`, `GET /inspections/signatures/{imageKey}?campusId`, mã lỗi 6080–6089; test service 12, tích hợp Postgres 5, controller 5 pass; đã sửa lỗi ArchUnit còn tồn từ Phase 1. Chi tiết và giả định cần soát ở plan BE. **Chưa** có M1 (tươi/khô): BE trả khung rỗng tới lát 2b.
- Khác mock FE hiện tại khi nối API: (1) `{tab}` là `FRESH|DRY|PROCESS|SERVE|SAMPLE` (hoa), FE đang dùng chữ thường; (2) lưu nháp gửi `expectedVersion` (0 khi chưa lưu) và nhận 409 `6082` khi có người lưu trước; (3) M2/M3 mỗi dòng ứng một (bữa, khối, món): `block` NURSERY/KINDERGARTEN, `sessionLabel` dạng "Bữa trưa · Nhà trẻ", `servings` là suất của khối đó (không đổi thành `{nursery, kindergarten}`); (4) bản trả có `canEdit` ở cấp ngày, `saved`, `history[]` (`action` SIGNED/REOPENED), `signature {signedByName, signedAt, documentVersion, imageKey}`; ảnh chữ ký trên biên bản tải qua `imageKey` (không phải id chữ ký tài khoản); (5) ký chỉ gửi `{signatureId}` (bỏ trống ⇒ chữ ký mặc định), thiếu cảm quan 422 `6084`, chưa có chữ ký 422 `6085`, sửa lại lý do <3 ký tự 422 `6086`; (6) quyền ghi cần mã `FOOD_SAFETY_APPROVE` (PHT mặc định chưa có, HT phải cấp).
- Tiếp: lát 2b của BE (M1 tươi/khô, nhà cung cấp trên kiểm nhận, `verify.mjs` đầy đủ) rồi chuyển FE `kitchen-inspection` và `signatures` từ `demo` sang `api`.

### 2026-11-10 — BE Phase 1 (chữ ký tài khoản) xong, chờ review
- Ở BE (worktree `CareNest_BE-day-boarding`, chưa commit): migration `V84`, API `GET|POST /signatures/me`, `PATCH /signatures/me/{id}/default`, `DELETE /signatures/me/{id}`, `GET /signatures/me/{id}/content`, mã lỗi 1140–1142, 13 test mới pass, snapshot OpenAPI cập nhật (chỉ thêm). Chi tiết ở `CareNest_BE-day-boarding/docs/plans/active/2026-11-10-inspection-records-signatures.md`.
- FE khi nối API chữ ký: `signatureService.js` đổi `signatures` từ `demo` sang `api`; API trả `{ id, isDefault, contentType, sizeBytes, createdAt }` (không có `imageUrl`), ảnh tải bằng `GET /signatures/me/{id}/content` qua client có token rồi đổi sang object URL; `POST` là multipart (`file`, `isDefault`); lỗi: 1140 ảnh sai (PNG/JPG ≤2 MB), 1141 quá 5 ảnh.
- Tiếp: BE Phase 2 (biên bản kiểm thực) sau khi user review Phase 1.

### 2026-11-10 — BE Phase 0 xong: plan BE đã duyệt, rule đã ghi (chờ review)
- User duyệt 4 câu: duyệt INS-01..04, SIG-01; thêm nhà cung cấp vào kiểm nhận hàng tươi ở BE; số suất tách Nhà trẻ / Mẫu giáo; làm BE ở nhánh nutrition `feature/G94-254-BE-FEAT-27-day-boarding` (worktree `CareNest_BE-day-boarding`). Tài liệu đã chuyển sang worktree này (xóa khỏi checkout G94-60).
- Ở BE (chưa commit): `BUSINESS_RULES.md` (NUT-21 đổi, INS-01..04, SIG-01, đóng P-26/P-27), `ADR-0024`, `specs/014-.../{domain-spec,data-model,tasks}.md`, plan BE `approved`, module card và flow. `check-ai-layer` BE → 0 lỗi. Nhánh này đã ở V83 (gộp bảng bán trú) nên migration của việc này là V84–V86 và dùng bảng gọn `inspection_sheets` (cột jsonb) thay 6 bảng.
- Việc FE phải đổi khi nối API: số suất ở M2, M3, M5 tách `{ nursery, kindergarten }` (mock hiện dùng một số tổng); kiểm nhận hàng tươi (M1 tươi) có nhà cung cấp từ BE nên bỏ nút "Chọn nhà cung cấp cho cả bảng" khi BE trả sẵn.
- Tiếp: BE Phase 1 (chữ ký tài khoản) sau khi user review Phase 0.

### 2026-11-10 — Phase 1–2 BE: lập domain spec và plan (đã thay bằng mục trên)
- Commit: chưa commit (BE và FE)
- Đã làm (chỉ tài liệu, ở repo BE, file mới chưa commit): `CareNest_BE/specs/014-inspection-records-signatures/domain-spec.md` (14 mục) và `CareNest_BE/docs/plans/active/2026-11-10-inspection-records-signatures.md` (contract, data model, 4 phase, rule đề xuất INS-01..04, SIG-01). **Chưa viết code, chưa tạo migration, chưa sửa `BUSINESS_RULES.md`** vì quy trình BE bắt buộc domain spec → Spec Kit → plan lớp L user duyệt trước khi code.
- Verify: `node scripts/check-ai-layer.mjs` ở BE → 0 lỗi (15 cảnh báo sẵn có).
- Lưu ý: checkout BE đang ở nhánh `feature/G94-60-BE-FEAT-01-authentication` với thay đổi chưa commit của người khác; migration cuối là V82 nên phần mới bắt đầu từ V83 (nhánh khác có thể trùng số).
- Tiếp: user trả lời câu hỏi mở ở plan BE (xác nhận rule INS/SIG, nhà cung cấp ở kiểm nhận hàng tươi, số suất theo nhóm, nhánh và Jira) rồi duyệt; sau đó Phase 0 → Phase 1 (chữ ký tài khoản).

### 2026-11-10 — Phase 5 (M5 lưu và hủy mẫu) và bản in M3 gộp, M4 (chờ review)
- Commit: chưa commit
- Verify: `node scripts/verify.mjs` → `VERIFY PASS full` (thêm test M3 gộp, M4, M5, `rowsMissing`; `check-design` giữ baseline). Chạy thử Chrome tự động trên mock (PHT, 09/11, ngày bếp có lưu mẫu): thẻ M5 mở được 18 dòng khối lượng, dụng cụ chứa, nhiệt độ, giờ lấy mẫu; ký M5 không cần lưu nháp trước và không đòi chọn Đạt / Không đạt; in M4 ra 3 nhãn (mỗi bữa một nhãn); Excel M4 mở hộp xem trước; console không lỗi. Chưa mở bản in M3 gộp bằng trình duyệt (đã có test dựng dữ liệu), chưa thử màn nhỏ.
- Đã làm: mẫu thứ 5 trên trang Kiểm thực (`sample`): dòng lấy từ sổ lưu mẫu bếp ghi (bữa, món, số suất, khối lượng, dụng cụ chứa, nhiệt độ, giờ lấy mẫu, giờ hủy mẫu), PHT chỉ nhập "Ghi chú chất lượng" rồi ký xác nhận đã soát; ô ký tay là người lưu mẫu và hủy mẫu. Bản in: M5; M4 nhãn mẫu (mỗi bữa một nhãn, giờ lấy mẫu in sẵn nếu có); M3 gộp = các cột M3 + các cột lưu mẫu ghép theo bữa, món (tab "In / xuất" của M3 và M5 có thanh chọn bản in). Mẫu đã ký giữ nguyên các dòng lúc ký (bản chụp), bếp ghi thêm giờ hủy mẫu sau đó thì phải "Sửa lại" để cập nhật.
- Quyết định tự chọn (chờ user soát): ký M5 là PHT xác nhận đã soát sổ lưu mẫu của ngày, **khác** việc duyệt lưu mẫu / duyệt hủy mẫu theo từng bản ghi ở `/kitchen/food-samples` (BE có sẵn, giữ nguyên); M4 do hệ thống lập từ M5 nên không có dữ liệu riêng.
- Chưa làm: duyệt lưu mẫu / duyệt hủy mẫu kèm chữ ký ảnh ở `/kitchen/food-samples` (cần BE nhận chữ ký ở `approve`, `approve-disposal`); cột khối lượng, dụng cụ, nhiệt độ ở màn đó khi nối BE thật (BE `food_samples` chưa có các trường này, App bếp cũng chưa gửi).
- Contract BE bổ sung: tab `sample` trong `GET /inspections/day` do BE dựng từ `food_samples` (thêm khối lượng, dụng cụ, nhiệt độ, giờ hủy), bản chụp dòng lúc ký.

### 2026-11-10 — Phase 6 phần M1–M3: in, PDF, Excel (chờ review)
- Commit: chưa commit
- Verify: `node scripts/verify.mjs` → `VERIFY PASS full` (thêm `tests/kitchen/inspection-export.test.mjs`; `check-design` giữ baseline cssPx 16/16). Chạy thử Chrome tự động trên mock (M2, 04/11): "In / xuất" mở bản xem trước A4 ngang (1123px), Xuất Excel mở hộp xem trước rồi tải `kiem-thuc-process-2026-11-04.xlsx`, Xuất PDF tải `.pdf` (449 KB), console không lỗi. Chưa mở file PDF/Excel bằng phần mềm đọc, chưa thử lệnh In thật.
- Đã làm: nút "In / xuất" ở thanh trên của từng biểu mẫu (còn sửa dở thì tự lưu nháp trước); `InspectionPrint` khổ A4 ngang theo Số 1246/QĐ-BYT, ô tích in "x", ba ô ký (ảnh chữ ký PHT ở "Người kiểm tra", hai ô còn lại ký tay, chưa ký hiện "Chưa xác nhận"); `inspectionExport.js` dùng chung cho bản in và Excel; `exportElementToPdf` và `PrintToolbar` nhận `orientation`; `print.css` thêm trang ngang đặt tên (`page: form-landscape`).
- Chưa làm: bản in M3 gộp, M4 (nhãn), M5 (cần dữ liệu lưu mẫu của bếp, thuộc Phase 5); in nhiều ngày một lần.
- Tiếp: Phase 5 (sổ lưu mẫu hiện khối lượng, dụng cụ, nhiệt độ; duyệt có chữ ký), rồi thêm M3 gộp, M4, M5 vào cùng khung in.

### 2026-11-10 — Phase 4 vòng 3: gọn, điền sẵn, khóa sau ký (chờ review)
- Commit: chưa commit
- Verify: `node scripts/verify.mjs` → `VERIFY PASS full` (thêm test `normalizeTime`, `fillColumn`, `applySupplier`, `rowsMissingSensory`, toast 409). Chạy thử Chrome tự động trên mock (PHT, 04/11): M1 khô tự điền nhà cung cấp, ngày nhập, hạn dùng; chọn nhà cung cấp cho cả bảng M1 tươi; điền chung giờ nhập; ký bị chặn tới khi chọn đủ Đạt / Không đạt; ký xong khóa mẫu; "Sửa lại" thiếu lý do thì báo, có lý do thì mở khóa và ghi lịch sử; gõ 1005 thành 10:05, Enter xuống dòng; console không lỗi. Chưa thử cỡ màn nhỏ.
- Quyết định user chốt 2026-11-10 (A có, B (1), C có): (A) lỗi 400/404/409/422 không ghi mã trong toast toàn app, `src/utils/toastStatus.js` + DESIGN; (B) mẫu đã ký bị khóa, "Sửa lại" bất kỳ ngày nào cần lý do, chữ ký cũ vào lịch sử (`history`), mẫu về chưa ký, ký lại sau khi sửa; (C) ký cần mọi dòng đã chọn Đạt / Không đạt (BE giả trả 422 nếu thiếu).
- Quyết định tự chọn (chờ user soát): M1 khô điền sẵn từ phiếu nhập kho (nhà cung cấp, địa chỉ + điện thoại, người giao, ngày nhập, hạn dùng; cơ sở sản xuất vẫn nhập tay); M1 tươi chưa có nhà cung cấp ở BE nên dùng nút chọn nhà cung cấp cho cả bảng; "Giờ nhập" M1 tươi chỉ gõ giờ, "Ngày nhập" M1 khô chỉ ngày; tự lưu nháp 20 giây và khi đóng; bảng gọn (ô 28px, chữ 12–13px).
- Contract BE cần thêm: `POST /inspections/day/{tab}/reopen {reason}`, `history[]` trong mỗi mẫu, `header`, giờ/ngày nhập và nhà cung cấp trong khung dòng M1 (tươi cần nhà cung cấp ở kiểm nhận), ký trả 422 khi thiếu cảm quan.
- Khác plan: dữ liệu mẫu có phiếu nhập kho sau ngày kiểm tra nên mock lấy phiếu sớm nhất khi chưa có phiếu trước đó.
- Tiếp: Phase 5 (sổ lưu mẫu) và Phase 6 (in/PDF/Excel dùng khung này).

### 2026-11-10 — Phase 4 làm lại giao diện theo PMS (đã thay bằng vòng 3)
- Commit: chưa commit
- Verify: `node scripts/verify.mjs` → `VERIFY PASS full` (viết lại `tests/kitchen/inspection-form.test.mjs`: tích cả cột, ô tích, tiêu đề hai hàng). Chạy thử bằng Chrome tự động trên mock (PHT, ngày 04/11): mở từng mẫu toàn màn hình, tích Đạt / Không đạt cả cột (18/18 dòng, hiện dấu gạch khi bỏ một dòng), lưu nháp, ký bằng ảnh, đóng khi sửa dở thì hỏi lại; tiêu đề bảng và hai cột đầu dính khi cuộn; console không lỗi. Chưa thử cỡ màn nhỏ, vai HT/GV.
- Quyết định (user yêu cầu 2026-11-10, ghi theo chế độ tự chạy): trang chỉ liệt kê 4 thẻ mẫu; bấm "Mở biểu mẫu" mở hộp toàn màn hình (`Modal size="full"`, thêm vào phần dùng chung + DESIGN §6.3). Bảng theo biểu mẫu Bộ Y tế như PMS: tiêu đề "Số: 1246/QĐ-BYT · Mẫu n", phần đầu (đơn vị, thời gian, địa điểm kiểm tra), hai hàng tiêu đề có cột nhóm (Nơi cung cấp, Kiểm tra điều kiện vệ sinh), hàng số cột. Cảm quan và xét nghiệm nhanh là hai ô tích Đạt / Không đạt, "Có" và "Đảm bảo" là ô tích; ô tiêu đề tích tất cả. Giá trị cũ "NO", "NOT_OK", "SKIP" coi là chưa tích.
- Khác plan: thêm phần đầu biểu mẫu (`header.place`, `header.checkedAt`) vào dữ liệu lưu và API đề xuất; ô nhập là ô tích thay ô chọn.
- Tiếp: Phase 5 (sổ lưu mẫu) và Phase 6 (in/PDF/Excel dùng lại khung này); Phase 1–2 BE/App cần user cho phép sửa repo.

### 2026-11-09 — Phase 4 trên mock (bản đầu, đã thay)
- Commit: chưa commit
- Verify: `node scripts/verify.mjs` → `VERIFY PASS full` (thêm `tests/kitchen/inspection-form.test.mjs`, sửa `tests/menu/nutrition-flow.test.mjs` vì menu PHT có thêm mục). Chạy thử bằng Chrome tự động trên mock (đăng nhập PHT): lưu nháp M2, ký bằng ảnh chữ ký, sửa sau khi ký ⇒ chữ ký mất hiệu lực "Nội dung đã sửa sau khi ký, cần ký lại", tải lại vẫn giữ dữ liệu, console không lỗi. Chưa thử đăng nhập HT, vai khác (GV/bếp), cỡ màn nhỏ.
- Đã làm: màn `/kitchen/inspections` (4 tab M1 tươi, M1 khô, M2, M3; chọn ngày, điểm trường), facade `inspectionService` + mock `inspectionMockRepository` + API đề xuất `inspectionApi` (module `kitchen-inspection`, `demo`), hook `useInspectionDay`, `inspectionForm`, bảng và khối ký, mục menu "Kiểm thực ba bước" ở nhóm An toàn thực phẩm của HT/PHT.
- Khác plan: route là `/kitchen/inspections?date=&tab=` thay vì `/:date` (khớp các trang bếp khác); mock đặt số suất là tổng theo bữa, chưa tách Nhà trẻ/Mẫu giáo; ô ký của "Người trực tiếp nấu ăn" và NV Y tế để trống như giả định. Chưa có in/xuất (Phase 6).
- Tiếp: Phase 5 (sổ lưu mẫu hiển thị cột mới, duyệt có chữ ký) và Phase 6 (in/PDF/Excel M1–M5); Phase 1–2 BE/App cần user cho phép sửa repo.

### 2026-11-09 — Phase 3 phần FE trên mock (chờ review)
- Commit: chưa commit
- Verify: `node scripts/verify.mjs` → `VERIFY PASS full`. Mở thử ở mock (`localhost:5180/account/signatures`): trang hiển thị, mục menu "Chữ ký của tôi" có mặt, console không lỗi.
- Đã làm: trang `src/pages/account/MySignaturesPage.jsx` (dùng lại `SignaturePicker`), route `account/signatures`, mục menu Tài khoản.
- Khác plan: chưa chuyển `signatures` demo → api và chưa thêm `signatureApi.js`, vì BE chưa có `/signatures/me` (Phase 1); `signatureService.js` đã có sẵn nhánh api. Chưa viết test riêng cho facade/hook (hook và mock không đổi).
- Tiếp: Phase 1–2 cần user cho phép sửa repo BE/APP; Phase 4 FE (màn Kiểm thực M1–M3) làm trên mock được.

### 2026-11-09 — Lập plan, cập nhật phân vai PHT điền M1–M3, bếp ghi lưu mẫu (đã duyệt)
- Commit: chưa commit
- Verify: chưa chạy (chỉ thêm tài liệu plan)
- Khác plan: không
- Tiếp: user trả lời "Câu hỏi mở" và duyệt plan; sau đó tạo task Jira và xin phép sửa repo BE/APP cho Phase 1–2.
