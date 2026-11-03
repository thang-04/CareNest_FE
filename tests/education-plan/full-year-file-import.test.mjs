import assert from 'node:assert/strict';
import { test } from 'node:test';
import * as imports from '../../src/models/education-plan/importGoalFile.mjs';
const base = () => ({
  title: 'Tên nhập tay',
  description: 'Mô tả cũ',
  ageGroupId: 'ag-3',
  schoolYear: '2026 – 2027',
  domains: [
    {
      id: 'd',
      name: 'Phát triển thể chất',
      rows: [
        { id: 'old', kind: 'goal', text: 'Cũ', lineageId: 'origin', contents: [{ id: 'old-c', text: 'Nội dung cũ', themes: ['manual'] }] },
      ],
    },
  ],
  themes: [
    { id: 'manual', name: 'Tự nhập', abbr: 'TAY', start: '', end: '' },
    { id: 'blank', name: '', abbr: '' },
  ],
  breaks: [{ id: 'blank-break', label: '' }],
});
const file = () => ({
  metadata: { title: 'Tên file', schoolYear: '2025-2026', ageFromMonths: 36, ageToMonths: 48 },
  themes: [{ name: 'Trường mầm non', abbr: 'MN', festivals: 'Ngày hội', start: '2025-09-08', end: '2025-09-26', note: '' }],
  breaks: [{ name: 'Nghỉ tết', start: '2026-02-16', end: '2026-02-20' }],
  domains: [{ name: 'Phát triển thể chất', rows: [{ kind: 'goal', text: 'Mới', contents: [{ text: 'Nội dung mới', themes: ['MN'] }] }] }],
  themeAbbrs: ['MN'],
  warnings: [],
});
const ids = () => {
  let n = 0;
  return () => `new-${++n}`;
};

const range = { start: '2026-09-01', end: '2027-05-31' };
const apply = (form, preview, options = {}, makeId = ids()) =>
  imports.mergeFilePlan(form, preview, makeId, { yearRange: range, ...options });

test('full thay toàn bộ phần editable, giữ fixed fields và không mutate form/file', () => {
  const target = {
    ...base(),
    id: 'plan',
    owner: { id: 'owner' },
    status: 'EDITING',
    revision: 7,
    versionNo: 2,
    history: [{ action: 'old' }],
  };
  const preview = file(),
    before = structuredClone({ target, preview });
  const { patch, report, error } = apply(target, preview);
  assert.equal(error, '');
  assert.equal(patch.title, 'Tên file');
  assert.equal(patch.description, '');
  assert.equal(patch.themes.length, 1);
  assert.equal(patch.breaks.length, 1);
  // Giữ ngày như file (Tiền 04/11); bảng chủ đề gợi ý dời ngày sau khi áp dụng
  assert.equal(patch.themes[0].start, '2025-09-08');
  assert.equal(patch.breaks[0].start, '2026-02-16');
  assert.deepEqual(
    patch.domains[0].rows.filter((r) => r.kind === 'goal').map((r) => r.text),
    ['Mới'],
  );
  assert.deepEqual(patch.domains[0].rows[0].contents[0].themes, [patch.themes[0].id]);
  for (const key of [
    'id',
    'owner',
    'status',
    'revision',
    'versionNo',
    'history',
    'schoolYear',
    'ageGroupId',
    'scope',
    'startDate',
    'endDate',
  ])
    assert.equal(patch[key], undefined, key);
  assert.equal(report.added, 1);
  assert.deepEqual({ target, preview }, before);
});

test('full file chỉ mục tiêu xóa lịch/mô tả/title thiếu, present giữ phần thiếu nhưng thay nguyên cây', () => {
  const target = base();
  target.themes = [{ id: 'manual', name: 'Tay', abbr: 'MN' }];
  const preview = { domains: file().domains };
  const full = apply(target, preview),
    present = apply(target, preview, { mode: 'replace-present' });
  assert.equal(full.error, '');
  assert.equal(present.error, '');
  assert.deepEqual(full.patch.themes, []);
  assert.deepEqual(full.patch.breaks, []);
  assert.equal(full.patch.title, '');
  assert.equal(full.patch.description, '');
  assert.deepEqual(full.patch.domains[0].rows[0].contents[0].themes, []);
  assert.deepEqual(full.report.missingThemes, ['MN']);
  assert.deepEqual(present.patch.themes, target.themes);
  assert.deepEqual(present.patch.breaks, target.breaks);
  assert.equal(present.patch.title, target.title);
  assert.equal(present.patch.description, target.description);
  assert.deepEqual(
    present.patch.domains[0].rows.map((r) => r.text),
    ['Mới'],
  );
  assert.deepEqual(present.patch.domains[0].rows[0].contents[0].themes, ['manual']);
});

test('present thay title hoặc lịch riêng, phần thiếu giữ nguyên', () => {
  const target = base();
  const result = apply(target, { metadata: { title: 'Đổi tên' } }, { mode: 'replace-present' });
  assert.equal(result.error, '');
  assert.equal(result.patch.title, 'Đổi tên');
  for (const key of ['domains', 'themes', 'breaks', 'description']) assert.deepEqual(result.patch[key], target[key]);
  const onlyBreak = apply(target, { breaks: file().breaks }, { mode: 'replace-present' });
  assert.equal(onlyBreak.patch.breaks.length, 1);
  assert.deepEqual(onlyBreak.patch.domains, target.domains);
});

