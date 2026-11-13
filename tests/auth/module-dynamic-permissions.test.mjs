import assert from 'node:assert/strict';
import { test } from 'node:test';
import { ROLES } from '@/models/User';
import { PERMISSIONS } from '@/models/bePermissions';
import { canAssignTeachers, canManageRooms, teacherAssignmentAccess } from '@/utils/school-config/schoolConfigPermissions';
import { canRecordAttendance, canRecordDailyHealth, canUnlockAttendanceDay } from '@/utils/attendance/attendancePermissions';
import { canConfirmEvaluation, canReviewEvaluation, canReviewRewardProposal } from '@/utils/assessment/assessmentPermissions';

const live = (role, permissions = [], extra = {}) => ({ role, bePermissions: permissions, ...extra });

test('quản lý phòng ban cần ROOM_MANAGE và PHT chỉ sửa campus được phân công', () => {
  const denied = live(ROLES.VICE_PRINCIPAL, [], { campusId: 1 });
  const granted = live(ROLES.VICE_PRINCIPAL, [PERMISSIONS.ROOM_MANAGE], { campusId: 1 });
  assert.equal(canManageRooms(denied, 1, 'update'), false);
  assert.equal(canManageRooms(granted, 1, 'update'), true);
  assert.equal(canManageRooms(granted, 2, 'update'), false);
  const schoolWide = { ...granted, beSchoolWidePermissions: [PERMISSIONS.ROOM_MANAGE] };
  assert.equal(canManageRooms(schoolWide, 2, 'update'), true);
});

test('phân công giáo viên mặc định theo campus và mở toàn trường khi HT cấp scope SCHOOL', () => {
  const campus = live(ROLES.VICE_PRINCIPAL, [PERMISSIONS.STAFF_ASSIGNMENT_MANAGE], { campusId: 1 });
  assert.equal(teacherAssignmentAccess(campus).scope, 'CAMPUS');
  assert.equal(canAssignTeachers(1, campus, 'update'), true);
  assert.equal(canAssignTeachers(2, campus, 'update'), false);

  const school = { ...campus, beSchoolWidePermissions: [PERMISSIONS.STAFF_ASSIGNMENT_MANAGE] };
  assert.equal(teacherAssignmentAccess(school).scope, 'ALL');
  assert.equal(canAssignTeachers(2, school, 'update'), true);
});

test('điểm danh, sức khỏe và mở lại dùng ba quyền độc lập, vẫn giữ phạm vi lớp/campus', () => {
  const cls = { id: 10, campusId: 1, canRecord: true, canUnlock: true };
  assert.equal(canRecordAttendance(cls, live(ROLES.TEACHER, [PERMISSIONS.DAILY_HEALTH_RECORD])), false);
  assert.equal(canRecordDailyHealth(cls, live(ROLES.TEACHER, [PERMISSIONS.DAILY_HEALTH_RECORD])), true);
  assert.equal(canUnlockAttendanceDay(cls, live(ROLES.VICE_PRINCIPAL, [PERMISSIONS.ATTENDANCE_UNLOCK], { campusId: 1 })), true);
  assert.equal(canUnlockAttendanceDay(cls, live(ROLES.VICE_PRINCIPAL, [], { campusId: 1 })), false);
  assert.equal(
    canUnlockAttendanceDay(
      { ...cls, campusId: 2, canUnlock: false },
      live(ROLES.VICE_PRINCIPAL, [PERMISSIONS.ATTENDANCE_UNLOCK], {
        campusId: 1,
        beSchoolWidePermissions: [PERMISSIONS.ATTENDANCE_UNLOCK],
      }),
    ),
    false,
    'cờ canUnlock=false từ BE luôn được ưu tiên',
  );
});

test('ghi, xác nhận và duyệt khen thưởng dùng đúng quyền đánh giá riêng', () => {
  const cls = { canEdit: true, teacherIds: [7] };
  const ev = { status: 'AWAITING_REVIEW' };
  const teacher = live(ROLES.TEACHER, [PERMISSIONS.ASSESSMENT_RECORD], { id: 7 });
  const confirmer = live(ROLES.TEACHER, [PERMISSIONS.ASSESSMENT_CONFIRM], { id: 7 });
  assert.equal(canReviewEvaluation(ev, cls, teacher), true);
  assert.equal(canConfirmEvaluation(ev, cls, teacher), false);
  assert.equal(canConfirmEvaluation(ev, cls, confirmer), true);

  const proposal = { campusId: 1, status: 'PENDING_VP' };
  const vp = live(ROLES.VICE_PRINCIPAL, [PERMISSIONS.REWARD_REVIEW], { campusId: 1 });
  assert.equal(canReviewRewardProposal(proposal, vp), true);
  assert.equal(canReviewRewardProposal(proposal, { ...vp, campusId: 2 }), false);
  assert.equal(
    canReviewRewardProposal(proposal, {
      ...vp,
      campusId: 2,
      beSchoolWidePermissions: [PERMISSIONS.REWARD_REVIEW],
    }),
    true,
  );
});

test('AUTH-13: PHT phụ trách nhiều điểm trường dùng quyền CAMPUS ở mọi điểm trường được phân công', () => {
  const vp = {
    role: ROLES.VICE_PRINCIPAL,
    campusId: null,
    locationIds: ['1', '2'],
    bePermissions: [PERMISSIONS.ROOM_MANAGE, PERMISSIONS.ATTENDANCE_UNLOCK],
    beSchoolWidePermissions: [],
  };
  assert.equal(canManageRooms(vp, 1), true);
  assert.equal(canManageRooms(vp, 2), true);
  assert.equal(canManageRooms(vp, 3), false);
  assert.equal(canUnlockAttendanceDay({ campusId: 2 }, vp), true);
  assert.equal(canUnlockAttendanceDay({ campusId: 3 }, vp), false);
});

test('Xếp lớp năm học mới: PHT chỉ xếp khi HT cấp YEAR_PLACEMENT_MANAGE, đúng phạm vi (Cần 10/11/2026)', async () => {
  const { canEditYearPlacement, canViewYearPlacement } = await import('@/utils/school-config/schoolConfigPermissions');
  const base = { role: ROLES.VICE_PRINCIPAL, campusId: '1', locationIds: ['1'], beSchoolWidePermissions: [] };
  assert.equal(canViewYearPlacement({ ...base, bePermissions: [] }), false);
  const vp = { ...base, bePermissions: [PERMISSIONS.YEAR_PLACEMENT_MANAGE] };
  assert.equal(canEditYearPlacement(vp, '1'), true);
  assert.equal(canEditYearPlacement(vp, '2'), false);
  assert.equal(canEditYearPlacement({ ...vp, beSchoolWidePermissions: [PERMISSIONS.YEAR_PLACEMENT_MANAGE] }, '2'), true);
});
