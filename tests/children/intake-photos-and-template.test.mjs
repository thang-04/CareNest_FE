import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { validateChildInfo } from '@/utils/children/childrenValidation';
import { emptyChildInfo, emptyGuardian } from '@/utils/children/childrenHelpers';
import { IMPORT_COLUMNS } from '@/models/children/childrenConstants';
import { CHILD_IMPORT_TEMPLATE_URL } from '@/utils/children/importTemplate';

const { readSheet } = await import('read-excel-file/node');
const photo = { name: 'a.png' };
const twoGuardians = (overrides = {}) => ({ ...emptyChildInfo(), guardians: [emptyGuardian(), emptyGuardian()], ...overrides });

// G94-180/CHD-15 (user chốt 2026-11-26): form Tiếp nhận trẻ bắt buộc ảnh của trẻ và ảnh từng phụ huynh.
test('tiếp nhận: thiếu ảnh của trẻ hoặc phụ huynh nào ⇒ báo theo ô', () => {
  const errors = validateChildInfo(twoGuardians(), { requirePhotos: true });
  assert.equal(errors.photo, 'Tải ảnh của trẻ');
  assert.equal(errors['guardians.0.photo'], 'Tải ảnh phụ huynh 1');
  assert.equal(errors['guardians.1.photo'], 'Tải ảnh phụ huynh 2');

  const withPhotos = twoGuardians({
    photoFile: photo,
    guardians: [
      { ...emptyGuardian(), photoFile: photo },
      { ...emptyGuardian(), photoFile: photo },
    ],
  });
  const ok = validateChildInfo(withPhotos, { requirePhotos: true });
  assert.equal(ok.photo, undefined);
  assert.equal(ok['guardians.0.photo'], undefined);
  assert.equal(ok['guardians.1.photo'], undefined);
});

test('sửa hồ sơ (không truyền requirePhotos) không đòi ảnh', () => {
  const errors = validateChildInfo(twoGuardians(), { requireRecipient: false });
  assert.equal(errors.photo, undefined);
  assert.equal(errors['guardians.0.photo'], undefined);
});

test('form Tiếp nhận truyền requirePhotos và đánh dấu ô ảnh bắt buộc', () => {
  assert.match(readFileSync('src/pages/children/EnrollChildPage.jsx', 'utf8'), /requirePhotos: true/);
  const fields = readFileSync('src/components/children/ChildInfoFields.jsx', 'utf8');
  assert.equal(fields.match(/<(PortraitPicker|IntakePortraitField)\s+required/g)?.length, 4);
});

// File mẫu .xlsx (26/11/2026): CSV mở bằng Excel đảo ngày/tháng, bỏ số 0 đầu, máy vùng Việt Nam dồn vào một cột.
test('file mẫu .xlsx: trang đầu đúng tiêu đề IMPORT_COLUMNS, chưa có dòng dữ liệu', async () => {
  assert.equal(CHILD_IMPORT_TEMPLATE_URL, '/templates/tiep-nhan-tre-mau.xlsx');
  const rows = await readSheet(readFileSync('public' + CHILD_IMPORT_TEMPLATE_URL));
  assert.deepEqual(
    rows[0],
    IMPORT_COLUMNS.map((c) => c.label),
  );
  assert.equal(rows.length, 1);
});

test('file mẫu .xlsx: mọi ô dữ liệu để dạng chữ (giữ dd/mm/yyyy và số 0 đầu)', async () => {
  const { default: JSZip } = await import('jszip');
  const zip = await JSZip.loadAsync(readFileSync('public' + CHILD_IMPORT_TEMPLATE_URL));
  const styles = await zip.file('xl/styles.xml').async('string');
  const sheet = await zip.file('xl/worksheets/sheet1.xml').async('string');
  const xfs = [...styles.match(/<cellXfs[\s\S]*?<\/cellXfs>/)[0].matchAll(/<xf [^>]*>/g)].map((m) => m[0]);
  const textStyle = (s) => /numFmtId="49"/.test(xfs[Number(s)] || '');
  // 500 dòng dữ liệu (dòng 2..501, = giới hạn 500 trẻ), đủ 35 cột, ô nào cũng dạng chữ
  for (const ref of ['A2', 'B2', 'F2', 'G2', 'X2', 'AI2', 'B501']) {
    const cell = sheet.match(new RegExp(`<c r="${ref}" s="(\\d+)"`));
    assert.ok(cell && textStyle(cell[1]), ref + ' dạng chữ');
  }
});
