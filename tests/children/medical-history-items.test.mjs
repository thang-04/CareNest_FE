import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

const { splitHistoryText, joinHistoryText } = await import('@/models/children/childProfile');

const read = (path) => readFileSync(new URL(`../../${path}`, import.meta.url), 'utf8');

test('splitHistoryText tách theo dấu chấm phẩy, bỏ khoảng trắng và mục rỗng', () => {
  assert.deepEqual(splitHistoryText('Hen phế quản; Viêm da'), ['Hen phế quản', 'Viêm da']);
  assert.deepEqual(splitHistoryText(' A ;; B ; '), ['A', 'B']);
  assert.deepEqual(splitHistoryText(''), []);
  assert.deepEqual(splitHistoryText(undefined), []);
});

test('splitHistoryText giữ dữ liệu cũ có dấu phẩy là một mục', () => {
  assert.deepEqual(splitHistoryText('hen, viêm'), ['hen, viêm']);
});

test('joinHistoryText nối bằng "; " và khớp với splitHistoryText', () => {
  assert.equal(joinHistoryText(['A', 'B']), 'A; B');
  assert.equal(joinHistoryText([]), '');
  assert.deepEqual(splitHistoryText(joinHistoryText(['Hen phế quản', 'Viêm da'])), ['Hen phế quản', 'Viêm da']);
});

test('khai báo sức khỏe và phiếu khám bước 1 dùng ChipListInput cho tiền sử', () => {
  assert.match(read('src/components/children/HealthDeclarationFields.jsx'), /<ChipListInput/);
  assert.match(read('src/components/children/exam/ExamAdminStep.jsx'), /<ChipListInput/);
});
