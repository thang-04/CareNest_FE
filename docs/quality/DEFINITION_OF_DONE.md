# Definition of Done — CareNest_FE

Agent và developer đối chiếu trước khi báo hoàn thành. Bỏ qua mục không áp dụng, nhưng nêu lý do.

## Code
- [ ] Không chép business rule vào FE; rule liên quan dẫn chiếu bằng rule ID / BE module card.
- [ ] Không tính lại dữ liệu nghiệp vụ ở client (số suất, trend, tổng hợp, trạng thái duyệt).
- [ ] Không hard-code role cho hành động có actor PENDING; ẩn/hiện theo permission BE.
- [ ] Không coi ẩn UI là phân quyền; xử lý 401/403/404 từ BE.
- [ ] Request/response khớp contract BE (envelope `{code, desc, data}`, pagination, field error 400); không phân nhánh theo text `desc`.
- [ ] Màn hình đủ trạng thái: loading, empty, error, 403, 404, submitting; nội dung AI có nhãn DRAFT + bước duyệt + dùng được khi AI tắt.
- [ ] Không secret, không dữ liệu trẻ thật trong code/test/fixture/log/console/storage.
- [ ] Không thêm dependency/thư viện nền khi chưa được user đồng ý.
- [ ] Theo `.claude/rules/` và quy tắc comment trong `CLAUDE.md`.

## Test
- [ ] Test cho hành vi chính, lỗi API quan trọng, ẩn/hiện theo permission.
- [ ] Bug fix có regression test fail-trước/pass-sau.
- [ ] Đã chạy test/lint/typecheck/build có sẵn; báo kết quả thật (không báo pass khi chưa chạy).
- [ ] Nêu rõ phần chưa kiểm chứng trên trình duyệt hoặc với BE thật.
- [ ] Form/bảng mới: kiểm tra accessibility cơ bản (label, focus, keyboard) và responsive.

## Contract & docs
- [ ] Cần BE đổi/thêm contract ⇒ đã liệt kê thay đổi cần thống nhất + tác động APP; không tự sửa BE.
- [ ] Quy ước tích hợp mới ⇒ `docs/integration/BACKEND_INTEGRATION.md`.
- [ ] Màn hình/route mới ⇒ `docs/architecture/ROUTE_MAP.md`; screen group đổi trạng thái ⇒ `docs/context/CURRENT_STATE.md`.
- [ ] Feature phức tạp ⇒ `docs/features/<feature>.md` theo template; thêm vào `docs/INDEX.md` + `.ai/CONTEXT_MAP.yaml`.
- [ ] Quyết định kiến trúc client đã chốt ⇒ cập nhật file SKELETON tương ứng thành FULL.

## Engineering memory
- [ ] Lỗi không hiển nhiên / thử >1 cách / có thể lặp / lỗi môi trường >15 phút ⇒ incident `docs/knowledge/incidents/` + dòng `ISSUE_INDEX.md` (kèm các cách đã thử thất bại).
- [ ] Bẫy đặc thù feature ⇒ 1 dòng "Known pitfalls" trong `docs/features/<feature>.md`.
- [ ] Bài học tổng quát ⇒ `docs/knowledge/PATTERNS.md`.
- [ ] Giới hạn còn tồn tại / chưa rõ root cause ⇒ `docs/knowledge/KNOWN_ISSUES.md`.
- [ ] Bug contract/nghiệp vụ do BE ⇒ báo cáo có nội dung đề xuất cho BE `docs/knowledge/CROSS_MODULE_ISSUES.md`.
