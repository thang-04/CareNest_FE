import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';

test('HT bấm Ban hành kế hoạch năm/tổ ⇒ hook nạp lại như khi duyệt; API gọi /principal-publish', () => {
  const hook = readFileSync(new URL('../../src/hooks/education-plan/useEducationPlan.jsx', import.meta.url), 'utf8');
  assert.match(hook, /reviewAction = \['approve', 'reject', 'publish'\]\.includes\(options\.action\)/);
  const api = readFileSync(new URL('../../src/services/education-plan/api/educationPlanApi.js', import.meta.url), 'utf8');
  assert.match(api, /publish: 'principal-publish'/);
});
