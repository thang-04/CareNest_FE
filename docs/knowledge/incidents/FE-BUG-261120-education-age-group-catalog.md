---
id: FE-BUG-261120-education-age-group-catalog
type: bug
screens: [education-plan]
be_modules: [education-plan, school-structure]
rules: [EDU-01, EDU-28, EDU-54, EDU-73]
status: fixed
date: 2026-11-20
keywords: [nhóm tuổi, age_groups, danh mục FE, config]
---

# Nhóm tuổi của kế hoạch giáo dục lấy từ danh mục BE

## Symptom và nguyên nhân

Các select và tên nhóm tuổi dùng `AGE_GROUPS` có bốn dòng viết cứng trong
`src/models/education-plan/educationPlanConstants.js`. Đổi tên/thêm/xóa nhóm trong DB không được phản ánh.
Trong khi đó `GET /education-plans/config` đã trả `ageGroups` từ
`SchoolStructureServiceImpl.findAgeGroups()` → `AgeGroupRepository` → bảng `age_groups`.
`yearPlanMapper.buildRefs()` đã dùng danh mục này để đổi code UI ↔ ID DB nhưng `toUiEduConfig()` bỏ danh mục khỏi cấu hình UI.

## Fix

- Mapper giữ danh mục BE, chuyển `id` dùng trong UI thành `code`, giữ ID số ở `databaseId`.
- `withDefaults` giữ danh mục; `applyEduConfig` cập nhật cùng tham chiếu `AGE_GROUPS` trước khi provider render các trang.
  Tái sử dụng cơ chế hiện hành của `DOMAINS`; cả select, lọc, nhập file và xuất Word đọc cùng nguồn.
- Danh mục khởi tạo/rỗng là `[]`; lỗi API được đẩy lên trạng thái lỗi hiện hành, không thay bằng dữ liệu mẫu.
- Mock repository trả danh mục mẫu riêng từ `models/School.js`; các test nhập file nạp fixture rõ ràng.
- Trang đối chiếu chương trình Bộ chọn nhóm đầu tiên BE trả khi URL không hợp lệ, không mặc định `ag-3`.
- Không đổi API, schema, quyền hay nghiệp vụ; không sửa những thay đổi đang dở của task khác.

## Attempts và kiểm chứng

| Lần | Kiểm tra | Kết quả |
| --- | --- | --- |
| 1 | Test danh mục qua adapter Axios: đổi tên, nhóm code mới, thêm/xóa, rỗng, lỗi 503 | 3/3 đạt |
| 2 | Bộ unit/component giáo dục | 389/400 đạt; 10 test nhập file còn dựa vào danh mục mặc định, 1 expectation cấu hình chưa có trường mới |
| 3 | Nạp fixture danh mục trong hai file test nhập file, cập nhật expectation cấu hình; chạy lại 4 file liên quan | 44/44 đạt; gồm toàn bộ 11 ca lỗi ở lần 2 |

`npm run build` đạt. ESLint các source sửa đạt. Không chạy Playwright/e2e hoặc kiểm tra trình duyệt/DB đang chạy.

## Rà soát phần còn lấy dữ liệu hoặc mặc định từ FE

Phạm vi: pages/components/hooks/models/services/utils của education-plan, provider năm học dùng chung,
các nơi gọi `AGE_GROUPS`, `CLASSES`, mặc định cấu hình và nhánh mock. Đây là kiểm tra source, không phải kiểm kê DB live.

| Phần | Bằng chứng | Kết luận hiện tại |
| --- | --- | --- |
| Nhóm tuổi | `educationPlanConstants.js`, `yearPlanMapper.js`, `eduConfig.js` | Đã sửa: danh sách và tên từ BE trong chế độ API. |
| Tên lớp mẫu | `educationPlanConstants.js: CLASSES`; `useEducationPlan.jsx: titleOf`; `lessonShared.jsx: className/LessonInfo` | Còn hai lớp Chồi viết cứng để dựng chức danh/tên trong helper cũ. Các trang lớp hiện hành lấy `classes`, `staff` từ `/education-plans/class-docs`; `LessonInfo` không có nơi gọi trong source hiện tại. |
| Lĩnh vực giáo dục | `educationPlanConstants.js: STANDARD_DOMAINS`; `eduConfig.js: applyEduConfig`; `yearPlanMapper.js: toUiEduConfig` | Năm lĩnh vực chuẩn còn cố định ở FE; BE cung cấp tên hiển thị và lĩnh vực thêm. UI dựng danh sách bằng 5 chuẩn + phần thêm, không hoàn toàn theo danh sách/order BE. |
| Cấu hình luồng duyệt, thời lượng, dòng tuần, hạn và ô ký | `eduConfig.js: DEFAULT_* / withDefaults / resetEduConfig`; `educationPlanApi.js: getEduConfig` | Bình thường lấy BE; còn mặc định dự phòng khi field thiếu/rỗng và nút khôi phục mặc định dựng ở FE. `duration-policy` 404 còn cho dùng mặc định. Quyền thực tế vẫn do BE kiểm. |
| Năm học header | `contexts/SchoolYearContext.jsx`, `config/app.js`, `schoolConfigService.js` | Lấy service cấu hình trường, nhưng khởi tạo và khi API lỗi vẫn giữ danh sách năm tĩnh. Tác động nhiều module; chưa sửa trong task này. |
| Nhận diện nhóm tuổi trong file | `models/education-plan/importGoalFile.mjs: sourceGroup` | Danh mục đã từ BE, nhưng FE vẫn suy khoảng tuổi bằng regex tên nhóm. `AgeGroupResponse` của config chưa có `ageFromMonths/ageToMonths`; tên DB không chứa khoảng tuổi có thể làm nhập file không nhận diện được nhóm. Chưa sửa logic này. |
| Khung nội dung giáo án | `models/education-plan/classPlan.js: DAY_SECTIONS, HOC_SUGGESTED_ROWS, NGOAI_TROI_SUGGESTED_ROWS, PREP_TARGETS` | Còn khung/bố cục và dòng gợi ý cố định ở FE. Nội dung giáo án đã lưu lấy BE. Không phải bản ghi danh mục DB giả. |
| Bản nháp chưa lưu | `services/education-plan/yearPlanRecovery.js`, `planBackup.js` | Có localStorage để khôi phục nội dung chưa lưu; không phải nguồn bản đã lưu/ban hành. |
| Mock/demo | `educationPlanService.js`, `resourceLibraryService.js`, `learningResourceService.js`, thư mục `mock/` | Mock chỉ được chọn theo `USE_MOCK`; API lỗi không tự chuyển mock. `.env.local` hiện đặt `VITE_USE_MOCK=false`, ghi đè `.env` trong chạy Vite local thông thường. |
| Dữ liệu legacy không còn nguồn API | `educationPlanApi.js: getAll`, `educationPlanService.js: getEducationSummary` | `themes`/`lessons` legacy trả rỗng trong chế độ API, không điền mẫu FE. Chủ đề/hồ sơ/giáo án hiện hành nằm trong kế hoạch và class-docs từ BE. |
| Hằng legacy | `educationPlanConstants.js: SLOTS_*, QUALITIES, COMPETENCIES, STEP_TEMPLATE` | Còn trong source; QUALITIES/COMPETENCIES/STEP_TEMPLATE không có consumer hiện tại. `slotsFor` chỉ còn consumer ở utils assessment, ngoài phần giáo dục đang sửa. |

Các mục còn lại được ghi nhận để user quyết định phạm vi xử lý tiếp; task này chỉ sửa nguồn nhóm tuổi và các nơi bị ảnh hưởng.
