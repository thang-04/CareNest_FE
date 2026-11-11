import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createDailyHealthBeApi } from '@/services/daily-health/api/dailyHealthApi';
import { normalizeTemperatureInput, validateDailyHealth } from '@/utils/dailyHealthValidation';

test('health adapter preserves handover lock and guardian contacts from the authorized child context', async () => {
  const calls = [];
  const api = createDailyHealthBeApi({
    get: async (path, options) => {
      calls.push([path, options.params]);
      return {
        canRecord: false,
        handedOverAt: '2026-11-05T08:30:00Z',
        contacts: [{ fullName: 'TEST guardian', relationship: 'MOTHER', phone: '0900000001' }],
        entries: [],
      };
    },
  });
  const day = await api.getDailyHealth({ classId: '10', childId: '20', date: '2026-11-05' });
  assert.equal(day.canRecord, false);
  assert.equal(day.handedOverAt, '2026-11-05T08:30:00Z');
  assert.deepEqual(day.contacts, [{ fullName: 'TEST guardian', relation: 'Mẹ', phone: '0900000001' }]);
  assert.deepEqual(calls, [['/classes/10/children/20/daily-health', { date: '2026-11-05' }]]);
});

test('empty guardian information stays empty and request failure is not disguised as an empty profile', async () => {
  const api = createDailyHealthBeApi({ get: async () => ({ canRecord: true, entries: [] }) });
  assert.deepEqual((await api.getDailyHealth({ classId: '10', childId: '20', date: '2026-11-05' })).contacts, []);
  const denied = new Error('TEST forbidden');
  const failed = createDailyHealthBeApi({
    get: async () => {
      throw denied;
    },
  });
  await assert.rejects(failed.getDailyHealth({ classId: '10', childId: '20', date: '2026-11-05' }), (e) => e === denied);
});

test('three digit shortcut and decimal input produce the same explicit temperature; blank stays unmeasured', () => {
  for (const value of ['385', '38.5', '38,5']) {
    const temperature = normalizeTemperatureInput(value);
    assert.equal(temperature, '38.5');
    assert.equal(validateDailyHealth({ temperature, observation: 'NO_CONCERN' }).temperature, undefined);
  }
  assert.equal(normalizeTemperatureInput(''), '');
  assert.equal(validateDailyHealth({ temperature: '', observation: 'NO_CONCERN' }).temperature, undefined);
  for (const raw of ['38.55', '3855', '-385', '3e2', 'abc']) {
    assert.ok(validateDailyHealth({ temperature: normalizeTemperatureInput(raw), observation: 'NO_CONCERN' }).temperature);
  }
});

test('thân nhiệt ngoài 20,0–45,0 °C báo lỗi ngay dưới ô (Cần chốt 11/11/2026)', () => {
  for (const ok of ['20', '20.0', '36.8', '45', '45.0']) {
    assert.equal(validateDailyHealth({ temperature: ok, observation: 'NO_CONCERN' }).temperature, undefined);
  }
  for (const bad of ['19.9', '45.1', '83.5']) {
    assert.match(validateDailyHealth({ temperature: bad, observation: 'NO_CONCERN' }).temperature, /20,0 đến 45,0/);
  }
});
