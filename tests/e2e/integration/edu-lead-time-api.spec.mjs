import { test, expect } from '@playwright/test';
import { api, beReachable, sql } from '../support/realBe.mjs';

// Integration spec 003 (mốc duyệt theo thời gian dạy) trên BE thật + dữ liệu dev (E2E_PG_DB=carenest_merge):
// teamlead34 = GVCN lớp 3–4 tuổi (cơ sở A), teacher6 = GV thứ hai, viceprincipal = PHT.
// Bộ test đặt ngày học kỳ của năm học đang chạy và lùi ngày mở lớp về trước học kỳ để có tình huống quá hạn.
test.describe.configure({ mode: 'serial' });

const U = { vp: 'viceprincipal@gmail.com', ht: 'principal@gmail.com', tl: 'teamlead34@gmail.com', gv2: 'teacher6@gmail.com' };
const DOCS = '/education-plans/class-docs';
const isoPlus = (days) => {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};
let cls;
let sp1;

const packageOf = async (user) => {
  const docs = await api(user, 'GET', DOCS);
  return docs.data.semesterPackages?.find((p) => String(p.classId) === String(cls.id) && p.semesterNo === 1);
};

test.beforeAll(async () => {
  test.skip(!(await beReachable()), 'BE thật không chạy ở :8080');
  const me = await api(U.tl, 'GET', '/accounts/me');
  const docs = await api(U.tl, 'GET', DOCS);
  cls = docs.data.classes.find((c) => String(c.homeroomTeacherId) === String(me.data.userId));
  test.skip(!cls, 'teamlead34 không có lớp chủ nhiệm');
  const year = sql(`select school_year_id from classrooms where id = ${cls.id}`);
  sql(
    `update school_years set semester1_start='2026-09-01', semester1_end='2027-01-15', semester2_start='2027-01-18', ` +
      `semester2_end='2027-05-31' where id = ${year}`,
  );
  sql(`update classrooms set created_at='2026-08-01' where id = ${cls.id}`);
  // Chạy lại được: đưa các gói học kỳ của lớp về Nháp trước khi lưu lại lịch nhánh (gói đang Chờ duyệt khóa lịch nhánh),
  // bỏ lần mở hạn / gửi của lần chạy trước (dữ liệu dev do bộ test tạo)
  sql(
    `update edu_class_docs set status='DRAFT', history='[]'::jsonb, approvals='[]'::jsonb ` +
      `where kind='semester' and classroom_id=${cls.id}`,
  );
  // Lưu lại lịch nhánh (không đổi nội dung) để BE tạo gói học kỳ / hồ sơ chủ đề còn thiếu
  const branch = docs.data.branchPlans.find((b) => String(b.classId) === String(cls.id));
  test.skip(!branch, 'Lớp chưa có lịch chủ đề nhánh');
  const saved = await api(U.tl, 'PUT', `${DOCS}/branch/${branch.id}`, {
    body: branch,
    headers: { 'X-Class-Doc-Version': String(branch.version) },
  });
  expect(saved.status, saved.desc).toBe(200);
  sp1 = await packageOf(U.tl);
});

test('IT-003-01 gói học kỳ có hạn = ngày bắt đầu học kỳ; đã qua hạn mà chưa gửi ⇒ Quá hạn, gửi bị chặn 7385', async () => {
  expect(sp1, 'gói học kỳ 1 của lớp').toBeTruthy();
  expect(sp1.deadline).toBe('2026-09-01');
  if (sp1.status !== 'DRAFT') test.skip(true, `gói đang ${sp1.status} từ lần chạy trước`);
  expect(sp1.deadlineState).toBe('OVERDUE');
  expect(sp1.blockedReason).toBe('DEADLINE_PASSED');
  const sent = await api(U.tl, 'POST', `${DOCS}/semester/${sp1.id}/actions`, {
    body: { action: 'submit' },
    headers: { 'X-Class-Doc-Version': String(sp1.version) },
  });
  expect(sent.status).toBe(409);
  expect(sent.errorCode).toBe(7385);
});

