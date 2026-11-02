import { test, expect } from '@playwright/test';
import {
  E2E,
  USERS,
  addTeamLeader,
  api,
  beReachable,
  cleanup,
  editHeaders,
  ids,
  newSession,
  removeTeamLeader,
  sql,
  tokenOf,
  BE_URL,
  yearPlanBody,
} from '../support/realBe.mjs';

// Integration: contract API thật mà UI Kế hoạch giáo dục dùng (BE:EDU-01..23), đi qua Keycloak thật và DB dev.
// Chạy tuần tự: các bước sau dùng kế hoạch/tài liệu bước trước tạo ra.
test.describe.configure({ mode: 'serial' });

const GOALS = '/education-plans/goals';
const DOCS = '/education-plans/class-docs';
const s = { tl: newSession(), vp: newSession() };
let plan;
let themeId;
let ref;

test.beforeAll(async () => {
  test.skip(!(await beReachable()), 'BE thật không chạy ở :8080');
  cleanup();
  ref = ids();
  addTeamLeader('teacher1');
});

test.afterAll(() => {
  if (process.env.E2E_KEEP_DATA !== '1') cleanup();
});

test('IT-01 cấu hình kế hoạch: mọi vai trò đọc được, giáo viên không sửa được, Phó HT lưu lại được', async () => {
  const cfg = await api(USERS.teacher2, 'GET', '/education-plans/config');
  expect(cfg.status).toBe(200);
  expect(cfg.data.domains.length).toBeGreaterThan(0);
  const body = {
    domainLabels: cfg.data.domainLabels || {},
    extraDomains: cfg.data.extraDomains || [],
    signers: cfg.data.signers,
    weekRows: cfg.data.weekRows,
  };
  expect((await api(USERS.teacher2, 'PUT', '/education-plans/config', { body })).status).toBe(403);
  const saved = await api(USERS.vp, 'PUT', '/education-plans/config', { body });
  expect(saved.status).toBe(200);
  expect(saved.data.signers).toEqual(cfg.data.signers);
});

test('IT-02 giáo viên không phải Tổ trưởng không lập được kế hoạch năm', async () => {
  const res = await api(USERS.teacher2, 'POST', GOALS, {
    body: await yearPlanBody(`${E2E.titlePrefix} không được tạo`),
    headers: editHeaders(newSession(), 0),
  });
  expect(res.status).toBe(403);
});

test('IT-03 Tổ trưởng lập kế hoạch năm (nháp dở được lưu), giữ phiên sửa', async () => {
  const res = await api(USERS.teacher1, 'POST', GOALS, {
    body: await yearPlanBody(`${E2E.titlePrefix} Kế hoạch năm học 2027 – 2028 nhóm Mẫu giáo nhỡ`),
    headers: editHeaders(s.tl, 0),
  });
  expect(res.status, res.desc).toBe(201);
  plan = res.data;
  expect(plan.status).toBe('EDITING'); // EDU-03: nháp đang có phiên sửa hiện "Đang sửa"
  expect(plan.revision).toBeGreaterThanOrEqual(1);
  themeId = plan.themes[0].id;
  // Lưu tay lần hai trên cùng phiên: revision tăng, nội dung đổi
  const body = await yearPlanBody(`${E2E.titlePrefix} Kế hoạch năm học 2027 – 2028 nhóm Mẫu giáo nhỡ (sửa)`);
  body.themes[0].id = themeId;
  const upd = await api(USERS.teacher1, 'PUT', `${GOALS}/${plan.id}`, { body, headers: editHeaders(s.tl, plan.revision) });
  expect(upd.status, upd.desc).toBe(200);
  expect(upd.data.revision).toBe(plan.revision + 1);
  plan = upd.data;
});

test('IT-04 một người sửa: Phó HT không nhận được quyền sửa khi Tổ trưởng đang giữ', async () => {
  const res = await api(USERS.vp, 'POST', `${GOALS}/${plan.id}/start-editing`, { headers: editHeaders(s.vp, plan.revision) });
  expect(res.status).toBe(409);
  // B2: thông báo ngắn tiếng Việt, nêu người đang sửa
  expect(res.errorCode).toBe(7006); // YEAR_PLAN_LOCKED_BY_OTHER
  expect(res.desc).toMatch(/^Đang được .+ sửa$/);
});

