# Review – Luân chuyển tài sản (facility-transfer)

Ngày 08/10/2026. Review chỉ đọc, không sửa code. Nguồn đối chiếu:
- SRS Report 3 (`imageFacibility/G94-Report-3_…docx`): UC §7.5 "Transfer Facility", màn #115–116, #123–125, GBR-FAC-01..10.
- Spec BF-07 / sơ đồ CSVC_4_Internal_Transfer theo mô tả của nhóm.
- Repo BE (bản remote `thang-04/CareNest_BE`, clone tạm để đọc).

Kiểm chứng gồm: đọc code, mở các trang bằng 3 tài khoản demo trên http://localhost:5180, và gọi trực tiếp mock repository trong trình duyệt cho các lỗi ghi "đã chứng minh". Dữ liệu demo đã được xóa sau khi test.

## 0. Phạm vi – cần nhóm chốt trước

| Nguồn | Nói gì về luân chuyển |
|---|---|
| SRS Report 3 | Có UC 7.5 và 5 màn hình. Nhưng không có business flow, entity, quyền trong role matrix. GBR-FAC-11/12/13 được UC trích dẫn nhưng không được định nghĩa. GBR-FAC-10 thực chất là luật về đề xuất mua sắm. |
| Spec BF-07 (nhóm gửi) | Luồng đầy đủ như mục 1 bên dưới. |
| BE `PROJECT_CONTEXT.md` | V1 về CSVC chỉ có **FE-08 "Báo + theo dõi sự cố CSVC"**. Exclusions có "quản lý vòng đời tài sản (… kiểm kê)". FAC-03 (CONFIRMED) loại trừ quản lý vòng đời tài sản và kiểm kê. Không có API, entity hay rule nào cho luân chuyển. |
| `AGENTS.md` (FE) | "không asset management (CSVC chỉ báo/theo dõi sự cố)". |

**Kết luận phạm vi: OPEN.** SRS và spec BF-07 có luân chuyển, còn BE và AGENTS.md loại trừ. Cần nhóm thống nhất và ghi vào Decision Log trước khi tiếp tục. Hiện cả module là luật nghiệp vụ viết ở FE (`services/facility-transfer/mock/transferMockRepository.js`), BE chưa có gì.

## 1. Đối chiếu từng bước với spec

