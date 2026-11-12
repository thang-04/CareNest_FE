import assert from 'node:assert/strict';
import { test } from 'node:test';

// Spec 006: thẻ hoạt động gắn MT (BE:EDU-78), bảng phủ MT, bản tuần theo hồ sơ chủ đề (EDU-79)
const cp = await import('@/models/education-plan/classPlan');
const { themeFileHtml } = await import('@/utils/education-plan/classPlanDoc');

const blocks = [
  {
    domain: 'Phát triển thể chất',
    sub: null,
    goals: [
      { id: '3', no: 3, text: 'Trẻ đi bước lùi', contents: ['Đi bước lùi', 'Bò chui'] },
      { id: '23', no: 23, text: 'Trẻ biết luật giao thông', contents: ['Tín hiệu đèn giao thông'] },
    ],
  },
];

// Kết quả của bản tách cũ (themeActivities trước spec 006) trên cùng dữ liệu: [id, goalId, text, loại giờ đầu tiên]
const LEGACY = [
  {
    rows: { 3: { activities: '- HĐ học: Đi bước lùi\n- Trò chuyện về đôi chân' } },
    expect: [
      ['3#0', '3', 'HĐ học: Đi bước lùi', 'hoc'],
      ['3#1', '3', 'Trò chuyện về đôi chân', 'tro_chuyen'],
    ],
  },
  {
    rows: { 3: { activities: 'Hoạt động góc:\n+ Xây nhà\n+ Bán hàng\nKể chuyện bé nghe' } },
    expect: [
      ['3#0', '3', 'Hoạt động góc: Xây nhà', 'goc'],
      ['3#1', '3', 'Hoạt động góc: Bán hàng', 'goc'],
      ['3#2', '3', 'Kể chuyện bé nghe', ''],
    ],
  },
  {
    rows: { 3: { activities: '- HĐ học:\u00a0' }, 23: { activities: '\ufeff+ Đèn đỏ:' }, 99: { activities: 'HĐ học: ngoài chủ đề' } },
    expect: [['23#0', '23', 'Đèn đỏ:', '']],
  },
];

test('FR-006: normalizeTheme ra cùng danh sách hoạt động như cách tách cũ (id, MT, chữ, loại giờ)', () => {
  LEGACY.forEach(({ rows, expect }) => {
    const cards = cp.normalizeTheme({ rows }, ['3', '23']);
    assert.deepEqual(
      cards.map((c) => [c.id, c.goalIds[0], c.name, c.slot]),
      expect,
    );
    assert.ok(cards.every((c) => c.legacy));
    // themeActivities (lớp bọc) giữ id và chữ cũ để lượt xếp, học liệu cũ trỏ đúng
    assert.deepEqual(
      cp.themeActivities(blocks, { rows }).map((a) => [a.id, a.goalId, a.text]),
      expect.map(([id, g, t]) => [id, g, t]),
    );
  });
  const saved = { activities: [{ id: 'c-1', slot: 'hoc', name: 'X', goalIds: ['3'] }], rows: LEGACY[0].rows };
  assert.equal(cp.normalizeTheme(saved), saved.activities);
});

test('R3: resolveGoals theo thẻ, rồi bản chụp goalIds, rồi goalId cũ; gõ tay không có MT', () => {
  const cards = [{ id: 'c-1', goalIds: ['3', '23'] }];
  assert.deepEqual(cp.resolveGoals({ cardId: 'c-1', goalIds: ['9'] }, cards), ['3', '23']);
  assert.deepEqual(cp.resolveGoals({ cardId: 'gone', goalIds: ['9'] }, cards), ['9']);
  assert.deepEqual(cp.resolveGoals({ id: '3#0', goalId: '3' }, cards), ['3']);
  assert.deepEqual(cp.resolveGoals({ text: 'gõ tay' }, cards), []);
});

const week = (start = '2026-11-16') => cp.emptyWeekPlan({ classId: 'c', yearPlanId: 'p', weekStart: start, themeId: 't' });