test('IT-05 ghi bằng revision cũ bị từ chối (không ghi đè bản mới)', async () => {
  const body = await yearPlanBody(`${E2E.titlePrefix} ghi đè`);
  const res = await api(USERS.teacher1, 'PUT', `${GOALS}/${plan.id}`, { body, headers: editHeaders(s.tl, plan.revision - 1) });
  expect(res.status).toBe(409);
  expect(res.errorCode).toBe(7021); // YEAR_PLAN_REVISION_STALE
  expect(res.desc).toBe('Kế hoạch đã được thay đổi ở nơi khác. Tải lại để đối chiếu');
});

test('IT-05a hai chủ đề trùng tên viết tắt (khác hoa thường, thừa khoảng trắng) ⇒ 400 mã 7012, bản đang lưu không đổi', async () => {
  const body = await yearPlanBody(`${E2E.titlePrefix} trùng viết tắt`);
  body.themes[0].id = themeId;
  body.themes = [
    body.themes[0],
    { ...body.themes[0], id: null, key: 'dup-abbr', name: 'Chủ đề trùng', abbr: ` ${body.themes[0].abbr.toLowerCase()} ` },
  ];
  const res = await api(USERS.teacher1, 'PUT', `${GOALS}/${plan.id}`, { body, headers: editHeaders(s.tl, plan.revision) });
  expect(res.status).toBe(400);
  expect(res.errorCode).toBe(7012); // THEME_ABBR_DUPLICATE (BE:EDU-42)
  const after = await api(USERS.teacher1, 'GET', `${GOALS}/${plan.id}`);
  expect(after.data.revision).toBe(plan.revision);
  expect(after.data.themes).toHaveLength(plan.themes.length);
});

test('IT-05b cùng tài khoản mở phiên mới (vd. sau mất điện) ⇒ nhận quyền ngay; phiên cũ bị 409 khi gửi tín hiệu/lưu', async () => {
  const fresh = newSession();
  const taken = await api(USERS.teacher1, 'POST', `${GOALS}/${plan.id}/start-editing`, { headers: editHeaders(fresh, plan.revision) });
  expect(taken.status, taken.desc).toBe(200);
  const beat = await api(USERS.teacher1, 'POST', `${GOALS}/${plan.id}/editing-heartbeat`, { headers: editHeaders(s.tl, plan.revision) });
  expect(beat.status).toBe(409);
  expect(beat.errorCode).toBe(7020); // EDIT_SESSION_LOST
  expect(beat.desc).toMatch(/^Đã mất quyền sửa/);
  const body = await yearPlanBody(`${E2E.titlePrefix} phiên cũ ghi`);
  const old = await api(USERS.teacher1, 'PUT', `${GOALS}/${plan.id}`, { body, headers: editHeaders(s.tl, plan.revision) });
  expect(old.status).toBe(409);
  expect(old.errorCode).toBe(7020);
  // Phiên cũ thoát trang không nhả được quyền của phiên mới; người khác vẫn bị chặn
  await api(USERS.teacher1, 'POST', `${GOALS}/${plan.id}/finish-editing`, { headers: editHeaders(s.tl, plan.revision) });
  const other = await api(USERS.vp, 'POST', `${GOALS}/${plan.id}/start-editing`, { headers: editHeaders(s.vp, plan.revision) });
  expect(other.status).toBe(409);
  s.tl = fresh;
});

test('IT-06 giáo viên thường chưa xem được kế hoạch năm chưa ban hành', async () => {
  const res = await api(USERS.teacher2, 'GET', `${GOALS}/${plan.id}`);
  expect([403, 404]).toContain(res.status);
});

test('IT-07 Tổ trưởng gửi Phó HT duyệt; Phó HT trả lại bắt buộc có lý do', async () => {
  const sub = await api(USERS.teacher1, 'POST', `${GOALS}/${plan.id}/submit`, { body: {}, headers: editHeaders(s.tl, plan.revision) });
  expect(sub.status, sub.desc).toBe(200);
  expect(sub.data.status).toBe('PENDING_VP');
  plan = sub.data;
  const lease = await api(USERS.vp, 'POST', `${GOALS}/${plan.id}/start-editing`, { headers: editHeaders(s.vp, plan.revision) });
  expect(lease.status, lease.desc).toBe(200);
  plan = lease.data;
  const noReason = await api(USERS.vp, 'POST', `${GOALS}/${plan.id}/return`, {
    body: { note: '' },
    headers: editHeaders(s.vp, plan.revision),
  });
  expect(noReason.status).toBe(400);
  const ret = await api(USERS.vp, 'POST', `${GOALS}/${plan.id}/return`, {
    body: { note: 'Bổ sung lễ hội cho chủ đề (E2E)' },
    headers: editHeaders(s.vp, plan.revision),
  });
  expect(ret.status, ret.desc).toBe(200);
  expect(ret.data.status).toBe('REJECTED'); // "Bị trả lại"
  plan = ret.data;
});

