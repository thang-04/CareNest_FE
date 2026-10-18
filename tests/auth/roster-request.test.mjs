import assert from 'node:assert/strict';
import { test } from 'node:test';

const { createRosterRequestGate } = await import('@/utils/account/rosterRequestGate');

test('late campus response cannot replace the selected campus roster', async () => {
  const pending = new Map();
  const gate = createRosterRequestGate((campusId) => new Promise((resolve) => pending.set(campusId, resolve)));
  const seen = [];
  const first = gate.run('c1', null, (roster) => seen.push(roster.campusId), (error) => { throw error; });
  const second = gate.run('c2', null, (roster) => seen.push(roster.campusId), (error) => { throw error; });
  pending.get('c2')({ campusId: 'c2', classrooms: [] });
  await second;
  pending.get('c1')({ campusId: 'c1', classrooms: [] });
  await first;
  assert.deepEqual(seen, ['c2']);
});

test('mismatched roster identity is rejected before reaching the screen', async () => {
  const gate = createRosterRequestGate(async () => ({ campusId: 'c1' }));
  const seen = [];
  await gate.run('c2', null, () => seen.push('rendered'), (error) => seen.push(error.message));
  assert.deepEqual(seen, ['Dữ liệu phân công không khớp điểm trường đã chọn']);
});
