import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createGeneralDraft, getGeneralSaveEntries } from '@/utils/assessment/dailyGeneralDraft';

const row = (childId, recorded) => ({
  childId,
  recorded,
  health: { signs: [], note: '', overridden: false },
  meals: {},
  nap: null,
  emotion: null,
  behaviors: [],
  behaviorNote: '',
  participation: null,
  flag: false,
  comment: '',
});

// OBS-17, OBS-33: dòng chưa ghi lúc mở trang chỉ tạo mới để không đè ghi nhận của cô khác
test('dòng chưa ghi chỉ gửi kèm createOnly, dòng đã ghi và cô đã sửa thì ghi đè như cũ', () => {
  const rows = [row(1, false), row(2, true)];
  const drafts = { 2: { ...createGeneralDraft(rows[1], []), comment: 'Cô sửa' } };
  const dirty = new Set([2]);
  const entries = getGeneralSaveEntries(rows, [], drafts, dirty);
  const byChild = Object.fromEntries(entries.map((entry) => [entry.childId, entry]));
  assert.equal(byChild[1].createOnly, true);
  assert.equal(byChild[2].createOnly, undefined);
  assert.equal(byChild[2].comment, 'Cô sửa');
});