| # | Spec | Code | Đánh giá |
|---|---|---|---|
| 1 | PHT tạo phiếu: tài sản, số lượng, nơi gửi, nơi nhận (lớp/campus), lý do | Wizard 4 bước (`components/facility-transfer/wizard/*`). Có loại luân chuyển, campus, nơi đi/đến, tài sản + SL, lý do, ngày dự kiến, đính kèm, chọn người bàn giao/nhận, chữ ký người tạo. Cho lưu nháp. `submit` ở `transferMockRepository.js:349` | **OK** (có thêm: nháp, chữ ký, chọn người, ngày dự kiến) |
| 2 | Kiểm tra: tài sản "Đang sử dụng" ở nơi gửi; đủ SL; nơi gửi ≠ nơi nhận; không đang kiểm kê. Sai thì PHT sửa | `assertValidDocument` (:203) kiểm SL khả dụng (trừ SL các phiếu đang chạy), nơi đến ≠ nơi đi, người bàn giao ≠ người nhận, campus khớp, loại phòng hợp loại luân chuyển. `assertNotLocked` (:226) chặn khi đang kiểm kê (đã test: báo 409). Lỗi trả 422, wizard hiện lỗi | **Khác**: không có trạng thái tài sản "Đang sử dụng". Code kiểm theo số lượng tồn từng phòng, không theo trạng thái |
| 3 | Chuyển tài sản sang "Đang luân chuyển", thông báo 2 bên | Không đổi trạng thái tài sản. SL được "giữ chỗ" ngầm qua `ACTIVE_STATUSES` (`transferConstants.js`, dùng ở `reservedQuantity` :122). Luôn báo người bàn giao. Người nhận chỉ được báo nếu `notifyOnSubmit` (mặc định bật, PHT tắt được) :390 | **Khác**: không có trạng thái "In transfer". Thông báo người nhận có thể bị tắt |
| 4 | Bên gửi bàn giao + ký biên bản; bên nhận kiểm SL, tình trạng | `confirmHandover` (:633): nhập SL, tình trạng, ảnh, ký → `PENDING_RECEIPT`. Người nhận nhập SL, tình trạng (`ReceivePage`) | **OK**. Thêm: người bàn giao được "Yêu cầu điều chỉnh" → `REVISION_REQUESTED` (:604) |
| 5 | Sai/thiếu: ghi chênh lệch, báo PHT; PHT xử lý (bổ sung/đổi); bàn giao lại | `reportDiscrepancy` (:908) → `PENDING_RESOLUTION`, báo PHT **và** người bàn giao. Người bàn giao trả lời từng dòng (`respondDiscrepancyLine` :677: giao bổ sung / xác nhận lại SL / nhận lại phần thừa / đổi hàng / không đồng ý). Nếu trả lời hết và không có dòng "không đồng ý" thì **tự đóng chênh lệch, không cần PHT** (:741). PHT xử lý (`resolveDiscrepancy` :469): yêu cầu giao bổ sung / chấp nhận SL thực nhận / điều chỉnh tài sản / hủy phần lỗi | **Khác**: spec nói PHT xử lý. Code cho người bàn giao tự đóng chênh lệch, PHT chỉ quyết các dòng còn tranh chấp. Có thêm "chấp nhận SL thực nhận" và "hủy phần lỗi" |
| 6 | Đúng: người nhận xác nhận; cập nhật vị trí, "Đang sử dụng", sổ sử dụng hai bên, lưu biên bản, báo PHT hoàn thành | `confirmReceipt` (:833): trừ tồn nơi đi, cộng tồn nơi đến, ghi `stockMovements` (trước/sau), bắt đủ 3 chữ ký, `COMPLETED`, báo PHT + người bàn giao. Có trang in, xuất PDF/CSV | **OK** về tồn kho và thông báo. Không có trạng thái "Đang sử dụng" hay "sổ sử dụng" riêng, `stockMovements` gần tương đương |

Quy tắc thực thể:
- **In transfer → Completed; chênh lệch giữ phiếu mở đến khi PHT xử lý.** Code có 7 trạng thái (mục 3). Chênh lệch có thể được đóng bởi người bàn giao, không qua PHT (khác spec).
- **GBR-FAC "mỗi tài sản đúng 1 vị trí tại 1 thời điểm".** Code quản lý tài sản theo **dòng tồn kho** (mã TS + phòng + SL). Một mã TS có ở nhiều phòng (`a_<phòng>_<mã>`), chuyển một phần SL thì tách tồn. **Khác mô hình**, cần chốt tài sản quản lý theo từng chiếc hay theo số lượng.
- **Chỉ trong trường; kho tổng đi qua cấp phát (BF-08), không qua luân chuyển.** Code cho `STORAGE` làm nơi đi/đến ở cả 3 loại (`transferConstants.js:43-45`). Đã test: tạo phiếu từ "Kho tổng Campus 1" → `PENDING_HANDOVER`. Seed LC002 cũng đi từ kho. **Khác spec.**
- **PHT duyệt liên campus (bản v6 cũ).** Code không có bước Hiệu trưởng duyệt, khớp SRS hiện tại.
- **GBR-FAC-06: PHT chỉ thao tác tài sản campus mình.** Code `canCreateTransfer = isVicePrincipal` (`transferPermissions.js:9`), `canViewTransfer` cho PHT thấy mọi phiếu (:18). Đã test: PHT campus 1 tạo phiếu trong campus 2 → thành công. **Thiếu phân quyền theo campus.**

## 2. Trạng thái và ai làm gì (theo code)

