# CareNest Web — hướng dẫn cho AI coding agent

Repo này là **client Web** của CareNest (Trường Mầm non Thượng Hồng, Hải Phòng — 1 trường / 2 điểm trường). Phục vụ System Admin, Principal, Vice Principal (theo campus), Teacher. FE sở hữu màn hình, route, client state, tích hợp API. **`CareNest_BE` là source of truth** cho business rule, authorization, API contract và engineering memory nghiệp vụ.

Quy ước đường dẫn: `BE:<path>` = `../CareNest_BE/<path>` (repo sibling). Không có sibling ⇒ đọc trên https://github.com/thang-04/CareNest_BE.git và nói rõ đã đọc bản remote.

## Bắt đầu mọi task

1. Phân loại task bằng `.ai/ROUTER.md` → profile, workflow, skill, mức context (L1–L4).
2. Tìm vùng nghiệp vụ bằng `.ai/CONTEXT_MAP.yaml` (mục `keywords`) → đọc **BE module card** (`BE:docs/modules/<module>.md`) + FE doc tương ứng (`docs/features/README.md`, `docs/architecture/ROUTE_MAP.md`).
3. Bug/lỗi/case lạ: **search `docs/knowledge/ISSUE_INDEX.md` (FE) và `BE:docs/knowledge/ISSUE_INDEX.md` trước** khi điều tra. Incident cũ là manh mối, phải kiểm chứng lại với code hiện tại.
4. Kết thúc: đối chiếu `docs/quality/DEFINITION_OF_DONE.md`, gồm cập nhật engineering memory.

**Tri thức mới** — user đưa nghiệp vụ mới / chốt PENDING, hoặc gặp **bug mới** / edge case ⇒ chạy `.ai/workflows/update-knowledge.md` ngay trong lượt (không đợi cuối task).

## Đọc tiết kiệm token

- **`.ai/CONTEXT_MAP.yaml`: grep, không đọc cả file** — `grep -iE "<từ khóa>" .ai/CONTEXT_MAP.yaml` để ra module/card. Chỉ mở cả file khi cần sửa map.
- **Contract BE**: chỉ đọc `BE:docs/backend-coding-guide.md` mục 7–8 khi đụng API (grep tiêu đề `^## 7\.`/`^## 8\.`); không đọc cả guide.
- **Engineering memory:** grep `docs/knowledge/ISSUE_INDEX.md` (+ `BE:docs/knowledge/ISSUE_INDEX.md` nếu lỗi contract/nghiệp vụ) theo chuỗi lỗi/từ khóa; chỉ mở `incidents/<ID>-*.md` khi dòng index khớp. Ghi mới: 1 issue = 1 dòng ngắn trong index, chi tiết để trong file incident.
- **Coding rule theo loại file** ở `.claude/rules/<tên>.md` (frontmatter `paths`). Claude tự nạp; agent khác (Codex) tự mở rule khớp file đang sửa.
- `.agents/skills/` là bản mirror của `.claude/skills/` — sửa một bên thì chép y hệt sang bên kia.
- Không đọc toàn bộ `docs/` trừ profile `full`. Mức đọc theo `.ai/ESCALATION.md`.

## Nguyên tắc bất biến

1. **BE sở hữu business rule, authorization, API contract.** FE chỉ hiển thị và gửi yêu cầu; BE quyết định hợp lệ.
2. **Không sao chép business rule vào FE.** Cần rule ⇒ dẫn chiếu rule ID / module card BE bằng đường dẫn, không chép nội dung. Validation FE chỉ hỗ trợ nhập liệu (required, format), không thay validation BE.
3. **Ẩn UI ≠ phân quyền.** Ẩn nút/menu theo dữ liệu quyền từ BE là UX; không lọc dữ liệu theo scope chỉ ở client. 403/404 từ BE là kết quả hợp lệ phải xử lý.
4. **1 trường, 2 campus** — không phải multi-school/multi-tenant. Không tự suy luận scope (campus/lớp) ở client; dùng dữ liệu BE trả về.
5. **Không dữ liệu trẻ thật / sức khỏe / tài khoản / secret** trong prompt, log, console, fixture, mock, screenshot, commit.
6. **PENDING / OPEN ⇒ hỏi.** Mục chưa chốt (actor, field hiển thị, framework, auth) ⇒ nêu khoảng trống, hỏi hoặc làm cấu hình được — không đoán. AI chỉ tạo DRAFT; UI phải thể hiện trạng thái DRAFT và bước người duyệt.
7. **Ghi lại bug không hiển nhiên** (kể cả các cách đã thử thất bại) vào `docs/knowledge/`. Bug UI/client ở FE; **bug contract/nghiệp vụ** phát hiện từ FE ⇒ đề xuất ghi vào `BE:docs/knowledge/CROSS_MODULE_ISSUES.md` (không tự sửa repo BE).
8. **Không mở rộng scope V1:** không asset management (CSVC chỉ báo/theo dõi sự cố), không chat thay Zalo, không giáo án, không chẩn đoán. Đối chiếu `BE:docs/context/PROJECT_CONTEXT.md` (Exclusions).

