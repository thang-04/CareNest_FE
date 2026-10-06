# Workflow — Fix bug (Web)

Làn S (1–2 file, nguyên nhân rõ): triệu chứng, grep memory, sửa, regression test fail-trước/pass-sau. Làn M/L: đủ các bước; root cause đủ 6 mục (triệu chứng nguyên văn · tái hiện · mong đợi vs thực tế · `file:line` + bằng chứng · vì sao giờ mới lộ · phạm vi ảnh hưởng) trước khi sửa. Không có nguồn cho "hành vi đúng" ⇒ `clarify-business.md`. **3 lần sửa thất bại ⇒ dừng**, ghi Attempts, hỏi user.

1. **Triệu chứng:** ghi nguyên văn chuỗi lỗi (console, network response `{code, desc}`, UI message), route, role/scope người dùng, bước thao tác, hành vi mong đợi (từ rule ID / flow trong BE module card). Tái hiện bằng dữ liệu giả, tối thiểu.
2. **Tra memory trước khi điều tra:**
   - grep `docs/knowledge/ISSUE_INDEX.md` (FE) theo chuỗi lỗi, màn hình, từ khóa VN/EN; lỗi build/dev server ⇒ `docs/knowledge/TROUBLESHOOTING.md`.
   - grep `BE:docs/knowledge/ISSUE_INDEX.md` (và `CROSS_MODULE_ISSUES.md` nếu nghi contract).
   - Có match (kể cả status `open`) ⇒ đọc incident, **đặc biệt mục Attempts** để không lặp cách đã thất bại.
3. **Khoanh vùng FE hay BE:** so request/response thực tế (network) với contract BE (`../CareNest_BE/docs/contracts/`, source controller/DTO nếu có).
   - Response sai contract hoặc sai nghiệp vụ ⇒ lỗi BE: **không vá ở FE**; chuyển `profiles/cross-repo.md`, đề xuất ghi `../CareNest_BE/docs/knowledge/CROSS_MODULE_ISSUES.md`.
   - Response đúng nhưng UI sai ⇒ lỗi FE: tiếp bước 4.
4. **Chứng minh root cause** bằng bằng chứng (test fail, file:line, network log, state snapshot). Ghi lại từng cách thử và kết quả trong lúc điều tra — dùng cho bước 7.
5. **Đánh giá tác động** trước khi sửa: component/hook dùng chung, cache/state bị stale, các role khác thấy màn hình này, trạng thái loading/empty/error/403/404.
6. **Sửa hẹp + regression test** fail-trước/pass-sau (unit/component test; e2e nếu lỗi điều hướng/luồng). Chạy test liên quan; báo đúng những gì đã chạy; nói rõ nếu chưa kiểm chứng trên trình duyệt/API thật.
7. **Cập nhật engineering memory:** theo `.ai/workflows/update-knowledge.md` T2 (incident `status: open` mở ngay từ bước 4 nếu lỗi không hiển nhiên; Attempts ghi vào incident).
8. Đối chiếu `docs/quality/DEFINITION_OF_DONE.md`.
