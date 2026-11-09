import test from 'node:test';
import assert from 'node:assert/strict';
import { planLevel, planRoute, inheritAnnual, curriculumShape } from '../../src/models/education-plan/planLevel.mjs';
import {
  projectCalendar,
  adaptCalendar,
  resizeBranch,
  updateWeek,
  reorderCalendar,
} from '../../src/models/education-plan/branchCalendar.mjs';
const annual = {
  id: 'annual',
  planLevel: 'SCHOOL_YEAR',
  themes: [
    { id: 'a', name: 'A', start: '2026-09-07', end: '2026-09-18' },
    { id: 'b', name: 'B', start: '2026-09-21', end: '2026-10-16' },
  ],
  domains: [{ name: 'D', rows: [{ id: 'g', kind: 'goal', text: 'G', contents: [{ id: 'c', text: 'C', themes: [] }] }] }],
  branchTemplates: [{ id: 't', themeId: 'a', name: 'Mẫu', startDate: '2026-09-07', endDate: '2026-09-18' }],
};
test('legacy defaults TEAM; route and annual inheritance isolate source', () => {
  assert.equal(planLevel({}), 'TEAM');
  assert.equal(planRoute(annual), '/education/school-year-plans');
  const copy = inheritAnnual(annual);
  copy.domains[0].rows[0].text = 'local';
  assert.equal(annual.domains[0].rows[0].text, 'G');
  assert.equal(copy.curriculumSourcePlanId, 'annual');
  assert.equal(copy.branchTemplates[0].sourceTemplateId, 't');
});
test('curriculum guard ignores content ticks but detects edited text', () => {
  const copy = structuredClone(annual);
  copy.domains[0].rows[0].contents[0].themes = ['a'];
  assert.deepEqual(curriculumShape(copy), curriculumShape(annual));
  copy.domains[0].rows[0].text = 'changed';
  assert.notDeepEqual(curriculumShape(copy), curriculumShape(annual));
});
test('v1 adapter keeps separate weekly branches; v2 projections retain two weeks and offset notes', () => {
  const doc = adaptCalendar({ names: { '2026-09-07': 'X', '2026-09-14': 'X' }, notes: {} }, annual);
  assert.equal(doc.branches.length, 2);
  const v2 = {
    ...doc,
    branches: [
      {
        key: 'k',
        themeId: 'a',
        sourceTemplateId: 't',
        name: 'Đổi tên',
        startDate: '2026-09-07',
        endDate: '2026-09-18',
        weekNotes: { 0: 'một', 1: 'hai' },
      },
    ],
  };
  const projected = projectCalendar(v2, annual);
  assert.equal(projected.names['2026-09-14'], 'Đổi tên');
  assert.equal(projected.notes['2026-09-14'], 'hai');
  const edited = updateWeek(v2, annual, 'notes', '2026-09-14', 'sửa');
  assert.equal(edited.branches[0].weekNotes[1], 'sửa');
});
test('mock reorder moves blocks preserving counts, branch identity and notes', () => {
  const doc = adaptCalendar({ names: { '2026-09-07': 'X' }, notes: { '2026-09-07': 'note' } }, annual);
  const moved = reorderCalendar(doc, annual, ['b', 'a']);
  assert.equal(moved.themeSchedules.find((t) => t.themeId === 'b').endDate, '2026-10-02');
  assert.equal(moved.branches[0].startDate, '2026-10-05');
  assert.equal(moved.branches[0].key, doc.branches[0].key);
  assert.equal(moved.notes['2026-10-05'], 'note');
  assert.equal(doc.branches[0].startDate, '2026-09-07');
  assert.deepEqual(reorderCalendar(moved, annual, ['b', 'a']), moved);
  assert.throws(() => reorderCalendar(doc, annual, ['a', 'a']));
});
test('resize rejects overlaps without deleting another branch', () => {
  const doc = adaptCalendar({ names: { '2026-09-07': 'X', '2026-09-14': 'Y' }, notes: {} }, annual);
  assert.throws(() => resizeBranch(doc, annual, doc.branches[0].key, '2026-09-07', '2026-09-18'));
});

test('annual export has four curriculum columns, branch/project names and no theme ticks', async () => {
  const { yearPlanHtml } = await import('../../src/utils/education-plan/yearPlanDoc.js');
  const { DOMAINS } = await import('../../src/models/education-plan/educationPlanConstants.js');
  const html = yearPlanHtml({ ...annual, schoolYear: '2026 – 2027', domains: [{ ...annual.domains[0], name: DOMAINS[0] }] }, { g: 1 });
  assert.match(html, /Nhóm kết quả mong đợi/);
  assert.match(html, /Chủ đề nhánh \/ dự án/);
  assert.match(html, /Mẫu/);
  assert.doesNotMatch(html, /Chủ đề thực hiện/);
});

test('removing an annual theme also removes only its suggested branches and ticks', async () => {
  const { removeThemeReferences } = await import('../../src/models/education-plan/planLevel.mjs');
  const input = { ...annual, branchTemplates: [...annual.branchTemplates, { id: 'other', themeId: 'b', name: 'B' }] };
  const result = removeThemeReferences(input.themes, input.domains, input.branchTemplates, 'a');
  assert.deepEqual(
    result.themes.map((t) => t.id),
    ['b'],
  );
  assert.deepEqual(
    result.branchTemplates.map((t) => t.id),
    ['other'],
  );
  assert.equal(input.themes.length, 2);
});
test('taking two name-only templates chooses separate free weeks and keeps optional choices', async () => {
  const { takeTemplate } = await import('../../src/models/education-plan/branchCalendar.mjs');
  const empty = adaptCalendar({ names: {}, notes: {} }, annual);
  const one = takeTemplate(empty, annual, { id: 't1', themeId: 'a', name: 'Một' });
  const two = takeTemplate(one, annual, { id: 't2', themeId: 'a', name: 'Hai' });
  assert.equal(two.branches[0].startDate, '2026-09-07');
  assert.equal(two.branches[1].startDate, '2026-09-14');
  assert.equal(empty.branches.length, 0);
  assert.equal(two.branches[1].sourceTemplateId, 't2');
});