test('FR-024, FR-021, FR-026: MT trong ngày = hợp MT của thẻ nhiều MT; ô gộp cả tuần và bảng góc tính mọi ngày', () => {
  const cards = [
    { id: 'c-1', slot: 'hoc', name: 'Bật xa', goalIds: ['3', '23'] },
    { id: 'c-2', slot: 'goc', name: 'Bán hàng', goalIds: ['5'] },
  ];
  const doc = week();
  doc.picks = { 'hoc.4': [{ cardId: 'c-1', goalIds: ['3'] }], 'goc.all': [{ cardId: 'c-2', cornerId: 'g1' }] };
  const days = cp.dayGoalsOf(doc, cards);
  assert.deepEqual(days[4].sort(), ['23', '3', '5']);
  assert.deepEqual(days[0], ['5']);
  // Lượt gõ tay (không thẻ) không thêm MT nào
  doc.picks['hoc.0'] = [{ text: 'Gõ tay' }];
  assert.deepEqual(cp.dayGoalsOf(doc, cards)[0], ['5']);
});

test('US1 FR-002, FR-008: thẻ nhiều MT là một bản ghi, in ở mọi MT dạng "Loại giờ: tên"', () => {
  const card = cp.newCard({ slot: 'tro_chuyen', name: 'Trò chuyện về ATGT', goalIds: ['3', '23'] });
  assert.match(card.id, /^c-/);
  const doc = { rows: {}, activities: [card], envIn: '', envOut: '' };
  const tree = cp.themeTree(blocks, doc.activities);
  assert.equal(tree[0].cards[0], tree[1].cards[0]);
  // Sửa tên ở một chỗ ⇒ mọi MT thấy tên mới
  doc.activities = doc.activities.map((c) => ({ ...c, name: 'Trò chuyện về đèn giao thông' }));
  const html = themeFileHtml({
    themeDoc: doc,
    theme: { name: 'Giao thông', start: '2026-11-16', end: '2026-11-20' },
    themeNo: 1,
    cls: { name: 'A1' },
    weeks: [],
    blocks,
    rowOf: () => ({ contents: '', activities: '' }),
    weekDocs: [],
  });
  assert.equal(html.split('Trò chuyện: Trò chuyện về đèn giao thông').length - 1, 2);
});

test('FR-004: dạng cây — nội dung chưa có thẻ vàng, MT chưa có thẻ đỏ, thẻ không gắn nội dung ở nhánh riêng', () => {
  const cards = [
    { id: 'a', slot: 'hoc', name: 'Đi lùi', goalIds: ['3'], contentRefs: ['3:0'] },
    { id: 'b', slot: 'hoc', name: 'Chơi', goalIds: ['3'], contentRefs: [] },
  ];
  const [mt3, mt23] = cp.themeTree(blocks, cards);
  assert.equal(mt3.warn, null);
  assert.deepEqual(
    mt3.contents.map((c) => [c.cards.map((x) => x.id), c.warn]),
    [
      [['a'], null],
      [[], 'yellow'],
    ],
  );
  assert.deepEqual(
    mt3.unlinkedCards.map((c) => c.id),
    ['b'],
  );
  assert.equal(mt23.warn, 'red');
});

test('FR-009, FR-013, FR-022: bảng phủ đếm lượt dạy theo tuần/thứ, bỏ ngày nghỉ, liệt kê ô gõ tay chưa MT', () => {
  const goals = blocks[0].goals;
  const cards = [{ id: 'bx', slot: 'hoc', name: 'Bật xa', goalIds: ['3'] }];
  const w1 = week('2026-11-16');
  w1.picks = { 'hoc.4': [{ cardId: 'bx' }] };
  const w2 = week('2026-11-23');
  w2.picks = { 'hoc.0': [{ cardId: 'bx' }], 'hoc.2': [{ cardId: 'bx' }] };
  w2.grid.chieu.days[1] = 'Gõ tay không thẻ';
  const cov = cp.coverageOf(goals, cards, [
    { start: w1.weekStart, offDays: [], doc: w1 },
    { start: w2.weekStart, offDays: [null, null, 'Lễ', null, null], doc: w2 },
  ]);
  const mt3 = cov.rows.find((r) => r.goal.id === '3');
  assert.deepEqual(mt3.weeks, { '2026-11-16': [4], '2026-11-23': [0] });
  assert.equal(mt3.count, 2);
  assert.equal(cov.rows.find((r) => r.goal.id === '23').count, 0);
  assert.deepEqual([cov.covered, cov.total], [1, 2]);
  assert.deepEqual(
    cov.missing.map((g) => g.no),
    [23],
  );
  assert.deepEqual(
    cov.unlinked.map((u) => [u.weekStart, u.day, u.rowKey]),
    [['2026-11-23', '1', 'chieu']],
  );
});

