---
title: Review and repair flows before publishing BE and FE PRs
status: done
owner: DinhCan
jira: G94-179 / FE-FEAT-42
branch: feature/G94-179-FE-FEAT-42-school-config-api
modules: [assessment, attendance, school-config]
rules: [OBS-12, OBS-23, OBS-26, NUT-02]
risk: high
created: 2026-11-04
updated: 2026-11-04
---
# Scope and authorization

User requests checking conflicts and their flows, then committing/pushing current working branches and creating PRs into dev. Earlier request specifies untouched placement/assessment screens must not prompt to save. Review repairs preserve existing contracts, formulas and role boundaries; no dependency, migration or App changes. Current GitHub identity is NhuDinhCan. Existing PRs FE #30 / BE #26 are reused rather than duplicated.

## Acceptance

- Untouched daily defaults remain manually saveable without triggering navigation confirmation; real edits do trigger it and reverting removes it. Placement already compares against initial suggestions; test that behavior without changing its rules.
- Quality-report semester dates are scoped to the selected school year, including exported month columns.
- BE confirmation is idempotent after a previous campus/day confirmation, including past-day reconfirmation; new confirmations on an old day remain blocked.
- BE quality campus filters respect already-readable classes for teachers/team leaders; unrelated campuses stay forbidden.
- First monthly class-comment creation serializes GET/save/confirm to avoid unique insert races; confirmed comments remain immutable.
- Targeted regressions, full BE/FE verification, independent read-only review, no-conflict evidence, scoped commits and PR descriptions. Local credentials/application.yml, dev reset scripts and unrelated old audit notes stay local.

## Progress log

- 04/11: Fetched dev: BE HEAD ahead22/behind0; FE ahead37/behind0. Both working branches contain current dev. Existing source repair commits are already present. Read-only reviewers identified past-day confirmation, stale semester state, campus-filter rejection and first-draft insert race. Initial full BE run stopped to add these repairs before the final run.
- User-requested behavior is explicit; this work fixes regressions in existing approved flows, not new business rules. No unresolved business choice.

## Risks and validation

Only the currently editable form is treated as unsaved; manual default saves remain available. Comment creation uses existing class lock before lookup. Campus validation does not grant extra classes. Full tests and review must finish before publishing changes; no PR merge is authorized.
- 04/11 (tiếp, phiên sau): hoàn tất 3 sửa BE còn dở (xác nhận lại sổ ăn ngày đã qua idempotent, lọc điểm trường của GV/tổ trưởng ở chất lượng tháng, tạo nhận xét chung lớp tuần tự theo lớp) và sửa 2 test sai dữ liệu. Hai reviewer độc lập (BE, FE) thêm 17 lỗi đã sửa: phạm vi tổ trưởng chỉ xem tổng hợp (không phiếu điểm danh từng ngày), HT phê duyệt khen thưởng phải còn phân công, PHT đọc mọi điểm trường ở đánh giá ngày / phiếu, không tạo nháp toàn trường khi BGH mở danh sách, đơn nghỉ lọc điểm trường cho GV, chuyên cần khen thưởng theo ngày của trẻ, phiếu tuần chỉ tính lớp hiện tại, đổi giờ chốt không lùi ngày; FE: lớp ra trường không tự chọn "Ra trường" cho trẻ chưa hoàn thành chương trình, xem lớp trong phạm vi nhóm tuổi, giữ nội dung đang gõ khi đánh dấu chương trình, nút mở lại ngày theo điểm trường, lọc học kỳ theo năm học trên URL, đổi năm học đặt lại khoảng ngày, tổ trưởng không có lớp vẫn xem nhóm, xếp loại bỏ nháp khi đổi kỳ, lỗi tải năm học ở ngày nghỉ.
- Chưa làm (cần quyết): tổng do FE cộng (tổng hợp điểm danh, sức khỏe theo nhóm tuổi, số ngày học trong đợt nghỉ), N+1 tên ở danh sách đơn nghỉ, "ngày học" trong báo cáo = ngày có điểm danh.
