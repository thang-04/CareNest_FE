---
id: FE-BUG-261102-curriculum-reimport-headings
type: bug
screens: [education-plan]
be_modules: [education-plan]
rules: [EDU-24, EDU-28]
status: fixed
date: 2026-11-02
keywords: [curriculum, reimport, lĩnh vực con, xóa mục tiêu, trùng nhóm]
similar_to: [BUG-261102-curriculum-reimport-duplicate-headings]
---

# Nhập lại mục tiêu Bộ tạo trùng lĩnh vực con và nhóm

## Symptom
Xóa một mục tiêu lấy từ Bộ rồi thêm lại sinh thêm lĩnh vực con/nhóm dù cha cũ vẫn còn.

## Điều kiện tái hiện
Nhập một mục tiêu có lĩnh vực con và nhóm từ curriculumAsSourcePlan, xóa riêng hàng goal rồi nhập lại. Mong đợi dùng lại cha còn tồn tại theo BE specs/005-ministry-goal-catalog FR-003; thực tế rows [sub, group] thành [sub, group, sub, group, goal].

## Attempts — đã thử
| # | Cách thử | Kết quả | Vì sao không đúng / bài học |
| --- | --- | --- | --- |
| 1 | Đọc điều tra BE, kiểm lại các caller mergeImportedGoals và xóa row ở GoalTables | Lỗi ghép bản soạn FE | Không cần đổi contract |
| 2 | Thêm 4 regression vào curriculum.test.mjs, chạy test trước sửa source | 16 tests: pass 12, fail 4, skip 0; lỗi đúng ở cha được tạo thêm | Bao phủ cha có ID, mock thiếu ID, cha sửa tên và nhập nhiều lượt |
| 3 | Tái sử dụng cha trong phạm vi lĩnh vực/sub và chèn trước ranh giới nhánh tiếp theo | 37/37 tests curriculum/import-goals/import-goal-file đạt, skip 0 | Phải giữ guard normalize, không chỉ bỏ hàng cha mới |
| 4 | Review độc lập và thêm regression chép nguồn hỗn hợp Bộ/tự gõ cùng nhóm | RED: added=1, unavailable chứa mục tiêu tự gõ thay vì added=2 | insertAt phải theo cha cho cả mục tiêu tự gõ đi sau mục tiêu Bộ |
| 5 | Chuyển tìm anchor/vị trí chèn sau cả hai nhánh, thêm ca nhóm không-sub | 39/39 targeted đạt; reviewer chạy lại exit 0, không còn finding trong delta | Cổng full cuối chạy sau hồ sơ; không thay kiểm UI/BE thật |

## Root cause
src/models/education-plan/importGoals.mjs khởi tạo sub/group=null mỗi lần nhập, luôn addHeading và append cuối bảng, không tìm liên kết nguồn cha đã có. Nhập đầu tiên không lộ lỗi; lượt nhập lại mới tạo trùng. Không thể chỉ bỏ hàng tiêu đề mới vì goal sẽ rơi vào nhóm cuối khác.

## Fix
Mục tiêu có liên kết Bộ dùng lại cha theo ID nguồn trong đúng lĩnh vực/ngữ cảnh. Nếu cả hai cha thiếu ID nguồn (mock), so câu sau trim/gộp khoảng trắng. Không gộp hai ID nguồn khác nhau dù cùng tên; giữ tên đã sửa khi cùng ID. Chèn vào đoạn cha cũ và giữ guard normalize, không mutate dữ liệu cũ. Mục tiêu tự gõ đi sau trong cùng nhóm tiếp tục chèn vào nhóm đó; nguồn thuần thường giữ cách tạo cha hiện tại.

## Regression test
tests/education-plan/curriculum.test.mjs: 6 ca mới gồm xóa/nhập lại qua nhiều chu kỳ, giữ cha/dòng cũ sau normalize; thêm nhóm vào sub cũ; cha sửa tên cùng ID và cùng tên khác ID; mock chưa có ID cha; nhóm không-sub; chép nguồn hỗn hợp. RED ban đầu: 4 fail/16; RED nguồn hỗn hợp: 1 fail/1; GREEN cuối: 39/39 khi chạy cùng import-goals/import-goal-file, skip 0.

## Ảnh hưởng
Helper dùng chung với lấy từ kế hoạch và nhập file. Chỉ sửa FE; không tự dọn tiêu đề trùng đã lưu. Chưa kiểm trình duyệt/BE thật; cổng toàn FE sẽ ghi tại VERIFICATION.md.

## Lesson
Tái sử dụng tiêu đề phải đi cùng chèn đúng đoạn trong flat rows, nếu không mục tiêu sẽ đổi cha sau normalize.
