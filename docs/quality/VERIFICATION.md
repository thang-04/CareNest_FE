# Verification — bằng chứng trước khi báo xong (FE)

## Iron Law
Không nói "xong / pass / đã sửa" khi chưa có **output lệnh chạy trong lượt này, sau lần sửa cuối**. Suy luận, kết quả lượt trước không phải bằng chứng. **Skip hoặc chưa chạy = chưa kiểm chứng** — báo đúng (`Verify: chưa chạy — <lý do>`).

Lệnh chuẩn: `node scripts/verify.mjs` — chưa có code (`package.json`) ⇒ in `VERIFY SKIP`; khi có code gọi `npm run verify` (team định nghĩa: lint + typecheck + test + build). Output tóm tắt, log ở `verify.log`.

## Bằng chứng

### Nhịp ba chấm loading — 2026-10-20

- Kiểm tiếp sau phản hồi "vẫn giật lắm": Chrome local mock `/ui-kit` bật giảm chuyển động. Trước sửa cả 9 chấm vẫn chạy `spinner-hop` infinite với duration `1e-05s` do rule `!important` toàn cục. Sau media rule riêng cho chấm: cả 9 có animation-name `none`, transform `none`, opacity `0.7`. Chế độ thường giữ source 1.6s, chưa giả lập lại; không đổi thời gian loading. Incident: `docs/knowledge/incidents/FE-BUG-261020-spinner-reduced-motion-loop.md`. Cổng verify và check-ai-layer chạy lại sau lần sửa cuối, xem output bàn giao.

- User chốt chỉ làm ba chấm chạy chậm hơn. Làn S: `src/styles/components.css` giãn chu kỳ `spinner-hop` từ 1s lên 1.6s; độ trễ chấm 2/3 từ 0.15s/0.3s lên 0.24s/0.48s, giữ tỷ lệ lệch nhịp. Áp dụng cho Spinner thường và nhỏ, gồm nút AI gợi ý cách sửa.
- Giữ nguyên timeout request, thời gian bật/tắt loading và cơ chế giảm chuyển động. Đây là điều chỉnh nhịp animation theo yêu cầu, không có incident mới; không thêm test riêng cho giá trị CSS.
- Kiểm chứng source: chu kỳ 1600ms, độ trễ 240/480ms. Cổng `node scripts/verify.mjs` và `node scripts/check-ai-layer.mjs` chạy sau lần sửa cuối, kết quả trong output bàn giao. Chưa đánh giá trực quan trên trình duyệt hoặc kiểm API thật.

| Claim | Bằng chứng |
| --- | --- |
| Xong (khi có code) | Dòng `VERIFY PASS …` trong lượt |
| Bug đã sửa | Output test **fail trước fix** + **pass sau fix** (chưa có test runner ⇒ bước kiểm tay ghi rõ, trình duyệt) |
| Khớp contract BE | Đối chiếu `BE:docs/api/openapi.yaml` (snapshot BE khóa bằng test) + source DTO BE, dẫn `file:line` |
| Chạy trên trình duyệt | Bước + kết quả `x/y`, môi trường (BE thật hay mock) |
| AI layer nhất quán | `node scripts/check-ai-layer.mjs` exit 0 |

## Báo cáo cuối task

### GitHub Actions chạy từ dev — 2026-10-20

- Làn S: đổi bộ lọc push trong `.github/workflows/deploy.yml` từ `main` sang `dev`; giữ nguyên kích hoạt thủ công và các bước verify/deploy VPS.
- Kiểm chứng local: chạy `node scripts/verify.mjs` và `node scripts/check-ai-layer.mjs` sau lần sửa cuối; kết quả trong output bàn giao và `verify.log`. Chưa commit/push, chưa chạy trên GitHub runner hoặc kiểm chứng deploy VPS.

### Dọn CSS không dùng — Phase 1, 2026-10-19

