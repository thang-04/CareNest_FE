---
title: Học liệu hoạt động và chế độ dạy học
status: done
owner: Nguyễn Quang Tiền
jira: unassigned
branch: feature/G94-178-FE-FEAT-41-lesson-assessment-parent
modules: [education-plan]
rules: [EDU-12, EDU-15, EDU-16, EDU-18]
risk: high
created: 2026-10-27
updated: 2026-10-27
---
# Học liệu hoạt động và chế độ dạy học

## Context / authorization
Plan chính: ../CareNest_BE/docs/plans/completed/2026-10-27-class-plan-teaching-media.md. User yêu cầu BE/FE, tiếp tục Spec Kit và giao agent chọn đề xuất. User chốt S3 và đồng ý SDK Java v2; FE không có cloud credential. Không tạo branch/commit/deploy.

## Scope
ActivityResources tại ClassThemePlanPage; LearningResourceViewer dùng Blob; TeachingPresentationPage mở từ chủ đề hoặc tuần/ngày; model signature/day picks; service thật gọi API BE, mock giữ Blob trong IndexedDB riêng. Không đổi API client chung/authService, không thêm FE dependency.

## Business / AC
BE EDU-12..18 là source of truth; không mở khóa/đổi MT. AC1: save-before-upload, error/retry, gắn lại/gỡ xác nhận. AC2: đổi hoạt động không chuyển nhầm tệp. AC3: presenter theme/day giữ nội dung cũ, MT khi có liên kết, keyboard/fullscreen, PDF/image/video và Office download. AC4: giữ manual save/leave guard.

## Phases
1. Model/services/tests cho binding, API multipart/blob, IndexedDB mock.
2. UI/presenter/actions/styles, browser smoke, full verify/review. User yêu cầu tiếp tục tự động; review làn L qua subagent.

## Risks / rollback
Positional ID: fingerprint và day pick saved text; stale không ghép media. ObjectURL revoke/abort khi chuyển/unmount. Legacy grid không picks hiển thị nội dung đã lưu, không tự gán MT. Có thể gỡ UI mới mà dữ liệu tài liệu cũ không đổi. S3 thật cấu hình tại BE; không gọi public viewer.

## Test matrix
learning-resources.test.mjs (binding/reorder/legacy/parser), learning-resources-api.test.mjs (multipart/requestID/blob/abort), test:edu regression; node scripts/verify.mjs và check-ai-layer. Browser mock tại localhost5188, không thay live S3 test.

## Progress log
### 2026-10-27
Source BE/FE triển khai; lần full verify đầu FE pass. Browser mock upload ảnh, presenter/fullscreen/next đạt; thêm legacy day fallback qua Converge; đang kiểm tra gate sau sửa cuối và review.

### 2026-10-27 — Hoàn tất
FE VERIFY PASS full | npm run verify | log verify.log; education suite31tests. Browser mock upload/reload/rebind/detach/theme/day/keyboard/fullscreen kiểm được; PDF fallback hiển thị, native render trong IAB chưa kiểm chứng. BE full392 fail0 err0 skip0, review khôngP1/P2, live S3 storage smoke1/1 pass. Không thêm FE dependency, không sửa authService, không commit/push/deploy.

