import { test, expect } from '@playwright/test';
import { E2E, USERS, addTeamLeader, api, beReachable, cleanup, editHeaders, newSession, yearPlanBody } from '../support/realBe.mjs';

// Integration: contract API thật mà UI Kế hoạch giáo dục dùng (BE:EDU-01..23), đi qua Keycloak thật và DB dev.
// Luồng Tổ trưởng tự lập kế hoạch năm (IT-03..16) đã bỏ theo EDU-72 (kế hoạch tổ tự tạo, PHT lập kế hoạch năm).
test.describe.configure({ mode: 'serial' });

const GOALS = '/education-plans/goals';

test.beforeAll(async () => {
  test.skip(!(await beReachable()), 'BE thật không chạy ở :8080');
  cleanup();
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
  // teacher2 là Tổ trưởng 4–5 tuổi từ dữ liệu dev 10/11 (BE:docs/TAI_KHOAN_DEMO.md) ⇒ dùng GV thường teacher6
  const res = await api('teacher6@gmail.com', 'POST', GOALS, {
    body: await yearPlanBody(`${E2E.titlePrefix} không được tạo`),
    headers: editHeaders(newSession(), 0),
  });
  expect(res.status, `${res.errorCode} ${res.desc}`).toBe(403);
});
