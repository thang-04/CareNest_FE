# CareNest Web — hướng dẫn cho AI coding agent

Repo này là **client Web** của CareNest (Trường Mầm non Thượng Hồng, Hải Phòng — 1 trường / 2 điểm trường). Phục vụ System Admin, Principal, Vice Principal (theo campus), Teacher. FE sở hữu màn hình, route, client state, tích hợp API. **`CareNest_BE` là source of truth** cho business rule, authorization, API contract và engineering memory nghiệp vụ.

Quy ước đường dẫn: `BE:<path>` = `../CareNest_BE/<path>` (repo sibling). Không có sibling ⇒ đọc trên https://github.com/thang-04/CareNest_BE.git và nói rõ đã đọc bản remote.

## Bắt đầu mọi task — chọn làn

| Làn | Khi nào | Đọc | Plan · verify · báo cáo |
| --- | --- | --- | --- |
| **S** | ≤2 file, việc rõ, ngoài vùng rủi ro | File đích + test; bug: grep `ISSUE_INDEX.md` (+ BE nếu lỗi contract) | Không plan · `node scripts/verify.mjs` · ≤3 dòng |
| **M** | 3–8 file; màn hình/hành vi trong 1 nhóm | `.ai/ROUTER.md` → grep `.ai/CONTEXT_MAP.yaml` → BE card + feature doc | Mini-plan chat · verify · ≤8 dòng |
| **L** | Thư viện nền, auth/token, API client chung, điều hướng theo role, dependency, ≥2 nhóm màn hình, đổi contract BE, >8 file | + `.ai/ESCALATION.md` L3–L4 | Plan `.ai/workflows/plan-change.md` user duyệt · Progress log |

- Đổi nghiệp vụ/thứ người dùng thấy ⇒ `.ai/workflows/clarify-business.md` trước khi code. Vượt tiêu chí ⇒ nâng làn, không hạ làn.
- Plan `docs/plans/active/` khớp branch ⇒ đọc Progress log cuối.
- Grep, không đọc cả file: CONTEXT_MAP, ISSUE_INDEX, BE guide mục 7–8.
- `.claude/rules/` theo file (Codex tự mở); `.agents/skills/` = mirror `.claude/skills/`.
- Báo xong: `docs/quality/VERIFICATION.md` + DoD theo làn.

## Nguyên tắc bất biến

1. **BE sở hữu business rule, authorization, API contract.** FE chỉ hiển thị và gửi yêu cầu; BE quyết định hợp lệ.
2. **Không sao chép business rule vào FE.** Cần rule ⇒ dẫn chiếu rule ID / module card BE bằng đường dẫn, không chép nội dung. Validation FE chỉ hỗ trợ nhập liệu (required, format), không thay validation BE.
3. **Ẩn UI ≠ phân quyền.** Ẩn nút/menu theo dữ liệu quyền từ BE là UX; không lọc dữ liệu theo scope chỉ ở client. 403/404 từ BE là kết quả hợp lệ phải xử lý.
4. **1 trường, 2 campus** — không phải multi-school/multi-tenant. Không tự suy luận scope (campus/lớp) ở client; dùng dữ liệu BE trả về.
5. **Không dữ liệu trẻ thật / sức khỏe / tài khoản / secret** trong prompt, log, console, fixture, mock, screenshot, commit.
6. **Chưa rõ / PENDING / OPEN / lệch tài liệu ⇒ hỏi user tới khi rõ** (actor, field); cấu hình được chỉ khi user nói chưa chốt. AI chỉ tạo DRAFT; UI phải thể hiện trạng thái DRAFT và bước người duyệt.
7. **Tri thức mới, bug không hiển nhiên** (kể cả cách thử thất bại) ⇒ `.ai/workflows/update-knowledge.md` ngay trong lượt; bug contract/nghiệp vụ ⇒ đề xuất ghi `BE:docs/knowledge/CROSS_MODULE_ISSUES.md`.
8. **Không mở rộng scope V1:** không asset management (CSVC chỉ báo/theo dõi sự cố), không chat thay Zalo, không giáo án, không chẩn đoán. Đối chiếu `BE:docs/context/PROJECT_CONTEXT.md` (Exclusions).

## Stack

React + TypeScript: **PROPOSED** (Next.js cũng chỉ PROPOSED). Chưa có source. Router, state/cache, UI kit, cách lưu token: chưa chốt ⇒ hỏi trước khi chọn. Đọc source thực tế trước khi áp rule framework.

Giao diện: theo `DESIGN.md` (design system chung web + app; luật cứng mục 2, tự kiểm mục 13.1). Code (thư mục, luồng dữ liệu, thêm module): `docs/architecture/CODING_GUIDE.md`. Lệch ⇒ nói rõ trong báo cáo.

## Quy tắc chung CareNest (bắt buộc)

Khối này là quy tắc chung cho `CareNest_BE`, `CareNest_FE`, `CareNest_APP`; chỉ mục "Hỏi trước khi làm" và "Phạm vi" khác theo repo. Đồng bộ sang repo khác chỉ khi user cho phép rõ. Quy tắc Git/Jira dưới đây được user chốt ngày 2026-10-12 (CONFIRMED), thay thế mẫu branch/Conventional Commits cũ; hiện được cập nhật tại FE, chưa xác nhận đồng bộ BE/APP.

### Git — commit, push, pull request