// Spec 005 FR-021: chỉ Hiệu trưởng mở hạn (PHT bị từ chối 403)
test('IT-003-02 chỉ HT mở hạn, bắt buộc lý do + hạn mới sau hôm nay; GVCN nhận thông báo có đường dẫn', async () => {
  const current = await packageOf(U.ht);
  test.skip(current?.status !== 'DRAFT' || current.deadlineState !== 'OVERDUE', 'gói không còn quá hạn');
  expect(current.canExtend).toBe(true);
  // Tiền 11/11/2026: PHT không soạn/duyệt chỉ thấy khung gói chưa ban hành (không trạng thái, hạn, nút mở hạn)
  const vpView = await packageOf(U.vp);
  expect(vpView.unreleased).toBe(true);
  expect(vpView.status).toBeUndefined();
  expect(vpView.deadlineState).toBeUndefined();
  expect(vpView.canExtend).toBeUndefined();
  expect((await packageOf(U.tl)).canExtend).toBe(false);
  const act = (user, body) =>
    api(user, 'POST', `${DOCS}/semester/${current.id}/actions`, { body, headers: { 'X-Class-Doc-Version': String(current.version) } });
  expect((await act(U.tl, { action: 'extend', note: 'x', deadline: isoPlus(5) })).status).toBe(403);
  expect((await act(U.vp, { action: 'extend', note: 'x', deadline: isoPlus(5) })).status).toBe(403);
  expect((await act(U.ht, { action: 'extend', note: ' ', deadline: isoPlus(5) })).status).toBe(400);
  expect((await act(U.ht, { action: 'extend', note: 'Lý do', deadline: isoPlus(0) })).status).toBe(400);
  const ok = await act(U.ht, { action: 'extend', note: '[E2E] Lớp mới nhận GV', deadline: isoPlus(5) });
  expect(ok.status, ok.desc).toBe(200);
  expect(ok.data.extendedTo).toBe(isoPlus(5));
  expect(ok.data.deadlineState).toBe('NEAR');
  const notes = await api(U.tl, 'GET', '/me/notifications');
  const extended = notes.data.items.find((n) => n.type === 'EDU_DEADLINE_EXTENDED' && n.link === `/education/class/${cls.id}/semesters/1`);
  expect(extended, 'thông báo mở hạn cho GVCN').toBeTruthy();
});

test('IT-003-03 sau mở hạn, lần gửi không còn bị chặn vì quá hạn', async () => {
  const current = await packageOf(U.tl);
  test.skip(current?.status !== 'DRAFT', `gói đang ${current?.status}`);
  const sent = await api(U.tl, 'POST', `${DOCS}/semester/${current.id}/actions`, {
    body: { action: 'submit', note: '[E2E] Gửi học kỳ 1' },
    headers: { 'X-Class-Doc-Version': String(current.version) },
  });
  // Dữ liệu dev có thể còn tuần chưa đặt tên nhánh (7112) — miễn không còn bị chặn vì hạn
  expect(sent.errorCode).not.toBe(7385);
  if (sent.status === 200) expect(sent.data.status).toBe('REVIEW');
});

test('IT-003-04 hồ sơ chủ đề: hạn = ngày bắt đầu chủ đề, không còn cách gửi (spec 004); giáo án tuần không nhận phần ngày (400)', async () => {
  const docs = await api(U.tl, 'GET', DOCS);
  const dossiers = (docs.data.themeDossiers || []).filter((d) => String(d.classId) === String(cls.id));
  for (const d of dossiers) {
    expect(d.deadline).toBeTruthy();
    expect(d.submitMode).toBeUndefined();
    expect(['NORMAL', 'NEAR', 'OVERDUE', 'ON_TIME', 'LATE']).toContain(d.deadlineState);
  }
  const week = (docs.data.weekPlans || []).find((w) => String(w.classId) === String(cls.id));
  test.skip(!week, 'Lớp chưa có giáo án tuần');
  const res = await api(U.tl, 'PUT', `${DOCS}/week/${week.id}`, {
    body: { ...week, days: [] },
    headers: { 'X-Class-Doc-Version': String(week.version), 'X-Dossier-Version': String(week.dossierVersion) },
  });
  expect([400, 409]).toContain(res.status);
});

test('IT-003-05 GV thứ hai thấy đủ lịch nhánh dự kiến (không cần ban hành), không sửa được; không thấy nút mở hạn', async () => {
  const docs = await api(U.gv2, 'GET', DOCS);
  const branch = docs.data.branchPlans.find((b) => String(b.classId) === String(cls.id));
  expect(branch.branchUnreleasedSemesters).toBeUndefined();
  expect(branch.permissions?.canEdit).toBe(false);
  const pkg = docs.data.semesterPackages.find((p) => String(p.classId) === String(cls.id) && p.semesterNo === 1);
  // Gói chưa ban hành: GV thứ hai chỉ nhận khung (không cờ canExtend); đã ban hành thì canExtend = false
  if (pkg) expect(pkg.canExtend ?? false).toBe(false);
});