test('IT-08 Tổ trưởng nhóm khác / giáo viên không gửi, không ban hành được', async () => {
  const other = sql(`select id from edu_year_plans where age_group_id <> ${ref.ageGroup} and status = 'DRAFT' limit 1`);
  if (other) {
    const res = await api(USERS.teacher1, 'POST', `${GOALS}/${other}/submit`, { body: {}, headers: editHeaders(newSession(), 0) });
    expect([403, 409]).toContain(res.status);
  }
  const issue = await api(USERS.teacher1, 'POST', `${GOALS}/${plan.id}/issue`, { body: {}, headers: editHeaders(s.tl, plan.revision) });
  expect(issue.status).toBe(403);
  expect(issue.errorCode).toBe(1101); // FORBIDDEN: endpoint chỉ cho Phó HT (chặn ở @PreAuthorize)
});

test('IT-09 Tổ trưởng sửa bản bị trả lại, gửi lại; Phó HT ban hành; giáo viên xem được (chỉ đọc)', async () => {
  const lease = await api(USERS.teacher1, 'POST', `${GOALS}/${plan.id}/start-editing`, { headers: editHeaders(s.tl, plan.revision) });
  expect(lease.status, lease.desc).toBe(200);
  plan = lease.data;
  const body = await yearPlanBody(plan.title);
  body.themes[0].id = themeId;
  body.themes[0].festivals = 'Ngày hội đến trường';
  const upd = await api(USERS.teacher1, 'PUT', `${GOALS}/${plan.id}`, { body, headers: editHeaders(s.tl, plan.revision) });
  expect(upd.status, upd.desc).toBe(200);
  const sub = await api(USERS.teacher1, 'POST', `${GOALS}/${plan.id}/submit`, { body: {}, headers: editHeaders(s.tl, upd.data.revision) });
  expect(sub.data.status).toBe('PENDING_VP');
  const vpLease = await api(USERS.vp, 'POST', `${GOALS}/${plan.id}/start-editing`, { headers: editHeaders(s.vp, sub.data.revision) });
  expect(vpLease.status, vpLease.desc).toBe(200);
  const issued = await api(USERS.vp, 'POST', `${GOALS}/${plan.id}/issue`, { body: {}, headers: editHeaders(s.vp, vpLease.data.revision) });
  expect(issued.status, issued.desc).toBe(200);
  expect(issued.data.status).toBe('APPROVED');
  plan = issued.data;
  const seen = await api(USERS.teacher2, 'GET', `${GOALS}/${plan.id}`);
  expect(seen.status).toBe(200);
  const lock = await api(USERS.teacher1, 'POST', `${GOALS}/${plan.id}/start-editing`, {
    headers: editHeaders(newSession(), plan.revision),
  });
  expect([403, 409]).toContain(lock.status);
});

const branchKey = () => `bp_${ref.classroom}_${plan.id}`;
const themeKey = () => `tp_${ref.classroom}_${themeId}`;
const weekKey = () => `wp_${ref.classroom}_${E2E.weekStart}`;
const branchDoc = (name) => ({
  id: branchKey(),
  kind: 'branch',
  classId: ref.classroom,
  yearPlanId: plan.id,
  names: { [E2E.weekStart]: name },
  notes: {},
});

test('IT-10 chủ đề nhánh: chỉ giáo viên của lớp lưu được; chưa đặt đủ tên thì chưa gửi được', async () => {
  expect((await api(USERS.teacher1, 'PUT', `${DOCS}/branch/${branchKey()}`, { body: branchDoc('x') })).status).toBe(403);
  const empty = await api(USERS.teacher2, 'PUT', `${DOCS}/branch/${branchKey()}`, { body: branchDoc('') });
  expect(empty.status, empty.desc).toBe(200);
  const blocked = await api(USERS.teacher2, 'POST', `${DOCS}/branch/${branchKey()}/actions`, { body: { action: 'submit' } });
  expect(blocked.status).toBe(409);
  expect(blocked.errorCode).toBe(7112); // BRANCH_WEEKS_UNNAMED
  const saved = await api(USERS.teacher2, 'PUT', `${DOCS}/branch/${branchKey()}`, { body: branchDoc('Bé vui đến trường (E2E)') });
  expect(saved.status).toBe(200);
});

