---
id: FE-BUG-261123-meals-campus-discard
type: bug
screens: [assessment, school-config]
rules: [ATT-02a, AUTH-20, OBS-18]
status: fixed
date: 2026-11-23
keywords: [không ăn, bộ lọc điểm trường, không lưu, lý do]
---

# Gợi ý ăn và trạng thái form chưa đồng bộ

Draft bữa ăn chưa dùng skippedMeals dù MealsCell có khóa sẵn; bộ lọc campus suy từ điểm trường làm việc của PHT thay vì danh mục đọc cấu hình server; form mở lại giữ reason khi đổi năm/bỏ nhập.

Sửa trong dailyGeneralDraft, AgeGroupsClassesPage, ClassListSection, AssessmentDayUnlockPage. Không sửa context quyền, menu hoặc policy chung. Không lưu dữ liệu tự động khi mở màn.

UI thật: GV Không ăn bị khóa, lưu/reload giữ; PHT cấu hình lọc11/6/5 lớp; Hủy giữ reason, Không lưu xóa reason và không hỏi lặp sau đổi năm. Node1602/1602, lint và build đạt. BE báo cáo chi tiết: ../CareNest_BE/docs/quality/2026-11-23-ui-followup-verification.md.
