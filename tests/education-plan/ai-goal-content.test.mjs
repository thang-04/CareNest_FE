import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  applyGoalContents,
  goalContentStamp,
  locateGoal,
  requestGoalContents,
  rememberShown,
  shownFor,
} from '../../src/models/education-plan/aiGoalContent.mjs';

const form = () => ({
  id: '17',
  ageGroupId: 'ag-5',
  schoolYear: '2026 – 2027',
  planLevel: 'SCHOOL_YEAR',
  domains: [
    {
      id: 'd-1',
      name: 'Ngôn ngữ',
      rows: [
        { id: '10', kind: 'goal', text: 'Trẻ đọc thơ rõ lời', contents: [] },
        { id: '11', kind: 'goal', text: 'Trẻ nghe kể chuyện', contents: [{ id: '1', text: 'Đã có', themes: [] }] },
        { id: '12', kind: 'goal', text: 'Trẻ kể lại câu chuyện', contents: [{ id: '2', text: ' ', themes: [] }] },
      ],
    },
  ],
});
const matches = [
  { goalId: 10, text: 'Đọc thơ, ca dao.', source: 'CURRICULUM_C', ref: null },
  { goalId: 11, text: 'đã có', source: 'CURRICULUM_D' },
  { goalId: 11, text: 'Nghe kể chuyện cổ tích.', source: 'RAG', ref: { id: 'MT-1', title: 'Trẻ nghe kể' } },
  { goalId: 12, text: 'Kể lại câu chuyện theo tranh.', source: 'AI' },
  { goalId: 99, text: 'Mục tiêu lạ', source: 'AI' },
  { goalId: 10, text: '  ', source: 'AI' },
];

test('EDU-106: gắn nội dung vào đúng mục tiêu (kể cả đã có), bỏ trùng chữ và dòng trống, ghi nguồn chờ ✓/✗', () => {
  const plan = form(),
    original = structuredClone(plan);
  let n = 0;
  const result = applyGoalContents(plan, matches, goalContentStamp(plan), () => `ai-${++n}`);
  assert.equal(result.added, 3);
  const [r10, r11, r12] = result.domains[0].rows;
  assert.deepEqual(r10.contents, [{ id: 'ai-1', text: 'Đọc thơ, ca dao.', themes: [] }]);
  assert.deepEqual(
    r11.contents.map((c) => c.text),
    ['Đã có', 'Nghe kể chuyện cổ tích.'],
  );
  assert.deepEqual(
    r12.contents.map((c) => c.text),
    ['Kể lại câu chuyện theo tranh.'],
  );
  assert.deepEqual(result.pending, {
    'ai-1': { source: 'CURRICULUM_C', ref: null },
    'ai-2': { source: 'RAG', ref: { id: 'MT-1', title: 'Trẻ nghe kể' } },
    'ai-3': { source: 'AI', ref: null },
  });
  assert.deepEqual(plan, original);
});

test('EDU-106: kết quả cũ không áp vào bản đã đổi trong lúc AI chạy', () => {
  const plan = form(),
    stamp = goalContentStamp(plan);
  for (const mutate of [
    (p) => {
      p.ageGroupId = 'ag-4';
    },
    (p) => {
      p.domains[0].rows[0].text = 'Đổi MT';
    },
    (p) => {
      p.domains[0].rows[0].contents.push({ id: 'fresh', text: 'Vừa nhập' });
    },
  ]) {
    const changed = structuredClone(plan);
    mutate(changed);
    assert.equal(
      applyGoalContents(changed, matches, stamp, () => 'id'),
      null,
    );
  }
});

test('EDU-106: lưu thất bại không gọi AI', async () => {
  let called = 0;
  await assert.rejects(
    requestGoalContents({
      ensureSaved: async () => null,
      current: () => ({ plan: form(), allowed: true }),
      request: async () => {
        called++;
      },
      active: () => true,
    }),
    /Chưa lưu/,
  );
  assert.equal(called, 0);
});

test('EDU-106: nút chung gửi goalId null; lĩnh vực lỗi được giữ', async () => {
  const saved = form();
  let args;
  const result = await requestGoalContents({
    ensureSaved: async () => ({ planId: '17', plan: saved, allowed: true }),
    current: () => ({ plan: saved, allowed: true }),
    active: () => true,
    request: async (...a) => {
      args = a;
      return { matches, failedDomains: [{ domainId: 5, name: 'Nghệ thuật' }] };
    },
  });
  assert.deepEqual(args, ['17', null]);
  assert.equal(result.matches.length, matches.length);
  assert.equal(result.failedDomains[0].name, 'Nghệ thuật');
});

test('EDU-106: nút từng mục tiêu tìm lại mục tiêu sau lần Lưu đầu (id tạm → id thật)', async () => {
  const draft = form();
  draft.domains[0].rows[0].id = 'tmp-1';
  const saved = form();
  let args,
    plan = draft;
  const result = await requestGoalContents({
    ensureSaved: async () => {
      plan = saved;
      return { planId: '17', plan: saved, allowed: true };
    },
    current: () => ({ plan, allowed: true }),
    active: () => true,
    goalId: 'tmp-1',
    request: async (...a) => {
      args = a;
      return { matches: [], failedDomains: [] };
    },
  });
  assert.deepEqual(args, ['17', '10']);
  assert.ok(result);
  assert.deepEqual(locateGoal(saved, '12'), { di: 0, ri: 2, text: 'Trẻ kể lại câu chuyện' });
});

test('EDU-106: rời màn trong lúc lưu không gọi AI; mục tiêu không còn thì bỏ', async () => {
  let active = true,
    called = false;
  const result = await requestGoalContents({
    ensureSaved: async () => {
      active = false;
      return { planId: '17', plan: form(), allowed: true };
    },
    current: () => ({ plan: form(), allowed: true }),
    active: () => active,
    request: async () => {
      called = true;
    },
  });
  assert.equal(result, null);
  assert.equal(called, false);
  assert.equal(
    await requestGoalContents({
      ensureSaved: async () => ({}),
      current: () => ({ plan: form(), allowed: true }),
      active: () => true,
      request: async () => {
        called = true;
      },
      goalId: 'không-có',
    }),
    null,
  );
  assert.equal(called, false);
});

test('EDU-106: nhớ câu đã gợi ý theo mục tiêu để lần sau không lặp', () => {
  assert.equal(shownFor({}), undefined);
  let shown = rememberShown({}, [
    { goalId: 10, text: 'A' },
    { goalId: 11, text: 'B' },
  ]);
  shown = rememberShown(shown, [
    { goalId: 10, text: 'A' },
    { goalId: 10, text: 'C' },
  ]);
  assert.deepEqual(shownFor(shown, '10'), { 10: ['A', 'C'] });
  assert.deepEqual(shownFor(shown), { 10: ['A', 'C'], 11: ['B'] });
  assert.equal(shownFor(shown, '99'), undefined);
});