test('present giữ mục tiêu khi thay chủ đề: remap mã duy nhất, bỏ tick không còn đích và báo', () => {
  const target = base();
  target.themes = [
    { id: 'manual', name: 'Tay', abbr: 'mn' },
    { id: 'gone', name: 'Bỏ', abbr: 'OLD' },
  ];
  target.domains[0].rows[0].contents[0].themes = ['manual', 'gone'];
  const result = apply(target, { themes: file().themes }, { mode: 'replace-present' });
  assert.equal(result.error, '');
  assert.equal(result.patch.domains[0].rows[0].id, 'old');
  assert.deepEqual(result.patch.domains[0].rows[0].contents[0].themes, [result.patch.themes[0].id]);
  assert.equal(result.report.removedTicks, 1);
  assert.ok(result.report.warnings.some((w) => w.message.includes('dấu tích')));
});

test('tên/mã tay cũ không giữ lại hay gây mơ hồ khi thay chủ đề từ file', () => {
  const target = base();
  target.themes = [
    { id: 'a', name: 'Trường mầm non', abbr: 'TMN' },
    { id: 'b', name: 'Khác', abbr: 'MN' },
  ];
  for (const mode of ['replace-all', 'replace-present']) {
    const result = apply(target, file(), { mode });
    assert.equal(result.error, '');
    assert.equal(result.patch.themes.length, 1);
    assert.equal(result.patch.themes[0].name, 'Trường mầm non');
    assert.deepEqual(result.patch.domains[0].rows[0].contents[0].themes, [result.patch.themes[0].id]);
  }
});

test('khác/không nhận diện/không có quyền nhóm tuổi bị chặn trước sinh ID', () => {
  for (const [target, preview, options] of [
    [{ ...base(), ageGroupId: 'ag-4' }, file(), {}],
    [base(), { ...file(), metadata: { ageFromMonths: 37, ageToMonths: 48 } }, {}],
    [{ ...base(), ageGroupId: '' }, file(), { allowedAgeGroupIds: ['ag-4'] }],
  ]) {
    const result = apply(target, preview, options, () => {
      throw new Error('must not allocate');
    });
    assert.match(result.error, /nhóm tuổi|quyền/);
    assert.equal(result.patch, null);
  }
  const result = apply({ ...base(), ageGroupId: '' }, file(), { allowedAgeGroupIds: ['ag-3'] });
  assert.equal(result.patch.ageGroupId, 'ag-3');
});

test('thiếu range hệ thống, range đảo, mode lạ hoặc file rỗng không tạo patch', () => {
  for (const options of [{ yearRange: undefined }, { yearRange: { start: range.end, end: range.start } }, { mode: 'append' }]) {
    const result = apply(base(), file(), options);
    assert.equal(result.patch, null);
    assert.ok(result.error);
  }
  for (const mode of ['replace-all', 'replace-present'])
    assert.equal(apply(base(), { domains: [], themes: [], breaks: [] }, { mode }).patch, null);
});

test('preview và apply cùng dời lịch, dùng range hệ thống để cảnh báo', () => {
  const preview = file();
  preview.themes[0].start = '2025-08-04';
  preview.themes[0].end = '2025-08-08';
  const prepared = imports.prepareFileImport(base(), preview, { yearRange: range });
  const result = apply(base(), preview);
  assert.equal(prepared.themes[0].start, '2025-08-04');
  assert.equal(result.patch.themes[0].start, prepared.themes[0].start);
  assert.ok(prepared.warnings.some((w) => w.message.includes('ngoài năm')));
  assert.equal(result.patch.schoolYear, undefined);
});

test('mã nguồn trùng chặn nhập, mã không có đích báo thiếu, IDs không trùng ID cũ', () => {
  const preview = file();
  preview.themes.push({ ...preview.themes[0], name: 'Khác', abbr: 'mn' });
  assert.equal(apply(base(), preview).patch, null);
  const target = base();
  target.themes[0].id = 'new';
  target.domains[0].rows[0].id = 'new-1';
  const result = apply(target, file(), {}, () => 'new');
  assert.equal(result.error, '');
  const all = [
    ...result.patch.themes,
    ...result.patch.breaks,
    ...result.patch.domains.flatMap((d) => d.rows.flatMap((r) => [r, ...(r.contents || [])])),
  ].map((x) => x.id);
  assert.equal(new Set(all).size, all.length);
  assert.ok(!all.includes('new'));
  assert.ok(!all.includes('new-1'));
});

test('nguồn không có lĩnh vực đích hợp lệ không âm thầm xóa kế hoạch', () => {
  const preview = file();
  preview.domains[0].name = 'Ngoài danh mục';
  const result = apply(base(), preview);
  assert.equal(result.patch, null);
  assert.ok(result.error);
});

test('nhập lại là thay, không nhân đôi mục tiêu hoặc tích nhầm ID cũ', () => {
  const first = apply(base(), file());
  const next = { ...base(), ...first.patch };
  const again = apply(next, file());
  assert.equal(again.error, '');
  assert.equal(again.patch.domains[0].rows.filter((r) => r.kind === 'goal').length, 1);
  assert.deepEqual(again.patch.domains[0].rows[0].contents[0].themes, [again.patch.themes[0].id]);
});
