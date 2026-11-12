import assert from 'node:assert/strict';
import { test } from 'node:test';
import { ROLES } from '@/models/User';
import { canViewRooms, roomCampusIds } from '@/utils/school-config/schoolConfigPermissions';

// BE RoomServiceImpl.visibleTo: PHT luôn xem phòng cơ sở mình; ROOM_MANAGE chỉ thêm quyền sửa / phạm vi được cấp
const campuses = [{ id: '1' }, { id: '2' }];
const vp = (bePermissions, beSchoolWidePermissions = []) => ({
  role: ROLES.VICE_PRINCIPAL,
  campusId: '1',
  locationIds: ['1'],
  bePermissions,
  beSchoolWidePermissions,
});

test('PHT chưa được cấp quản lý phòng vẫn xem phòng cơ sở mình, không sửa được', () => {
  const user = vp([]);
  assert.equal(canViewRooms(user), true);
  assert.deepEqual(roomCampusIds(user, campuses), ['1']);
  assert.deepEqual(roomCampusIds(user, campuses, true), []);
});

test('PHT được cấp quản lý phòng toàn trường xem và sửa mọi cơ sở', () => {
  const user = vp(['ROOM_MANAGE'], ['ROOM_MANAGE']);
  assert.deepEqual(roomCampusIds(user, campuses), ['1', '2']);
  assert.deepEqual(roomCampusIds(user, campuses, true), ['1', '2']);
});
