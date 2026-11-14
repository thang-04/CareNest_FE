import assert from 'node:assert/strict';
import { beforeEach, test } from 'node:test';

const values = new Map();
globalThis.localStorage = {
  getItem: (k) => values.get(k) ?? null,
  setItem: (k, v) => values.set(k, String(v)),
  removeItem: (k) => values.delete(k),
  clear: () => values.clear(),
};
globalThis.window = new EventTarget();

const { axiosClient } = await import('@/services/http/axiosClient');
const { childrenApi } = await import('@/services/children/api/childrenApi');
const { resetDb, writeDb } = await import('@/mocks/mockDatabase');
const { childrenMockRepository: children, ensureChildRecordsSeeded } = await import('@/services/children/mock/childrenMockRepository');
const { validateTrendContent, normalizeTrendContent, isTrendStale, trendBlocks, toEditable, toPayload } = await import(
  '@/utils/children/healthTrend'
);
const { canReviewHealthTrend } = await import('@/utils/children/childrenPermissions');

/*
 * Plan docs/plans/active/2026-11-14-health-trend-review.md, Phase 1 (BE HLT-21): nhận định xu hướng có cấu trúc, đọc bản mới nhất,
 * duyệt chỉ GV phụ trách lớp hiện tại của trẻ. Seed: ch_001 (lớp cls_c1_m1, GV u_an) có 5 lần đo. Dữ liệu giả.
 */
const CHILD = 'ch_001';
const AN = { id: 'u_an', role: 'TEACHER', campusId: 'c1' };
const PRINCIPAL = { id: 'u_hung', role: 'PRINCIPAL', campusId: null };
const WARNINGS = [
  { code: 'WEIGHT_DROP', level: 'warning', text: 'Cân nặng giảm.' },
  { code: 'NORMAL', level: 'info', text: 'Bình thường.' },
];

let calls;
const envelope = (config, data) => ({ status: 200, statusText: 'OK', headers: {}, config, data: { code: 200, desc: 'ok', data } });

beforeEach(() => {
  values.clear();
  resetDb();
  ensureChildRecordsSeeded();
  calls = [];
  axiosClient.defaults.adapter = async (config) => {
    calls.push({ method: config.method.toUpperCase(), url: config.url, body: config.data ? JSON.parse(config.data) : undefined });
    return envelope(config, { id: 90, status: 'OK', draft: true, stale: false, approvedBy: 40, measurementIds: [1, 2] });
  };
});

test('HLT-21: adapter đọc bản mới nhất bằng GET; duyệt gửi { content } hoặc thân rỗng; id đổi sang chuỗi', async () => {
  const latest = await childrenApi.getLatestHealthTrend('11');
  await childrenApi.approveHealthTrend('11', '90', { overview: 'Tăng đều.' });
  await childrenApi.approveHealthTrend('11', '90', null);

  assert.deepEqual(
    calls.map((c) => `${c.method} ${c.url}`),
    [
      'GET /children/11/health/trend-analysis',
      'POST /children/11/health/trend-analysis/90/approve',
      'POST /children/11/health/trend-analysis/90/approve',
    ],
  );
  assert.deepEqual(calls[1].body, { content: { overview: 'Tăng đều.' } });
  assert.deepEqual(calls[2].body, {});
  assert.equal(latest.id, '90');
  assert.equal(latest.approvedBy, '40');
});

