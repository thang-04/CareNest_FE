import assert from 'node:assert/strict';
import { beforeEach, test } from 'node:test';

globalThis.window = new EventTarget();

const { axiosClient } = await import('@/services/http/axiosClient');
const { childrenApi } = await import('@/services/children/api/childrenApi');
const { healthCheckApi } = await import('@/services/children/api/healthCheckApi');
const { canManageHealthCheck, canRecordMeasurement } = await import('@/utils/children/childrenPermissions');
const { validateMeasurement } = await import('@/utils/children/childrenValidation');
const { ageGroupIn } = await import('@/utils/children/childrenHelpers');
const { growthAxesFor } = await import('@/models/children/childrenConstants');
const { SCHOOL_NAME } = await import('@/config/app');

/*
 * Plan 2026-11-11-children-module-be-wiring, Phase 2: adapter sức khỏe đọc response đúng shape BE (G94-180) và trả về shape
 * màn đang dùng: id dạng chuỗi, sổ sức khỏe có thông tin trẻ, phiếu khám có tên trường, số nháp là ô trống.
 */
const record = {
  childId: 11,
  canRecord: true,
  openCampaign: { id: 3, kind: 'MEASUREMENT', name: 'Kỳ cân đo tháng 11', startDate: '2026-11-01', endDate: '2026-11-30' },
  measurements: [{ id: 50, campaignId: 3, date: '2026-11-05', heightCm: 100.5, weightKg: 15.2, edits: [] }],
  latestExam: null,
  latestBmi: null,
};
const profile = {
  child: { id: 11, fullName: 'Bé demo', status: 'ACTIVE', classId: 7, campusId: 1, guardians: [], history: [] },
  cls: { id: 7, name: 'Lớp A1', campusId: 1, ageGroupId: 2, schoolYearId: 5, capacity: 25, homeroomTeacherId: 40, teacherIds: [40, 41] },
  declaration: { history: [] },
  placements: [],
};
const campaignDetail = {
  campaign: { id: 3, kind: 'EXAM', name: 'Khám định kỳ', campusId: 1, status: 'OPEN' },
  classes: [{ classId: 7, className: 'Lớp A1', total: 20, recorded: 5 }],
  watchList: [],
};
const exam = {
  child: { id: 11, fullName: 'Bé demo', className: 'Lớp A1', guardians: [] },
  campaign: { id: 3, examiner: 'Trạm y tế' },
  measurement: null,
  draft: { date: '2026-11-11', heightCm: null, weightKg: null, headCircumferenceCm: null, exam: { step: 0 } },
};

let calls;
const envelope = (config, data) => ({ status: 200, statusText: 'OK', headers: {}, config, data: { code: 200, desc: 'ok', data } });

beforeEach(() => {
  calls = [];
  axiosClient.defaults.adapter = async (config) => {
    const method = config.method.toUpperCase();
    calls.push(`${method} ${config.url}`);
    if (config.url === '/children/11/health') return envelope(config, record);
    if (config.url === '/children/11/profile') return envelope(config, profile);
    if (config.url === '/health-checks/3') return envelope(config, campaignDetail);
    if (config.url === '/health-checks/3/children/11/exam') return envelope(config, exam);
    if (config.url === '/children/11/health/measurements') return envelope(config, { ...record.measurements[0], id: 51 });
    return envelope(config, null);
  };
});

test('HLT-09: sổ sức khỏe ghép thông tin trẻ, lớp từ hồ sơ; id chuỗi; GV lớp được nhập số đo', async () => {
  const health = await childrenApi.getHealthRecord('11');

  assert.deepEqual(calls.sort(), ['GET /children/11/health', 'GET /children/11/profile']);
  assert.equal(health.child.id, '11');
  assert.equal(health.cls.id, '7');
  assert.deepEqual(health.cls.teacherIds, ['40', '41']);
  assert.equal(health.measurements[0].id, '50');
  assert.equal(health.openCampaign.id, '3');
  const teacher = { id: '40', role: 'TEACHER', bePermissions: [] };
  const other = { id: '99', role: 'TEACHER', bePermissions: [] };
  assert.equal(canRecordMeasurement(health.child, teacher, health.cls), true);
  assert.equal(canRecordMeasurement(health.child, other, health.cls), false);
});

