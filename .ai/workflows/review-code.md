# Workflow — Review code (Web)

Làn S: tự kiểm 3 điểm (đúng phạm vi, không đổi contract, có test). Làn M: các mục liên quan. Làn L: đủ, kể cả spec trước (mỗi AC trong plan: PASS / MISSING / EXTRA) và Kết luận; review qua subagent nếu công cụ hỗ trợ.

Đọc mục tiêu thay đổi + diff + BE module card liên quan. Kiểm tra theo thứ tự ưu tiên:

1. **Business logic bị chép vào FE:** client tự tính số suất, trend, trạng thái duyệt, cut-off, quyền? Hard-code role cho hành động có actor PENDING? Hiển thị field ngoài quyền?
2. **Security & privacy:** coi ẩn UI là phân quyền; lọc dữ liệu theo scope chỉ ở client; dữ liệu trẻ/sức khỏe trong `console.log`, error tracking, URL query, localStorage; token lưu sai chỗ so với `docs/integration/AUTH_FLOW.md`; secret trong code/env commit; render HTML không escape.
3. **Contract:** request/response khớp `../CareNest_BE/docs/contracts/` và DTO BE; đọc đúng envelope `{code, desc, data}`; xử lý 400 (field errors), 401, 403, 404, 409, 5xx; pagination đúng shape.
4. **AI output:** hiển thị là DRAFT, có bước duyệt, màn hình dùng được khi AI tắt (503/504).
5. **State & async:** race condition, stale cache sau mutation, double submit, cleanup effect, loading/empty/error đầy đủ.
6. **UX/accessibility:** label, focus, keyboard, thông báo lỗi dễ hiểu (tiếng Việt), responsive cho bảng/form.
7. **Test:** có test hành vi chính, lỗi API, ẩn/hiện theo permission, regression cho bug fix?
8. **Convention:** `.claude/rules/`, quy tắc comment/commit trong `AGENTS.md`.
9. **Memory:** fix bug không hiển nhiên có incident + dòng `ISSUE_INDEX.md` chưa (theo `update-knowledge.md` T2)? Đối chiếu `docs/knowledge/PATTERNS.md`.

## Phát hiện
`[Severity] file:line — kịch bản lỗi — cách sửa — đã chứng minh | giả thuyết`. Severity: **Critical** (lộ dữ liệu trẻ/token, vượt quyền, sai nghiệp vụ lõi) · **High** (vd. làm theo rule chưa CONFIRMED hoặc lệch tài liệu mà không hỏi) · **Medium** · **Low**. Spec không rõ ⇒ ghi là câu hỏi. Mỗi phát hiện: vị trí, kịch bản gây lỗi, cách sửa. Phân biệt lỗi đã chứng minh với câu hỏi/giả định. Không tuyên bố đã chạy runtime/trình duyệt nếu chỉ đọc tĩnh.

## Kết luận (làn L)
`PASS` · `PASS_WITH_RISK` (liệt kê rủi ro chấp nhận) · `BLOCKED` (≥1 Critical/High đã chứng minh). Tối đa 3 vòng review–sửa, sau đó hỏi user.

## Nhận review
Kiểm chứng từng phát hiện trước khi sửa; sai ⇒ phản biện bằng bằng chứng. Không âm thầm đảo quyết định user đã ghi trong plan.
