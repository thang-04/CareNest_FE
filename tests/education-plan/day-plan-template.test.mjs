import assert from 'node:assert/strict';
import { test } from 'node:test';

// Spec 005: mẫu chung kế hoạch tuần + giáo án ngày cho cả hai trường
const cp = await import('@/models/education-plan/classPlan');
const { DEFAULT_WEEK_ROWS } = await import('@/models/education-plan/eduConfig');
const { dayPlansFileHtml, weekFileHtml } = await import('@/utils/education-plan/classPlanDoc');

const week = (over = {}) => ({
  ...cp.emptyWeekPlan({ classId: 'c1', yearPlanId: 'y1', weekStart: '2026-11-16', weekNo: 11, themeId: 't1' }),
  ...over,
});

test('FR-001–004: ngày mới có 4 mục cố định, mục học 3 dòng gợi ý không chữ cái, mục khác 1 dòng trống', () => {
  const d = cp.emptyDay('2026-11-16');
  assert.deepEqual(Object.keys(d.sections), ['hoc', 'ngoai_troi', 'goc', 'chieu']);
  assert.deepEqual(
    d.sections.hoc.rows.map((r) => r.title),
    ['Ổn định tổ chức, gây hứng thú', 'Nội dung trọng tâm', 'Kết thúc'],
  );
  assert.ok(d.sections.hoc.rows.every((r) => !/^[abc]\)/.test(r.title)));
  for (const k of ['ngoai_troi', 'goc', 'chieu']) assert.equal(d.sections[k].rows.length, 1);
  assert.deepEqual(d.review, { health: '', knowledge: '', attitude: '' });
});

test('FR-007, FR-013: bố cục cũ hiện ở mẫu mới không mất chữ', () => {
  const old = {
    date: '2026-11-16',
    aims: 'Mục đích chung',
    prep: 'Chuẩn bị chung',
    steps: {
      'hoc.a': { teacher: 'Hát', child: 'Trẻ hát', note: '' },
      'hoc.b': { teacher: 'Trọng tâm', child: 'Trẻ làm', note: 'Chú ý' },
      'hoc.c': { teacher: 'Nhận xét', child: '', note: '' },
      'ngoai_troi.x': { teacher: 'Quan sát sân', child: 'Trẻ quan sát', note: '' },
      'chieu.x': { teacher: 'Bài thơ', child: 'Đọc theo', note: '' },
    },
  };
  const d = cp.normalizeDay(old);
  assert.equal(d.sections.hoc.aims, 'Mục đích chung');
  assert.equal(d.sections.hoc.prep, 'Chuẩn bị chung');
  assert.deepEqual(
    d.sections.hoc.rows.map((r) => [r.title, r.teacher, r.note]),
    [
      ['Ổn định tổ chức, gây hứng thú', 'Hát', ''],
      ['Nội dung trọng tâm', 'Trọng tâm', 'Chú ý'],
      ['Kết thúc', 'Nhận xét', ''],
    ],
  );
  assert.equal(d.sections.ngoai_troi.rows[0].teacher, 'Quan sát sân');
  assert.equal(d.sections.chieu.rows[0].child, 'Đọc theo');
  assert.equal(d.steps, undefined);
  const w = cp.normalizeWeek({ prep: 'Tranh ảnh' });
  assert.deepEqual(w.prep, { teacher: 'Tranh ảnh', child: '', parent: '' });
  assert.deepEqual(w.corners, []);
});

test('FR-004, SC-006: đã xóa hết dòng gợi ý thì mở lại không tạo lại; đổi thứ tự giữ id', () => {
  const d = cp.emptyDay('2026-11-16');
  d.sections.hoc.rows = [];
  assert.deepEqual(cp.normalizeDay(d).sections.hoc.rows, []);
  const rows = [cp.emptyRow('A'), cp.emptyRow('B')];
  const again = cp.normalizeDay({ ...d, sections: { ...d.sections, hoc: { aims: '', prep: '', rows: [rows[1], rows[0]] } } });
  assert.deepEqual(
    again.sections.hoc.rows.map((r) => r.id),
    [rows[1].id, rows[0].id],
  );
});

test('FR-007a: mục chỉ có tên dòng gợi ý không tính có nội dung; ngày nghỉ bỏ qua', () => {
  const doc = week();
  doc.days.forEach((d) => {
    for (const k of ['hoc', 'ngoai_troi', 'chieu']) d.sections[k].aims = 'Có';
  });
  const weeks = [{ start: '2026-11-16', offDays: [null, null, null, null, 'Nghỉ lễ'] }];
  const empty = cp.emptyDaySections([doc], weeks);
  assert.deepEqual(
    empty.map((e) => `${e.date}:${e.section}`),
    ['2026-11-16:goc', '2026-11-17:goc', '2026-11-18:goc', '2026-11-19:goc'],
  );
  assert.equal(cp.sectionHasContent({ aims: '', prep: '', rows: [cp.emptyRow('Ổn định')] }), false);
  assert.equal(cp.sectionHasContent({ aims: '', prep: '', rows: [{ ...cp.emptyRow(), note: 'x' }] }), true);
});

