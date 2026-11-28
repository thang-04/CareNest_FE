import assert from 'node:assert/strict';
import { test } from 'node:test';
import readXlsxFile from 'read-excel-file/node';

import { CLASS_COLUMNS, LEADER_COLUMNS, ROOM_COLUMNS, SHEETS, TEACHER_COLUMNS } from '@/utils/school-config/yearSetupImport';
import { STAFF_COLUMNS, STAFF_SHEET } from '@/utils/school-config/staffImport';

const headersOf = async (file) => Object.fromEntries((await readXlsxFile(`public/templates/${file}`)).map((s) => [s.sheet, s.data[0]]));

test('file mẫu cấu hình trường có đúng dòng tiêu đề mà màn nhập đọc', async () => {
  assert.deepEqual(await headersOf('phong-lop-mau.xlsx'), { [SHEETS.rooms]: ROOM_COLUMNS, [SHEETS.classes]: CLASS_COLUMNS });
  assert.deepEqual(await headersOf('giao-vien-to-truong-mau.xlsx'), {
    [SHEETS.teachers]: TEACHER_COLUMNS,
    [SHEETS.leaders]: LEADER_COLUMNS,
  });
  assert.deepEqual(await headersOf('tai-khoan-nhan-su-mau.xlsx'), { [STAFF_SHEET]: STAFF_COLUMNS });
});
