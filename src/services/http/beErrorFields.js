/*
 * errorCode của BE (ApiCode, docs/contracts/ERROR_CONTRACT.md) → ô nhập trên form FE để hiện lỗi đỏ đúng chỗ.
 * Mã không có ở đây hiện ở đầu form/hộp thoại (_form). desc của BE đã là câu tiếng Việt, FE hiện thẳng.
 */
export const BE_ERROR_FIELDS = {
  2004: 'name', // SCHOOL_YEAR_NAME_INVALID
  2005: 'endDate', // END_DATE_BEFORE_START
  2006: 'name', // SCHOOL_YEAR_EXISTS
  2007: 'endDate', // SCHOOL_YEAR_DATES_OVERLAP
  2008: 'name', // SCHOOL_YEAR_NAME_LOCKED
  2009: 'name', // SCHOOL_YEAR_HAS_CLASSES
  2014: 'confirmName', // ACTIVATION_CONFIRM_MISMATCH
  2019: 'name', // SCHOOL_YEAR_OUT_OF_SEQUENCE
  2020: 'startDate', // SCHOOL_YEAR_START_BEFORE_LATEST_END
  2105: 'code', // CAMPUS_CODE_EXISTS
  2106: 'name', // CAMPUS_NAME_EXISTS
  2113: 'campusId', // CAMPUS_INACTIVE
  2114: 'room', // ROOM_CODE_EXISTS
  2115: 'name', // ROOM_NAME_EXISTS
  2116: 'capacity', // ROOM_CAPACITY_REQUIRED
  2117: 'capacity', // ROOM_CAPACITY_BELOW_CLASS_SIZE
  2119: 'managerUserId', // ROOM_MANAGER_INVALID
  2120: 'locationId', // ROOM_NOT_IN_CAMPUS
  2121: 'locationId', // ROOM_INACTIVE
  2122: 'locationId', // ROOM_TAKEN
  2204: 'name', // AGE_GROUP_NAME_EXISTS
  2205: 'ageToMonths', // AGE_RANGE_INVALID
  2206: 'ageToMonths', // AGE_RANGE_OVERLAP
  2208: 'maxClassSize', // AGE_GROUP_MAX_SIZE_CONFLICT
  2209: 'name', // CLASS_NAME_EXISTS
  2210: 'schoolYear', // CLASS_YEAR_IMMUTABLE
  2211: 'ageGroupId', // CLASS_AGE_GROUP_LOCKED
  2212: 'campusId', // CLASS_CAMPUS_LOCKED
  2214: 'capacity', // CLASS_MAX_SIZE_OUT_OF_RANGE
  2215: 'sourceYearId', // COPY_SOURCE_YEAR_INVALID
  2216: 'ageGroupId', // CLASS_PLACED_AGE_GROUP_LOCKED
  2217: 'campusId', // CLASS_PLACED_CAMPUS_LOCKED
  2301: 'teacherIds', // REPLACEMENT_TEACHER_REQUIRED
  2302: 'teacherIds', // TEACHERS_MUST_DIFFER
  2303: 'homeroomTeacherId', // HOMEROOM_NOT_IN_CLASS
  2304: 'teacherIds', // TEACHER_WRONG_CAMPUS
  2305: 'teacherIds', // TEACHER_ACCOUNT_LOCKED
  2306: 'teacherIds', // TEACHER_ALREADY_ASSIGNED
  2307: 'userId', // TEAM_LEADER_INVALID
  4001: 'effectiveFrom', // CUTOFF_DATE_OUT_OF_YEAR
  4002: 'time', // CUTOFF_UNCHANGED
  4012: 'date', // UNLOCK_DATE_OUT_OF_RANGE
  4014: 'until', // UNLOCK_DEADLINE_INVALID
  5005: 'note', // HEALTH_NOTE_REQUIRED
  5006: 'actions', // HEALTH_ACTIONS_NOT_ALLOWED
  5007: 'referral', // HEALTH_REFERRAL_INCOMPLETE
  6006: 'normal', // MEAL_COUNT_UNCHANGED
  // Đánh giá hằng ngày: lỗi theo dòng trẻ / ô nhận xét (BE chưa trả childId nên trang hiện ở đầu bảng)
  7307: 'row', // ASSESSMENT_CHILD_NOT_PRESENT
  7311: 'comment', // ASSESSMENT_DIAGNOSTIC_TERM
  7322: 'classComment', // CLASS_COMMENT_TOO_LONG
  7323: 'classComment', // CLASS_COMMENT_DIAGNOSTIC_TERM
  // Mở lại ngày đánh giá
  7314: 'date', // ASSESSMENT_UNLOCK_DATE_OUT_OF_RANGE
  7315: 'date', // ASSESSMENT_DAY_NOT_LOCKED_YET
  7316: 'validUntil', // ASSESSMENT_UNLOCK_DEADLINE_INVALID
  7317: 'date', // ASSESSMENT_UNLOCK_ALREADY_ACTIVE
  9005: 'to', // INVALID_DATE_RANGE
  9006: 'to', // DATE_RANGE_TOO_LONG
};
