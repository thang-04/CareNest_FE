import assert from 'node:assert/strict';
import { test } from 'node:test';

import { CURRICULUM_SEED } from '../../src/mocks/curriculumSeed.js';
import {
  addContentsToExistingGoals,
  addSuggestedContents,
  curriculumAsSourcePlan,
  curriculumSourceLink,
  curriculumTree,
  goalTargets,
} from '../../src/models/education-plan/curriculum.mjs';
import { getImportGoals, mergeImportedGoals } from '../../src/models/education-plan/importGoals.mjs';
import { toRows } from '../../src/models/education-plan/goalTable.js';
import { toYearPlanRequest, toUiGoal } from '../../src/services/education-plan/api/yearPlanMapper.js';

// BE:EDU-28 — lấy mục tiêu từ Chương trình GDMN của Bộ (specs/005-ministry-goal-catalog)
const goalsOf = (age) => CURRICULUM_SEED.goals.filter((g) => g.ageGroup === age);
const DOMAINS = [
  'Phát triển thể chất',
  'Phát triển nhận thức',
  'Phát triển ngôn ngữ',
  'Phát triển tình cảm và kỹ năng xã hội',
  'Phát triển thẩm mỹ',
];
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
  const { domains, report } = mergeImportedGoals(
    emptyPlan(),
    curriculumAsSourcePlan(goals),
    goals.map((g) => `cg-${g.id}`),
    makeId,
  );
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
  const once = mergeImportedGoals(
    emptyPlan(),
    curriculumAsSourcePlan(goals),
    goals.map((g) => `cg-${g.id}`),
    makeId,
  );
  const twice = mergeImportedGoals(
    { ...emptyPlan(), domains: once.domains },
    curriculumAsSourcePlan(goals),
    goals.map((g) => `cg-${g.id}`),
    makeId,
  );
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
  const first = mergeImportedGoals(
    emptyPlan(),
    curriculumAsSourcePlan(goals),
    goals.map((g) => `cg-${g.id}`),
    makeId,
  );
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

test('đường dẫn trang nguồn', () => {
  assert.equal(curriculumSourceLink('ag-3', 7), '/education/curriculum-sources?ageGroup=ag-3#cg-7');
});

test('cây hiển thị giữ thứ tự văn bản: lĩnh vực > lĩnh vực con > nhóm', () => {
  const tree = curriculumTree(goalsOf('ag-5'));
  assert.equal(tree[0].name, 'Phát triển thể chất');
  assert.equal(tree[0].subs[0].name, 'Phát triển vận động');
  assert.equal(
    tree.reduce((n, d) => n + d.subs.reduce((m, s) => m + s.groups.reduce((k, g) => k + g.goals.length, 0), 0), 0),
    103,
  );
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
          rows: [
            {
              id: 5,
              kind: 'goal',
              text: 'x',
              goalNo: 1,
              contents: [],
              curriculumGoalId: 9,
              curriculumGoalText: 'x',
              curriculumSectionRef: 'r',
            },
          ],
        },
      ],
    },
    refs,
  );
  assert.equal(ui.domains[0].rows[0].curriculumGoalId, 9);
  assert.equal(ui.domains[0].rows[0].curriculumSectionRef, 'r');
});

// BE V37 — danh mục 3 tầng: API trả id lĩnh vực con/nhóm; dữ liệu mock chưa có id nên gán giả theo chữ
const withTierIds = (goals) => {
  const subs = new Map();
  const groups = new Map();
  return goals.map((g) => {
    const subKey = `${g.domainName}|${g.subDomain || ''}`;
    const groupKey = `${subKey}|${g.groupNo}|${g.groupText}`;
    if (g.subDomain && !subs.has(subKey)) subs.set(subKey, 500 + subs.size);
    if (!groups.has(groupKey)) groups.set(groupKey, 900 + groups.size);
    return { ...g, subDomainId: g.subDomain ? subs.get(subKey) : null, expectedResultId: groups.get(groupKey) };
  });
};

