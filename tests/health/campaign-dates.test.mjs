import assert from 'node:assert/strict';
import { beforeEach, test } from 'node:test';

process.env.TZ = 'Asia/Ho_Chi_Minh';

const values = new Map();
globalThis.localStorage = {
  getItem: (key) => values.get(key) ?? null,
  setItem: (key, value) => values.set(key, String(value)),
  removeItem: (key) => values.delete(key),
  clear: () => values.clear(),
};
globalThis.window = new EventTarget();

const { readDb, writeDb, resetDb } = await import('@/mocks/mockDatabase');
const { healthCheckMockRepository: checks } = await import('@/services/children/mock/healthCheckMockRepository');
const { ensureChildRecordsSeeded } = await import('@/services/children/mock/childrenMockRepository');
const { validateHealthCheck } = await import('@/utils/children/childrenValidation');
const { formatDate, parseDisplayDate, todayInput } = await import('@/utils/format');

const PRINCIPAL = { id: 'u_hung', role: 'PRINCIPAL', campusId: null };
const TODAY = '2026-11-01';
const YESTERDAY = '2026-10-31';
const TOMORROW = '2026-11-02';
const payload = (kind, dates = {}) => ({
  kind,
  name: 'Đợt thử ngày (giả)',
  campusId: 'c1',
  startDate: TODAY,
  endDate: TODAY,
  ...dates,
});

beforeEach((context) => {
  // Cố định 00:30 giờ Việt Nam: ngày UTC vẫn là hôm qua.
  context.mock.timers.enable({ apis: ['Date'], now: new Date('2026-11-01T00:30:00+07:00').getTime() });
  resetDb();
  ensureChildRecordsSeeded();
});

const freeCampus = () =>
  writeDb((db) => {
    db.healthCheckCampaigns
      .filter((campaign) => campaign.campusId === 'c1' && !campaign.closedAt && !campaign.cancelledAt)
      .forEach((campaign) => (campaign.cancelledAt = new Date().toISOString()));
  });

for (const kind of ['EXAM', 'MEASUREMENT']) {
  test(`${kind}: tạo mới báo lỗi cả hai ngày trong quá khứ`, () => {
    const errors = validateHealthCheck(payload(kind, { startDate: YESTERDAY, endDate: YESTERDAY }), { creating: true });
    assert.ok(errors.startDate);
    assert.ok(errors.endDate);
  });

  test(`${kind}: tạo mới nhận hôm nay và tương lai theo ngày Việt Nam`, () => {
    assert.equal(todayInput(), TODAY);
    assert.equal(new Date().toISOString().slice(0, 10), YESTERDAY);
    assert.deepEqual(validateHealthCheck(payload(kind), { creating: true }), {});
    assert.deepEqual(validateHealthCheck(payload(kind, { startDate: TOMORROW, endDate: TOMORROW }), { creating: true }), {});
  });

  test(`${kind}: ngày kết thúc phải bằng hoặc sau ngày bắt đầu`, () => {
    const errors = validateHealthCheck(payload(kind, { startDate: TOMORROW, endDate: TODAY }), { creating: true });
    assert.ok(errors.endDate);
    assert.equal(errors.startDate, undefined);
  });

  test(`${kind}: ngày gõ chưa đủ hoặc không tồn tại không hợp lệ`, () => {
    for (const startDate of ['01/11/202', '31/02/2027', '2027-02-31']) {
      assert.ok(validateHealthCheck(payload(kind, { startDate, endDate: '2027-03-01' }), { creating: true }).startDate, startDate);
    }
    for (const endDate of ['02/11/', '31/11/2026', '2026-11-31']) {
      assert.ok(validateHealthCheck(payload(kind, { endDate }), { creating: true }).endDate, endDate);
    }
  });

  test(`${kind}: sửa đợt đã bắt đầu giữ được khoảng ngày cũ`, () => {
    assert.deepEqual(validateHealthCheck(payload(kind, { startDate: YESTERDAY }), { creating: false }), {});
  });

  test(`${kind}: mock từ chối tạo ngày quá khứ và không ghi dữ liệu`, async () => {
    freeCampus();
    const count = readDb().healthCheckCampaigns.length;
    await assert.rejects(
      checks.createHealthCheck(payload(kind, { startDate: YESTERDAY }), PRINCIPAL),
      (error) => error.status === 422 && !!error.details?.startDate,
    );
    assert.equal(readDb().healthCheckCampaigns.length, count);
  });

  for (const date of [TODAY, TOMORROW]) {
    test(`${kind}: mock tạo được ngày ${date}`, async () => {
      freeCampus();
      const created = await checks.createHealthCheck(payload(kind, { startDate: date, endDate: date }), PRINCIPAL);
      assert.equal(created.kind, kind);
      assert.equal(created.startDate, date);
      assert.equal(created.endDate, date);
    });
  }

  test(`${kind}: mock sửa tên đợt đang diễn ra có ngày bắt đầu quá khứ`, async () => {
    const campaign = readDb().healthCheckCampaigns.find(
      (candidate) => candidate.kind === kind && !candidate.closedAt && !candidate.cancelledAt,
    );
    assert.ok(campaign.startDate < TODAY);
    const updated = await checks.updateHealthCheck(campaign.id, { ...campaign, name: 'Tên mới (giả)' }, PRINCIPAL);
    assert.equal(updated.name, 'Tên mới (giả)');
    assert.equal(updated.startDate, campaign.startDate);
    assert.equal(updated.endDate, campaign.endDate);
  });
}

test('Ngày hiển thị dd/mm/yyyy chuyển qua lại đúng với giá trị gửi API', () => {
  const iso = parseDisplayDate('01/11/2026');
  assert.equal(iso, TODAY);
  assert.equal(formatDate(iso), '01/11/2026');
  assert.equal(parseDisplayDate('31/02/2027'), null);
  assert.equal(parseDisplayDate('29/02/2028'), '2028-02-29');
});