test('principal review menu stays available for the default annual workflow', async () => {
  const { principalSigns } = await import('../../src/models/education-plan/eduConfig.js');
  assert.equal(principalSigns({ signers: { year: ['VICE_PRINCIPAL'], branch: ['TEAM_LEADER'], week: ['TEAM_LEADER'] } }), true);
});

test('one two-week branch keeps one branch number while preserving two distinct week documents', async () => {
  const { branchNumber } = await import('../../src/models/education-plan/classPlan.js');
  const doc = { schemaVersion: 2, branches: [{ key: 'k', themeId: 'a', startDate: '2026-09-07', endDate: '2026-09-18' }] };
  assert.equal(branchNumber(annual, '2026-09-07', doc), 1);
  assert.equal(branchNumber(annual, '2026-09-14', doc), 1);
});

test('explicit annual source rebase preserves content ticks by lineage and warns about removed themes', () => {
  const previous = inheritAnnual(annual);
  previous.domains[0].rows[0].contents[0].themes = ['a', 'gone'];
  previous.themes.push({ id: 'gone', name: 'Đã bỏ' });
  const source = structuredClone(annual);
  source.id = 'annual-v2';
  source.themes[0] = { ...source.themes[0], id: 'a2', lineageId: 'a' };
  source.domains[0].rows[0].contents[0] = { ...source.domains[0].rows[0].contents[0], id: 'c2', lineageId: 'c' };
  const copied = inheritAnnual(source, previous);
  assert.deepEqual(copied.domains[0].rows[0].contents[0].themes, ['a2']);
  assert.equal(copied.remapWarnings.length, 1);
  assert.deepEqual(previous.domains[0].rows[0].contents[0].themes, ['a', 'gone']);
});

test('typing into an empty teaching week creates one custom branch and later rename keeps its identity', () => {
  const empty = adaptCalendar({ names: {}, notes: {} }, annual);
  const first = updateWeek(empty, annual, 'names', '2026-09-07', 'Tự tạo');
  assert.equal(first.branches.length, 1);
  assert.equal(first.branches[0].sourceTemplateId, null);
  const renamed = updateWeek(first, annual, 'names', '2026-09-07', 'Đổi tên');
  assert.equal(renamed.branches[0].key, first.branches[0].key);
  assert.equal(renamed.names['2026-09-07'], 'Đổi tên');
  assert.equal(empty.branches.length, 0);
});
test('notes on a blank week survive naming and writes outside the teaching calendar are ignored', () => {
  const empty = adaptCalendar({ names: {}, notes: {} }, annual);
  const notes = updateWeek(empty, annual, 'notes', '2026-09-14', 'Ghi chú');
  assert.equal(notes.branches[0].name, '');
  assert.equal(notes.notes['2026-09-14'], 'Ghi chú');
  const named = updateWeek(notes, annual, 'names', '2026-09-14', 'Tên');
  assert.equal(named.notes['2026-09-14'], 'Ghi chú');
  assert.deepEqual(updateWeek(named, annual, 'names', '2026-08-03', 'Ngoài lịch'), named);
});
test('valid two-week resize keeps UUID and per-week notes', () => {
  const one = updateWeek(adaptCalendar({ names: {}, notes: {} }, annual), annual, 'names', '2026-09-07', 'Nhánh');
  const resized = resizeBranch(one, annual, one.branches[0].key, '2026-09-07', '2026-09-18');
  assert.equal(resized.branches[0].key, one.branches[0].key);
  assert.equal(resized.names['2026-09-14'], 'Nhánh');
  assert.throws(() => resizeBranch(one, annual, one.branches[0].key, '2026-09-08', '2026-09-18'));
});

test('intentional conflict reapply keeps fresh source tree/review and only valid old ticks plus own text', async () => {
  const { reapplyTeamDraft } = await import('../../src/models/education-plan/planLevel.mjs');
  const fresh = { title: 'Server', description: '', curriculumSourcePlanId: 'new', revision: 9,
    reviewItems: [{ reviewItemId: 'review', resolved: false }], themes: [{ id: 'keep' }],
    domains: [{ rows: [{ id: 'goal', text: 'New source', contents: [
      { id: 'content', text: 'New content', themes: [] }, { id: 'added', text: 'Added', themes: [] } ] }] }] };
  const draft = { title: 'My title', description: 'My description', curriculumSourcePlanId: 'old', revision: 2,
    domains: [{ rows: [{ text: 'Stale source', contents: [{ id: 'content', themes: ['keep', 'gone'] }, { id: 'deleted', themes: ['keep'] }] }] }] };
  const reapplied = reapplyTeamDraft(fresh, draft);
  assert.equal(reapplied.title, 'My title'); assert.equal(reapplied.description, 'My description');
  assert.equal(reapplied.curriculumSourcePlanId, 'new'); assert.equal(reapplied.revision, 9);
  assert.deepEqual(reapplied.reviewItems, fresh.reviewItems);
  assert.equal(reapplied.domains[0].rows[0].text, 'New source');
  assert.deepEqual(reapplied.domains[0].rows[0].contents.map((c) => c.themes), [['keep'], []]);
  assert.equal(fresh.title, 'Server'); assert.deepEqual(fresh.domains[0].rows[0].contents[0].themes, []);
});