test('xóa rồi lấy lại mục tiêu Bộ: dùng lại cha, giữ dòng cũ và đúng nhóm sau normalize', () => {
  const goals = withTierIds(goalsOf('ag-3'));
  const source = curriculumAsSourcePlan(goals);
  const first = mergeImportedGoals(
    emptyPlan(),
    source,
    goals.map((g) => `cg-${g.id}`),
    makeId,
  );
  const removed = goals.find((g) => g.subDomain);
  const target = {
    domains: first.domains.map((d) => ({ ...d, rows: d.rows.filter((r) => r.curriculumGoalId !== removed.id) })),
  };
  const snapshot = structuredClone(target);
  const before = getImportGoals(target);
  for (let attempt = 0; attempt < 3; attempt++) {
    const result = mergeImportedGoals(target, curriculumAsSourcePlan([removed]), [`cg-${removed.id}`], makeId);
    assert.deepEqual(result.report, { added: 1, duplicates: 0, unavailable: [] });
    for (const [i, domain] of result.domains.entries()) {
      assert.deepEqual(
        domain.rows.filter((r) => r.kind !== 'goal'),
        snapshot.domains[i].rows.filter((r) => r.kind !== 'goal'),
      );
    }
    const reopened = { domains: result.domains.map((d) => ({ ...d, rows: toRows(d, makeId) })) };
    const restored = getImportGoals(reopened);
    for (const old of before) {
      const current = restored.find((g) => g.id === old.id);
      assert.deepEqual(current, old);
    }
    const incoming = restored.find((g) => g.curriculumGoalId === removed.id);
    assert.equal(incoming.sub.curriculumSubDomainId, removed.subDomainId);
    assert.equal(incoming.group.curriculumExpectedResultId, removed.expectedResultId);
    assert.ok(incoming.contents.every((c) => c.themes.length === 0));
    assert.deepEqual(target, snapshot);
    target.domains = reopened.domains.map((d) => ({ ...d, rows: d.rows.filter((r) => r.id !== incoming.id) }));
  }
});

test('lấy mục tiêu Bộ nhiều lượt: nhóm mới nằm trong lĩnh vực con cũ, không đổi các nhánh sau', () => {
  const goals = withTierIds(goalsOf('ag-3'));
  const firstGoal = goals.find((g) => g.subDomain);
  const nextGoal = goals.find((g) => g.subDomainId === firstGoal.subDomainId && g.expectedResultId !== firstGoal.expectedResultId);
  const otherSub = goals.find((g) => g.domainName === firstGoal.domainName && g.subDomainId !== firstGoal.subDomainId);
  const first = mergeImportedGoals(
    emptyPlan(),
    curriculumAsSourcePlan([firstGoal, otherSub]),
    [`cg-${firstGoal.id}`, `cg-${otherSub.id}`],
    makeId,
  );
  const target = { domains: first.domains };
  const snapshot = structuredClone(target);
  const result = mergeImportedGoals(target, curriculumAsSourcePlan([nextGoal]), [`cg-${nextGoal.id}`], makeId);
  assert.deepEqual(result.report, { added: 1, duplicates: 0, unavailable: [] });
  const rows = result.domains[0].rows;
  assert.equal(rows.filter((r) => r.kind === 'sub').length, 2);
  const imported = getImportGoals({ domains: result.domains });
  assert.deepEqual(
    imported.map((g) => g.curriculumGoalId),
    [firstGoal.id, nextGoal.id, otherSub.id],
  );
  assert.equal(imported[1].sub.id, imported[0].sub.id);
  assert.notEqual(imported[1].group.id, imported[0].group.id);
  assert.deepEqual(imported[2], getImportGoals(target)[1]);
  assert.deepEqual(target, snapshot);
});

test('cha nguồn Bộ đã sửa tên vẫn được dùng lại theo ID; không gộp nhánh khác ID dù cùng tên', () => {
  const [goal] = withTierIds(goalsOf('ag-3'));
  const first = mergeImportedGoals(emptyPlan(), curriculumAsSourcePlan([goal]), [`cg-${goal.id}`], makeId);
  const original = first.domains[0].rows.filter((r) => r.kind !== 'goal');
  const target = emptyPlan();
  target.domains[0].rows = [
    { ...original[0], id: 'other-sub', curriculumSubDomainId: 9999 },
    { ...original[1], id: 'other-group', curriculumExpectedResultId: 9998 },
    ...original.map((r) => ({ ...r, text: `Đã sửa ${r.kind}` })),
  ];
  const snapshot = structuredClone(target);
  const result = mergeImportedGoals(target, curriculumAsSourcePlan([goal]), [`cg-${goal.id}`], makeId);
  assert.deepEqual(result.report, { added: 1, duplicates: 0, unavailable: [] });
  assert.deepEqual(result.domains[0].rows.slice(0, -1), snapshot.domains[0].rows);
  const [imported] = getImportGoals({ domains: result.domains });
  assert.equal(imported.sub.id, original[0].id);
  assert.equal(imported.group.id, original[1].id);
  assert.deepEqual(target, snapshot);
});

