---
title: Tải ảnh trẻ và phụ huynh trong tiếp nhận
status: in-progress
owner: thang-04
jira: G94-180 / FE-FEAT-43
branch: feature/G94-180-FE-FEAT-43-child-health-pickup
modules: [children, pickup]
rules: [CHD-01, CHD-02, AUTH-04, PCK-02]
risk: high
created: 2026-11-05
updated: 2026-11-05
---
# Tải ảnh trẻ và phụ huynh trong tiếp nhận

## Context
Plan chính: [BE plan](../../../../CareNest_BE/docs/plans/active/2026-11-05-child-enrollment-photos.md).
User yêu cầu code FE/BE ngày 05/11/2026. `EnrollChildPage.jsx:214` gửi JSON qua enrollChild rồi hiện kết quả; `ChildInfoFields.jsx:57` dùng chung cho tiếp nhận/sửa hồ sơ, chưa có ảnh. `PickupVerifyFlow.jsx:23` đã có ảnh người đón; `ChildAvatar.jsx:5` hỗ trợ ảnh trẻ/fallback. Không sửa dirty work về vòng đầu của task trước.

## Quyết định đã chốt
1. Có nút tải ảnh riêng của trẻ và từng phụ huynh ở tiếp nhận — user 05/11/2026.
2. Giữ luồng bước, quyền và UI components hiện có. Không sửa APP, không thêm dependency/camera/link công khai.

## Làm rõ nghiệp vụ
CHD-01/02: nhập hồ sơ có ảnh; AUTH-04: scope; PCK-02: giáo viên đối chiếu người đón. Xem Domain spec và contract tại BE `specs/012-child-enrollment-photos/`.
Đề xuất ảnh tùy chọn, JPEG/PNG/WEBP ≤2 MiB; ảnh phụ huynh gắn hồ sơ và không ghi đè ảnh tài khoản dùng chung. Dữ liệu cũ/fallback tiếp tục hiện bình thường.
Flow: [B] ảnh gia đình cung cấp → [S] chọn/preview từng người → [B] xem lại và lưu → [S] multipart tới BE, đọc blob có token để xem ảnh đã lưu.

### Câu hỏi mở
- [x] User duyệt gói đề xuất trong plan chính; không tự approve.

## Acceptance criteria
AC-1..8 dùng chung plan BE: preview/xem lại đúng người, lưu/đọc/avatar, JSON không ảnh, lỗi tệp đúng ô, quyền, pickup chưa kích hoạt/fallback, lỗi lưu giữ form và bảo toàn ảnh khi sửa hồ sơ.

## Key decisions
| Quyết định | Đề xuất | Phương án khác | Vì sao |
| --- | --- | --- | --- |
| Tệp chưa lưu | File + object URL trong bộ nhớ form | Base64 vào localStorage | Giữ file thật cho multipart, thu hồi preview đúng lúc |
| Request | JSON khi không ảnh; multipart khi có ảnh | Upload từng ảnh sau tạo trẻ | Tương thích và tránh trạng thái tiếp nhận đã lưu nhưng giao diện báo lỗi |
| Ảnh đã lưu | Blob có token qua API client, rồi object URL | img src trực tiếp endpoint private | Endpoint cần Authorization |

## Phases
### Phase 1 — Client cùng lượt BE, review cuối
Phụ thuộc contract BE được user duyệt và implementation BE.
- Sửa EnrollChildPage/ChildInfoFields: nút Tải ảnh/Thay ảnh/Bỏ ảnh đã chọn; preview cho trẻ/từng phụ huynh; dùng được bằng bàn phím; đúng người khi thêm/xóa/đổi người.
- Bước xem lại hiện ảnh; bỏ/chọn lại tệp giống nhau được; clear form thu hồi URL; disabled khi busy; dirty state tính cả ảnh.
- Sửa childrenApi/facade/mock theo contract; multipart không tự đặt boundary; response giữ đúng kiểu dữ liệu hiện có.
- Hiện ảnh ở hồ sơ/ChildAvatar/danh sách và pickup bằng đường đọc private có token. Lỗi ảnh có fallback; không nuốt lỗi save.
- Sửa hồ sơ không kèm ảnh vẫn giữ ảnh, không vô tình mở quyền upload cho các màn dùng chung ngoài tiếp nhận.
- Tests: render và tương tác chọn/thay/bỏ/chuyển bước; adapter mapping theo guardian; mock save/reload; private blob và URL cleanup; pickup/fallback.
- Exit: `node scripts/verify.mjs` → VERIFY PASS full, skip 0; `node scripts/check-ai-layer.mjs` exit 0; browser 1440/375 chọn ảnh, xem lại, lưu/mở lại và lỗi tệp; môi trường thật tùy cấu hình, ghi rõ giới hạn.
- **Dừng chờ user review cùng phase BE.**

