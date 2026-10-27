---
id: FE-BUG-261021-profile-assessed-on-absent-day
type: bug
screens: [child-development-profile, child-development-progress]
be_modules: [assessment, attendance]
rules: [ATT-07]
status: fixed
date: 2026-10-21
keywords: [hồ sơ phát triển, ngày có mặt, ngày được đánh giá, nghỉ phép, đánh giá ngày vắng, seed]
similar_to: []
---

# FE-BUG-261021-profile-assessed-on-absent-day — Hồ sơ phát triển có đánh giá ở ngày trẻ nghỉ phép

## Symptom
Hồ sơ phát triển Lớp Chồi 1: "Ngày được đánh giá" 16 > "Ngày có mặt" 15; bảng hằng ngày có dòng 19/10 dù trẻ nghỉ có phép ngày đó.

## Điều kiện tái hiện
Mock, DB demo mới. Giáo viên Lê Minh Anh mở `/assessment/children/<trẻ Chồi 1>` (trẻ có bản ghi nghỉ phép của seed).

## Root cause
FE mock. `buildDailyAssessments` (`src/mocks/assessmentSeed.js`) tự chọn ngày vắng, không theo điểm danh seed (`attendanceSeed.js`, nghỉ phép). Luồng ghi thật đã chặn đánh giá trẻ vắng (`saveDailyAssessments`), nhưng luồng đọc/tổng hợp không lọc bản ghi cũ.

## Fix
`assessmentMockRepository.js`: `absentDaysOf` + `assessmentsOf`, `periodDaysOf`, `periodSummaryOf` bỏ ngày có điểm danh khác `PRESENT`. Kiểm: hồ sơ trẻ trên còn 15/15, không còn dòng 19/10.

## Phòng tránh
Hai seed cùng mô tả một sự thật (vắng mặt) phải dùng chung nguồn; số "được đánh giá" không bao giờ vượt "có mặt".
