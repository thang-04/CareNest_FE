import assert from 'node:assert/strict';
import { test } from 'node:test';
import { actionsMissing, isFailed, sampleWarning } from '@/utils/kitchen/inspectionRules';

test('dòng Không đạt (cảm quan hoặc xét nghiệm nhanh) chưa ghi biện pháp xử lý bị đếm; ghi chú toàn khoảng trắng vẫn thiếu', () => {
  const form = {
    rows: {
      a: { sensory: 'FAIL', note: '' },
      b: { sensory: 'PASS', rapidTest: 'FAIL', note: '  ' },
      c: { sensory: 'FAIL', note: 'Loại bỏ' },
      d: { sensory: 'PASS', note: '' },
    },
  };
  assert.deepEqual(actionsMissing('fresh', form), ['a', 'b']);
  assert.equal(isFailed(form.rows.d), false);
});

test('M5 không có cột cảm quan nên không bắt biện pháp xử lý', () => {
  assert.deepEqual(actionsMissing('sample', { rows: { a: { sensory: 'FAIL' } } }), []);
});

test('lưu mẫu: thức ăn đặc dưới 100 g, lỏng dưới 150 ml bị cảnh báo (QĐ 1246 Điều 7)', () => {
  assert.match(sampleWarning('weight', '80 g'), /100 g/);
  assert.match(sampleWarning('weight', '0,05 kg'), /100 g/);
  assert.match(sampleWarning('weight', '100 ml'), /150 ml/);
  assert.match(sampleWarning('weight', '0.1 lít'), /150 ml/);
  assert.equal(sampleWarning('weight', '100 g'), '');
  assert.equal(sampleWarning('weight', '150 ml'), '');
  assert.equal(sampleWarning('weight', '2 kg'), '');
});

test('lưu mẫu: nhiều món kiểm từng phần, thiếu đơn vị hoặc chữ lạ thì không cảnh báo', () => {
  assert.match(sampleWarning('weight', 'Cơm: 100 g; Canh: 120 ml'), /150 ml/);
  assert.equal(sampleWarning('weight', 'Cơm: 100 g; Canh: 200 ml'), '');
  assert.equal(sampleWarning('weight', '100'), '');
  assert.equal(sampleWarning('weight', 'một hộp'), '');
  assert.equal(sampleWarning('weight', ''), '');
});

test('lưu mẫu: nhiệt độ ngoài 2–8 °C bị cảnh báo (QĐ 1246 Điều 8)', () => {
  assert.equal(sampleWarning('temperature', '2–8 °C'), '');
  assert.equal(sampleWarning('temperature', '5'), '');
  assert.match(sampleWarning('temperature', '12 °C'), /2 °C đến 8 °C/);
  assert.match(sampleWarning('temperature', '-18 °C'), /2 °C đến 8 °C/);
  assert.match(sampleWarning('temperature', '1-4'), /2 °C đến 8 °C/);
  assert.equal(sampleWarning('container', '12'), '');
});
