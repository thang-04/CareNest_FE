import assert from 'node:assert/strict';
import { test } from 'node:test';

const { VP_TASK_AREAS, VP_TASK_PRESETS } = await import('@/models/account/vpTaskAreas');
const { applyVpPreset, vpAreasView, vpDraftOf, vpOverridesFromDraft, vpPresetsOf } = await import('@/utils/account/vpTasks');

test('Tiền 24/11/2026: mảng Kế hoạch giáo dục chỉ còn "Phụ trách chuyên môn" và cấu hình, không bật/tắt từng mã soạn/duyệt', () => {
  const education = VP_TASK_AREAS.find((a) => a.key === 'education');
  assert.equal(education.label, 'Kế hoạch giáo dục');
  assert.deepEqual(
    education.tasks.map((t) => t.code),
    ['EDU_ACADEMIC_DUTY', 'EDU_PLAN_CONFIG'],
  );
  assert.match(education.note, /chỉ xem bản đã ban hành/);
});

test('FR3.3: preset chuyên môn có mảng education; preset dinh dưỡng đưa education về chỉ xem', () => {
  const preset = (key) => VP_TASK_PRESETS.find((p) => p.key === key);
  assert.deepEqual(preset('academic').areas, ['children', 'education']);
  assert.ok(!preset('nutrition').areas.includes('education'));
  assert.deepEqual(preset('nutrition').offAreas, ['education']);
});

// Danh sách việc của một PHT như BE trả: 8 mã soạn/duyệt vẫn trong configurablePermissions nhưng không giao được theo người
const items = [
  { code: 'MENU_MANAGE', roleOn: false, on: false },
  { code: 'EDU_ACADEMIC_DUTY', roleOn: true, on: true },
  { code: 'EDU_PLAN_CONFIG', roleOn: false, on: false },
  { code: 'EDU_THEME_PLAN_APPROVE', roleOn: true, on: true },
];

test('PHT dinh dưỡng ⇒ REVOKE EDU_ACADEMIC_DUTY; 8 mã soạn/duyệt không hiện, không gửi (BE 1120)', () => {
  assert.ok(
    !vpAreasView(items)
      .flatMap((a) => a.tasks)
      .some((t) => t.code === 'EDU_THEME_PLAN_APPROVE'),
  );
  const draft = applyVpPreset(vpDraftOf(items), 'nutrition', items);
  assert.deepEqual(vpOverridesFromDraft(items, draft), [
    { permission: 'MENU_MANAGE', effect: 'GRANT' },
    { permission: 'EDU_ACADEMIC_DUTY', effect: 'REVOKE' },
  ]);
  assert.equal(vpPresetsOf(items, draft).find((p) => p.key === 'nutrition').applied, true);
});

test('PHT chuyên môn (mặc định) ⇒ không có ngoại lệ cho EDU_ACADEMIC_DUTY; bật lại sau dinh dưỡng thì bỏ REVOKE', () => {
  assert.deepEqual(vpOverridesFromDraft(items, vpDraftOf(items)), []);
  const nutrition = [{ ...items[1], on: false, effect: 'REVOKE' }];
  const back = applyVpPreset(vpDraftOf(nutrition), 'academic', nutrition);
  assert.deepEqual(vpOverridesFromDraft(nutrition, back), []);
});
