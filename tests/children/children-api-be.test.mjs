import assert from 'node:assert/strict';
import { beforeEach, test } from 'node:test';

globalThis.window = new EventTarget();

const { axiosClient } = await import('@/services/http/axiosClient');
const { childrenApi } = await import('@/services/children/api/childrenApi');
const { stringifyIds, sameId } = await import('@/services/http/idStrings');
const { suggestAgeGroupId } = await import('@/utils/children/childrenHelpers');

/*
 * Plan 2026-11-11-children-module-be-wiring, Phase 1: adapter hồ sơ trẻ đọc response đúng shape BE (G94-180) và trả về shape
 * màn đang dùng: id dạng chuỗi, quan hệ bằng chữ, đủ trẻ đã nghỉ, tên năm học/nhóm tuổi/giáo viên chủ nhiệm.
 */
const listItem = {
  id: 11,
  code: 'HS26001',
  fullName: 'Bé demo',
  dateOfBirth: '2022-05-01',
  gender: 'MALE',
  status: 'LEFT',
  classroomId: 7,
  className: 'Lớp A1',
  campusId: 1,
  guardianCount: 1,
  guardians: [{ id: 30, fullName: 'Bố demo', relation: 'FATHER', phone: '0900000030' }],
};
const profile = {
  child: {
    id: 11,
    fullName: 'Bé demo',
    status: 'ACTIVE',
    classId: 7,
    campusId: 1,
    guardians: [{ id: 30, fullName: 'Mẹ demo', relation: 'MOTHER', phone: '0900000030', accountStatus: 'ACTIVE' }],
    history: [{ action: 'UPDATED', userId: 40, userFullName: 'Cô Lan', at: '2026-11-10T02:00:00Z', note: 'Sửa', changes: [] }],
  },
  cls: { id: 7, name: 'Lớp A1', campusId: 1, ageGroupId: 2, schoolYearId: 5, capacity: 25, homeroomTeacherId: 40, teacherIds: [40, 41] },
  declaration: { history: [{ userId: 41, userName: 'Cô Mai', at: '2026-11-09T02:00:00Z' }] },
  placements: [],
};
const structure = {
  year: { id: 5, name: '2026-2027', startDate: '2026-09-01', status: 'ACTIVE' },
  ageGroups: [
    { id: 1, code: 'ag-2', name: 'Nhà trẻ (24–36 tháng)', shortName: 'Nhà trẻ', ageFromMonths: 24, ageToMonths: 36 },
    { id: 2, code: 'ag-3', name: 'Mẫu giáo bé (3–4 tuổi)', shortName: 'Mẫu giáo bé', ageFromMonths: 36, ageToMonths: 48 },
    { id: 3, code: 'ag-4', name: 'Mẫu giáo nhỡ (4–5 tuổi)', shortName: 'Mẫu giáo nhỡ', ageFromMonths: 48, ageToMonths: 60 },
    { id: 4, code: 'ag-5', name: 'Mẫu giáo lớn (5–6 tuổi)', shortName: 'Mẫu giáo lớn', ageFromMonths: 60, ageToMonths: 72 },
  ],
  classes: [
    {
      id: 7,
      name: 'Lớp A1',
      schoolYearId: 5,
      campusId: 1,
      ageGroupId: 2,
      capacity: 25,
      homeroomTeacherId: 40,
      teacherIds: [40, 41],
      teachers: [
        { id: 40, fullName: 'Cô Lan' },
        { id: 41, fullName: 'Cô Mai' },
      ],
    },
  ],
};
const account = {
  id: 21,
  fullName: 'Mẹ demo',
  phone: '0900000030',
  idNumber: '999900000030',
  relation: 'MOTHER',
  status: 'ACTIVE',
  children: [{ id: 11, fullName: 'Bé demo', className: 'Lớp A1' }],
  otherChildrenCount: 0,
};

let calls;
let bodies;
const envelope = (config, data) => ({ status: 200, statusText: 'OK', headers: {}, config, data: { code: 200, desc: 'ok', data } });