- KHÔNG tự `git commit` / `git push` / tạo-merge-đóng PR / tạo branch khi user chưa cho phép rõ **trong tin nhắn hiện tại** (được phép một lần ≠ lần sau). Yêu cầu tạo rule không phải quyền thực hiện các thao tác Git này.
- Source code lưu trong GitHub repository private; chỉ contributors được ủy quyền có quyền truy cập. Không tự đổi visibility, quyền truy cập hoặc branch protection.
- `main`: release đã duyệt; `dev`: tích hợp; `release/*`: kiểm thử release và sửa lỗi release. Cấm push trực tiếp vào `main`. PR công việc vào `dev`; chỉ nhánh `release/*` được merge vào `main`.
- Mỗi công việc phải có Jira task với **Jira key** (vd. `G94-181`) và **work code** trong summary (vd. `FE-FEAT-44`). Loại hợp lệ: `FE-FEAT` (feature Web/App), `BE-FEAT`, `FE-FIX`, `BE-FIX`. Số tăng theo từng loại, không tái sử dụng. Không tự đoán/cấp số; thiếu key/code ⇒ hỏi user hoặc kiểm tra task qua công cụ được phép trước khi tạo branch/commit/PR.
- Một working branch cho mỗi Jira task, tạo từ `dev`: `<prefix>/<jira-key>-<work-code>-<flow-name>`. `feature` cho `FE-FEAT`/`BE-FEAT`, `fix` cho `FE-FIX`/`BE-FIX`; flow-name ngắn, chữ thường, phân cách bằng hyphen, do developer chọn. Không dùng dấu ngoặc vuông trong branch name. Ví dụ: `feature/G94-181-FE-FEAT-44-lesson-plan`, `fix/G94-190-BE-FIX-03-meal-count-validation`.
- Trước khi tạo nhánh, kiểm tra branch hiện tại và worktree; giữ nguyên thay đổi đang có, không âm thầm chuyển chúng sang task khác. Không tạo working branch từ `main` hoặc nhánh hiện tại thay cho `dev`; nếu cần fetch/chuyển trạng thái ngoài quyền được cấp hoặc có thay đổi chồng lấn ⇒ hỏi user.
- PR title cùng format commit bên dưới; tham chiếu Jira task, mô tả thay đổi và kiểm thử đã chạy. Cần ít nhất một reviewer khác tác giả, mandatory checks đạt và blocking comments được xử lý trước khi merge.
- Team phải kiểm tra branch protection thực tế và ghi nhận các giới hạn đang được enforce. Không coi tài liệu này là bằng chứng GitHub đã bật protection; chưa kiểm tra thì báo chưa kiểm chứng.
- KHÔNG lệnh git phá hủy khi chưa hỏi (`reset --hard`, `push --force`, `rebase`, `branch -D`, `clean -fd`, `checkout -- .`, `restore .`, `stash drop`); KHÔNG `--no-verify`/bỏ qua hook.

### Commit message

- Mọi commit phải bắt đầu bằng `[<work-code>] <jira-key>: <short-description>`. Description ngắn, tiếng Anh, nêu thay đổi thực tế. Body tùy chọn mô tả lý do/tác động; không thay header bắt buộc bằng Conventional Commits hoặc chỉ footer `Refs`.
- Một commit thuộc đúng một Jira task; không gom nhiều task. Thiếu Jira key hoặc work code ⇒ hỏi "Task này có Jira key và work code nào (vd. G94-181 / FE-FEAT-44)?"; không có ngoại lệ commit không key.
- Không dùng mã task cha `[Module-NN]` trong commit; dùng work code của sub-task `FE-FEAT`/`BE-FEAT`, hoặc `FE-FIX`/`BE-FIX` của task sửa lỗi tương ứng.
- KHÔNG ghi tên model/công cụ AI, `Co-Authored-By` AI, "Generated with ..." trong commit, PR hay comment code (ghi đè attribution mặc định của công cụ).

```text
[FE-FEAT-44] G94-181: complete half of the lesson plan UI
[BE-FIX-03] G94-190: correct meal-count validation
```

- Không commit thông tin nhạy cảm (credentials, token, dữ liệu cá nhân/sức khỏe). Repo chỉ chứa ví dụ cấu hình không nhạy cảm; credentials thật quản lý bằng environment configuration được kiểm soát truy cập hoặc secret storage. Kiểm tra staged diff trước commit, không in secret vào log.

### Comment trong code

- Chỉ comment ngắn (1 dòng, tối đa 2–3) ở logic chính/không hiển nhiên; nói *tại sao / quy tắc gì*, tiếng Việt, giữ identifier tiếng Anh. Không comment code tự giải thích, không Javadoc/JSDoc tràn lan.
- KHÔNG code comment-out, comment nhật ký, TODO mơ hồ (cần thì `// TODO(<người/issue>): <việc cụ thể>`), thông tin AI, dữ liệu thật/secret. Sửa code ⇒ sửa/xóa comment liên quan.

### Cổng chất lượng

- **Iron Law:** chưa có output `node scripts/verify.mjs` chạy sau lần sửa cuối ⇒ không báo "xong/pass/đã sửa"; skip = chưa kiểm chứng (`docs/quality/VERIFICATION.md`).
- Làn L ⇒ plan user duyệt mới code. Sửa bug thất bại 3 lần ⇒ dừng, ghi Attempts, hỏi.
- Sửa `.ai/ .claude/ .agents/ docs/` ⇒ `node scripts/check-ai-layer.mjs`. Cổng fail ⇒ sửa nguyên nhân, không lách.

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