## Stack

React + TypeScript: **PROPOSED** (Next.js cũng chỉ PROPOSED). Chưa có source. Router, state/cache, UI kit, cách lưu token: chưa chốt ⇒ hỏi trước khi chọn. Coding rule: `.claude/rules/` (dùng chung cho mọi agent). Đọc source thực tế trước khi áp rule framework.

## Quy tắc chung CareNest (bắt buộc)

Khối này giống nhau ở cả ba repo `CareNest_BE`, `CareNest_FE`, `CareNest_APP`; chỉ mục "Hỏi trước khi làm" và "Phạm vi" khác theo repo. Sửa ở một repo thì đồng bộ sang hai repo còn lại.

### Git — commit, push, pull request

- KHÔNG tự `git commit` / `git push` / tạo-merge-đóng PR / tạo branch khi user chưa cho phép rõ **trong tin nhắn hiện tại** (được phép một lần ≠ lần sau). Branch khi được phép: `feature/<KEY>-<mo-ta>`, `fix/<KEY>-<mo-ta>`, `chore/<mo-ta>`; làm trên branch khác `main` ⇒ hỏi trước.
- KHÔNG lệnh git phá hủy khi chưa hỏi (`reset --hard`, `push --force`, `rebase`, `branch -D`, `clean -fd`, `checkout -- .`, `restore .`, `stash drop`); KHÔNG `--no-verify`/bỏ qua hook.

### Commit message

- Conventional Commits tiếng Anh `<type>(<scope>): <subject>`, `type` ∈ `feat|fix|refactor|test|docs|chore|build|ci`; subject ≤72 ký tự, mệnh lệnh, không dấu chấm cuối; body tùy chọn ≤~5 gạch đầu dòng nói lý do/tác động (không liệt kê file, không kể quá trình). 1 commit = 1 thay đổi logic.
- **Jira:** user bảo commit mà chưa nêu task ⇒ hỏi "Thay đổi này thuộc task Jira nào (vd. `CN-123`)?". 1 commit = đúng 1 key ở footer `Refs: <KEY>`; nhiều task ⇒ tách commit; user xác nhận không có task ⇒ commit không key và nói rõ. Không đoán/bịa key.
- KHÔNG ghi tên model/công cụ AI, `Co-Authored-By` AI, "Generated with ..." trong commit, PR hay comment code (ghi đè attribution mặc định của công cụ).

```text
feat(response): add PageResponse for paginated APIs

- Avoid exposing Spring Page structure to clients

Refs: CN-123
```

### Comment trong code

- Chỉ comment ngắn (1 dòng, tối đa 2–3) ở logic chính/không hiển nhiên; nói *tại sao / quy tắc gì*, tiếng Việt, giữ identifier tiếng Anh. Không comment code tự giải thích, không Javadoc/JSDoc tràn lan.
- KHÔNG code comment-out, comment nhật ký, TODO mơ hồ (cần thì `// TODO(<người/issue>): <việc cụ thể>`), thông tin AI, dữ liệu thật/secret. Sửa code ⇒ sửa/xóa comment liên quan.

### Hỏi trước khi làm

- Thêm/xóa/nâng dependency (`package.json`, lockfile) hoặc đổi version công cụ build.
- Chọn framework/thư viện nền khi team chưa chốt: router, state/cache, UI kit, cách lưu token.
- Gọi API khác contract BE hoặc cần BE đổi contract — nêu thay đổi cần thống nhất thay vì tự giả định.

### Phạm vi

- Chỉ sửa trong phạm vi task; KHÔNG xóa/đổi tên/di chuyển file ngoài phạm vi khi chưa hỏi.
- KHÔNG sửa repo `CareNest_BE`, `CareNest_APP` trừ khi user cho phép rõ trong tin nhắn hiện tại (vd. đồng bộ tri thức theo `update-knowledge.md`).
- KHÔNG tự thêm thư viện/hạ tầng mới khi team chưa chốt.

### Giao tiếp

- Trả lời user tiếng Việt; commit, branch, identifier tiếng Anh. Yêu cầu chưa rõ ⇒ hỏi trước. Báo kết quả đúng sự thật (test fail/skip/chưa chạy phải nói rõ).