test('IT-11 kế hoạch chủ đề chưa mở khi chủ đề nhánh chưa được duyệt', async () => {
  const res = await api(USERS.teacher2, 'PUT', `${DOCS}/theme/${themeKey()}`, {
    body: { id: themeKey(), kind: 'theme', classId: ref.classroom, yearPlanId: plan.id, themeId, rows: {} },
  });
  expect(res.status).toBe(409);
  expect(res.errorCode).toBe(7110); // BRANCH_THEMES_NOT_APPROVED
});

test('IT-12 duyệt chủ đề nhánh: Tổ trưởng → Phó HT; sai lượt bị chặn; trả lại cần lý do', async () => {
  const cfg = (await api(USERS.vp, 'GET', '/education-plans/config')).data;
  const tlFirst = cfg.signers.branch[0] === 'TEAM_LEADER';
  const sub = await api(USERS.teacher2, 'POST', `${DOCS}/branch/${branchKey()}/actions`, { body: { action: 'submit' } });
  expect(sub.status, sub.desc).toBe(200);
  expect(sub.data.status).toBe(tlFirst ? 'PENDING_TL' : 'PENDING_VP');
  test.skip(!tlFirst, 'Cấu hình người ký chủ đề nhánh không có bước Tổ trưởng');
  expect((await api(USERS.teacher2, 'POST', `${DOCS}/branch/${branchKey()}/actions`, { body: { action: 'approve' } })).status).toBe(403);
  expect((await api(USERS.vp, 'POST', `${DOCS}/branch/${branchKey()}/actions`, { body: { action: 'approve' } })).status).toBe(403);
  expect((await api(USERS.teacher1, 'POST', `${DOCS}/branch/${branchKey()}/actions`, { body: { action: 'reject' } })).status).toBe(400);
  const rej = await api(USERS.teacher1, 'POST', `${DOCS}/branch/${branchKey()}/actions`, {
    body: { action: 'reject', note: 'Đặt tên gần trẻ hơn (E2E)' },
  });
  expect(rej.data.status).toBe('REJECTED');
  await api(USERS.teacher2, 'PUT', `${DOCS}/branch/${branchKey()}`, { body: branchDoc('Lớp học của bé (E2E)') });
  expect((await api(USERS.teacher2, 'POST', `${DOCS}/branch/${branchKey()}/actions`, { body: { action: 'submit' } })).data.status).toBe(
    'PENDING_TL',
  );
  const tl = await api(USERS.teacher1, 'POST', `${DOCS}/branch/${branchKey()}/actions`, { body: { action: 'approve' } });
  expect(tl.status, tl.desc).toBe(200);
  expect(tl.data.status).toBe('PENDING_VP');
  const vp = await api(USERS.vp, 'POST', `${DOCS}/branch/${branchKey()}/actions`, { body: { action: 'approve' } });
  expect(vp.status, vp.desc).toBe(200);
  expect(['APPROVED', 'PENDING_HT']).toContain(vp.data.status);
  if (vp.data.status === 'PENDING_HT') {
    expect((await api(USERS.principal, 'POST', `${DOCS}/branch/${branchKey()}/actions`, { body: { action: 'approve' } })).data.status).toBe(
      'APPROVED',
    );
  }
});

