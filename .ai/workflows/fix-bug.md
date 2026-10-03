# Workflow — Fix bug (Web)

1. **Triệu chứng:** ghi nguyên văn chuỗi lỗi (console, network response `{code, desc}`, UI message), route, role/scope người dùng, bước thao tác, hành vi mong đợi (từ rule ID / flow trong BE module card). Tái hiện bằng dữ liệu giả, tối thiểu.
2. **Tra memory trước khi điều tra:**
   - grep `docs/knowledge/ISSUE_INDEX.md` (FE) theo chuỗi lỗi, màn hình, từ khóa VN/EN; lỗi build/dev server ⇒ `docs/knowledge/TROUBLESHOOTING.md`.
   - grep `../CareNest_BE/docs/knowledge/ISSUE_INDEX.md` (và `CROSS_MODULE_ISSUES.md` nếu nghi contract).
   - Có match ⇒ đọc incident, **đặc biệt mục Attempts** để không lặp cách đã thất bại.
3. **Khoanh vùng FE hay BE:** so request/response thực tế (network) với contract BE (`../CareNest_BE/docs/contracts/`, source controller/DTO nếu có).
   - Response sai contract hoặc sai nghiệp vụ ⇒ lỗi BE: **không vá ở FE**; chuyển `profiles/cross-repo.md`, đề xuất ghi `../CareNest_BE/docs/knowledge/CROSS_MODULE_ISSUES.md`.
   - Response đúng nhưng UI sai ⇒ lỗi FE: tiếp bước 4.
4. **Chứng minh root cause** bằng bằng chứng (test fail, file:line, network log, state snapshot). Ghi lại từng cách thử và kết quả trong lúc điều tra — dùng cho bước 7.
5. **Đánh giá tác động** trước khi sửa: component/hook dùng chung, cache/state bị stale, các role khác thấy màn hình này, trạng thái loading/empty/error/403/404.
6. **Sửa hẹp + regression test** fail-trước/pass-sau (unit/component test; e2e nếu lỗi điều hướng/luồng). Chạy test liên quan; báo đúng những gì đã chạy; nói rõ nếu chưa kiểm chứng trên trình duyệt/API thật.
7. **Cập nhật engineering memory** (bắt buộc nếu lỗi không hiển nhiên / thử >1 cách / có thể lặp / lỗi môi trường >15 phút):
   - `docs/knowledge/incidents/<ID>-<slug>.md` theo `_TEMPLATE.md` (gồm Attempts thất bại).
   - 1 dòng trong `docs/knowledge/ISSUE_INDEX.md` với từ khóa + chuỗi lỗi để grep được.
   - `docs/knowledge/PATTERNS.md` nếu tổng quát hóa được.
   - Chưa rõ root cause ⇒ ghi `docs/knowledge/KNOWN_ISSUES.md`, không tạo incident.
   - Root cause ở BE ⇒ nội dung đề xuất cho BE `CROSS_MODULE_ISSUES.md` trong báo cáo.
8. Đối chiếu `docs/quality/DEFINITION_OF_DONE.md`.