| Trạng thái | Ai thao tác | Chuyển tới |
|---|---|---|
| `DRAFT` Bản nháp | PHT: sửa, gửi, hủy | `PENDING_HANDOVER`, `CANCELLED` |
| `PENDING_HANDOVER` Chờ bàn giao | Người bàn giao: xác nhận bàn giao + ký, hoặc yêu cầu điều chỉnh. Khi đang chờ giao bổ sung: xác nhận giao bổ sung. PHT: hủy | `PENDING_RECEIPT`, `REVISION_REQUESTED`, `CANCELLED` |
| `REVISION_REQUESTED` Cần điều chỉnh | PHT: sửa + gửi lại (tăng phiên bản, chữ ký người tạo ký lại, chữ ký bàn giao bị vô hiệu nếu đổi phòng/tài sản/SL), hoặc hủy | `PENDING_HANDOVER`, `CANCELLED` |
| `PENDING_RECEIPT` Chờ xác nhận nhận | Người nhận (chỉ khi đã có chữ ký bàn giao hợp lệ): xác nhận nhận (SL phải đúng bằng SL cần nhận) hoặc báo chênh lệch | `COMPLETED`, `PENDING_RESOLUTION` |
| `PENDING_RESOLUTION` Chờ xử lý chênh lệch | Người bàn giao: trả lời từng dòng. PHT: quyết các dòng chưa trả lời/tranh chấp | `PENDING_RECEIPT`, `PENDING_HANDOVER` |
| `COMPLETED` / `CANCELLED` | Khóa, chỉ xem/in | – |

Xem phiếu:
- PHT: tất cả (không lọc campus).
- Giáo viên / nhân viên / tổ trưởng: chỉ phiếu mình là người bàn giao hoặc người nhận, và không phải nháp.
- Quyền dựa vào **người được chọn trên phiếu, không theo lớp/phòng phụ trách**.

Người bàn giao và người nhận là bất kỳ tài khoản nào: hệ thống chỉ *gợi ý* người phụ trách phòng (`UserPicker.jsx:25`). Đã test: chọn nhân viên bếp campus 2 làm người bàn giao cho phòng campus 1, chọn chính PHT làm người nhận → server chấp nhận.

## 3. Lỗi / rủi ro