test('IT-13 kế hoạch chủ đề + giáo án tuần: lưu được; giáo án tuần không gửi riêng; thiếu giáo án nhánh thì chưa gửi hồ sơ', async () => {
  const theme = await api(USERS.teacher2, 'PUT', `${DOCS}/theme/${themeKey()}`, {
    body: {
      id: themeKey(),
      kind: 'theme',
      classId: ref.classroom,
      yearPlanId: plan.id,
      themeId,
      rows: {},
      envIn: 'Góc đồ chơi (E2E)',
      envOut: '',
    },
  });
  expect(theme.status, theme.desc).toBe(200);
  const early = await api(USERS.teacher2, 'POST', `${DOCS}/theme/${themeKey()}/actions`, { body: { action: 'submit' } });
  expect(early.status).toBe(409);
  const week = await api(USERS.teacher2, 'PUT', `${DOCS}/week/${weekKey()}`, {
    body: {
      id: weekKey(),
      kind: 'week',
      classId: ref.classroom,
      yearPlanId: plan.id,
      themeId,
      weekStart: E2E.weekStart,
      weekNo: 1,
      aims: { knowledge: 'Biết tên lớp (E2E)' },
      days: [],
    },
  });
  expect(week.status, week.desc).toBe(200);
  expect((await api(USERS.teacher2, 'POST', `${DOCS}/week/${weekKey()}/actions`, { body: { action: 'submit' } })).status).toBe(400);
});

test('IT-14 Tổ trưởng dạy chính lớp ⇒ hồ sơ chủ đề bỏ bước Tổ trưởng; duyệt xong khóa cả giáo án tuần', async () => {
  addTeamLeader('teacher2');
  try {
    const sub = await api(USERS.teacher2, 'POST', `${DOCS}/theme/${themeKey()}/actions`, { body: { action: 'submit' } });
    expect(sub.status, sub.desc).toBe(200);
    expect(sub.data.status).toBe('PENDING_VP');
    const vp = await api(USERS.vp, 'POST', `${DOCS}/theme/${themeKey()}/actions`, { body: { action: 'approve' } });
    expect(vp.status, vp.desc).toBe(200);
    if (vp.data.status === 'PENDING_HT')
      await api(USERS.principal, 'POST', `${DOCS}/theme/${themeKey()}/actions`, { body: { action: 'approve' } });
    const docs = await api(USERS.teacher2, 'GET', `${DOCS}?schoolYearId=${ref.year}`);
    const all = JSON.stringify(docs.data);
    expect(docs.status).toBe(200);
    expect(all).toContain(weekKey());
    const edit = await api(USERS.teacher2, 'PUT', `${DOCS}/week/${weekKey()}`, {
      body: {
        id: weekKey(),
        kind: 'week',
        classId: ref.classroom,
        yearPlanId: plan.id,
        themeId,
        weekStart: E2E.weekStart,
        weekNo: 1,
        days: [],
      },
    });
    expect(edit.status).toBe(409);
  } finally {
    removeTeamLeader('teacher2');
  }
});

test('IT-15 học liệu: hồ sơ chủ đề đã duyệt thì không tải học liệu lên được', async ({ request }) => {
  // Tải lên thành công cần kho S3 (CARENEST_EDUCATION_MEDIA_*); BE dev chưa cấu hình nên chỉ kiểm quy tắc khóa (Draft/Returned mới sửa)
  const res = await request.post(`${BE_URL}${DOCS}/theme/${themeKey()}/learning-resources`, {
    headers: { Authorization: `Bearer ${await tokenOf(USERS.teacher2)}`, 'Idempotency-Key': crypto.randomUUID() },
    multipart: {
      file: { name: 'e2e.txt', mimeType: 'text/plain', buffer: Buffer.from('E2E') },
      activityKey: 'e2e',
      activitySignature: 'e2e',
      activityLabel: 'Hoạt động E2E',
    },
  });
  const body = await res.json();
  expect(res.status(), JSON.stringify(body)).toBe(409);
  expect(body.errorCode).toBe(7117); // CLASS_DOC_LOCKED
});

test('IT-16 học liệu: thiếu một phần multipart ⇒ 400 kèm câu rõ ràng (không 500)', async ({ request }) => {
  const res = await request.post(`${BE_URL}${DOCS}/theme/${themeKey()}/learning-resources`, {
    headers: { Authorization: `Bearer ${await tokenOf(USERS.teacher2)}`, 'Idempotency-Key': crypto.randomUUID() },
    multipart: {
      file: { name: 'e2e.txt', mimeType: 'text/plain', buffer: Buffer.from('E2E') },
      activityKey: 'e2e',
      activityLabel: 'Hoạt động E2E',
    },
  });
  expect(res.status()).toBe(400);
  const body = await res.json();
  expect(body.errorCode).toBe(9003); // REQUIRED_FIELD_MISSING
  expect(body.desc).toBe('Thiếu thông tin bắt buộc: activitySignature');
});