test('dữ liệu Bộ mock chưa có ID cha: xóa và thêm lại không tạo trùng tiêu đề', () => {
  const [goal] = goalsOf('ag-3');
  const first = mergeImportedGoals(emptyPlan(), curriculumAsSourcePlan([goal]), [`cg-${goal.id}`], makeId);
  const target = { domains: first.domains.map((d) => ({ ...d, rows: d.rows.filter((r) => r.kind !== 'goal') })) };
  const result = mergeImportedGoals(target, curriculumAsSourcePlan([goal]), [`cg-${goal.id}`], makeId);
  assert.deepEqual(result.report, { added: 1, duplicates: 0, unavailable: [] });
  assert.deepEqual(
    result.domains[0].rows.map((r) => r.kind),
    ['sub', 'group', 'goal'],
  );
});

test('lấy lại mục tiêu Bộ không có lĩnh vực con: dùng đúng nhóm cũ trước các nhóm khác', () => {
  const goals = withTierIds(goalsOf('ag-3'));
  const removed = goals.find((g) => !g.subDomain);
  const first = mergeImportedGoals(
    emptyPlan(),
    curriculumAsSourcePlan(goals),
    goals.map((g) => `cg-${g.id}`),
    makeId,
  );
  const target = { domains: first.domains.map((d) => ({ ...d, rows: d.rows.filter((r) => r.curriculumGoalId !== removed.id) })) };
  const before = getImportGoals(target);
  const result = mergeImportedGoals(target, curriculumAsSourcePlan([removed]), [`cg-${removed.id}`], makeId);
  assert.deepEqual(result.report, { added: 1, duplicates: 0, unavailable: [] });
  const imported = getImportGoals({ domains: result.domains });
  const restored = imported.find((g) => g.curriculumGoalId === removed.id);
  assert.equal(restored.sub, null);
  assert.equal(restored.group.curriculumExpectedResultId, removed.expectedResultId);
  for (const old of before)
    assert.deepEqual(
      imported.find((g) => g.id === old.id),
      old,
    );
  for (const [i, domain] of result.domains.entries()) {
    assert.deepEqual(
      domain.rows.filter((r) => r.kind !== 'goal'),
      target.domains[i].rows.filter((r) => r.kind !== 'goal'),
    );
  }
});

test('chép kế hoạch có mục tiêu Bộ và tự gõ cùng nhóm: giữ cả hai trong nhánh cũ', () => {
  const goals = withTierIds(goalsOf('ag-3'));
  const ministry = goals.find((g) => g.subDomain);
  const later = goals.find((g) => g.domainName === ministry.domainName && g.subDomainId !== ministry.subDomainId);
  const source = curriculumAsSourcePlan([ministry]);
  source.domains[0].rows.push({ id: 'manual', kind: 'goal', text: 'Mục tiêu tự gõ trong cùng nhóm', contents: [] });
  const first = mergeImportedGoals(emptyPlan(), curriculumAsSourcePlan([ministry, later]), [`cg-${ministry.id}`, `cg-${later.id}`], makeId);
  const target = { domains: first.domains.map((d) => ({ ...d, rows: d.rows.filter((r) => r.curriculumGoalId !== ministry.id) })) };
  const snapshot = structuredClone(target);
  const result = mergeImportedGoals(target, source, [`cg-${ministry.id}`, 'manual'], makeId);
  assert.deepEqual(result.report, { added: 2, duplicates: 0, unavailable: [] });
  const imported = getImportGoals({ domains: result.domains });
  assert.deepEqual(
    imported.map((g) => g.text),
    [ministry.goalText, 'Mục tiêu tự gõ trong cùng nhóm', later.goalText],
  );
  assert.equal(imported[0].sub.id, imported[1].sub.id);
  assert.equal(imported[0].group.id, imported[1].group.id);
  assert.deepEqual(imported[2], getImportGoals(target)[0]);
  assert.deepEqual(target, snapshot);
});