| # | Mức | Vị trí | Kịch bản | Cách sửa | Trạng thái |
|---|---|---|---|---|---|
| 1 | High | toàn module | Luật nghiệp vụ luân chuyển (trạng thái, quyền, tồn kho) chỉ nằm ở FE mock, trái `AGENTS.md` nguyên tắc 1–2 và 8. BE coi là ngoài V1 | Chốt phạm vi (mục 0). Nếu giữ: viết BE module card + rule ID, FE chỉ hiển thị | Đã chứng minh (tài liệu) |
| 2 | High | `transferMockRepository.js:496-553` + `FacilityTransferItem.js expectedReceiveQuantity` | PHT xử lý chênh lệch trộn "Chấp nhận SL thực nhận" (dòng A) với "Điều chỉnh tài sản" (dòng B). Phiếu quay về bàn giao lại toàn bộ, `handoverQuantity` reset nhưng `acceptedQuantity` của dòng A giữ nguyên. Người bàn giao giao lại 5, người nhận buộc nhập 3. Hoàn thành chỉ trừ/cộng tồn 3, **2 chiếc biến mất khỏi sổ** | Khi `needsHandover` thì reset `acceptedQuantity` / `cancelledQuantity` mọi dòng, hoặc không cho trộn 2 hướng này | **Đã chứng minh** (runtime, t_006) |
| 3 | High | `transferPermissions.js:9,18` | PHT campus 1 tạo / xem / xử lý phiếu campus 2 (trái GBR-FAC-06) | Lọc theo campus PHT phụ trách (P-14 ở BE đang PENDING) | **Đã chứng minh** |
| 4 | Medium | `transferMockRepository.js:839-849` | `confirmReceipt` chỉ kiểm các dòng client gửi lên, nhưng chuyển tồn **mọi** dòng. Gửi 1/3 dòng vẫn `COMPLETED`, chuyển cả 3. `confirmHandover` (:640) tương tự: dòng không gửi được coi là giao đủ | Bắt buộc payload có đủ mọi dòng của phiếu | **Đã chứng minh** (receipt); handover: đọc code |
| 5 | Medium | `transferConstants.js:43-45` | Cho luân chuyển từ/đến kho tổng, trong khi spec nói kho đi qua cấp phát (BF-08) | Bỏ `STORAGE` khỏi luân chuyển nếu nhóm xác nhận | **Đã chứng minh** |
| 6 | Medium | `assertValidDocument` :214 | Người bàn giao/nhận có thể là bất kỳ ai (khác campus, vai trò bếp, chính PHT). Server không kiểm người đó phụ trách nơi đi/nơi đến | Server kiểm `managerUserId` của phòng hoặc danh sách người được phép | **Đã chứng minh** |
| 7 | Medium | `respondDiscrepancyLine` :705-711 + `resolveDiscrepancy` :576 | Người bàn giao "xác nhận lại SL đã giao" (đổi `handoverQuantity`) cho 1 dòng, dòng khác "không đồng ý". PHT quyết bằng "chấp nhận" → `PENDING_RECEIPT` mà chữ ký bàn giao cũ vẫn hợp lệ dù dữ liệu đã ký bị đổi (trái DESIGN §12.3) | Vô hiệu + ký lại chữ ký bàn giao khi `handoverQuantity` đổi | Đọc code, chưa chạy |
| 8 | Medium | `mocks/mockDatabase.js:23,70` | "Khôi phục dữ liệu demo": lần đầu DB tạo thẳng từ object seed, các thao tác sửa vào chính seed. Reset trong cùng tab trả về seed đã bị sửa (đã test: t_006 vẫn `PENDING_RECEIPT`, phiếu mới vẫn còn) | `cache = clone(buildSeedDatabase())` ở `load` và `resetDb` | **Đã chứng minh** (lỗi chung, ảnh hưởng mọi module) |
| 9 | Low | `confirmReceipt` :859-871 | Nhận vào phòng đã có cùng mã TS: cộng dồn vào dòng tồn sẵn có, tình trạng thực nhận (vd. "Cần sửa") bị mất | Tách dòng tồn theo tình trạng, hoặc ghi chú | Đọc code |
| 10 | Low | `resolveDiscrepancy` CANCEL_DEFECTIVE | Phần lỗi bị "hủy" khỏi phiếu vẫn tính tồn ở nơi đi, dù thực tế đã mang sang nơi nhận | Câu hỏi nghiệp vụ: phần lỗi trả về nơi đi hay chuyển sang báo hỏng? | Câu hỏi |
| 11 | Low | `submit` :379, `addSignature` | Chữ ký nhận `signatureUrl` bất kỳ từ client, không kiểm thuộc tài khoản | BE nhận `signatureId` của chính người dùng | Đọc code |
| 12 | Low | `validateGeneralInfo` | `createdDate` do client gửi. Ngày dự kiến chỉ cần ≥ ngày lập, có thể ở quá khứ | Server tự gán ngày lập | Đọc code |

Điểm làm tốt:
- Giữ chỗ SL giữa các phiếu đang chạy (tránh 2 phiếu cùng lấy một tài sản).
- Khóa khi đang kiểm kê (đã test).
- Bắt đủ 3 chữ ký mới hoàn thành.
- Có phiên bản phiếu và vô hiệu chữ ký khi đổi dữ liệu.
- Có lịch sử và thông báo từng bước.
- Ghi tồn trước/sau.
- Validation dùng chung UI và "server".

## 4. Câu hỏi cần nhóm trả lời

