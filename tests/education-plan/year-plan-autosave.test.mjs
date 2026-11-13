import test from 'node:test';
import assert from 'node:assert/strict';
import { reconcileYearPlanIds, createSaveQueue, yearPlanContentKey } from '../../src/models/education-plan/yearPlanAutosave.mjs';

test('saving assigns branch and parent theme IDs without losing edits made while waiting', () => {
  const snapshot = {
    themes: [{ id: 'theme-local', name: 'Trường mầm non' }],
    branchTemplates: [{ id: 'branch-local', themeId: 'theme-local', name: 'Nhánh đã gửi' }],
  };
  const current = structuredClone(snapshot);
  current.branchTemplates[0].name = 'Nhánh đang gõ tiếp';
  current.branchTemplates.push({ id: 'branch-next', themeId: 'theme-local', name: 'Thêm trong lúc lưu' });
  const saved = {
    themes: [{ id: '703', name: 'Trường mầm non' }],
    branchTemplates: [{ id: '35', themeId: '703', name: 'Nhánh đã gửi' }],
  };
  const result = reconcileYearPlanIds(current, snapshot, saved);
  assert.deepEqual(result.branchTemplates, [
    { id: '35', themeId: '703', name: 'Nhánh đang gõ tiếp' },
    { id: 'branch-next', themeId: '703', name: 'Thêm trong lúc lưu' },
  ]);
  const deleted = reconcileYearPlanIds({ ...current, branchTemplates: [] }, snapshot, saved);
  assert.deepEqual(deleted.branchTemplates, []);
});

test('branch-only changes remain distinguishable from the saved document for recovery', () => {
  const before = { branchTemplates: [{ id: '35', themeId: '703', name: 'Nhánh cũ', startDate: '', endDate: '' }] };
  const after = structuredClone(before);
  after.branchTemplates[0].name = 'Nội dung chưa lưu';
  assert.notEqual(yearPlanContentKey(before), yearPlanContentKey(after));
});

test('autosave preserves text typed during a save while assigning server IDs and theme ticks', () => {
  const snapshot = {
    id: 'new',
    domains: [{ rows: [{ id: 'r', text: 'old', contents: [{ id: 'c', text: 'old', themes: ['t'] }] }] }],
    themes: [{ id: 't', name: 'old' }],
    breaks: [],
  };
  const current = structuredClone(snapshot);
  current.domains[0].rows[0].text = 'new typing';
  current.themes.push({ id: 'next', name: 'added during save' });
  const saved = structuredClone(snapshot);
  saved.id = '12';
  saved.domains[0].rows[0].id = '13';
  saved.domains[0].rows[0].contents[0].id = '14';
  saved.themes[0].id = '15';
  const result = reconcileYearPlanIds(current, snapshot, saved);
  assert.equal(result.id, '12');
  assert.equal(result.domains[0].rows[0].id, '13');
  assert.equal(result.domains[0].rows[0].text, 'new typing');
  assert.deepEqual(result.domains[0].rows[0].contents[0].themes, ['15']);
  assert.equal(result.themes[1].id, 'next');
});

test('only one write runs at a time; a lost response retries the same request before newer content', async () => {
  let doc = { text: '' };
  let release;
  let active = 0;
  let maxActive = 0;
  const writes = [];
  const queue = createSaveQueue({
    read: () => doc,
    write: async (snapshot, requestId) => {
      writes.push({ snapshot, requestId });
      active++;
      maxActive = Math.max(active, maxActive);
      await new Promise((resolve) => {
        release = resolve;
      });
      active--;
      return snapshot;
    },
    accept: (saved) => saved,
    onState: () => {},
  });
  queue.markClean(doc);
  doc = { text: 'first' };
  const saving = queue.flush();
  await Promise.resolve();
  doc = { text: 'second' };
  release();
  await new Promise((resolve) => setTimeout(resolve, 0));
  assert.equal(writes.length, 2);
  release();
  await saving;
  assert.equal(maxActive, 1);
  assert.equal(writes[1].snapshot.text, 'second');
  queue.dispose();
});

test('failed writes preserve the same request identity for retry', async () => {
  let doc = { text: '' };
  const ids = [];
  let fail = true;
  const queue = createSaveQueue({
    read: () => doc,
    write: async (snapshot, id) => {
      ids.push(id);
      if (fail) throw new Error('lost response');
      return snapshot;
    },
    accept: (saved) => saved,
    onState: () => {},
  });
  queue.markClean(doc);
  doc = { text: 'draft' };
  assert.equal(await queue.flush(), false);
  fail = false;
  assert.equal(await queue.flush(), true);
  assert.equal(ids[0], ids[1]);
  queue.dispose();
});

