import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createPreviewCoordinator } from '../../src/components/announcement/previewCoordinator.mjs';

test('preview cũ không bật gửi khi người dùng đổi đối tượng hoặc preview mới', async () => {
  const pending = [];
  const gate = createPreviewCoordinator((target, options) => new Promise((resolve) => pending.push({ target, options, resolve })));
  const first = gate.run({ scopeType: 'SCHOOL' });
  gate.invalidate();
  assert.equal(pending[0].options.signal.aborted, true);
  const second = gate.run({ scopeType: 'CLASSROOM' });
  pending[0].resolve({ total: 20 });
  pending[1].resolve({ total: 0 });
  assert.equal(await first, null);
  assert.deepEqual(await second, { total: 0 });
});
