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

test('FR-001–004: ngày mới có 4 mục cố định, mục học và ngoài trời có dòng gợi ý không chữ cái, mục khác 1 dòng trống', () => {
  const d = cp.emptyDay('2026-11-16');
  assert.deepEqual(Object.keys(d.sections), ['hoc', 'ngoai_troi', 'goc', 'chieu']);
  assert.deepEqual(
    d.sections.hoc.rows.map((r) => r.title),
    ['Ổn định tổ chức, gây hứng thú', 'Nội dung trọng tâm', 'Kết thúc'],
  );
  assert.ok(d.sections.hoc.rows.every((r) => !/^[abc]\)/.test(r.title)));
  // File "Chủ đề gia đình": buổi ngoài trời gồm hoạt động có mục đích, trò chơi vận động, chơi theo ý thích
  assert.deepEqual(
    d.sections.ngoai_troi.rows.map((r) => r.title),
    ['Hoạt động có mục đích', 'Trò chơi vận động', 'Chơi theo ý thích'],
  );
  for (const k of ['goc', 'chieu']) assert.equal(d.sections[k].rows.length, 1);
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
  // Mục góc của ngày theo file: mỗi góc "tên: nội dung"; mục đích, chuẩn bị, cách tiến hành ở bảng góc của tuần
  const fw = cp.dayDraftFromWeek(doc, 2);
  assert.equal(fw.goc.aims, '');
  assert.deepEqual(
    fw.goc.rows.map((r) => [r.title, r.teacher]),
    [
      ['Góc phân vai', 'Bán hàng'],
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
  assert.equal((html.match(/I\. Kế hoạch giáo dục ngày/g) || []).length, 5);
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

test('theo file "Chủ đề gia đình": giờ học tách hoạt động chính / kết hợp; ngoài trời 3 phần; buổi chiều là danh sách', () => {
  const doc = week();
  doc.grid.hoc.days[0] = { subject: 'Vận động', topic: 'Ném xa bằng 1 tay\nÂm nhạc\nMTXQ' };
  doc.grid.ngoai_troi = {
    allWeek: false,
    common: '',
    days: ['Trò chuyện về gia đình trẻ\nTCVĐ: Tìm người láng giềng', '', '', '', ''],
    extra: 'Chơi với đồ chơi ngoài trời',
  };
  doc.grid.chieu = {
    allWeek: false,
    common: '',
    days: ['Ôn: ném xa bằng 1 tay\nLQ: trò chuyện về ngôi nhà của bé', '', '', '', ''],
    extra: '',
  };
  const fw = cp.dayDraftFromWeek(doc, 0);
  assert.equal(fw.hoc.main, 'Vận động: Ném xa bằng 1 tay');
  assert.equal(fw.hoc.combined, 'Âm nhạc; MTXQ');
  assert.deepEqual(
    fw.ngoai_troi.rows.map((r) => [r.title, r.teacher]),
    [
      ['Hoạt động có mục đích', 'Trò chuyện về gia đình trẻ'],
      ['Trò chơi vận động', 'TCVĐ: Tìm người láng giềng'],
      ['Chơi theo ý thích', 'Chơi với đồ chơi ngoài trời'],
    ],
  );
  assert.deepEqual(fw.chieu.rows, [{ title: '', teacher: '- Ôn: ném xa bằng 1 tay\n- LQ: trò chuyện về ngôi nhà của bé' }]);
});

test('bảng tháng giữ tuần trống, gộp theo mã nhánh và tách tại tháng mới', () => {
  const a = { id: 1, name: 'Gia đình' };
  const b = { id: 2, name: 'Nghề nghiệp' };
  const rows = [
    { type: 'week', start: '2026-11-02', end: '2026-11-06', theme: a },
    { type: 'break', start: '2026-11-09', end: '2026-11-13', theme: a },
    { type: 'week', start: '2026-11-16', end: '2026-11-20', theme: a },
    { type: 'week', start: '2026-11-23', end: '2026-11-27', theme: b },
    { type: 'week', start: '2026-12-07', end: '2026-12-11', theme: b },
  ];
  rows.push({ type: 'week', start: '2026-11-30', end: '2026-12-04', theme: b });
  const branches = [{ key: 'b1', themeId: 2, startDate: '2026-11-23', endDate: '2026-12-11', name: 'Nghề của bé' }];
  const g = cp.branchGrid(rows, { '2026-11-02': 'Bé và gia đình' }, branches);
  assert.deepEqual(
    g.months.map((m) => m.month),
    ['2026-11', '2026-12'],
  );
  const november = g.months[0].cells;
  assert.equal(november[1].week, undefined);
  assert.equal(november[3].span, 2);
  assert.equal(november[3].end, '2026-12-04');
  assert.equal(g.months[1].cells[0].span, 1);
  assert.equal(g.months[1].cells[0].name, 'Nghề của bé');
  assert.equal(
    november.reduce((n, c) => n + c.span, 0),
    5,
  );
});

test('phần a/b/c của một mục xóa tay được và thêm lại được', () => {
  const sec = { aims: 'x', prep: 'y', rows: [{ id: 'r', title: '', teacher: 't', child: '', note: '' }] };
  const cut = cp.removePart(cp.removePart(sec, 'aims'), 'rows');
  assert.deepEqual([cut.aims, cut.rows, cut.off], ['', [], ['aims', 'rows']]);
  assert.deepEqual(cp.partsOff({ off: ['aims', 'khac'] }), ['aims']);
  const back = cp.restorePart(cut, 'rows');
  assert.deepEqual(back.off, ['aims']);
  assert.equal(back.rows.length, 1);
  const day = cp.normalizeDay({ date: '2026-11-09', sections: { goc: cut } });
  assert.deepEqual(day.sections.goc.off, ['aims', 'rows']);
});

test('khôi phục mặc định cấu hình: mọi phần về mặc định, giữ số phiên bản và cờ quyền', async () => {
  const { resetEduConfig, DEFAULT_WORKFLOW_POLICY } = await import('@/models/education-plan/eduConfig');
  const cfg = {
    canConfigure: true,
    workflowRevision: 7,
    domainLabels: { 'Phát triển thể chất': 'Thể chất' },
    extraDomains: ['Lĩnh vực mới'],
    workflowPolicy: { ...DEFAULT_WORKFLOW_POLICY, year: { creators: ['TEAM_LEADER'], reviewers: ['PRINCIPAL'] } },
    durationPolicy: { revision: 3, theme: { minWeeks: 1, maxWeeks: 9 }, branch: { minWeeks: 1, maxWeeks: 5 } },
    weekRows: [{ key: 'hoc', label: 'Giờ học' }],
  };
  const out = resetEduConfig(cfg);
  assert.deepEqual(out.extraDomains, []);
  assert.deepEqual(out.workflowPolicy, DEFAULT_WORKFLOW_POLICY);
  assert.deepEqual(out.durationPolicy, { revision: 3, theme: { minWeeks: 2, maxWeeks: 4 }, branch: { minWeeks: 1, maxWeeks: 2 } });
  assert.deepEqual(out.weekRows, DEFAULT_WEEK_ROWS);
  assert.equal(out.domainLabels['Phát triển thể chất'], undefined);
  assert.deepEqual([out.canConfigure, out.workflowRevision], [true, 7]);
});
