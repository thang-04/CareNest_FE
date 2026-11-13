import { test, expect } from '@playwright/test';
import { api, beReachable, newSession } from '../support/realBe.mjs';
import { randomUUID } from 'node:crypto';

// Integration spec 002 (luồng duyệt, quyền xem bản ban hành, hàng chờ, giáo viên xem kế hoạch năm) trên dữ liệu dev
// sau reset 10/11/2026: nhóm 3–4 tuổi có kế hoạch năm + tổ đã ban hành; teamlead34 = Tổ trưởng, teacher6 = GV thứ hai.
// Mỗi lần chạy tạo thêm một phiên bản năm (ban hành) và một bản tổ Nháp tự sinh của nhóm 3–4 tuổi.
test.describe.configure({ mode: 'serial' });

const GOALS = '/education-plans/goals';
const U = {
  vp: 'viceprincipal@gmail.com',
  ht: 'principal@gmail.com',
  tl: 'teamlead34@gmail.com',
  gv2: 'teacher6@gmail.com',
};
const NOTE = '[E2E] Nhờ duyệt bản điều chỉnh, xem lại chủ đề Tết';
const headers = (rev) => ({ 'X-Plan-Revision': String(rev ?? 0), 'Idempotency-Key': randomUUID(), 'X-Edit-Session': newSession() });
const rev = (d) => d.contentRevision ?? d.revision;
let annual;
let teamDraft;
let ageGroupId;

test.beforeAll(async () => {
  test.skip(!(await beReachable()), 'BE thật không chạy ở :8080');
  const list = await api(U.vp, 'GET', `${GOALS}?planLevel=SCHOOL_YEAR&size=100`);
  const tlTeams = await api(U.tl, 'GET', `${GOALS}?planLevel=TEAM&size=100`);
  ageGroupId = tlTeams.data.items[0]?.ageGroupId;
  annual = list.data.items.find((p) => p.ageGroupId === ageGroupId && p.status === 'APPROVED' && p.current);
  test.skip(!annual, 'Không có kế hoạch năm đã ban hành của nhóm tuổi Tổ trưởng teamlead34');
});

test('IT-002-01 PHT tạo phiên bản năm, gửi kèm ghi chú; HT thấy trong hàng chờ kèm ghi chú và ban hành', async () => {
  // Spec 004 Q3b/Q5: năm học đã bắt đầu ⇒ kế hoạch năm khóa (7389) tới khi Hiệu trưởng mở khóa; PHT không mở khóa được
  if ((await api(U.vp, 'GET', `${GOALS}/${annual.id}`)).data.timeLock?.timeLocked) {
    const locked = await api(U.vp, 'POST', `${GOALS}/${annual.id}/versions`, { body: {}, headers: headers(annual.revision) });
    expect(locked.status).toBe(409);
    expect(locked.errorCode ?? locked.code).toBe(7389);
    const until = new Date(Date.now() + 7 * 864e5).toISOString().slice(0, 10);
    expect((await api(U.vp, 'POST', `${GOALS}/${annual.id}/unlock`, { body: { note: '[E2E] mở khóa', deadline: until } })).status).toBe(403);
    const unlocked = await api(U.ht, 'POST', `${GOALS}/${annual.id}/unlock`, { body: { note: '[E2E] mở khóa', deadline: until } });
    expect(unlocked.status, unlocked.desc).toBe(200);
    expect((await api(U.vp, 'GET', `${GOALS}/${annual.id}`)).data.timeLock).toMatchObject({ timeLocked: false, extendedTo: until });
  }
  // Lần chạy trước dừng giữa chừng để lại phiên bản Nháp ⇒ dùng tiếp (mỗi chuỗi chỉ một phiên bản đang soạn)
  const left = (await api(U.vp, 'GET', `${GOALS}?planLevel=SCHOOL_YEAR&size=100`)).data.items.find(
    (p) => p.ageGroupId === ageGroupId && p.status === 'DRAFT',
  );
  const v = left
    ? await api(U.vp, 'GET', `${GOALS}/${left.id}`)
    : await api(U.vp, 'POST', `${GOALS}/${annual.id}/versions`, { body: {}, headers: headers(annual.revision) });
  expect(v.status, v.desc).toBe(left ? 200 : 201);
  const sub = await api(U.vp, 'POST', `${GOALS}/${v.data.id}/submit`, { body: { note: NOTE }, headers: headers(rev(v.data)) });
  expect(sub.status, sub.desc).toBe(200);
  const queue = await api(U.ht, 'GET', `${GOALS}/review-queue`);
  expect(queue.status).toBe(200);
  expect(queue.data.map((p) => p.id)).toContain(v.data.id);
  // Người soạn không thấy hồ sơ của mình trong hàng chờ
  expect((await api(U.vp, 'GET', `${GOALS}/review-queue`)).data.map((p) => p.id)).not.toContain(v.data.id);
  const forHt = await api(U.ht, 'GET', `${GOALS}/${v.data.id}`);
  expect(forHt.data.history.some((h) => h.action === 'SUBMIT' && h.note === NOTE)).toBe(true);
  const issued = await api(U.ht, 'POST', `${GOALS}/${v.data.id}/issue`, { body: { note: 'Đồng ý' }, headers: headers(rev(sub.data)) });
  expect(issued.status, issued.desc).toBe(200);
  expect(issued.data.status).toBe('APPROVED');
  expect((await api(U.ht, 'GET', `${GOALS}/review-queue`)).data.map((p) => p.id)).not.toContain(v.data.id);
  annual = issued.data;
});

