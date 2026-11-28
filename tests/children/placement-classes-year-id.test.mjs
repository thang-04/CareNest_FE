import assert from 'node:assert/strict';
import { beforeEach, test } from 'node:test';

globalThis.window = new EventTarget();

const { axiosClient } = await import('@/services/http/axiosClient');
const { childrenApi } = await import('@/services/children/api/childrenApi');

// Header năm học dùng tên "2026-2027" làm id; BE nhận schoolYearId là id số (gửi tên ⇒ 400/9002 ở màn Tiếp nhận trẻ)
const years = [
  { id: 1, name: '2026-2027', status: 'ACTIVE' },
  { id: 3, name: '2027-2028', status: 'PLANNED' },
];
let calls;
let bodies;
const envelope = (config, data) => ({ status: 200, statusText: 'OK', headers: {}, config, data: { code: 200, desc: 'ok', data } });

beforeEach(() => {
  calls = [];
  bodies = [];
  axiosClient.defaults.adapter = async (config) => {
    const query = config.params ? `?${new URLSearchParams(Object.entries(config.params).filter(([, v]) => v != null))}` : '';
    // Ghi query như axios gửi (bỏ giá trị null/undefined)
    calls.push(`${config.method.toUpperCase()} ${config.url}${query}`);
    if (config.data) bodies.push(JSON.parse(config.data));
    if (config.url === '/school-years') return envelope(config, years);
    if (config.url === '/children/placement-classes') return envelope(config, []);
    return envelope(config, null);
  };
});

test('lớp xếp: tên năm học đổi sang id số; id số và không tham số giữ nguyên', async () => {
  await childrenApi.getPlacementClasses({ schoolYearId: '2027-2028' });
  await childrenApi.getPlacementClasses({ schoolYearId: 1 });
  await childrenApi.getPlacementClasses({});
  const placement = calls.filter((c) => c.includes('placement-classes'));
  assert.deepEqual(placement, [
    'GET /children/placement-classes?schoolYearId=3',
    'GET /children/placement-classes?schoolYearId=1',
    'GET /children/placement-classes?',
  ]);
});

test('tiếp nhận trẻ: schoolYearId trong body là id số', async () => {
  await childrenApi.enrollChild({ schoolYearId: '2026-2027', child: { fullName: 'Bé demo', guardians: [] } });
  assert.equal(bodies.at(-1).schoolYearId, 1);
});