1. Luân chuyển có thuộc V1 không? (SRS có, BE/AGENTS loại trừ.)
2. Tài sản quản lý theo từng chiếc (1 vị trí) hay theo dòng số lượng?
3. Kho tổng có được làm nơi đi/đến của luân chuyển không?
4. Ai được đóng chênh lệch: chỉ PHT (spec) hay người bàn giao tự xử lý được (code)?
5. Người bàn giao/nhận có bắt buộc là người phụ trách phòng không?
6. PHT phụ trách cố định 1 campus hay luân phiên (BE P-14)?
7. Phần tài sản lỗi bị hủy khỏi phiếu thì đi đâu?

**Kết luận:** luồng chính (tạo → bàn giao → nhận → hoàn thành, chênh lệch, khóa kiểm kê) chạy được. Nhưng **chưa nên coi là đúng**:
- Còn 2 lỗi High đã chứng minh: mất tồn khi trộn quyết định, và thiếu phân quyền theo campus.
- Vài chỗ khác spec: kho tổng, người bàn giao tự đóng chênh lệch, không có trạng thái "Đang sử dụng / Đang luân chuyển".
- Phạm vi V1 đang mâu thuẫn giữa các tài liệu.

---

## 5. Đã sửa (08/10/2026, chưa commit)

Luật nằm ở service (`services/facility-transfer/mock/transferMockRepository.js` = bản tham chiếu cho BE), UI chỉ hiển thị theo.

| Lỗi | Sửa | File |
|---|---|---|
| #2 mất tồn khi trộn quyết định | Khi PHT "Điều chỉnh tài sản", mọi dòng bị bàn giao lại; quyết định từng dòng thành SL mới trên phiếu (chấp nhận → SL thực nhận, hủy lỗi → trừ phần lỗi), xóa `acceptedQuantity`/`cancelledQuantity`. Sổ chuyển kho ghi thêm `documentQuantity`, `handoverQuantity`, `shortfall`, `condition` → gửi = nhận + thiếu hụt có ghi nhận | mock repo `resolveDiscrepancy`, `confirmReceipt` |
| #3 phân quyền campus | PHT chỉ tạo / sửa / gửi / hủy / xử lý chênh lệch phiếu **gửi đi từ campus mình**; PHT campus nhận chỉ xem. Wizard chỉ cho chọn campus của PHT. Thêm PHT Campus 2 demo (`duc.trinh@`), LC004 do PHT Campus 2 tạo | `utils/facility-transfer/transferPermissions.js`, mock repo (`assertOwnCampus`), `StepGeneralInfo.jsx`, `mocks/seed.js`, `README.md` |
| #4 thiếu dòng | Bàn giao, xác nhận nhận, báo chênh lệch phải gửi **đủ mọi dòng, mỗi dòng 1 lần** (`assertAllLines`) | mock repo |
| #5 kho tổng | Bỏ `STORAGE` khỏi luân chuyển + thông báo "dùng Cấp phát tài sản". Seed LC002 (Văn phòng → Bếp), LC007 (Lá 1 → Campus 2) | `transferConstants.js`, mock repo, `seed.js` |
| #6 sai người | Người bàn giao / nhận **bắt buộc là người phụ trách** phòng đi / đến (`managerUserId`), phòng chưa có người phụ trách thì báo lỗi. Wizard chỉ hiện người phụ trách | mock repo (`assertResponsiblePerson`), `UserPicker.jsx`, `StepAssignUsers.jsx`, `useTransferWizard.js` |
| #7 chữ ký cũ | Người bàn giao đổi SL khi phản hồi chênh lệch (giao bổ sung / xác nhận lại / đổi hàng) → vô hiệu chữ ký bàn giao cũ, ký lại ngay | mock repo `respondDiscrepancyLine` |
| #8 khôi phục demo | `mockDatabase` clone seed khi tạo DB và khi reset | `mocks/mockDatabase.js` |
| #9 mất tình trạng | Mỗi phòng một dòng tồn cho mỗi (mã TS, tình trạng); "Biến động tồn kho" cộng mọi dòng cùng mã | mock repo `confirmReceipt`, `getStockSnapshot` |
| #11, #12 | Chữ ký phải là chữ ký đã lưu của chính người ký hoặc ảnh vừa tải lên; ngày lập do server gán khi gửi, ngày dự kiến ≥ hôm nay | mock repo (`assertOwnSignature`, `submit`) |
| Spec BF-07 | **Chỉ PHT đóng chênh lệch**: người bàn giao phản hồi hết thì phiếu vẫn chờ, PHT nhận thông báo và xác nhận. **Luôn thông báo cả hai bên** (bỏ ô tắt thông báo). Thao tác trên phiếu Hoàn thành/Đã hủy trả 409 rõ ràng; không cho "Yêu cầu điều chỉnh" khi đang giao bổ sung | mock repo, `transferPermissions.js`, `HandoverPage.jsx`, `StepAssignUsers.jsx` |
| Contract | Ghi luật BE phải làm + mã lỗi ở đầu `services/facility-transfer/api/transferApi.js` (PROPOSED, chưa thống nhất với BE) | `transferApi.js` |