beforeEach(() => {
  calls = [];
  bodies = [];
  axiosClient.defaults.adapter = async (config) => {
    const method = config.method.toUpperCase();
    const query = config.params ? `?${new URLSearchParams(Object.entries(config.params).filter(([, v]) => v != null))}` : '';
    calls.push(`${method} ${config.url}${query}`);
    if (config.data) bodies.push(JSON.parse(config.data));
    if (config.url === '/children') return envelope(config, { items: [listItem], page: 0, size: 100, totalElements: 1, totalPages: 1 });
    if (config.url === '/children/11/profile') return envelope(config, profile);
    if (config.url === '/school-structure') return envelope(config, structure);
    if (config.url === '/children/parent-accounts/by-citizen-id') return envelope(config, account);
    if (config.url === '/children/11' && method === 'PUT') return envelope(config, { ...profile.child, accountChanges: [] });
    return envelope(config, null);
  };
});

test('stringifyIds: id, xxxId, xxxIds thành chuỗi, giữ CCCD và giá trị khác', () => {
  const out = stringifyIds({
    id: 1,
    classId: 7,
    teacherIds: [40, 41],
    idNumber: '0123',
    capacity: 25,
    nested: [{ userId: 3 }],
    none: null,
  });
  assert.deepEqual(out, {
    id: '1',
    classId: '7',
    teacherIds: ['40', '41'],
    idNumber: '0123',
    capacity: 25,
    nested: [{ userId: '3' }],
    none: null,
  });
  assert.ok(sameId(7, '7'));
  assert.ok(!sameId(null, 'null'));
});

test('G94-180/CHD-09: danh sách gửi năm học và cả 3 trạng thái, trả id chuỗi, quan hệ bằng chữ', async () => {
  const rows = await childrenApi.listChildren({ schoolYear: 5 });

  assert.deepEqual(calls, ['GET /children?schoolYear=5&status=ACTIVE%2CPENDING_PLACEMENT%2CLEFT&page=0&size=100']);
  assert.equal(rows[0].id, '11');
  assert.equal(rows[0].classId, '7');
  assert.equal(rows[0].campusId, '1');
  assert.equal(rows[0].status, 'LEFT');
  assert.equal(rows[0].guardians[0].relation, 'Bố');
});

test('G94-180/CHD-01: hồ sơ có tên năm học, nhóm tuổi, giáo viên chủ nhiệm, tên người trong lịch sử; id chuỗi', async () => {
  const detail = await childrenApi.getChildDetail('11');

  assert.deepEqual(calls, ['GET /children/11/profile', 'GET /school-structure?schoolYear=5']);
  assert.equal(detail.child.id, '11');
  assert.equal(detail.child.guardians[0].relation, 'Mẹ');
  assert.equal(detail.child.history[0].userName, 'Cô Lan');
  assert.equal(detail.declaration.history[0].userName, 'Cô Mai');
  assert.equal(detail.cls.id, '7');
  assert.deepEqual(detail.cls.teacherIds, ['40', '41']);
  assert.equal(detail.cls.schoolYearName, '2026 - 2027');
  assert.equal(detail.cls.ageGroupName, 'Mẫu giáo bé (3–4 tuổi)');
  assert.equal(detail.cls.homeroomTeacherName, 'Cô Lan');
});

test('hồ sơ vẫn mở khi không đọc được cấu trúc lớp (thiếu tên năm học, nhóm tuổi)', async () => {
  const adapter = axiosClient.defaults.adapter;
  axiosClient.defaults.adapter = async (config) => {
    if (config.url === '/school-structure') throw Object.assign(new Error('Forbidden'), { response: { status: 403 } });
    return adapter(config);
  };
  const detail = await childrenApi.getChildDetail('11');

  assert.equal(detail.cls.id, '7');
  assert.equal(detail.cls.homeroomTeacherName, undefined);
});

test('G94-180/AUTH-21: sửa hồ sơ gửi mã quan hệ, bỏ trường phụ của form', async () => {
  await childrenApi.updateChild('11', {
    child: { fullName: 'Bé demo', guardians: [{ fullName: 'Mẹ demo', relation: 'Mẹ', phone: '0900000030', savedPhone: '0900000030' }] },
    reason: 'Sửa',
  });

  assert.deepEqual(calls, ['PUT /children/11']);
  assert.equal(bodies[0].child.guardians[0].relation, 'MOTHER');
  assert.ok(!('savedPhone' in bodies[0].child.guardians[0]));
});

