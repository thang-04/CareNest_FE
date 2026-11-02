import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mergeFileGoals, missingThemeAbbrs, previewSummary } from '../../src/models/education-plan/importGoalFile.mjs';
import { mergeImportedGoals } from '../../src/models/education-plan/importGoals.mjs';

// BE:EDU-46 — ghép bản xem trước của file vào bản đang soạn
const NAME = 'Phát triển thể chất';
const ids = () => {
  let n = 0;
  return () => `n${++n}`;
};
const form = (
  rows,
  themes = [
    { id: 't1', abbr: 'TMN' },
    { id: 't2', abbr: 'BT' },
  ],
) => ({
  domains: [{ id: 'd1', name: NAME, rows }],
  themes,
});
const preview = (rows) => ({ domains: [{ name: NAME, rows }], themeAbbrs: ['TMN', 'BT', 'XYZ'], warnings: [] });

test('thêm mục tiêu, nội dung và dấu tích khớp viết tắt (không phân biệt hoa thường)', () => {
  const { domains, report } = mergeFileGoals(
    form([]),
    preview([
      { kind: 'sub', text: 'Vận động' },
      {
        kind: 'goal',
        text: 'Trẻ khỏe',
        contents: [
          { text: 'Ăn uống', themes: ['tmn', 'XYZ'] },
          { text: 'Vệ sinh', themes: ['BT'] },
        ],
      },
    ]),
    ids(),
  );
  const rows = domains[0].rows;
  assert.deepEqual(
    rows.map((r) => [r.kind, r.text]),
    [
      ['sub', 'Vận động'],
      ['goal', 'Trẻ khỏe'],
    ],
  );
  assert.deepEqual(
    rows[1].contents.map((c) => [c.text, c.themes]),
    [
      ['Ăn uống', ['t1']],
      ['Vệ sinh', ['t2']],
    ],
  );
  assert.equal(report.added, 1);
  assert.equal(report.ticks, 2);
  assert.deepEqual(report.missingThemes, ['XYZ']);
});

test('mục tiêu trùng câu được bỏ qua, dữ liệu đang có giữ nguyên', () => {
  const existing = { id: 'g1', kind: 'goal', text: 'Trẻ khỏe', contents: [{ id: 'c1', text: 'Cũ', themes: ['t2'] }] };
  const { domains, report } = mergeFileGoals(
    form([existing]),
    preview([
      { kind: 'goal', text: 'Trẻ khỏe', contents: [{ text: 'Mới', themes: ['TMN'] }] },
      { kind: 'goal', text: 'Trẻ vui', contents: [] },
    ]),
    ids(),
  );
  assert.equal(report.duplicates, 1);
  assert.equal(report.added, 1);
  assert.deepEqual(domains[0].rows[0], existing);
  assert.deepEqual(
    domains[0].rows.map((r) => r.text),
    ['Trẻ khỏe', 'Trẻ vui'],
  );
});

test('lĩnh vực không có trong bản đang soạn: không thêm, báo chưa thêm được', () => {
  const { domains, report } = mergeFileGoals(
    form([]),
    { domains: [{ name: 'Lĩnh vực lạ', rows: [{ kind: 'goal', text: 'X', contents: [] }] }] },
    ids(),
  );
  assert.equal(report.added, 0);
  assert.equal(report.unavailable.length, 1);
  assert.deepEqual(domains[0].rows, []);
});

test('xem trước đếm theo lĩnh vực; viết tắt chưa có liệt kê một lần', () => {
  const p = preview([
    {
      kind: 'goal',
      text: 'A',
      contents: [
        { text: 'a1', themes: ['TMN', 'BT'] },
        { text: 'a2', themes: ['XYZ'] },
      ],
    },
    { kind: 'group', text: 'Nhóm' },
    { kind: 'goal', text: 'B', contents: [{ text: 'b1', themes: ['xyz'] }] },
  ]);
  assert.deepEqual(previewSummary(p), [{ name: NAME, goals: 2, contents: 3, ticks: 4 }]);
  assert.deepEqual(missingThemeAbbrs(p, form([]).themes), ['XYZ']);
});

test('lấy từ kế hoạch có sẵn (EDU-24) vẫn bỏ dấu tích như cũ', () => {
  const source = {
    domains: [{ id: 's', name: NAME, rows: [{ id: 'g', kind: 'goal', text: 'A', contents: [{ id: 'c', text: 'a', themes: ['t1'] }] }] }],
  };
  const { domains } = mergeImportedGoals(form([]), source, ['g'], ids());
  assert.deepEqual(domains[0].rows[0].contents[0].themes, []);
});

test('mục tiêu trong file không ghi lĩnh vực con/nhóm: thêm cuối lĩnh vực đích có lĩnh vực con', () => {
  const target = form([
    { id: 's', kind: 'sub', text: 'Con' },
    { id: 'gr', kind: 'group', text: 'Nhóm' },
    { id: 'g', kind: 'goal', text: 'Cũ', contents: [] },
  ]);
  const { domains, report } = mergeFileGoals(
    target,
    preview([{ kind: 'goal', text: 'Mới', contents: [{ text: 'n', themes: ['TMN'] }] }]),
    ids(),
  );
  assert.equal(report.added, 1);
  assert.deepEqual(
    domains[0].rows.map((r) => r.text),
    ['Con', 'Nhóm', 'Cũ', 'Mới'],
  );
});