test('3 tầng: lấy từ Bộ gắn liên kết cho lĩnh vực con và nhóm; chép sang kế hoạch khác vẫn giữ', () => {
  const goals = withTierIds(goalsOf('ag-4').slice(0, 3));
  const first = mergeImportedGoals(
    emptyPlan(),
    curriculumAsSourcePlan(goals),
    goals.map((g) => `cg-${g.id}`),
    makeId,
  );
  const rows = first.domains.flatMap((d) => d.rows);
  const sub = rows.find((r) => r.kind === 'sub');
  const group = rows.find((r) => r.kind === 'group');
  assert.equal(sub.curriculumSubDomainId, goals[0].subDomainId);
  assert.equal(sub.curriculumText, goals[0].subDomain);
  assert.equal(group.curriculumExpectedResultId, goals[0].expectedResultId);
  assert.equal(group.curriculumText, goals[0].groupText);

  const source = { ...emptyPlan(), id: 'src', domains: first.domains };
  const ids = rows.filter((r) => r.kind === 'goal').map((r) => r.id);
  const copied = mergeImportedGoals(emptyPlan(), source, ids, makeId).domains.flatMap((d) => d.rows);
  assert.equal(copied.find((r) => r.kind === 'sub').curriculumSubDomainId, goals[0].subDomainId);
  assert.equal(copied.find((r) => r.kind === 'group').curriculumExpectedResultId, goals[0].expectedResultId);
});

test('3 tầng: đường dẫn nguồn cho nhóm; cây dùng id tầng', () => {
  assert.equal(curriculumSourceLink('ag-3', null, 'cgr-12'), '/education/curriculum-sources?ageGroup=ag-3#cgr-12');
  const tree = curriculumTree(withTierIds(goalsOf('ag-5')));
  assert.ok(tree[0].subs[0].id);
  assert.ok(tree[0].subs[0].groups[0].id);
});

test('3 tầng: mapper gửi id lĩnh vực con/nhóm đúng tầng và đọc lại câu gốc', () => {
  const refs = { schoolYearId: () => 1, ageGroupId: () => 2, domainId: () => 3, ageGroupCode: () => 'ag-3' };
  const req = toYearPlanRequest(
    {
      schoolYear: '2026 – 2027',
      ageGroupId: 'ag-3',
      title: 't',
      domains: [
        {
          name: 'Phát triển thể chất',
          rows: [
            { id: 'n1', kind: 'sub', text: 's', curriculumSubDomainId: 4, curriculumExpectedResultId: 99 },
            { id: 'n2', kind: 'group', text: 'g', curriculumExpectedResultId: 12 },
          ],
        },
      ],
      themes: [],
      breaks: [],
    },
    refs,
  );
  const [sub, group] = req.domains[0].rows;
  assert.equal(sub.curriculumSubDomainId, 4);
  assert.equal(sub.curriculumExpectedResultId, null);
  assert.equal(group.curriculumExpectedResultId, 12);
  const ui = toUiGoal(
    {
      id: 1,
      domains: [
        {
          domainId: 3,
          name: 'Phát triển thể chất',
          rows: [
            { id: 5, kind: 'sub', text: 's', curriculumSubDomainId: 4, curriculumText: 'Gốc' },
            { id: 6, kind: 'group', text: 'g', curriculumExpectedResultId: 12, curriculumText: 'Nhóm gốc' },
          ],
        },
      ],
    },
    refs,
  );
  assert.equal(ui.domains[0].rows[0].curriculumSubDomainId, 4);
  assert.equal(ui.domains[0].rows[1].curriculumText, 'Nhóm gốc');
});

test('EDU-28: lần 2 tích thêm nội dung cho mục tiêu Bộ đã có ⇒ thêm vào đúng mục tiêu, bỏ câu trùng', () => {
  const g = goalsOf('ag-3').find((x) => (x.contents || []).length >= 2);
  assert.ok(g, 'seed có mục tiêu kèm nội dung');
  const empty = { domains: DOMAINS.map((name, i) => ({ id: `d${i}`, name, rows: [] })) };
  let n = 0;
  const makeId = () => `t-${++n}`;
  const first = mergeImportedGoals(empty, curriculumAsSourcePlan([{ ...g, contents: [] }]), [`cg-${g.id}`], makeId);
  assert.equal(first.report.added, 1);
  const form = { domains: first.domains };
  const once = addContentsToExistingGoals(form, [{ ...g, contents: [g.contents[0]] }], makeId);
  assert.ok(once.matched.has(g.id));
  assert.equal(once.added, 1);
  const twice = addContentsToExistingGoals({ domains: once.domains }, [g], makeId);
  assert.equal(twice.added, g.contents.length - 1);
  const row = twice.domains.flatMap((d) => d.rows).find((r) => r.kind === 'goal' && r.curriculumGoalId === g.id);
  assert.deepEqual(
    row.contents.map((c) => c.text),
    g.contents,
  );
  const other = addContentsToExistingGoals({ domains: twice.domains }, [{ ...g, id: -1, goalText: 'Câu khác' }], makeId);
  assert.equal(other.matched.size, 0);
});
