import assert from 'node:assert/strict';
import { beforeEach, test } from 'node:test';
const storage = new Map();
globalThis.localStorage = { getItem: (k) => storage.get(k) ?? null, setItem: (k,v) => storage.set(k,String(v)), removeItem: (k) => storage.delete(k), clear: () => storage.clear() };
globalThis.window = new EventTarget();
const { readDb, writeDb, resetDb } = await import('@/mocks/mockDatabase');
const { childrenMockRepository: children, ensureChildRecordsSeeded } = await import('@/services/children/mock/childrenMockRepository');
const { guardianMockRepository: accounts } = await import('@/services/account/mock/guardianMockRepository');
const { activateChosenGuardian } = await import('@/services/account/guardianService');
const { emptyChildInfo, emptyDeclaration } = await import('@/utils/children/childrenHelpers');
const { readEnrollmentCsv } = await import('@/services/children/mock/enrollmentImport');
const { IMPORT_COLUMNS } = await import('@/models/children/childrenConstants');
const { filledProfile, filledMedicalHistory, filledImportColumns } = await import('./profileFixture.mjs');
const VP = { id: 'u_lan', role: 'VICE_PRINCIPAL', campusId: 'c1' };
const parent = (i, selected = false) => ({ fullName: 'Phụ huynh chọn ' + i, relation: i === 1 ? 'Mẹ' : 'Bố', phone: '090000057' + i, idNumber: '99990000057' + i, email: '', accountRecipient: selected });
const payload = (guardians) => ({ child: { ...emptyChildInfo(), fullName: 'Trẻ chọn tài khoản', dateOfBirth: '2023-05-05', gender: 'MALE', guardians, profile: filledProfile() }, declaration: { ...emptyDeclaration(), medicalHistory: filledMedicalHistory() } });
beforeEach(() => { resetDb(); ensureChildRecordsSeeded(); });
test('form: giữ cả hai liên hệ, chỉ tạo tài khoản cho bố được chọn', async () => {
  const saved = await children.enrollChild(payload([parent(1), parent(2,true)]), VP);
  assert.equal(saved.guardians.length, 2);
  assert.deepEqual(saved.guardians.map(g => g.accountStatus), ['NOT_ACTIVATED','ACTIVE']);
  assert.equal(saved.guardianAccounts.length, 1);
  assert.equal(saved.guardianAccounts[0].phone, parent(2).phone);
  assert.equal((await accounts.listGuardians(saved.id, VP)).length, 1);
  assert.ok(!readDb().parentAccounts.some(a => a.phone === parent(1).phone));
});
test('form: thiếu hoặc chọn hai người đều bị chặn, không tạo hồ sơ hay tài khoản', async () => {
  const before = readDb();
  for (const contacts of [[parent(1),parent(2)], [parent(1,true),parent(2,true)]]) {
    await assert.rejects(children.enrollChild(payload(contacts), VP), e => e.status === 422 && !!e.details.accountRecipient);
  }
  assert.equal(readDb().children.length, before.children.length);
  assert.equal(readDb().parentAccounts.length, before.parentAccounts.length);
});
test('Excel: chỉ lưu hồ sơ, người được chọn kích hoạt sau; chặn lựa chọn cũ', async () => {
  const count = readDb().parentAccounts.length;
  const imported = await children.importChildren([payload([parent(1),parent(2,true)])], VP);
  assert.equal(readDb().parentAccounts.length, count);
  const contacts = await accounts.getAccountCandidates(imported.ids[0], VP);
  const old = contacts.find(g => g.accountRecipient);
  const next = contacts.find(g => !g.accountRecipient);
  await accounts.selectAccountRecipient(imported.ids[0], next.id, VP);
  await assert.rejects(accounts.activateGuardians(imported.ids[0], VP, old.id), e => e.status === 409);
  const [result] = await accounts.activateGuardians(imported.ids[0], VP, next.id);
  assert.equal(result.username, parent(1).phone);
  assert.equal(readDb().parentAccounts.length, count + 1);
  assert.deepEqual(await accounts.activateGuardians(imported.ids[0], VP, next.id), []);
  await assert.rejects(accounts.selectAccountRecipient(imported.ids[0], old.id, VP), e => e.status === 409);
});
test('hộp thoại: kích hoạt thẳng người đang chọn ở dropdown; khác người nhận đã lưu thì đổi người nhận trước', async () => {
  const count = readDb().parentAccounts.length;
  const imported = await children.importChildren([payload([parent(1),parent(2,true)])], VP);
  const childId = imported.ids[0];
  const contacts = await accounts.getAccountCandidates(childId, VP);
  const saved = contacts.find(g => g.accountRecipient);
  const other = contacts.find(g => !g.accountRecipient);
  const [result] = await activateChosenGuardian(childId, other.id, saved.id, VP);
  assert.equal(result.username, parent(1).phone);
  assert.equal(readDb().parentAccounts.length, count + 1);
  const after = await accounts.getAccountCandidates(childId, VP);
  assert.equal(after.find(g => g.accountRecipient).id, other.id);
});
test('hộp thoại: chọn đúng người nhận đã lưu thì chỉ kích hoạt, không ghi lịch sử đổi người nhận', async () => {
  const imported = await children.importChildren([payload([parent(1),parent(2,true)])], VP);
  const childId = imported.ids[0];
  const saved = (await accounts.getAccountCandidates(childId, VP)).find(g => g.accountRecipient);
  const history = () => (readDb().children.find(c => c.id === childId).history || []).length;
  const before = history();
  const [result] = await activateChosenGuardian(childId, saved.id, saved.id, VP);
  assert.equal(result.username, parent(2).phone);
  assert.equal(history(), before);
});
test('CSV: đọc riêng nhóm phụ huynh 2, 3 và CCCD chọn; file cũ một người vẫn dùng được', () => {
  const raw = { fullName:'Trẻ CSV',dateOfBirth:'05/05/2023',gender:'Nam',guardianName:'Mẹ CSV',relation:'Mẹ',phone:parent(1).phone,guardianIdNumber:parent(1).idNumber,guardianName2:'Bố CSV',relation2:'Bố',phone2:parent(2).phone,guardianIdNumber2:parent(2).idNumber,accountRecipientIdNumber:parent(2).idNumber,...filledImportColumns() };
  const csv = [IMPORT_COLUMNS.map(c => c.label),IMPORT_COLUMNS.map(c => raw[c.key] || '')].map(row=>row.map(v=>'"'+String(v).replaceAll('"','""')+'"').join(',')).join('\n');
  const parsed = readEnrollmentCsv(csv);
  assert.deepEqual(parsed.missingColumns, []);
  const contacts = parsed.rows[0].payload.child.guardians;
  assert.equal(contacts.length, 2);
  assert.equal(contacts[0].fullName, 'Mẹ CSV');
  assert.deepEqual(contacts.map(g=>g.accountRecipient), [false,true]);
});
test('hồ sơ cũ nhiều người chưa chọn: không tự kích hoạt, không xóa liên kết cũ', async () => {
  const child = readDb().children.find(c => c.campusId === 'c1' && c.status !== 'LEFT');
  writeDb(db => { const target = db.children.find(c=>c.id===child.id); target.guardians = [parent(1),parent(2)]; });
  const before = readDb().parentAccounts.map(a=>[a.id,a.childIds]);
  await assert.rejects(accounts.activateGuardians(child.id, VP), e=>e.status===409);
  assert.deepEqual(readDb().parentAccounts.map(a=>[a.id,a.childIds]), before);
  assert.deepEqual(await accounts.listGuardians(child.id, VP), []);
});

