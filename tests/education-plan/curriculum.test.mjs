import assert from 'node:assert/strict';
import { test } from 'node:test';

import { CURRICULUM_SEED } from '../../src/mocks/curriculumSeed.js';
import {
  addSuggestedContents,
  curriculumAsSourcePlan,
  curriculumBadge,
  curriculumSourceLink,
  curriculumTree,
  goalTargets,
} from '../../src/models/education-plan/curriculum.mjs';
import { mergeImportedGoals } from '../../src/models/education-plan/importGoals.mjs';
import { toYearPlanRequest, toUiGoal } from '../../src/services/education-plan/api/yearPlanMapper.js';

// BE:EDU-28 — lấy mục tiêu từ Chương trình GDMN của Bộ (specs/005-ministry-goal-catalog)
const goalsOf = (age) => CURRICULUM_SEED.goals.filter((g) => g.ageGroup === age);
const DOMAINS = ['Phát triển thể chất', 'Phát triển nhận thức', 'Phát triển ngôn ngữ', 'Phát triển tình cảm và kỹ năng xã hội', 'Phát triển thẩm mỹ'];
const emptyPlan = () => ({ id: 'g-1', domains: DOMAINS.map((name, i) => ({ id: `d${i}`, name, rows: [] })) });
let seq = 0;
const makeId = () => `n${++seq}`;

test('dữ liệu mock trùng số lượng BE (V31) cho 4 nhóm tuổi', () => {
  assert.deepEqual(
    ['ag-2', 'ag-3', 'ag-4', 'ag-5'].map((a) => goalsOf(a).length),
    [41, 84, 99, 103],
  );
  assert.deepEqual(
    ['ag-2', 'ag-3', 'ag-4', 'ag-5'].map((a) => CURRICULUM_SEED.contents.filter((c) => c.ageGroup === a).length),
    [77, 119, 121, 106],
  );
  assert.equal(CURRICULUM_SEED.sources[0].documentNo, '01/VBHN-BGDĐT');
});

test('lấy tất cả mục tiêu MG bé: đủ lĩnh vực con, nhóm, mục tiêu nguyên văn kèm nội dung và liên kết nguồn', () => {
  const goals = goalsOf('ag-3');
  const { domains, report } = mergeImportedGoals(emptyPlan(), curriculumAsSourcePlan(goals), goals.map((g) => `cg-${g.id}`), makeId);
  assert.equal(report.added, 84);
  assert.equal(report.duplicates, 0);
  const physical = domains.find((d) => d.name === 'Phát triển thể chất').rows;
  assert.deepEqual(
    physical.slice(0, 3).map((r) => [r.kind, r.text]),
    [
      ['sub', 'Phát triển vận động'],
      ['group', 'Thực hiện được các động tác phát triển các nhóm cơ và hô hấp'],
      ['goal', 'Thực hiện đủ các động tác trong bài tập thể dục theo hướng dẫn.'],
    ],
  );
  const balance = physical.find((r) => r.text === 'Giữ được thăng bằng cơ thể khi thực hiện vận động');
  assert.deepEqual(
    balance.contents.map((c) => c.text),
    ['Đi hết đoạn đường hẹp (3m x 0,2m).', 'Đi kiễng gót liên tục 3m.'],
  );
  assert.ok(balance.contents.every((c) => c.themes.length === 0));
  assert.ok(balance.curriculumGoalId);
  assert.equal(balance.curriculumSectionRef, 'Phần ba › D › I › a) › 2 › 2.1');
});

test('lấy lại cùng mục tiêu: bỏ qua trùng, không ghi đè', () => {
  const goals = goalsOf('ag-3').slice(0, 5);
  const once = mergeImportedGoals(emptyPlan(), curriculumAsSourcePlan(goals), goals.map((g) => `cg-${g.id}`), makeId);
  const twice = mergeImportedGoals({ ...emptyPlan(), domains: once.domains }, curriculumAsSourcePlan(goals), goals.map((g) => `cg-${g.id}`), makeId);
  assert.equal(twice.report.added, 0);
  assert.equal(twice.report.duplicates, 5);
});

test('lĩnh vực có mục tiêu tự gõ ngoài lĩnh vực con: không thêm mục tiêu của Bộ có lĩnh vực con, báo lý do, giữ nguyên dữ liệu (Tiền chọn A)', () => {
  const goal = goalsOf('ag-3').find((g) => g.domainName === 'Phát triển thể chất' && g.subDomain);
  const plan = emptyPlan();
  plan.domains[0].rows = [{ id: 'own', kind: 'goal', text: 'Trẻ tự phục vụ', contents: [] }];
  const { domains, report } = mergeImportedGoals(plan, curriculumAsSourcePlan([goal]), [`cg-${goal.id}`], makeId);
  assert.equal(report.added, 0);
  assert.equal(report.unavailable.length, 1);
  assert.match(report.unavailable[0].reason, /lĩnh vực con\/nhóm/);
  assert.deepEqual(domains[0].rows, plan.domains[0].rows);
});

