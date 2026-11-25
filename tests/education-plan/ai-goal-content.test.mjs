import { test } from 'node:test';
import assert from 'node:assert/strict';
import { applyGoalContents, goalContentGroups, goalContentStamp, requestGoalContents } from '../../src/models/education-plan/aiGoalContent.mjs';

const form = () => ({ id: '17', ageGroupId: 'ag-5', schoolYear: '2026 – 2027', planLevel: 'SCHOOL_YEAR',
  domains: [{ id: 'd-1', name: 'Ngôn ngữ', rows: [
    { id: '10', kind: 'goal', text: 'Trẻ đọc thơ rõ lời', contents: [] },
    { id: '11', kind: 'goal', text: 'Trẻ nghe kể chuyện', contents: [{ id: '1', text: 'Đã có', themes: [] }] },
    { id: '12', kind: 'goal', text: 'Trẻ kể lại câu chuyện', contents: [{ id: '2', text: ' ', themes: [] }] },
  ] }] });
const catalog = [
  { id: 20, domainName: 'Ngôn ngữ', text: 'Đọc thơ, ca dao' },
  { id: 21, domainName: 'Ngôn ngữ', text: 'Kể lại câu chuyện' },
  { id: 22, domainName: 'Thể chất', text: 'Chạy nhanh' },
  { id: 23, domainName: 'Ngôn ngữ', text: 'ĐỌC THƠ, CA DAO' },
];
const matches = [
  { goalId: 10, curriculumContentId: 20, text: 'AI viết bịa', from: 'đọc thơ' },
  { goalId: 12, curriculumContentId: 21, from: 'kể lại' },
];

test('EDU-106: lấy chữ catalog, gom mục tiêu trống gồm mục tiêu tự thêm, bỏ id/domain/from sai và trùng chữ', () => {
  const groups = goalContentGroups(form(), [...matches,
    { goalId: 11, curriculumContentId: 21, from: 'nghe' },
    { goalId: 99, curriculumContentId: 20, from: 'thơ' },
    { goalId: 10, curriculumContentId: 999, from: 'thơ' },
    { goalId: 10, curriculumContentId: 22, from: 'thơ' },
    { goalId: 10, curriculumContentId: 21, from: 'không có' },
    { goalId: 10, curriculumContentId: 23, from: 'thơ' },
  ], catalog);
  assert.equal(groups.length, 2);
  assert.deepEqual(groups.map((g) => g.lines.length), [1, 1]);
  assert.equal(groups[0].lines[0].text, catalog[0].text);
  assert.equal(groups[1].goalId, '12');
});

test('EDU-106: giữ/bỏ chỉ chép chữ, giữ nội dung cũ, không liên kết catalog và không sửa input', () => {
  const plan = form(), original = structuredClone(plan), groups = goalContentGroups(plan, matches, catalog);
  const result = applyGoalContents(plan, groups, new Set(['10:20']), goalContentStamp(plan), () => 'new-content');
  assert.equal(result.added, 1);
  assert.deepEqual(result.domains[0].rows[0].contents, [{ id: 'new-content', text: 'Đọc thơ, ca dao', themes: [] }]);
  assert.equal(result.domains[0].rows[1].contents[0].text, 'Đã có');
  assert.equal(result.domains[0].rows[2].contents.length, 1);
  assert.deepEqual(plan, original);
});

test('EDU-106: không chọn gì giống Hủy, không có nội dung thêm; kết quả cũ không áp vào bản đổi tuổi/goal/nội dung', () => {
  const plan = form(), stamp = goalContentStamp(plan), groups = goalContentGroups(plan, matches, catalog);
  assert.equal(applyGoalContents(plan, groups, new Set(), stamp, () => 'id').added, 0);
  for (const mutate of [p => { p.ageGroupId = 'ag-4'; }, p => { p.domains[0].rows[0].text = 'Đổi MT'; },
    p => { p.domains[0].rows[0].contents.push({ id: 'fresh', text: 'Vừa nhập' }); }]) {
    const changed = structuredClone(plan); mutate(changed);
    assert.equal(applyGoalContents(changed, groups, new Set(['10:20']), stamp, () => 'id'), null);
  }
});

test('EDU-106: save thất bại không gọi AI hay tải catalog', async () => {
  let called = 0;
  await assert.rejects(requestGoalContents({ ensureSaved: async () => null, current: () => ({ plan: form(), allowed: true }),
    request: async () => { called++; }, loadCatalog: async () => { called++; }, active: () => true }), /Chưa lưu/);
  assert.equal(called, 0);
});

test('EDU-106: save thành công dùng đúng id kế hoạch và goal sau lưu, số lĩnh vực lỗi được giữ', async () => {
  const saved = form(); let requested;
  const result = await requestGoalContents({ ensureSaved: async () => ({ planId: '17', plan: saved, allowed: true }),
    current: () => ({ plan: saved, allowed: true }), active: () => true,
    request: async (id) => { requested = id; return { matches, failedDomains: [{ domainId: 5, name: 'Nghệ thuật' }] }; },
    loadCatalog: async (age) => { assert.equal(age, 'ag-5'); return catalog; } });
  assert.equal(requested, '17'); assert.equal(result.groups[0].goalId, '10');
  assert.equal(result.failedDomains[0].name, 'Nghệ thuật');
});

test('EDU-106: đóng modal trong lúc save không gọi AI', async () => {
  let active = true, called = false;
  const result = await requestGoalContents({ ensureSaved: async () => { active = false; return { planId: '17', plan: form(), allowed: true }; },
    current: () => ({ plan: form(), allowed: true }), active: () => active,
    request: async () => { called = true; }, loadCatalog: async () => [] });
  assert.equal(result, null); assert.equal(called, false);
});

test('EDU-106: đóng modal, mất quyền hoặc sửa bản trong khi chờ bỏ kết quả AI', async () => {
  for (const change of ['close', 'permission', 'draft']) {
    const plan = form(); let active = true, allowed = true;
    const result = await requestGoalContents({ ensureSaved: async () => ({ planId: '17', plan: structuredClone(plan), allowed: true }),
      current: () => ({ plan, allowed }), active: () => active,
      request: async () => { if(change==='close') active=false; if(change==='permission') allowed=false;
        if(change==='draft') plan.title='Vừa sửa tên'; return { matches }; }, loadCatalog: async () => catalog });
    assert.equal(result, null);
  }
});

test('EDU-106: lỗi8001/8002 giữ nguyên bản soạn và truyền lỗi để UI báo/soạn tay', async () => {
  const plan = form(), original = structuredClone(plan);
  for(const errorCode of [8001,8002]) {
    await assert.rejects(requestGoalContents({ ensureSaved: async () => ({ planId:'17', plan, allowed:true }),
      current: () => ({plan,allowed:true}), active: () => true,
      request: async () => { throw Object.assign(new Error('AI lỗi'),{errorCode}); }, loadCatalog: async () => catalog }), {errorCode});
    assert.deepEqual(plan,original);
  }
});
