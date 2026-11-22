import assert from 'node:assert/strict';
import { test } from 'node:test';
import { dailyOverviewValue } from '@/utils/assessment/dailyOverviewValues';

const saved = {
  generalRecorded: true,
  health: { signs: [] },
  meals: { LUNCH: 'AN_HET', AFTERNOON: 'AN_IT' },
  nap: 'NGU_TOT',
  emotion: 'HAPPY',
  participation: 'BINH_THUONG',
  behaviors: [],
};

test('chi tiết ngày hiển thị giá trị bình thường đã lưu, không để ô trống', () => {
  assert.equal(dailyOverviewValue(saved, 'health'), 'Bình thường');
  assert.equal(dailyOverviewValue(saved, 'nap'), 'Ngủ tốt');
  assert.equal(dailyOverviewValue(saved, 'emotion'), 'Vui vẻ');
  assert.equal(dailyOverviewValue(saved, 'behavior'), 'Bình thường');
  assert.equal(dailyOverviewValue(saved, 'participation'), 'Bình thường');
  assert.equal(dailyOverviewValue(saved, 'eating'), 'Bữa trưa: Ăn hết · Bữa chiều: Ăn ít');
});

test('chỉ lưu kỹ năng hoặc chưa có bản ghi không được hiện Hoạt động chung bình thường', () => {
  for (const row of [undefined, { ...saved, generalRecorded: false, skillsRecorded: true, recorded: true }]) {
    for (const key of ['health', 'eating', 'nap', 'emotion', 'behavior', 'participation']) {
      assert.equal(dailyOverviewValue(row, key), 'Chưa lưu');
    }
  }
});

test('giữ đúng từng mức bất thường và hành vi tích cực đã lưu', () => {
  const row = {
    ...saved,
    health: { signs: ['FEVER'] },
    nap: 'KHONG_NGU',
    emotion: 'UPSET',
    behaviors: ['HOP_TAC_TOT'],
    participation: 'CHUA_TICH_CUC',
  };
  assert.equal(dailyOverviewValue(row, 'health'), 'Sốt');
  assert.equal(dailyOverviewValue(row, 'nap'), 'Không ngủ');
  assert.equal(dailyOverviewValue(row, 'emotion'), 'Quấy khóc');
  assert.equal(dailyOverviewValue(row, 'behavior'), 'Hợp tác tốt');
  assert.equal(dailyOverviewValue(row, 'participation'), 'Chưa tích cực');
});

test('không tự điền Ngủ tốt hoặc Ăn hết nếu dữ liệu đã lưu thiếu trường', () => {
  const row = { generalRecorded: true, meals: {}, nap: null, emotion: null, participation: null };
  for (const key of ['eating', 'nap', 'emotion', 'participation']) {
    assert.equal(dailyOverviewValue(row, key), 'Chưa ghi nhận');
  }
});
