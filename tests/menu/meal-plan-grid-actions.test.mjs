import assert from 'node:assert/strict';
import { test } from 'node:test';

const { dayReasons, replaceDish } = await import('@/utils/menu-planning/mealPlanGrid');

const DAY = '2026-11-09';
const draft = {
  days: [
    {
      date: DAY,
      off: false,
      note: '',
      items: [
        { session: 'LUNCH', block: 'KINDERGARTEN', dishId: '1', dishName: 'Cơm tẻ', dishType: 'RICE' },
        { session: 'LUNCH', block: 'KINDERGARTEN', dishId: '2', dishName: 'Canh bí', dishType: 'SOUP' },
        { session: 'LUNCH', block: 'NURSERY', dishId: '1', dishName: 'Cơm tẻ', dishType: 'RICE' },
      ],
    },
  ],
};

test('NUT-18: Thay món giữ đúng vị trí, chỉ đổi ô của khối và bữa đó', () => {
  const next = replaceDish(draft, DAY, 'KINDERGARTEN', 'LUNCH', '1', { id: 9, name: 'Cơm gạo lứt', type: 'RICE' });
  const items = next.days[0].items;
  assert.deepEqual(items[0], { session: 'LUNCH', block: 'KINDERGARTEN', dishId: '9', dishName: 'Cơm gạo lứt', dishType: 'RICE' });
  assert.equal(items[1].dishId, '2');
  assert.equal(items[2].dishId, '1', 'khối nhà trẻ giữ nguyên');
});

test('NUT-18: Thay bằng món đã có trong ô thì không đổi gì', () => {
  const next = replaceDish(draft, DAY, 'KINDERGARTEN', 'LUNCH', '1', { id: 2, name: 'Canh bí', type: 'SOUP' });
  assert.deepEqual(next.days[0], draft.days[0]);
});

test('NUT-08: Lý do ngắn đầu cột — lỗi chặn trước, tối đa 2 nhãn, phần còn lại đếm vào more', () => {
  const plan = {
    issues: [
      { severity: 'WARNING', code: 'OVER_BUDGET', date: DAY, message: 'Tiền ăn vượt giá suất 2.000 đ' },
      { severity: 'BLOCKING', code: 'NOT_BALANCED', date: DAY, message: 'Hơi ít năng lượng' },
      { severity: 'BLOCKING', code: 'NOT_BALANCED', date: DAY, message: 'Béo thấp' },
      { severity: 'WARNING', code: 'DISH_REPEATED', date: DAY, message: 'Món lặp trong tuần' },
      { severity: 'INFO', code: 'MICRONUTRIENT_OFF', date: DAY, message: 'bỏ qua mức INFO' },
      { severity: 'BLOCKING', code: 'NOT_BALANCED', date: '2026-11-10', message: 'ngày khác' },
    ],
  };
  const why = dayReasons(plan, DAY);
  assert.deepEqual(
    why.reasons.map((r) => [r.label, r.tone]),
    [
      ['Chưa cân đối', 'red'],
      ['Vượt giá suất', 'orange'],
    ],
  );
  assert.equal(why.reasons[0].title, 'Hơi ít năng lượng\nBéo thấp');
  assert.equal(why.more, 1);
  assert.equal(why.all.length, 3);
});

test('NUT-08: Mã lạ hiện "Lưu ý khác"; ngày không có lưu ý trả null', () => {
  const why = dayReasons({ issues: [{ severity: 'WARNING', code: 'NEW_CODE', date: DAY, message: 'Câu BE mới' }] }, DAY);
  assert.deepEqual(why.reasons, [{ label: 'Lưu ý khác', tone: 'orange', messages: ['Câu BE mới'], title: 'Câu BE mới' }]);
  assert.equal(dayReasons({ issues: [] }, DAY), null);
});
