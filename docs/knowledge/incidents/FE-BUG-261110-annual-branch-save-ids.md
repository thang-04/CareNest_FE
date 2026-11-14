---
id: FE-BUG-261110-annual-branch-save-ids
type: bug
modules: [education-plan]
rules: [EDU-22, EDU-62]
status: fixed
date: 2026-11-10
keywords: [7212, lưu, kế hoạch năm, mất nhánh, themeKey]
---

# Lưu kế hoạch năm báo 7212 và nhánh biến mất trên màn hình

User báo updateYearPlan plan350/user3 trả 7212 “Nguồn kế hoạch năm học không hợp lệ”, sau đó làm rõ chưa xóa nhưng nhánh mất trên UI. Đọc metadata DB carenest_merge:350 là SCHOOL_YEAR DRAFT; có chín chủ đề và bốn nhánh đã lưu. Không ghi hoặc xóa dữ liệu runtime.

`reconcileYearPlanIds` nhận ID chủ đề do server cấp nhưng bỏ qua ID nhánh và themeId của nhánh. Sau lần tạo/lưu chủ đề mới, nhánh vẫn tham chiếu ID tạm; bảng không tìm thấy cha nên không hiển thị, lần PUT sau gửi themeKey cũ bị saveTemplates từ chối. Đây là lỗi đồng bộ ID ở FE; giữ nguyên guard nguồn của BE. `yearPlanContentKey` cũng thiếu branchTemplates nên bản phục hồi chỉ khác nhánh có thể bị coi như không thay đổi.

Sửa helper hiện có: ánh xạ ID nhánh bằng map riêng và ánh xạ themeId theo ID chủ đề đã lưu; giữ nội dung/nhánh thêm trong lúc chờ, không phục hồi nhánh user chủ động xóa. Tính branchTemplates vào khóa nội dung phục hồi. Không dùng bản server đè phần đang gõ, không nới validate hoặc tự sửa DB.

RED: ba regression mới cùng thất bại trước sửa (ID nhánh null trong lần PUT sau, themeId tạm chưa đổi, khóa nội dung bỏ qua nhánh). GREEN: 37/37 test tập trung, sau đó 331/331 test giáo dục/menu; ESLint helper exit0 và build FE exit0 (cảnh báo phụ thuộc hiện có).

Lệnh: `node --import ./scripts/register-auth-test-loader.mjs --test --test-reporter=spec tests/education-plan/*.test.mjs tests/menu/edu-review-menu.test.mjs`; `npx.cmd eslint src/models/education-plan/yearPlanAutosave.mjs`; `npm.cmd run build`.

Chưa kiểm browser/E2E hoặc gửi PUT lên kế hoạch thật350. Tab đã giữ ID sai từ trước không được tự suy lại cha bằng tên/thứ tự; bản đã lưu trên BE còn đủ bốn nhánh để nạp lại. Không commit/push trong lượt sửa này.