test('corrected content can save after a validation error instead of retrying the rejected snapshot forever', async () => {
  let doc = { text: '' };
  const queue = createSaveQueue({
    read: () => doc,
    write: async (snapshot) => {
      if (snapshot.text === 'invalid') throw Object.assign(new Error('validation'), { status: 400 });
      return snapshot;
    },
    accept: (saved) => saved,
    onState: () => {},
  });
  queue.markClean(doc);
  doc = { text: 'invalid' };
  assert.equal(await queue.flush(), false);
  doc = { text: 'corrected' };
  const saved = await queue.flush();
  queue.dispose();
  assert.equal(saved, true);
});

test('editing never writes to the server by itself; only flush (Lưu/Ctrl+S, gửi, ban hành) writes', async () => {
  let doc = { text: '' };
  const writes = [];
  const queue = createSaveQueue({
    read: () => doc,
    write: async (d) => {
      writes.push(d.text);
      return d;
    },
    accept: (d) => d,
    onState: () => {},
  });
  queue.markClean(doc);
  doc = { text: 'typing' };
  await new Promise((resolve) => setTimeout(resolve, 50));
  assert.equal(writes.length, 0);
  assert.equal(queue.dirty(), true);
  assert.equal(await queue.flush(), true);
  assert.deepEqual(writes, ['typing']);
  assert.equal(queue.dirty(), false);
  queue.dispose();
});

test('a server failure is not retried in the background; the next Lưu reuses the same request ID', async () => {
  let doc = { text: '' };
  const ids = [];
  let fail = true;
  const queue = createSaveQueue({
    read: () => doc,
    write: async (d, id) => {
      ids.push(id);
      if (fail) throw Object.assign(new Error('server unavailable'), { status: 503 });
      return d;
    },
    accept: (d) => d,
    onState: () => {},
  });
  queue.markClean(doc);
  doc = { text: 'saved later' };
  assert.equal(await queue.flush(), false);
  await new Promise((resolve) => setTimeout(resolve, 50));
  assert.equal(ids.length, 1);
  fail = false;
  assert.equal(await queue.flush(), true);
  assert.equal(ids.length, 2);
  assert.equal(ids[0], ids[1]);
  queue.dispose();
});

test('offline Lưu keeps the edits unsaved; Lưu after reconnect saves the latest content', async () => {
  let doc = { text: '' };
  let online = false;
  const writes = [];
  const queue = createSaveQueue({
    read: () => doc,
    enabled: () => online,
    write: async (snapshot) => {
      writes.push(snapshot.text);
      return snapshot;
    },
    accept: (saved) => saved,
    onState: () => {},
  });
  queue.markClean(doc);
  doc = { text: 'offline one' };
  assert.equal(await queue.flush(), false);
  doc = { text: 'offline latest' };
  assert.equal(writes.length, 0);
  assert.equal(queue.dirty(), true);
  online = true;
  assert.equal(await queue.flush(), true);
  assert.deepEqual(writes, ['offline latest']);
  assert.equal(queue.dirty(), false);
  queue.dispose();
});

test('editing only an STT label is a content change before goal text is entered', () => {
  const before = { domains: [{ name: 'A', rows: [{ id: 'pending', kind: 'goal', text: '', displayLabel: 'MT01', contents: [] }] }] };
  const after = structuredClone(before);
  after.domains[0].rows[0].displayLabel = 'MTR20';
  assert.notEqual(yearPlanContentKey(before), yearPlanContentKey(after));
});

test('source/session conflicts retain local edits but do not replay a rejected snapshot after explicit recovery', async () => {
  for (const status of [409, 403]) {
    let doc = { title: 'Draft', source: 'old' };
    let allowed = true;
    const attempts = [];
    const queue = createSaveQueue({ read: () => doc, enabled: () => allowed,
      write: async (snapshot, requestId) => {
        attempts.push({ snapshot, requestId });
        if (snapshot.source === 'old') throw Object.assign(new Error('Source changed'), { status });
        return snapshot;
      }, accept: (saved) => saved, onState: (phase) => { if (phase === 'conflict') allowed = false; } });
    queue.markClean(doc); doc = { title: 'Unsaved input', source: 'old' };
    assert.equal(await queue.flush(), false); assert.equal(doc.title, 'Unsaved input');
    assert.equal(await queue.flush(), false); assert.equal(attempts.length, 1);
    doc = { ...doc, source: 'fresh' }; allowed = true;
    assert.equal(await queue.flush(), true);
    assert.equal(attempts[1].snapshot.source, 'fresh');
    assert.notEqual(attempts[0].requestId, attempts[1].requestId);
    queue.dispose();
  }
});
