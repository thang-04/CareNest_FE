import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  applyPicked,
  filterDomains,
  groupMatches,
  mergeFiltered,
  reviewLines,
  themeCount,
} from '../../src/models/education-plan/aiThemeContent.mjs';

// BE:EDU-103: dữ liệu dựng tay — 2 chủ đề, nội dung "Đèn ông sao" có ở 2 mục tiêu khác nhau (trùng chữ)
const form = () => ({
  themes: [
    { id: '1', name: 'Trường mầm non' },
    { id: '2', name: 'Tết Trung thu' },
  ],
  domains: [
    {
      id: 'd-1',
      name: 'Thể chất',
      rows: [
        { id: 's1', kind: 'sub', text: 'Vận động' },
        {
          id: 'g1',
          kind: 'goal',
          text: 'MT1',
          contents: [
            { id: '11', text: 'Đi theo đường hẹp', themes: ['1'] },
            { id: '12', text: 'Đèn ông sao', themes: [] },
            { id: '13', text: '   ', themes: [] },
          ],
        },
        { id: 's2', kind: 'sub', text: 'Dinh dưỡng' },
        { id: 'g2', kind: 'goal', text: 'MT2', contents: [{ id: '21', text: 'đèn ông  sao', themes: [] }] },
      ],
    },
  ],
});

test('gom theo chủ đề → căn cứ, bỏ cặp đã tick, nội dung trống và id lạ', () => {
  const groups = groupMatches(form(), [
    { themeId: 2, contentId: 12, from: 'Tết Trung thu' },
    { themeId: 1, contentId: 11, from: 'Trường mầm non' },
    { themeId: 1, contentId: 13, from: 'Trường mầm non' },
    { themeId: 9, contentId: 12, from: 'lạ' },
    { themeId: 1, contentId: 99, from: 'lạ' },
    { themeId: 1, contentId: 12, from: 'trường mầm non' },
  ]);
  assert.deepEqual(
    groups.map((g) => [g.themeId, g.sources.map((s) => s.from)]),
    [
      ['1', ['trường mầm non']],
      ['2', ['Tết Trung thu']],
    ],
  );
  assert.deepEqual(
    groups[0].sources[0].lines.map((l) => l.text),
    ['Đèn ông sao'],
  );
});

test('nội dung trùng chữ thành một dòng, áp cho mọi id cùng chữ', () => {
  const groups = groupMatches(form(), [
    { themeId: 2, contentId: 12, from: 'Tết Trung thu' },
    { themeId: 2, contentId: 21, from: 'Tết Trung thu' },
  ]);
  const lines = reviewLines(groups);
  assert.equal(lines.length, 1);
  assert.deepEqual(lines[0].ids, ['12', '21']);
  const picked = new Set([lines[0].key]);
  assert.equal(themeCount(form(), 'Đèn ông sao', groups, picked), 1);
  const { domains, added } = applyPicked(form(), groups, picked);
  assert.equal(added, 2);
  assert.deepEqual(domains[0].rows[1].contents[1].themes, ['2']);
  assert.deepEqual(domains[0].rows[3].contents[0].themes, ['2']);
});

test('áp dụng chỉ thêm tick, giữ tick có sẵn, dòng bỏ chọn không áp', () => {
  const groups = groupMatches(form(), [
    { themeId: 2, contentId: 11, from: 'Tết Trung thu' },
    { themeId: 1, contentId: 12, from: 'Trường mầm non' },
  ]);
  const [keep] = reviewLines(groups).filter((l) => l.themeId === '2');
  assert.equal(themeCount(form(), 'Đi theo đường hẹp', groups, new Set([keep.key])), 2);
  const { domains, added } = applyPicked(form(), groups, new Set([keep.key]));
  assert.equal(added, 1);
  assert.deepEqual(domains[0].rows[1].contents[0].themes, ['1', '2']);
  assert.deepEqual(domains[0].rows[1].contents[1].themes, []);
});

test('lọc theo chữ không dấu, không phân biệt hoa thường; bỏ lĩnh vực con không còn mục tiêu', () => {
  const view = filterDomains(form().domains, 'DUONG HEP', false);
  const rows = view[0].rows;
  assert.deepEqual(
    rows.map((r) => r.id),
    ['s1', 'g1'],
  );
  assert.deepEqual(
    rows[1].contents.map((c) => c.id),
    ['11'],
  );
  assert.equal(filterDomains(form().domains, '', false), null);
});

test('lọc "Chưa thuộc chủ đề nào" và ghi thay đổi trên bản lọc về form đầy đủ', () => {
  const full = form().domains;
  const view = filterDomains(full, '', true);
  assert.deepEqual(
    view[0].rows.filter((r) => r.kind === 'goal').flatMap((r) => r.contents.map((c) => c.id)),
    ['12', '13', '21'],
  );
  const next = view.map((d) => ({
    ...d,
    rows: d.rows.map((r) => (r.id === 'g1' ? { ...r, contents: r.contents.map((c) => (c.id === '12' ? { ...c, themes: ['2'] } : c)) } : r)),
  }));
  const merged = mergeFiltered(full, view, next);
  assert.deepEqual(
    merged[0].rows[1].contents.map((c) => [c.id, c.themes]),
    [
      ['11', ['1']],
      ['12', ['2']],
      ['13', []],
    ],
  );
  assert.equal(merged[0].rows[3].contents.length, 1);
});
