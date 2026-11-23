import assert from 'node:assert/strict';
import { test } from 'node:test';

const { VP_TASK_AREAS, VP_TASK_PRESETS } = await import('@/models/account/vpTaskAreas');

test('FR3.2: mảng Kế hoạch giáo dục có đủ 9 mã EDU-108', () => {
  const education = VP_TASK_AREAS.find((a) => a.key === 'education');
  assert.equal(education.label, 'Kế hoạch giáo dục');
  assert.equal(education.tasks.length, 9);
  assert.ok(education.tasks.every((t) => t.code.startsWith('EDU_')));
});

test('FR3.3: preset chuyên môn có mảng education, preset dinh dưỡng không có', () => {
  const preset = (key) => VP_TASK_PRESETS.find((p) => p.key === key).areas;
  assert.deepEqual(preset('academic'), ['children', 'education']);
  assert.ok(!preset('nutrition').includes('education'));
});