test('AI-02, HLT-21: kiểm bản sửa giống BE — tổng quan bắt buộc, mã cảnh báo của lần phân tích, giới hạn độ dài, tên ô dạng chấm', () => {
  const errors = validateTrendContent(
    {
      overview: '  ',
      attentionPoints: [
        { warningCode: 'WEIGHT_DROP', text: 'Giảm 0,5 kg.' },
        { warningCode: 'WEIGHT_DROP', text: 'Trùng mã.' },
        { warningCode: 'NORMAL', text: 'Không phải cảnh báo.' },
      ],
      positives: ['a', 'b', 'c', 'x'.repeat(301)],
      followUps: [{ type: 'TALK_TO_PARENT', text: '' }],
      limitations: 'y'.repeat(301),
    },
    WARNINGS,
  );

  assert.deepEqual(Object.keys(errors).sort(), [
    'content.attentionPoints.1.warningCode',
    'content.attentionPoints.2.warningCode',
    'content.followUps.0.text',
    'content.limitations',
    'content.overview',
    'content.positives',
    'content.positives.3',
  ]);
  assert.deepEqual(validateTrendContent({ overview: 'Tăng đều.' }, WARNINGS), {});
  assert.deepEqual(normalizeTrendContent({ overview: ' A ', limitations: ' ' }), {
    overview: 'A',
    attentionPoints: [],
    positives: [],
    followUps: [],
    limitations: null,
  });
  assert.equal(isTrendStale(['1', '2'], [2, 1]), false);
  assert.equal(isTrendStale(['1', '2'], ['1', '2', '3']), true);
});

test('HLT-21: bản giả lập — chưa có bản ⇒ null; phân tích ⇒ nháp có content, cảnh báo có mã; GET trả bản đó', async () => {
  assert.equal(await children.getLatestHealthTrend(CHILD, AN), null);

  const draft = await children.analyzeHealthTrend(CHILD, PRINCIPAL);

  assert.equal(draft.draft, true);
  assert.equal(draft.stale, false);
  assert.equal(draft.source, 'AI');
  assert.ok(draft.content.overview);
  assert.ok(draft.warnings.every((w) => w.code));
  assert.ok(draft.summary.startsWith('Tổng quan: '));
  const latest = await children.getLatestHealthTrend(CHILD, AN);
  assert.equal(latest.id, draft.id);
});

test('HLT-21: chỉ GV phụ trách lớp hiện tại của trẻ được duyệt; HT nhận 403', async () => {
  const draft = await children.analyzeHealthTrend(CHILD, PRINCIPAL);

  await assert.rejects(children.approveHealthTrend(CHILD, draft.id, null, PRINCIPAL), (err) => err.status === 403);
  const approved = await children.approveHealthTrend(CHILD, draft.id, null, AN);
  assert.equal(approved.draft, false);
  assert.equal(approved.source, 'AI');
  assert.equal(approved.approvedBy, AN.id);
});

test('AI-02: duyệt có sửa ⇒ source HUMAN, summary ghép lại; bản sửa sai ⇒ 400 kèm ô lỗi, không duyệt', async () => {
  const draft = await children.analyzeHealthTrend(CHILD, PRINCIPAL);

  await assert.rejects(
    children.approveHealthTrend(CHILD, draft.id, { ...draft.content, overview: '' }, AN),
    (err) => err.status === 400 && Object.hasOwn(err.details, 'content.overview'),
  );
  assert.equal((await children.getLatestHealthTrend(CHILD, AN)).draft, true);

  const approved = await children.approveHealthTrend(CHILD, draft.id, { ...draft.content, overview: ' Đã sửa tổng quan. ' }, AN);
  assert.equal(approved.source, 'HUMAN');
  assert.equal(approved.content.overview, 'Đã sửa tổng quan.');
  assert.ok(approved.summary.startsWith('Tổng quan: Đã sửa tổng quan.'));
});

test('HLT-21: có số đo công bố mới sau lần phân tích ⇒ bản mới nhất stale', async () => {
  await children.analyzeHealthTrend(CHILD, PRINCIPAL);
  writeDb((d) => {
    d.healthMeasurements.push({
      id: 'hm_trend_test',
      childId: CHILD,
      date: '2026-11-12',
      heightCm: 101,
      weightKg: 15.8,
      headCircumferenceCm: null,
      note: '',
      campaignId: null,
      measuredBy: 'u_an',
      published: true,
      publishedAt: '2026-11-12T09:00:00.000Z',
      createdAt: '2026-11-12T09:00:00.000Z',
    });
  });

  assert.equal((await children.getLatestHealthTrend(CHILD, AN)).stale, true);
});