test('FR-017: weekDiff đánh dấu đúng ô khác bản theo kỳ', () => {
  const a = week();
  const b = structuredClone(a);
  b.grid.hoc.days[1].topic = 'Đổi đề tài';
  b.picks = { 'tro_chuyen.all': [{ cardId: 'x' }] };
  assert.deepEqual(cp.weekDiff(a, b).sort(), ['hoc.1', 'tro_chuyen.all']);
  assert.deepEqual(cp.weekDiff(a, structuredClone(a)), []);
});

test('FR-025, FR-027: ô a) điền sẵn câu MT một lần khi trống; thẻ bị bỏ khỏi ô tuần thì báo đã đổi', () => {
  const goals = blocks[0].goals;
  const cards = [{ id: 'bx', slot: 'hoc', name: 'Bật xa', goalIds: ['3', '23'] }];
  const doc = week();
  doc.picks = { 'hoc.0': [{ cardId: 'bx' }] };
  const fw = cp.dayDraftFromWeek(doc, 0, goals, cards);
  assert.equal(fw.hoc.aims, '- MT3: Trẻ đi bước lùi\n- MT23: Trẻ biết luật giao thông');
  const day = cp.normalizeDay(doc.days[0]);
  assert.equal(cp.prefillDayAims(day, fw), true);
  assert.equal(day.sections.hoc.aims, fw.hoc.aims);
  // Cô xóa ô a) rồi lưu: không tự điền lại
  day.sections.hoc.aims = '';
  assert.equal(cp.prefillDayAims(day, fw), false);
  cp.markDayBasis(day, fw);
  doc.picks = {};
  assert.deepEqual(cp.droppedFromWeek(day, cp.dayDraftFromWeek(doc, 0, goals, cards)), ['hoc']);
});

test('FR-010, FR-019: gợi ý ô tuần — thẻ đúng loại giờ trước, thẻ khác và "chưa rõ" ở nhóm Khác', () => {
  const acts = cp.themeActivities(blocks, {
    activities: [
      { id: 'a', slot: 'goc', name: 'Góc', goalIds: ['3'] },
      { id: 'b', slot: 'hoc', name: 'Âm nhạc: Dạy hát', goalIds: ['3'] },
      { id: 'c', slot: '', name: 'Cũ', goalIds: ['3'], legacy: true },
    ],
  });
  const list = cp.activitiesForRow(acts, 'hoc');
  assert.deepEqual(
    list.map((a) => [a.id, !!a.other]),
    [
      ['b', false],
      ['a', true],
      ['c', true],
    ],
  );
  // FR-020: tên "Môn: đề tài" giữ được phần Môn sau khi bỏ loại giờ
  assert.equal(cp.activityBody(list[0].text), 'Âm nhạc: Dạy hát');
});

test('FR-006, US3-AC5: bản cũ (thẻ do server dựng từ ô chữ) in nguyên ô chữ như trước', () => {
  const rows = { 3: { contents: '', activities: 'HĐ học:\n+ Đi bước lùi' } };
  const doc = { rows, activities: cp.normalizeTheme({ rows }), envIn: '', envOut: '' };
  const html = themeFileHtml({
    themeDoc: doc,
    theme: { name: 'Bản thân', start: '2026-09-07', end: '2026-09-11' },
    themeNo: 1,
    cls: { name: 'A1' },
    weeks: [],
    blocks,
    rowOf: (g) => doc.rows[g.id] || { contents: '', activities: '' },
    weekDocs: [],
  });
  assert.match(html, /\+ Đi bước lùi/);
  assert.doesNotMatch(html, /- HĐ học: Đi bước lùi/);
});