Quyết định đã chọn: phiếu liên campus do **PHT campus gửi** tạo và xử lý; PHT campus nhận chỉ xem. Hiệu trưởng (read-only 2 campus) chưa có vai trò trong FE nên chưa làm.

### Kết quả kiểm thử
- `npm run format`, `npm run lint` (0 lỗi, 0 cảnh báo), `npm run build`, `npm run check`: pass.
- Repo chưa có test runner cho `src/` (chỉ `node --test` cho `scripts/`), không thêm dependency. Đã chạy kịch bản trực tiếp với mock trong trình duyệt (:5180):

| Kịch bản | Kết quả |
|---|---|
| S1 luồng chuẩn: bàn giao đủ → nhận đủ | COMPLETED, sổ: doc 5 / giao 5 / chuyển 5 / thiếu 0 |
| S2 trộn "Chấp nhận" + "Điều chỉnh" (lỗi cũ) | Phiếu thành TS0001=3, TS0002=10; bàn giao lại 3/10/1; chuyển 3/10/1 – khớp |
| S3 nhận chỉ gửi 1/3 dòng | 422 "Vui lòng kiểm tra và xác nhận đủ tất cả 3 tài sản" |
| S10 xác nhận nhận lần 2 / hủy phiếu đã hoàn thành | bị chặn |
| S4 PHT Campus 1 tạo phiếu Campus 2 | 403; PHT Campus 2 tạo được; PHT Campus 1 xem LC004 nhưng xử lý bị chặn; PHT Campus 2 xử lý được |
| S5 nơi đi là Kho tổng | 422 kèm hướng dẫn dùng Cấp phát |
| S6 người bàn giao không phụ trách phòng / người nhận là PHT | 422 nêu đúng người phụ trách |
| S7 nơi đến đang kiểm kê | 409 khóa |
| S9 người bàn giao giao bổ sung đủ | Vẫn PENDING_RESOLUTION, chữ ký bàn giao cũ vô hiệu + ký mới; PHT xác nhận → PENDING_RECEIPT → nhận → COMPLETED |
| S11 chữ ký là URL lạ | 422 |
| S12 client gửi ngày lập 2020-01-01 | Server gán ngày hôm nay |
| S8 thao tác rồi "Khôi phục dữ liệu demo" | Dữ liệu về đúng ban đầu |
| UI | PHT Campus 1: wizard chỉ có Campus 1, LC004 chỉ xem; PHT Campus 2: danh sách LC004, LC007, mở được trang xử lý chênh lệch |