test('HLT-21: khối hiển thị theo thứ tự cố định, bỏ khối rỗng, gợi ý kèm loại; bản cũ không có content ⇒ không có khối', () => {
  const blocks = trendBlocks({
    content: {
      overview: 'Tăng đều.',
      attentionPoints: [{ warningCode: 'WEIGHT_DROP', text: 'Giảm 0,5 kg.' }],
      positives: [],
      followUps: [{ type: 'TALK_TO_PARENT', text: 'Hỏi bữa ăn ở nhà.' }],
      limitations: null,
    },
  });

  assert.deepEqual(
    blocks.map((b) => b.title),
    ['Tổng quan', 'Cần chú ý', 'Gợi ý theo dõi'],
  );
  assert.deepEqual(blocks[1].items, [{ text: 'Giảm 0,5 kg.', code: 'WEIGHT_DROP' }]);
  assert.deepEqual(blocks[2].items, [{ text: 'Hỏi bữa ăn ở nhà.', type: 'TALK_TO_PARENT' }]);
  assert.deepEqual(trendBlocks({ summary: 'Bản cũ.', content: null }), []);
});

test('AI-02: form sửa — toEditable có key từng dòng, toPayload bỏ key, giữ mã cảnh báo, loại gợi ý và thứ tự dòng', () => {
  const content = {
    overview: 'Tăng đều.',
    attentionPoints: [{ warningCode: 'WEIGHT_DROP', text: 'Giảm 0,5 kg.' }],
    positives: ['Cao thêm.', 'Ăn tốt.'],
    followUps: [{ type: 'TALK_TO_PARENT', text: 'Hỏi bữa ăn.' }],
    limitations: null,
  };
  const form = toEditable(content);

  assert.ok(form.positives.every((p) => p.key));
  assert.notEqual(form.positives[0].key, form.positives[1].key);
  assert.equal(form.limitations, '');
  form.positives = form.positives.slice(1);
  assert.deepEqual(toPayload(form), { ...content, positives: ['Ăn tốt.'], limitations: '' });
});

test('HLT-21: nút Sửa, Duyệt chỉ cho GV đang phân công lớp hiện tại của trẻ; HT, GV lớp khác không thấy', () => {
  const child = { id: 'ch_x', status: 'ACTIVE', classId: 'cls_x' };
  const cls = { id: 'cls_x', teacherIds: ['u_an'] };

  assert.equal(canReviewHealthTrend(child, AN, cls), true);
  assert.equal(canReviewHealthTrend(child, { id: 'u_other', role: 'TEACHER' }, cls), false);
  assert.equal(canReviewHealthTrend(child, PRINCIPAL, cls), false);
});

test('HLT-21: mock — chỉ NORMAL ⇒ tổng quan mở đầu "Trẻ phát triển ổn định"; có cảnh báo ⇒ không dùng cụm này', async () => {
  const stableOf = (d) => d.content.overview.startsWith('Trẻ phát triển ổn định');
  const normalOnly = (d) => d.warnings.every((w) => w.code === 'NORMAL');
  const first = await children.analyzeHealthTrend(CHILD, PRINCIPAL);
  assert.equal(stableOf(first), normalOnly(first));

  writeDb((d) => {
    const last = d.healthMeasurements
      .filter((m) => m.childId === CHILD)
      .sort((a, b) => a.date.localeCompare(b.date))
      .at(-1);
    d.healthMeasurements.push({
      ...last,
      id: 'hm_drop',
      date: '2027-03-12',
      weightKg: last.weightKg - 1,
      publishedAt: '2027-03-12T09:00:00.000Z',
    });
  });
  const dropped = await children.analyzeHealthTrend(CHILD, PRINCIPAL);
  assert.ok(dropped.warnings.some((w) => w.code === 'WEIGHT_DROP'));
  assert.equal(dropped.content.overview.includes('phát triển ổn định'), false);
});
