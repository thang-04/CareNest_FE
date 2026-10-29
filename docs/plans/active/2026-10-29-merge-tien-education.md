---
title: Ghép UI giáo dục mới của Tiền, giữ WIP hiện tại
status: in-progress
owner: Nhữ Đình Cần
jira: G94-179 / FE-FEAT-42
branch: feature/G94-179-FE-FEAT-42-school-config-api
modules: [education-plan, assessment]
rules: [EDU-19, OBS-19]
risk: high
created: 2026-10-29
updated: 2026-10-29
---
# Ghép code Tiền

Plan chính: [BE](../../../../CareNest_BE/docs/plans/active/2026-10-29-merge-tien-education.md). Người dùng 29/10 yêu cầu merge hai repo trong folder của mình bằng Git DinhCan. Không push, không thay DB.

- Nguồn FE `origin/feature/G94-178-FE-FEAT-41-lesson-assessment-parent` = `eaddd72`; HEAD hiện tại `f9f98dc` là ancestor.
- Giữ điểm danh/sức khỏe/đánh giá ngày/mở lại/tổng quan/nhận xét lớp đang sửa; ghép nguồn chương trình, phiên bản kế hoạch, học liệu, route/menu giáo dục và sửa refresh phiên của Tiền.
- Chồng lấn WIP: `menuConfig.js`, `AppRoutes.jsx`, mock assessment, `beClient.js`, ISSUE_INDEX. Preview conflict thật ở menu/mock/index; các file khác merge sạch vẫn phải kiểm tra semantics.
- Bản sao lưu trước merge: `D:/FULearning/Fall2026/backups/merge-tien-2026-10-29T16-05-14-089Z/CareNest_FE` (35 file + patch + hash). Giữ stash sau apply.
- AC: ancestry đúng nguồn, WIP ngoài overlap giữ hash, route/menu giữ cả hai phía, adapter classComment rỗng vẫn xóa được, session refresh incoming còn nguyên; build/lint/test/check-ai và review thực tế.
- Baseline: FE full fail AI week trùng seed; dashboard/hardening 56/56, lint/build đạt. Incoming có sửa seed, cần chạy lại. Không gọi browser/E2E với server của người dùng trong task.

## Progress

- 29/10: fetch và preview hoàn tất, Git author/GCM đúng DinhCan. Thực hiện ghép hai phase cùng plan BE theo yêu cầu merge hiện tại, không hỏi lại các thao tác kỹ thuật thường lệ.

- Hoàn tất ghép source và phục hồi WIP; giữ stash FE2eeadd4b/BE90b35016. Review phát hiện lineage EDU-26: đã có red/green daily và tổng quan; BE29/29, FE dashboard/hardening65/65. Thêm unit nhiều ngày/hoạt động. Full FE trước mở rộng assertion334/334; đang chạy lại cổng đầy đủ sau sửa cuối, kết quả ở verify.log/target/verify.log và bàn giao. Không kiểm browser/E2E/S3 hoặc áp migration DB user; không push/commit WIP.
- Npm peer Vite8/plugin-react4 có sẵn: npm install thường ERESOLVE, npm ci legacy gặp native file đang dùng; npm install legacy/ignore-scripts phục hồi. Package/lock giữ nguyên incoming, không nâng dependency khác hoặc dừng dev server.