### Còn mở (cần nhóm quyết)
1. Phạm vi V1 (mục 0) – vẫn mâu thuẫn SRS ↔ BE/AGENTS.md.
2. Không có trạng thái tài sản "Đang sử dụng / Đang luân chuyển"; mô hình theo dòng số lượng mỗi phòng.
3. Phần tài sản lỗi bị hủy khỏi phiếu (`CANCEL_DEFECTIVE`) vẫn tính ở nơi đi.
4. Bước "Yêu cầu điều chỉnh" (ngoài spec) vẫn giữ.
5. Vai trò Hiệu trưởng (xem 2 campus) chưa có; PHT cố định 1 campus hay luân phiên (BE P-14).

---

## 6. Luồng xử lý chênh lệch mới (chốt với nhóm 08/10/2026, chưa commit)

Quy tắc: phần đúng nhận ngay, phần sai để PHT quyết; mỗi phần lỗi chỉ có 2 lựa chọn.

| Phần lỗi của một dòng | Lựa chọn của PHT (mặc định trước) | Kết quả |
|---|---|---|
| Thiếu | Yêu cầu giao thêm / Chấp nhận | Giao thêm: người bàn giao mang bù rồi ký. Chấp nhận: lấy đúng số thực nhận, sổ ghi thiếu hụt |
| Thừa | Báo giao thừa – trả lại / Chấp nhận | Trả lại: người bàn giao lấy phần thừa về, phiếu chuyển đúng số trên phiếu. Chấp nhận: nơi nhận giữ luôn, sổ ghi phần thừa |
| Hỏng | Yêu cầu đổi cái tốt / Chấp nhận | Đổi: mang cái tốt sang, lấy cái hỏng về. Chấp nhận: không nhận phần hỏng, phần hỏng ở lại nơi đi |

- Người nhận nhập **số thực nhận** và **trong đó hỏng** cho từng dòng, **ký** khi báo chênh lệch.
- Tất cả "Chấp nhận" thì phiếu **Hoàn thành ngay**, kho chuyển theo số nơi nhận giữ.
- Có giao thêm / trả lại / đổi: phiếu về "Chờ bàn giao" chỉ cho phần đó ("Giao thêm / lấy lại"), người bàn giao ký, người nhận xác nhận, Hoàn thành.
- Bỏ: "Điều chỉnh tài sản", "Hủy phần tài sản lỗi", bước người bàn giao phản hồi từng dòng.
- Sổ biến động ghi: số trên phiếu, đã giao, đã chuyển, thiếu hụt, thừa, số hỏng trả lại.

File: `services/facility-transfer/mock/transferMockRepository.js` (reportDiscrepancy, resolveDiscrepancy, confirmSupplement, completeTransfer), `models/facility-transfer/transferConstants.js`, `models/facility-transfer/FacilityTransferItem.js` (`discrepancyParts`), `utils/facility-transfer/transferPermissions.js`, `pages/facility-transfer/{ReceivePage,HandoverPage,TransferDiscrepancyPage,TransferDetailPage}.jsx`, `components/facility-transfer/{DiscrepancyHistoryCard,DiscrepancyModal,TransferAssetTable}.jsx`, xóa `HandoverResponseModal.jsx`, `mocks/seed.js` (chữ ký mẫu cô Mai, Bình, PHT Đức; LC004 có chữ ký người nhận), `api/transferApi.js` (contract đề xuất).

Đã test: 5 tình huống trên service (thiếu→giao thêm + thừa→trả lại; chấp nhận hết; hỏng→đổi; thiếu+hỏng với giao thiếu có lý do; chưa chọn → lỗi) và chạy trọn trên giao diện LC006 (An bàn giao → Mai báo thiếu bàn, thừa ghế → PHT Lan giao thêm 1 / trả lại 1 → An giao thêm, lấy về, ký → Mai xác nhận 5/10/1 → Hoàn thành, Mầm 1 còn 15 bàn, Chồi 2 lên 17) và LC004 (PHT Đức chấp nhận 8/10 → Hoàn thành ngay, kho chuyển 8). `npm run check` pass.