test('chép mục tiêu sang kế hoạch khác (EDU-24) vẫn giữ liên kết Bộ', () => {
  const goals = goalsOf('ag-4').slice(0, 2);
  const first = mergeImportedGoals(emptyPlan(), curriculumAsSourcePlan(goals), goals.map((g) => `cg-${g.id}`), makeId);
  const source = { ...emptyPlan(), id: 'src', domains: first.domains };
  const ids = first.domains.flatMap((d) => d.rows.filter((r) => r.kind === 'goal').map((r) => r.id));
  const copied = mergeImportedGoals(emptyPlan(), source, ids, makeId);
  const row = copied.domains.flatMap((d) => d.rows).find((r) => r.kind === 'goal');
  assert.equal(row.curriculumGoalId, goals[0].id);
});

test('gợi ý nội dung: thêm vào mục tiêu đích, bỏ trùng; chỉ mục tiêu có chữ là đích', () => {
  const goals = goalsOf('ag-3').slice(0, 1);
  const { domains } = mergeImportedGoals(emptyPlan(), curriculumAsSourcePlan(goals), [`cg-${goals[0].id}`], makeId);
  const form = { domains };
  const [target] = goalTargets(form);
  const tips = CURRICULUM_SEED.contents.filter((c) => c.ageGroup === 'ag-3' && c.label === 'Đi và chạy').slice(0, 2);
  const first = addSuggestedContents(form, target.id, tips, makeId);
  assert.equal(first.added, 2);
  const again = addSuggestedContents({ domains: first.domains }, target.id, tips, makeId);
  assert.equal(again.added, 0);
  assert.equal(again.duplicates, 2);
  const row = first.domains.flatMap((d) => d.rows).find((r) => r.id === target.id);
  assert.deepEqual(
    row.contents.map((c) => c.text),
    tips.map((t) => t.text),
  );
});

test('nhãn Theo Bộ / Đã sửa từ Bộ và đường dẫn trang nguồn', () => {
  const row = { curriculumGoalId: 7, curriculumGoalText: 'Câu gốc.', curriculumSectionRef: 'Phần ba › D › I', text: ' Câu gốc. ' };
  assert.equal(curriculumBadge(row).label, 'Theo Bộ');
  assert.equal(curriculumBadge({ ...row, text: 'Trẻ câu đã sửa.' }).label, 'Đã sửa từ Bộ');
  assert.equal(curriculumBadge({ text: 'x' }), null);
  assert.equal(curriculumSourceLink('ag-3', 7), '/education/curriculum-sources?ageGroup=ag-3#cg-7');
});

test('cây hiển thị giữ thứ tự văn bản: lĩnh vực > lĩnh vực con > nhóm', () => {
  const tree = curriculumTree(goalsOf('ag-5'));
  assert.equal(tree[0].name, 'Phát triển thể chất');
  assert.equal(tree[0].subs[0].name, 'Phát triển vận động');
  assert.equal(tree.reduce((n, d) => n + d.subs.reduce((m, s) => m + s.groups.reduce((k, g) => k + g.goals.length, 0), 0), 0), 103);
});

test('mapper: gửi curriculumGoalId cho dòng mục tiêu, đọc lại câu gốc', () => {
  const refs = { schoolYearId: () => 1, ageGroupId: () => 2, domainId: () => 3, ageGroupCode: () => 'ag-3' };
  const req = toYearPlanRequest(
    {
      schoolYear: '2026 – 2027',
      ageGroupId: 'ag-3',
      title: 't',
      domains: [{ name: 'Phát triển thể chất', rows: [{ id: 'n1', kind: 'goal', text: 'x', contents: [], curriculumGoalId: 9 }] }],
      themes: [],
      breaks: [],
    },
    refs,
  );
  assert.equal(req.domains[0].rows[0].curriculumGoalId, 9);
  const ui = toUiGoal(
    {
      id: 1,
      domains: [
        {
          domainId: 3,
          name: 'Phát triển thể chất',
          rows: [{ id: 5, kind: 'goal', text: 'x', goalNo: 1, contents: [], curriculumGoalId: 9, curriculumGoalText: 'x', curriculumSectionRef: 'r' }],
        },
      ],
    },
    refs,
  );
  assert.equal(ui.domains[0].rows[0].curriculumGoalId, 9);
  assert.equal(ui.domains[0].rows[0].curriculumSectionRef, 'r');
});
