import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { beforeEach, test } from 'node:test';

/*
 * G94-180/CHD-04 (user chốt 2026-11-24): mở lại hồ sơ không còn "Giữ điểm trường cũ"; ô Điểm trường mặc định điểm trường của trẻ
 * (duplicate-check trả campusId) nếu điểm trường đó có trong năm tiếp nhận lại, ngược lại trống và bắt chọn.
 */
const storage = new Map();
globalThis.localStorage = {
  getItem: (k) => storage.get(k) ?? null,
  setItem: (k, v) => storage.set(k, String(v)),
  removeItem: (k) => storage.delete(k),
  clear: () => storage.clear(),
};
globalThis.window = new EventTarget();

const { resetDb } = await import('@/mocks/mockDatabase');
const { childrenMockRepository: children, ensureChildRecordsSeeded } = await import('@/services/children/mock/childrenMockRepository');
const { defaultReadmitCampus } = await import('@/utils/children/readmit');
const { emptyChildInfo, emptyDeclaration } = await import('@/utils/children/childrenHelpers');
const { todayInput } = await import('@/utils/format');
const { filledMedicalHistory, filledProfile } = await import('./profileFixture.mjs');

const read = (f) => readFileSync(f, 'utf8');
const PRINCIPAL = { id: 'u_hung', role: 'PRINCIPAL', campusId: 'c1' };

beforeEach(() => {
  resetDb();
  ensureChildRecordsSeeded();
});

test('defaultReadmitCampus: điểm trường của trẻ có trong năm ⇒ chọn sẵn; so id theo chuỗi', () => {
  assert.equal(defaultReadmitCampus({ campusId: '2' }, [{ id: '1' }, { id: '2' }]), '2');
  assert.equal(defaultReadmitCampus({ campusId: 2 }, [{ id: '1' }, { id: '2' }]), '2');
});

test('defaultReadmitCampus: điểm trường không có trong năm, thiếu campusId hoặc chưa có hồ sơ ⇒ trống', () => {
  assert.equal(defaultReadmitCampus({ campusId: '3' }, [{ id: '1' }, { id: '2' }]), '');
  assert.equal(defaultReadmitCampus({ campusId: null }, [{ id: '1' }]), '');
  assert.equal(defaultReadmitCampus(null, [{ id: '1' }]), '');
  assert.equal(defaultReadmitCampus({ campusId: '1' }, []), '');
});

test('đổi sang năm không có điểm trường cũ ⇒ trống; đổi lại năm có ⇒ chọn sẵn lại', () => {
  const duplicate = { campusId: '2' };
  assert.equal(defaultReadmitCampus(duplicate, [{ id: '2' }]), '2');
  assert.equal(defaultReadmitCampus(duplicate, [{ id: '1' }]), '');
});

test('trang mở lại hồ sơ: bỏ "Giữ điểm trường cũ", điểm trường theo năm tiếp nhận lại, luôn gửi campusId', () => {
  const page = read('src/pages/children/EnrollChildPage.jsx');
  assert.doesNotMatch(page, /Giữ điểm trường cũ/);
  assert.match(page, /useMasterData\(readmitYear\?\.id \?\? null\)/);
  assert.match(page, /defaultReadmitCampus\(duplicate, readmitCampusOptions\)/);
  assert.match(page, /Chọn điểm trường/);
  assert.match(page, /campusId: readmitCampusId,/);
  assert.doesNotMatch(page, /readmitCampusId && \{/);
  assert.match(page, /err\.details\?\.campusId/);
});

test('BE giả: duplicate-check trẻ đã nghỉ trả campusId của trẻ (G94-180/CHD-04)', async () => {
  const guardian = { fullName: 'Phụ huynh mở lại', relation: 'Mẹ', phone: '0900 000 910', idNumber: '999900000901', email: '' };
  const child = await children.enrollChild(
    {
      child: {
        ...emptyChildInfo(),
        fullName: 'Trẻ mở lại campus',
        dateOfBirth: '2023-05-17',
        gender: 'FEMALE',
        guardians: [guardian],
        profile: filledProfile(),
      },
      declaration: { ...emptyDeclaration(), medicalHistory: filledMedicalHistory() },
      campusId: 'c1',
      classId: '',
    },
    PRINCIPAL,
  );
  await children.withdrawChild(child.id, { leftAt: todayInput(), reason: 'Chuyển nơi ở (giả)' }, PRINCIPAL);
  const dup = await children.checkDuplicate(
    { fullName: 'Trẻ mở lại campus', dateOfBirth: '2023-05-17', guardianIdNumbers: [guardian.idNumber] },
    PRINCIPAL,
  );
  assert.equal(dup.kind, 'LEFT');
  assert.equal(dup.campusId, 'c1');
});