test('HLT-13: lưu số đo trả id chuỗi để trang sửa tìm đúng lần đo', async () => {
  const saved = await childrenApi.saveMeasurement('11', null, { campaignId: '3', heightCm: '100.5', weightKg: '15.2' });

  assert.equal(saved.id, '51');
  assert.equal(saved.campaignId, '3');
});

test('HLT-13: số đo tối đa 1 chữ số thập phân, báo ở ô trước khi gửi', () => {
  const errors = validateMeasurement({ heightCm: '100.55', weightKg: '15.25' });

  assert.equal(errors.heightCm, 'Chiều cao lấy tối đa 1 chữ số thập phân');
  assert.equal(errors.weightKg, 'Cân nặng lấy tối đa 1 chữ số thập phân');
  assert.deepEqual(validateMeasurement({ heightCm: '100.5', weightKg: '15' }), {});
});

test('G94-180/HLT-08: chi tiết đợt khám trả id lớp chuỗi để mở đúng lớp theo URL', async () => {
  const detail = await healthCheckApi.getHealthCheck('3');

  assert.equal(detail.campaign.id, '3');
  assert.equal(detail.campaign.campusId, '1');
  assert.equal(detail.classes[0].classId, '7');
});

test('G94-180/HLT-08: phiếu khám có tên trường khi BE không trả; số nháp null thành ô trống', async () => {
  const view = await healthCheckApi.getHealthExam('3', '11');

  assert.equal(view.child.id, '11');
  assert.equal(view.child.schoolName, SCHOOL_NAME);
  assert.equal(view.draft.heightCm, '');
  assert.equal(view.draft.weightKg, '');
  assert.equal(view.draft.headCircumferenceCm, '');
  assert.deepEqual(view.draft.exam, { step: 0 });
});

test('AUTH-02, HLT-08: PHT quản lý đợt khám mọi điểm trường được phân công, kể cả nhiều điểm trường (Q4 = A)', () => {
  const twoCampuses = { id: '8', role: 'VICE_PRINCIPAL', bePermissions: [], locationIds: ['1', '2'], campusId: null };
  const oneCampus = { id: '9', role: 'VICE_PRINCIPAL', bePermissions: [], locationIds: ['1'], campusId: '1' };

  assert.equal(canManageHealthCheck(twoCampuses), true);
  assert.equal(canManageHealthCheck(twoCampuses, 1), true);
  assert.equal(canManageHealthCheck(twoCampuses, '2'), true);
  assert.equal(canManageHealthCheck(twoCampuses, 3), false);
  assert.equal(canManageHealthCheck(oneCampus, 2), false);
  assert.equal(canManageHealthCheck({ id: '7', role: 'PRINCIPAL', bePermissions: [] }, 3), true);
  // Dữ liệu mẫu: PHT theo campusId, locationIds là phòng
  const mockVp = { id: 'u_lan', role: 'VICE_PRINCIPAL', campusId: 'c1', locationIds: ['loc_c1_m1'] };
  assert.equal(canManageHealthCheck(mockVp, 'c1'), true);
  assert.equal(canManageHealthCheck(mockVp, 'c2'), false);
});

test('Xu hướng sức khỏe: thang biểu đồ theo mã nhóm tuổi BE (code ag-*), mock dùng id ag-*', () => {
  const beGroups = [
    { id: '1', code: 'ag-2', shortName: 'Nhà trẻ' },
    { id: '2', code: 'ag-3', shortName: 'Mẫu giáo bé' },
  ];

  assert.equal(ageGroupIn(beGroups, 2).shortName, 'Mẫu giáo bé');
  assert.deepEqual(growthAxesFor(ageGroupIn(beGroups, '2').code), growthAxesFor('ag-3'));
  assert.equal(ageGroupIn(beGroups, '9'), null);
});

test('G94-180/HLT-08: danh sách đợt khám đổi tên năm học ở header sang id BE', async () => {
  const adapter = axiosClient.defaults.adapter;
  const params = [];
  axiosClient.defaults.adapter = async (config) => {
    if (config.url === '/school-years') return envelope(config, [{ id: 5, name: '2026-2027', status: 'ACTIVE' }]);
    if (config.url === '/health-checks') {
      params.push(config.params);
      return envelope(config, []);
    }
    return adapter(config);
  };

  await healthCheckApi.listHealthChecks({ schoolYear: '2026-2027', kind: 'EXAM' });

  assert.deepEqual(params, [{ schoolYear: 5, kind: 'EXAM' }]);
});
