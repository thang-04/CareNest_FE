import { test } from 'node:test';
import assert from 'node:assert/strict';
import { applyPicked, reviewLines } from '../../src/models/education-plan/aiThemeContent.mjs';
import { buildGroups, guessThemeMap, normalizeContent, previewCounts } from '../../src/models/education-plan/prevYearTicks.mjs';

// BE:EDU-104: dữ liệu dựng tay — lĩnh vực 1 có "Bé chào cô" ở 2 mục tiêu (trùng chữ), lĩnh vực 2 có cùng câu khác lĩnh vực
const form = () => ({
  themes: [
    { id: '11', name: 'Trường mầm non của bé' },
    { id: '12', name: 'Gia đình' },
    { id: '13', name: 'Thế giới động vật' },
  ],
  domains: [
    {
      id: 'd-1',
      rows: [
        { id: 'r1', kind: 'goal', contents: [{ id: '101', text: 'Bé chào cô.', themes: [] }, { id: '102', text: '  ', themes: [] }] },
        { id: 'r2', kind: 'goal', contents: [{ id: '103', text: 'bé  chào cô', themes: ['11'] }] },
      ],
    },
    { id: 'd-2', rows: [{ id: 'r3', kind: 'goal', contents: [{ id: '201', text: 'Hát: Cả nhà thương nhau', themes: [] }] }] },
  ],
});
const prev = {
  themes: [
    { id: 1, name: 'Trường mầm non' },
    { id: 2, name: 'gia đình' },
  ],
  ticks: [
    { domainId: 1, text: 'Bé chào cô', themeId: 1 },
    { domainId: 2, text: 'Bé chào cô', themeId: 1 },
    { domainId: 2, text: 'Hát: Cả nhà thương nhau!', themeId: 2 },
    { domainId: 1, text: 'Nội dung đã bỏ', themeId: 2 },
  ],
};

test('EDU-104: chuẩn hóa bỏ dấu, hoa thường, khoảng trắng, dấu câu cuối', () => {
  assert.equal(normalizeContent('  Bé  CHÀO cô. '), 'be chao co');
});

test('EDU-104: đoán chủ đề trùng tên → chứa nhau → không chọn', () => {
  assert.deepEqual(guessThemeMap(form().themes, prev.themes), { 11: '1', 12: '2', 13: '' });
});

test('EDU-104: ghép cùng lĩnh vực, trùng chữ áp nhiều id, bỏ cặp đã tick, đếm câu không khớp', () => {
  const { groups, unmatched } = buildGroups(form(), { 11: '1', 12: '2', 13: '' }, prev);
  const lines = reviewLines(groups);
  // "Bé chào cô" ở lĩnh vực 2 không có nội dung đó ⇒ không ghép sang lĩnh vực khác
  assert.deepEqual(
    lines.map((l) => [l.themeId, l.ids]),
    [
      ['11', ['101']],
      ['12', ['201']],
    ],
  );
  assert.equal(unmatched, 2);
  assert.deepEqual(previewCounts(groups).map((c) => c.count), [1, 1]);
  assert.equal(groups[0].sources[0].from, 'Trường mầm non');
});

test('EDU-104: áp dụng chỉ thêm tick, giữ tick cũ, bỏ nội dung trống', () => {
  const f = form();
  const { groups } = buildGroups(f, { 11: '1', 12: '2' }, prev);
  const { domains, added } = applyPicked(f, groups, new Set(reviewLines(groups).map((l) => l.key)));
  assert.equal(added, 2);
  const all = domains.flatMap((d) => d.rows.flatMap((r) => r.contents));
  assert.deepEqual(all.find((c) => c.id === '101').themes, ['11']);
  assert.deepEqual(all.find((c) => c.id === '102').themes, []);
  assert.deepEqual(all.find((c) => c.id === '103').themes, ['11']);
  assert.deepEqual(all.find((c) => c.id === '201').themes, ['12']);
});

test('EDU-104: không chọn chủ đề nào ⇒ không có gì để áp', () => {
  assert.deepEqual(buildGroups(form(), {}, prev), { groups: [], unmatched: 0 });
});