test('IT-002-02 bản tổ Nháp tự sinh: chỉ Tổ trưởng thấy; PHT/HT/GV nhận 403 "chưa ban hành", danh sách chỉ bản ban hành', async () => {
  const tlTeams = await api(U.tl, 'GET', `${GOALS}?planLevel=TEAM&size=100`);
  teamDraft = tlTeams.data.items.find((p) => p.status === 'DRAFT' && p.curriculumSourcePlanId === annual.id);
  if (!teamDraft) {
    // Spec 004 Q6: kế hoạch tổ khóa cập nhật từ ngày bắt đầu năm học ⇒ không tự sinh bản tổ mới tới khi HT mở khóa
    const prior = tlTeams.data.items.find((p) => p.ageGroupId === ageGroupId && p.status === 'APPROVED' && p.current);
    test.skip(!prior, 'Chưa có kế hoạch tổ đã ban hành của nhóm tuổi');
    expect((await api(U.tl, 'GET', `${GOALS}/${prior.id}`)).data.timeLock?.timeLocked, 'không có bản tổ Nháp thì kế hoạch tổ phải đang khóa').toBe(true);
    return;
  }
  for (const user of [U.vp, U.ht, U.gv2]) {
    const list = await api(user, 'GET', `${GOALS}?planLevel=TEAM&size=100`);
    expect(list.data.items.every((p) => p.status === 'APPROVED')).toBe(true);
    const direct = await api(user, 'GET', `${GOALS}/${teamDraft.id}`);
    expect(direct.status).toBe(403);
    expect(direct.errorCode).toBe(7384); // EDU_PLAN_NOT_RELEASED
  }
  const forTl = await api(U.tl, 'GET', `${GOALS}/${teamDraft.id}`);
  expect(forTl.status).toBe(200);
  expect(forTl.data.permissions.canEdit).toBe(true);
  expect(forTl.data.canEditBranchTemplates).toBe(true);
});

test('IT-002-03 giáo viên thứ hai xem kế hoạch năm đã ban hành của nhóm tuổi mình (cả bản nguồn cũ), không xem nhóm khác, không thấy lịch sử duyệt', async () => {
  const list = await api(U.gv2, 'GET', `${GOALS}?planLevel=SCHOOL_YEAR&size=100`);
  expect(list.status).toBe(200);
  expect(list.data.items.length).toBeGreaterThan(0);
  expect(list.data.items.every((p) => p.ageGroupId === ageGroupId && p.status === 'APPROVED')).toBe(true);
  const detail = await api(U.gv2, 'GET', `${GOALS}/${annual.id}`);
  expect(detail.status).toBe(200);
  expect(detail.data.permissions.canEdit).toBe(false);
  expect(detail.data.history).toEqual([]);
  expect(detail.data.versions.every((v) => v.status === 'APPROVED')).toBe(true);
  const vp = await api(U.vp, 'GET', `${GOALS}?planLevel=SCHOOL_YEAR&size=100`);
  const other = vp.data.items.find((p) => p.ageGroupId !== ageGroupId && p.status === 'APPROVED');
  if (other) expect((await api(U.gv2, 'GET', `${GOALS}/${other.id}`)).status).toBe(403);
});

test('IT-002-04 HT không còn thấy bản năm PHT đang soạn (Nháp)', async () => {
  const v = await api(U.vp, 'POST', `${GOALS}/${annual.id}/versions`, { body: {}, headers: headers(annual.revision) });
  expect(v.status, v.desc).toBe(201);
  try {
    const ht = await api(U.ht, 'GET', `${GOALS}?planLevel=SCHOOL_YEAR&size=100`);
    expect(ht.data.items.map((p) => p.id)).not.toContain(v.data.id);
    expect((await api(U.ht, 'GET', `${GOALS}/${v.data.id}`)).errorCode).toBe(7384);
    expect((await api(U.vp, 'GET', `${GOALS}/${v.data.id}`)).status).toBe(200);
  } finally {
    await api(U.vp, 'DELETE', `${GOALS}/${v.data.id}`, { headers: headers(rev(v.data)) });
  }
});