- Kế hoạch user duyệt: `docs/plans/active/2026-10-19-css-cleanup.md`; chỉ dọn kỹ thuật, giữ giao diện và dirty work. Xóa 95 rule, giảm 499 dòng ở 12 stylesheet; không xóa file hoặc đổi JSX/token/dependency.
- Kiểm chứng cấu trúc: AST giữ nguyên mọi rule/declaration/thứ tự ngoài danh sách xóa; hash tracked file ngoài phạm vi giữ nguyên. Reviewer độc lập không tìm thấy consumer bị bỏ sót, kể cả template class và selector ghép.
- Chrome mock riêng, 23 màn ở 1440/768 và ba trạng thái tương tác: 49/49 ca giữ nguyên computed style/hình học; không có selector đã xóa khớp DOM hoặc runtime exception. Modal/Escape, bốn loại toast và focus bàn phím hoạt động.
- PNG: 5/49 ảnh trùng pixel tuyệt đối; 49/49 ảnh không lệch quá 2/255 mỗi kênh RGB, tối đa 145 pixel/ảnh (0,0112%) khác do raster chữ. Đã bỏ nhiễu từ full-page screenshot/scrollbar, loading và HMR bằng kiểm lại viewport trên cùng DOM ổn định; không gọi toàn bộ ảnh là trùng tuyệt đối.
- Suite ghi nhận trong `verify.log`: menu 46, kitchen 37, merge 38 đều đạt, 0 fail/skip; lint/format/build đạt. `check-ai-layer`: 0 lỗi/18 cảnh báo hiện hữu. Cổng đầy đủ được chạy lại sau khi ghi log này; xem output bàn giao cuối.
- Bằng chứng ảnh/JSON/snapshot ở thư mục tạm `carenest-css-cleanup-9c9b06d931ea4fecb3080c1e89578396`; ma trận, thống kê và giới hạn trong Progress log của plan. Không kiểm BE thật hoặc triển khai; Phase 2 chờ review.

### Khoảng cách card Quy trình bếp — 2026-10-19

- User báo khối Thực đơn trong ngày dính card phía trên tại `/kitchen/preparation`. Chrome mock đo gap trước sửa: 0px.
- Sửa hẹp `KitchenFlowPage.jsx`: dùng utility `mb-16` có sẵn (`--space-4`) ở hàng `.db-board`; không đổi CSS dùng chung, dữ liệu hoặc hành vi. Kiểm lại khoảng cách bằng bounding rect trên Chrome, cổng đầy đủ `node scripts/verify.mjs` và `node scripts/check-ai-layer.mjs`; kết quả cuối trong báo cáo bàn giao/`verify.log`.

### Bằng chứng thực đơn dị ứng — 2026-10-19

- Mock repository: `tests/kitchen/published-allergy-menu.test.mjs` ban đầu 0/3, bổ sung read model đạt 3/3; thêm ca legacy tái hiện 3/4 rồi fix đạt 4/4. Bao phủ đổi/bỏ món, nhiều phương án, bữa không đổi, dữ liệu legacy, scope campus/nhóm tuổi, 403 và trường dữ liệu tối thiểu.
- `node scripts/verify.mjs` sau bổ sung fallback legacy: `VERIFY PASS full`, menu 46 + kitchen 37 + merge 38 = 121 test; lint/format/build đạt. Chạy lại sau chỉnh docs cuối, output tại `verify.log` và báo cáo bàn giao.
- Chrome `localhost:5173`, mock, PHT campus 1, ngày 21/10/2026: Theo ngày, Theo tuần và `/kitchen/preparation` đều có dòng thay món + lý do; nút mắt mở bảng tên/lớp/dị ứng đúng nhóm. Escape và nút Đóng đóng modal; đổi nhóm tuổi về Nhà trẻ không còn modal/dòng dị ứng của Mẫu giáo lớn.
- Quy trình bếp 375px: body 365px, modal khoảng 317px; 768px: body 758px. Theo ngày/tuần 375px: bảng cuộn trong khung, body không vượt viewport sau khi layout ổn định. Viewport đã reset. Không reset DB/session demo của user.
- Review độc lập phát hiện thiếu tên món legacy, đã sửa và review lại không còn lỗi quan trọng. Chưa kiểm UI Principal/bếp, BE thật hoặc scope enrollment lịch sử. `check-ai-layer`: lần đầu thiếu dòng incident đúng định dạng bảng, đã sửa index và đạt 0 lỗi/18 cảnh báo; chạy lại sau docs cuối.

```text
Làn S (≤3 dòng):  Đã làm: … · Verify: <dòng VERIFY | chưa chạy — lý do> · Memory: <chỉ khi có trigger>
Làn M (≤8 dòng):  Đã làm · Rule/AC · Verify · Chưa kiểm chứng (trình duyệt, BE thật) · Chờ BE · Memory
Làn L:            ghi đủ vào Progress log của plan; chat chỉ tóm tắt + link plan
```
