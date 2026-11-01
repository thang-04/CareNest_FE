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

test('full file bổ sung chủ đề trước ticks, dời ngày, giữ dữ liệu tay/id/lineage và hàng trống', () => {
  const target = base(),
    snapshot = structuredClone(target);
  assert.equal(typeof imports.mergeFilePlan, 'function');
  const { patch, report, error } = imports.mergeFilePlan(target, file(), ids());
  assert.equal(error, '');
  assert.equal(patch.title, undefined);
  assert.equal(patch.description, undefined);
  assert.deepEqual(target, snapshot);
  assert.deepEqual(patch.domains[0].rows[0], target.domains[0].rows[0]);
  assert.equal(patch.themes[1].id, 'blank');
  assert.equal(patch.breaks[0].id, 'blank-break');
  const added = patch.themes.find((t) => t.abbr === 'MN');
  assert.equal(added.start, '2026-09-08');
  assert.equal(patch.breaks[1].start, '2027-02-16');
  assert.deepEqual(patch.domains[0].rows[1].contents[0].themes, [added.id]);
  assert.equal(report.themes, 1);
  assert.equal(report.breaks, 1);
  assert.equal(report.added, 1);
});

test('khác nhóm tuổi bị chặn, không sinh patch', () => {
  const target = { ...base(), ageGroupId: 'ag-4' };
  assert.equal(typeof imports.mergeFilePlan, 'function');
  const result = imports.mergeFilePlan(target, file(), ids());
  assert.match(result.error, /nhóm tuổi/);
  assert.equal(result.patch, null);
});

test('nhóm tuổi trống nhận từ file chỉ khi trong danh sách được phép; metadata chỉ điền ô trống', () => {
  const target = { ...base(), ageGroupId: '', title: '' };
  assert.equal(typeof imports.mergeFilePlan, 'function');
  const ok = imports.mergeFilePlan(target, file(), ids(), { allowedAgeGroupIds: ['ag-3'] });
  assert.equal(ok.patch.ageGroupId, 'ag-3');
  assert.equal(ok.patch.title, 'Tên file');
  assert.equal(ok.patch.schoolYear, undefined);
  assert.match(imports.mergeFilePlan(target, file(), ids(), { allowedAgeGroupIds: ['ag-4'] }).error, /quyền/);
  const unknown = file();
  unknown.metadata.ageFromMonths = 37;
  assert.match(imports.mergeFilePlan(target, unknown, ids()).error, /nhóm tuổi/);
});

test('chủ đề trùng tên khác viết tắt giữ nguyên tên/mã tay, ticks nguồn ghép đúng id cũ', () => {
  const target = base();
  target.themes[0] = { id: 'manual', name: 'Trường mầm non', abbr: 'TMN', note: 'tay' };
  assert.equal(typeof imports.mergeFilePlan, 'function');
  const result = imports.mergeFilePlan(target, file(), ids());
  assert.equal(result.report.themes, 0);
  assert.deepEqual(result.patch.themes, target.themes);
  assert.deepEqual(result.patch.domains[0].rows[1].contents[0].themes, ['manual']);
  assert.deepEqual(result.report.missingThemes, []);
});

test('mã nguồn trỏ sang hai chủ đề đang có khác nhau thì chặn thay vì ghép sai', () => {
  const target = base();
  target.themes = [
    { id: 'a', name: 'Trường mầm non', abbr: 'TMN' },
    { id: 'b', name: 'Khác', abbr: 'MN' },
  ];
  assert.equal(typeof imports.mergeFilePlan, 'function');
  assert.match(imports.mergeFilePlan(target, file(), ids()).error, /chủ đề/);
});

test('preview cho thấy lịch đã dời, cảnh báo trọn tuần; không đổi năm và file cũ vẫn bổ sung như trước', () => {
  assert.equal(typeof imports.prepareFileImport, 'function');
  const prepared = imports.prepareFileImport(base(), file());
  assert.equal(prepared.themes[0].start, '2026-09-08');
  assert.equal(prepared.shifted, 1);
  assert.ok(prepared.warnings.length > 0);
  const legacy = file();
  delete legacy.metadata;
  delete legacy.themes;
  delete legacy.breaks;
  const merged = imports.mergeFilePlan(base(), legacy, ids());
  assert.deepEqual(merged.patch.themes, base().themes);
  assert.deepEqual(merged.report.missingThemes, ['MN']);
});

test('nhập lại bỏ trùng, không đổi mục tiêu/ticks cũ hoặc chép owner/năm/phạm vi từ metadata', () => {
  assert.equal(typeof imports.mergeFilePlan, 'function');
  const target = base();
  const preview = file();
  preview.metadata.owner = 'ignored';
  preview.metadata.scope = 'ignored';
  const first = imports.mergeFilePlan(target, preview, ids());
  const next = { ...target, ...first.patch };
  const again = imports.mergeFilePlan(next, preview, ids());
  assert.equal(again.report.added, 0);
  assert.equal(again.report.duplicates, 1);
  assert.equal(again.report.themes, 0);
  assert.deepEqual(again.patch.domains, next.domains);
  assert.equal(again.patch.owner, undefined);
  assert.equal(again.patch.scope, undefined);
});

test('preview dùng đúng khoảng năm học được truyền vào để cảnh báo ngày ngoài năm', () => {
  const preview = file();
  preview.themes[0].start = '2025-08-04';
  preview.themes[0].end = '2025-08-08';
  const prepared = imports.prepareFileImport(base(), preview, { yearRange: { start: '2026-09-01', end: '2027-05-31' } });
  assert.ok(prepared.warnings.some((w) => w.message.includes('ngoài năm')));
});

test('trùng mã nhưng khác tên báo rõ chủ đề tay được giữ và đích ghép dấu tích', () => {
  const target = base();
  target.themes[0] = { id: 'manual', name: 'Chủ đề gõ tay', abbr: 'MN', note: 'tay' };
  const prepared = imports.prepareFileImport(target, file());
  assert.equal(prepared.error, '');
  assert.equal(prepared.themes[0].targetName, 'Chủ đề gõ tay');
  assert.ok(prepared.warnings.some(w => w.message.includes('Chủ đề gõ tay') && w.message.includes('Trường mầm non')));
  const result = imports.mergeFilePlan(target, file(), ids());
  assert.deepEqual(result.patch.themes, target.themes);
  assert.deepEqual(result.patch.domains[0].rows[1].contents[0].themes, ['manual']);
});
