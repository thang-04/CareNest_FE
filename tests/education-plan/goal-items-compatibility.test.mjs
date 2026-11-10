import assert from 'node:assert/strict';
import { test } from 'node:test';
import { allGoalItems, goalRequirements } from '@/models/education-plan/educationPlanConstants';

test('mục tiêu dạng rows chỉ lấy hàng goal và giữ nội dung đã lưu', () => {
  const goal = { id: 'g1', kind: 'goal', text: 'Mục tiêu mẫu', contents: [{ id: 'c1', text: 'Nội dung mẫu' }] };
  const plan = { domains: [{ name: 'Lĩnh vực mẫu', rows: [{ id: 's1', kind: 'sub', text: 'Nhóm' }, goal] }] };
  assert.deepEqual(allGoalItems(plan), [{ ...goal, domain: 'Lĩnh vực mẫu' }]);
  assert.equal(plan.domains[0].rows.length, 2);
});

test('dữ liệu items cũ giữ mã mục tiêu và yêu cầu cần đạt', () => {
  const item = { id: 'g1', code: 'TC1', text: 'Mục tiêu mẫu', requirements: [{ id: 'r1', code: 'TC1.1', text: 'Yêu cầu mẫu' }] };
  const plan = { domains: [{ name: 'Lĩnh vực mẫu', items: [item] }] };
  assert.deepEqual(allGoalItems(plan), [{ ...item, domain: 'Lĩnh vực mẫu' }]);
  assert.equal(goalRequirements(plan)[0].goalCode, 'TC1');
  assert.equal(goalRequirements(plan)[0].code, 'TC1.1');
});

test('kế hoạch chưa có lĩnh vực hoặc lĩnh vực trống không làm sập danh sách', () => {
  for (const plan of [null, {}, { domains: [] }, { domains: [{ name: 'Lĩnh vực trống' }] }]) {
    assert.deepEqual(allGoalItems(plan), []);
  }
});