test('tra CCCD: quan hệ bằng chữ, id trẻ chuỗi để so với id trên URL', async () => {
  const found = await childrenApi.findParentAccountByCitizenId('999900000030');

  assert.equal(found.relation, 'Mẹ');
  assert.equal(found.children[0].id, '11');
});

test('getClassOptions: lớp, nhóm tuổi, giáo viên của năm học từ /school-structure', async () => {
  const options = await childrenApi.getClassOptions(5);

  assert.deepEqual(calls, ['GET /school-structure?schoolYear=5']);
  assert.equal(options.year.id, '5');
  assert.equal(options.year.startDate, '2026-09-01');
  assert.deepEqual(
    options.ageGroups.map((g) => g.id),
    ['1', '2', '3', '4'],
  );
  assert.deepEqual(options.classes[0], {
    id: '7',
    name: 'Lớp A1',
    campusId: '1',
    ageGroupId: '2',
    schoolYear: '5',
    capacity: 25,
    homeroomTeacherId: '40',
    homeroomTeacherName: 'Cô Lan',
    teacherIds: ['40', '41'],
  });
});

test('gợi ý nhóm tuổi theo năm sinh: nhóm tuổi BE (theo tháng) và ngày bắt đầu năm học', async () => {
  const { ageGroups } = await childrenApi.getClassOptions(5);

  // Tuổi theo năm sinh: 2026 - 2022 = 4 ⇒ 48 tháng ⇒ Mẫu giáo nhỡ
  assert.equal(suggestAgeGroupId('2022-12-31', '2026-09-01', ageGroups), '3');
  assert.equal(suggestAgeGroupId('2024-01-01', '2026-09-01', ageGroups), '1');
  assert.equal(suggestAgeGroupId('2021-06-01', '2026-09-01', ageGroups), '4');
  // Ngoài khoảng: nhỏ hơn ⇒ nhóm đầu, lớn hơn ⇒ nhóm cuối
  assert.equal(suggestAgeGroupId('2025-01-01', '2026-09-01', ageGroups), '1');
  assert.equal(suggestAgeGroupId('2019-01-01', '2026-09-01', ageGroups), '4');
  // Dữ liệu mẫu: năm học dạng "2026-2027", nhóm tuổi ag-*
  assert.equal(suggestAgeGroupId('2022-05-01', '2026-2027'), 'ag-4');
});

test('G94-180/CHD-09: danh sách mặc định ẩn trẻ đã nghỉ, chọn "Đã nghỉ" mới hiện (user chốt 2026-11-11)', async () => {
  const { childrenOfStatus } = await import('@/utils/children/childrenHelpers');
  const all = [
    { id: '1', status: 'ACTIVE' },
    { id: '2', status: 'PENDING_PLACEMENT' },
    { id: '3', status: 'LEFT' },
  ];

  assert.deepEqual(
    childrenOfStatus(all, '').map((c) => c.id),
    ['1', '2'],
  );
  assert.deepEqual(
    childrenOfStatus(all, 'LEFT').map((c) => c.id),
    ['3'],
  );
  assert.deepEqual(
    childrenOfStatus(all, 'ACTIVE').map((c) => c.id),
    ['1'],
  );
});

test('Năm học ở header là tên ("2026-2027", beClient): đổi sang id BE khi gọi danh sách trẻ và cấu trúc lớp', async () => {
  const adapter = axiosClient.defaults.adapter;
  axiosClient.defaults.adapter = async (config) => {
    if (config.url === '/school-years') {
      calls.push(`GET ${config.url}`);
      return envelope(config, [{ id: 5, name: '2026-2027', status: 'ACTIVE' }]);
    }
    return adapter(config);
  };

  await childrenApi.listChildren({ schoolYear: '2026-2027' });
  await childrenApi.getClassOptions('2026-2027');

  assert.ok(calls.includes('GET /children?schoolYear=5&status=ACTIVE%2CPENDING_PLACEMENT%2CLEFT&page=0&size=100'));
  assert.ok(calls.includes('GET /school-structure?schoolYear=5'));
});