test('FR-015, FR-015b: bảng góc sinh dòng Góc của bảng Thứ 2–6 và mục Góc của giáo án ngày', () => {
  const doc = week({
    corners: [
      { id: 'a', name: 'Góc phân vai', content: 'Bán hàng', aims: 'Nhận vai', prep: 'Quầy', steps: 'Gợi ý vai' },
      { id: 'b', name: 'Góc xây dựng', content: 'Xây nhà', aims: '', prep: '', steps: '' },
    ],
  });
  cp.cornersToGrid(doc);
  assert.equal(doc.grid.goc.common, 'Góc phân vai: Bán hàng\nGóc xây dựng: Xây nhà');
  assert.equal(doc.grid.goc.allWeek, true);
  const fw = cp.dayDraftFromWeek(doc, 2);
  assert.equal(fw.goc.aims, '- Góc phân vai: Nhận vai');
  assert.deepEqual(
    fw.goc.rows.map((r) => [r.title, r.teacher]),
    [
      ['Góc phân vai', 'Gợi ý vai'],
      ['Góc xây dựng', 'Xây nhà'],
    ],
  );
});

test('FR-015c: chép bảng góc tuần trước chỉ khi đang trống; MT khác chủ đề bị bỏ', () => {
  const prev = week({ corners: [{ id: 'p1', name: 'Góc học tập', content: 'Đếm', aims: '', prep: '', steps: '' }] });
  prev.picks = {
    'goc.all': [
      { id: 'act1', goalId: 'g1', goalNo: 1, text: 'x', cornerId: 'p1' },
      { id: 'act2', goalId: 'g9', goalNo: 9, text: 'y', cornerId: 'p1' },
    ],
  };
  const doc = cp.copyPrevCorners(week(), prev, new Set(['g1']));
  assert.equal(doc.corners.length, 1);
  assert.notEqual(doc.corners[0].id, 'p1');
  assert.deepEqual(
    doc.picks['goc.all'].map((p) => [p.goalId, p.cornerId]),
    [['g1', doc.corners[0].id]],
  );
  const kept = week({ corners: [{ id: 'k', name: 'Có sẵn' }] });
  assert.equal(cp.copyPrevCorners(kept, prev, new Set()).corners[0].id, 'k');
});

test('FR-015a: bộ dòng mặc định có "Ăn, ngủ" sau Ngoài trời, Góc trước Ngoài trời', () => {
  assert.deepEqual(
    DEFAULT_WEEK_ROWS.map((r) => r.key),
    ['don', 'tro_chuyen', 'the_duc', 'hoc', 'goc', 'ngoai_troi', 'an_ngu', 'chieu', 'tra_tre'],
  );
});

test('FR-006: dùng lại bài đã soạn chỉ điền dòng còn trống của mục học', () => {
  const doc = week();
  doc.days[0].sections.hoc.rows[0].teacher = 'Cô đã viết';
  cp.copyLessonSteps(doc, 0, [
    { title: 'Ổn định', teacher: 'Khác', child: 'Trẻ hát' },
    { title: 'Trọng tâm', teacher: 'Dạy', child: '' },
    { title: 'Kết thúc', teacher: 'Nhận xét', child: '' },
    { title: 'Thêm', teacher: 'Mở rộng', child: '' },
  ]);
  const rows = doc.days[0].sections.hoc.rows;
  assert.equal(rows[0].teacher, 'Cô đã viết');
  assert.equal(rows[0].child, 'Trẻ hát');
  assert.equal(rows[1].teacher, 'Dạy');
  assert.equal(rows.length, 4);
});

test('FR-016, FR-017, SC-001, SC-005: file giáo án ngày cả tuần theo mẫu, không còn ô điều chỉnh', () => {
  const doc = week({
    prep: { teacher: 'Tranh', child: 'Ảnh gia đình', parent: 'Trò chuyện' },
    corners: [{ id: 'a', name: 'Góc phân vai', content: 'Bán hàng', aims: '', prep: '', steps: '' }],
  });
  const html = dayPlansFileHtml({
    doc,
    week: { no: 11, start: '2026-11-16', end: '2026-11-20', offDays: [] },
    branchNo: 1,
    branchName: 'Gia đình',
    cls: { name: 'Chồi 1' },
  });
  const at = (s) => html.indexOf(s);
  assert.ok(at('Đối với cô') > 0 && at('Góc phân vai') > at('Đối với cô') && at('KẾ HOẠCH NGÀY') > at('Góc phân vai'));
  for (const s of [
    '1. Hoạt động học',
    '2. Hoạt động ngoài trời',
    '3. Hoạt động góc',
    '4. Hoạt động chiều',
    'a) Mục đích, yêu cầu',
    'b) Chuẩn bị',
    'c) Tiến hành',
    'II. Đánh giá trẻ trên ngày',
  ])
    assert.ok(html.includes(s), s);
  assert.equal((html.match(/I\. Giáo án/g) || []).length, 5);
  assert.ok(!html.includes('Kế hoạch điều chỉnh'));
  assert.ok(!html.includes('<th>Ghi chú</th>'));
  const weekHtml = weekFileHtml({
    doc,
    week: { no: 11, start: '2026-11-16', end: '2026-11-20', offDays: [] },
    branchNo: 1,
    branchName: 'Gia đình',
    cls: { name: 'Chồi 1' },
  });
  assert.ok(!weekHtml.includes('<h2>I. Mục đích, yêu cầu</h2>'));
  assert.ok(weekHtml.includes('I. Chuẩn bị'));
});