## Test matrix
| AC | Rule | Test (tầng) | Phase | Kết quả |
| --- | --- | --- | --- | --- |
| 1/2 | CHD-01/02 | Form, preview, multipart save, hồ sơ/avatar | 1 | Đạt; bằng chứng ở Spec012 quickstart |
| 3/4/7 | CHD-01 | JSON cũ, lỗi ảnh, giữ form và busy/retry | 1 | Đạt; bằng chứng ở Spec012 quickstart |
| 5/6 | AUTH-04/PCK-02 | Private image, fallback và pickup | 1 | Đạt; bằng chứng ở Spec012 quickstart |
| 8 | CHD-02 | Sửa/đổi thứ tự phụ huynh không lẫn ảnh | 1 | Đạt; bằng chứng ở Spec012 quickstart |

## Rủi ro & rollback
Sai ảnh khi xóa/đổi thứ tự phụ huynh: giữ danh tính và test mapping; không dùng index làm identity sau lưu. Object URL rò rỉ: cleanup khi thay/unmount. Không clear DB demo đang dùng. Rollback có chọn lọc các file task; không đụng dirty work trước đó.

## Validation log
- [x] Đã kiểm source, chỉ rõ consumer; chọn phương án trong Key decisions còn chờ user duyệt.
- [x] >8 file liên repo tách task theo BE/FE, một điểm review cuối; mỗi AC có kiểm chứng.
- [x] Không công bố đã có upload thật, không đổi contract đang chạy trước duyệt.

## Progress log
### 2026-11-05 — Draft chờ duyệt
- Chuẩn bị thiết kế FE và liên kết plan/Domain spec/contract BE; chưa sửa source của tính năng ảnh.
- Chưa chạy test ứng dụng cho tính năng. Check-ai-layer: 0 lỗi/20 cảnh báo có sẵn; diff whitespace đạt. BE còn một link incident hỏng có sẵn ngoài phạm vi, xem plan chính.
- Tiếp: user duyệt plan chính và gói đề xuất, sau đó triển khai BE+FE.

### 2026-11-05 — User duyệt, bắt đầu phase 1
- User trả lời “duyệt”, chấp thuận gói phương án đã trình và triển khai FE/BE. Không có quyền commit/push. Các entry trước giữ để truy vết lịch sử.

### 2026-11-05 — Phase 1 triển khai xong, chờ review
- BE: VERIFY PASS full | tests 1073 fail 0 err 0 skip 0 | archunit ok | snapshot ok | spotless ok | 516s | log target/verify.log. FE: VERIFY PASS full, 799 tests, zero fail/skip.
- Actual Chromium mock 1440/375 chọn/bỏ/chọn lại, xóa phụ huynh, chuyển bước, lưu/mở lại/reload có ảnh; 0 lỗi JS, không tràn ngang; 9 URL tạo/9 thu hồi mỗi viewport. Ảnh fixture tổng hợp, không dữ liệu thật.
- Review độc lập tìm bốn vấn đề; đã sửa và thêm regression, review lại không còn blocker. Converge cuối sạch trong phạm vi ảnh đã duyệt; tasks T001..T012 hoàn tất.
- Khác plan theo source: bổ sung GET /children/{id}/profile vì FE đã gọi nhưng BE chưa có; response chỉ child view hiện có, không giả lập khai báo/lịch sử lớp. Scope đọc dùng CampusAccessPolicy AUTH-20, tách metadata quản trị tài khoản theo quyền và campus. BE chưa có PUT sửa hồ sơ, không mở thêm feature sửa hồ sơ.
- Giới hạn: chưa chạy upload S3 thật hoặc browser-to-live-BE; module children/pickup FE vẫn giữ nguồn demo hiện có. API adapters và BE kiểm độc lập. AI-layer FE 0 lỗi/20 cảnh báo; BE còn 1 link incident hỏng có sẵn/12 cảnh báo, đã xác nhận tồn tại ở HEAD.
- Không commit/push. Giữ status in-progress để chờ user review phase; không còn câu hỏi nghiệp vụ mở.

### 2026-11-05 — User yêu cầu commit và push
- User cho phép commit và đẩy code lên nhánh hiện tại của cả FE/BE; dùng mã G94-180 theo nhánh, không tạo PR hoặc đổi nhánh. Không đưa artifact trình duyệt/tệp báo cáo cục bộ vào commit.
- Cổng tài liệu BE trước commit: sửa link incident FE đã có ở commit994002c sang URL blob cố định, đã xác minh git object; không đổi nội dung incident hay mã giáo dục. Check-ai-layer sau sửa: BE 0 lỗi/12 cảnh báo, FE 0 lỗi/20 cảnh báo.
