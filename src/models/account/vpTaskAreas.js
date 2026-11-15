/*
 * Gom mã quyền của Phó hiệu trưởng thành mảng để Hiệu trưởng đọc bằng lời thường; BE vẫn lưu từng mã (ADR-0017).
 * `place` là nơi áp dụng cố định: SCHOOL = dữ liệu dùng chung cả trường, CAMPUS = điểm trường phụ trách (AUTH-20).
 * Mã `campusScoped` của BE thì Hiệu trưởng chọn được nơi áp dụng, `place` chỉ là giá trị ban đầu.
 * `checkGaps`: mảng cảnh báo khi điểm trường chưa có PHT nào được sửa (Nhân sự mặc định Hiệu trưởng làm nên không cảnh báo).
 */
export const VP_PLACE = { SCHOOL: 'SCHOOL', CAMPUS: 'CAMPUS' };

export const VP_TASK_AREAS = [
  {
    key: 'meals',
    label: 'Bán trú',
    checkGaps: true,
    tasks: [
      { code: 'MENU_MANAGE', place: VP_PLACE.SCHOOL },
      { code: 'NUTRITION_MANAGE', place: VP_PLACE.SCHOOL },
      { code: 'MEAL_COUNT_CONFIRM', place: VP_PLACE.CAMPUS },
      { code: 'STOCK_MANAGE', place: VP_PLACE.CAMPUS },
      { code: 'FOOD_SAFETY_APPROVE', place: VP_PLACE.CAMPUS },
    ],
  },
  {
    key: 'children',
    label: 'Hồ sơ trẻ và phụ huynh',
    checkGaps: true,
    tasks: [
      { code: 'CHILD_ENROLL', place: VP_PLACE.CAMPUS },
      { code: 'CHILD_PROFILE_EDIT', place: VP_PLACE.CAMPUS },
      { code: 'CHILD_PLACEMENT', place: VP_PLACE.CAMPUS },
      { code: 'PARENT_ACCOUNT_MANAGE', place: VP_PLACE.CAMPUS },
    ],
  },
  {
    key: 'staff',
    label: 'Nhân sự',
    tasks: [
      { code: 'STAFF_ASSIGNMENT_MANAGE', place: VP_PLACE.CAMPUS },
      { code: 'ACCOUNT_MANAGE', place: VP_PLACE.CAMPUS },
      { code: 'ACCOUNT_STATUS_MANAGE', place: VP_PLACE.CAMPUS },
    ],
  },
];

/** Mã BE mới chưa xếp mảng vẫn phải hiện để Hiệu trưởng thấy và giao được. */
export const VP_OTHER_AREA = { key: 'other', label: 'Việc khác' };

/** PHT luôn xem được hồ sơ trẻ (AUTH-20) nên không là việc để giao; chỉ cảnh báo khi đang bị tắt. */
export const VP_VIEW_CODE = 'CHILD_PROFILE_VIEW';

export const VP_TASK_PRESETS = [
  { key: 'nutrition', label: 'Phụ trách dinh dưỡng', areas: ['meals'] },
  { key: 'academic', label: 'Phụ trách chuyên môn', areas: ['children'] },
];