test('sửa hồ sơ bảo toàn lựa chọn: cờ client không được cấp tài khoản cho người thứ hai', async () => {
  const saved = await children.enrollChild(payload([parent(1,true),parent(2)]), VP);
  const edited = await children.updateChild(saved.id, { child: { ...saved, guardians: saved.guardians.map(g => ({ ...g, accountRecipient: true })) }, reason: 'Cập nhật liên hệ giả' }, VP);
  assert.deepEqual(edited.guardians.map(g => g.accountRecipient), [true,false]);
  assert.equal((await accounts.listGuardians(saved.id, VP)).length, 1);
  assert.ok(!readDb().parentAccounts.some(a=>a.phone===parent(2).phone));
});

test('batch CHD-04: tên/ngày sinh giống nhau nhưng khác gia đình vẫn nhập được', async () => {
  const result = await children.importChildren([payload([parent(1)]),payload([parent(2)])], VP);
  assert.equal(result.created, 2);
});
test('batch CHD-04: cùng trẻ với mẹ ở dòng1, mẹ và bố ở dòng2 bị chặn trước ghi', async () => {
  const before=readDb().children.length;
  await assert.rejects(children.importChildren([payload([parent(1)]),payload([parent(1,true),parent(2)])], VP),e=>e.status===422);
  assert.equal(readDb().children.length,before);
});
