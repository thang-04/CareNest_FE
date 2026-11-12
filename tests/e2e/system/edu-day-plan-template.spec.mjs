import { test, expect } from '@playwright/test';
import { api, beReachable, sql } from '../support/realBe.mjs';
import { login, spaGo } from '../support/ui.mjs';

// System spec 005 (BE thật): giáo án ngày theo mẫu chung — 4 mục a/b/c, dòng gợi ý xóa được, phần II Đánh giá trẻ trên ngày,
// bỏ ô "Kế hoạch điều chỉnh và bổ sung", gửi hồ sơ chủ đề thiếu mục ⇒ chữ đỏ, xuất file cả tuần.
// teamlead34 = GVCN lớp 3–4 tuổi; chạy sau edu-semester-flow-ui (gói học kỳ 2 đã ban hành).
test.describe.configure({ mode: 'serial' });

const U = { tl: 'teamlead34@gmail.com' };
const DOCS = '/education-plans/class-docs';
const SECTIONS = ['1. Hoạt động học', '2. Hoạt động ngoài trời', '3. Hoạt động góc', '4. Hoạt động chiều'];
const SUGGESTED = ['Ổn định tổ chức, gây hứng thú', 'Nội dung trọng tâm', 'Kết thúc'];
const today = new Date().toISOString().slice(0, 10);
let cls;
let week; // tuần của chủ đề HK2 chưa tới ngày dạy, hồ sơ chủ đề còn Nháp

test.beforeAll(async () => {
  test.skip(!(await beReachable()), 'BE thật không chạy');
  const me = await api(U.tl, 'GET', '/accounts/me');
  const docs = (await api(U.tl, 'GET', DOCS)).data;
  cls = docs.classes.find((c) => String(c.homeroomTeacherId) === String(me.data.userId));
  test.skip(!cls, 'teamlead34 không có lớp chủ nhiệm');
  const pkg = docs.semesterPackages.find((p) => String(p.classId) === String(cls.id) && p.semesterNo === 2);
  const themes = (pkg?.themeIds || []).map(String);
  const dossierOk = (themeId) => {
    const d = docs.themeDossiers.find((x) => String(x.classId) === String(cls.id) && String(x.themeId) === String(themeId));
    return !d || d.status === 'DRAFT' || d.status === 'REJECTED';
  };
  week = docs.weekPlans
    .filter(
      (w) => String(w.classId) === String(cls.id) && themes.includes(String(w.themeId)) && w.weekStart > today && dossierOk(w.themeId),
    )
    .sort((a, b) => a.weekStart.localeCompare(b.weekStart))[0];
  // Chạy lại được: bỏ giáo án ngày do lần chạy trước tạo cho các tuần của chủ đề này (dữ liệu dev của bộ test)
  if (week) {
    const starts = docs.weekPlans
      .filter((w) => String(w.classId) === String(cls.id) && String(w.themeId) === String(week.themeId))
      .map((w) => `'${w.weekStart}'`);
    sql(`delete from edu_class_docs where kind='day' and classroom_id=${cls.id} and week_start in (${starts.join(',')})`);
  }
});

const openDay = async (page) => {
  await login(page, U.tl);
  await spaGo(page, `/education/day-plans/${cls.id}?week=${week.weekStart}`);
  await expect(page.getByRole('tab', { name: /Thứ 2/ })).toBeVisible({ timeout: 30_000 });
};

test('ST-005-01 giáo án ngày có 4 mục a/b/c, mục học 3 dòng gợi ý, phần II; không còn ô điều chỉnh', async ({ page }) => {
  test.skip(!week, 'Không có tuần HK2 chưa dạy');
  await openDay(page);
  // Phần I là một bảng: mỗi mục một dòng tiêu đề
  await expect(page.getByRole('button', { name: 'I. Kế hoạch giáo dục ngày' })).toBeVisible();
  for (const s of SECTIONS) await expect(page.getByRole('columnheader', { name: new RegExp(`^${s}`) })).toBeVisible();
  await expect(page.getByText('a) Mục đích, yêu cầu').first()).toBeVisible();
  await expect(page.getByText('b) Chuẩn bị').first()).toBeVisible();
  await expect(page.getByText('c) Tiến hành').first()).toBeVisible();
  await expect(page.getByRole('button', { name: 'II. Đánh giá trẻ trên ngày' })).toBeVisible();
  await expect(page.getByLabel('1. Tình trạng sức khỏe của trẻ')).toBeVisible();
  await expect(page.getByText(/Kế hoạch điều chỉnh/)).toHaveCount(0);
  for (const [i, t] of SUGGESTED.entries()) {
    const cell = page.getByLabel(`1. Hoạt động học – tên bước ${i + 1}`);
    if (await cell.count()) expect(['', t]).toContain(await cell.inputValue());
  }
});

test('ST-005-02 xóa hết dòng gợi ý, thêm "Hoạt động 1", lưu, tải lại: không tạo lại dòng gợi ý', async ({ page }) => {
  test.skip(!week, 'Không có tuần HK2 chưa dạy');
  await openDay(page);
  // Chỉ xóa dòng của mục học: các nút xóa của mục học có nhãn ô tên bước "1. Hoạt động học"
  // Dòng trống cuối ("tên bước mới") luôn có để gõ thêm dòng, không tính là dòng thật (Tiền 11/11/2026)
  const realRows = 'textarea[aria-label^="1. Hoạt động học – tên bước "]:not([aria-label$="mới"])';
  for (let n = await page.locator(realRows).count(); n > 0; n--) {
    await page
      .locator('textarea[aria-label="1. Hoạt động học – tên bước 1"]')
      .locator('xpath=ancestor::tr')
      .getByRole('button', { name: 'Xóa dòng 1' })
      .click();
    const confirm = page.getByRole('dialog');
    if (await confirm.isVisible().catch(() => false)) await confirm.getByRole('button', { name: 'Xóa' }).click();
  }
  await expect(page.locator(realRows)).toHaveCount(0);
  // Không còn nút Thêm dòng: gõ vào dòng trống cuối bảng thì thành dòng mới
  await expect(page.getByRole('button', { name: /^Thêm dòng/ })).toHaveCount(0);
  await page.getByLabel('1. Hoạt động học – tên bước mới').fill('Hoạt động 1');
  await expect(page.getByLabel('1. Hoạt động học – tên bước 1')).toHaveValue('Hoạt động 1');
  await page.getByLabel('1. Hoạt động học – hoạt động của cô dòng 1').fill('[E2E] Cô giới thiệu bài');
  const saved = page.waitForResponse((r) => r.url().includes(`${DOCS}/day/`) && r.request().method() === 'PUT');
  await page.getByRole('button', { name: 'Lưu', exact: true }).click();
  expect((await saved).status()).toBe(200);
  await page.reload();
  await expect(page.getByRole('tab', { name: /Thứ 2/ })).toBeVisible({ timeout: 30_000 });
  await expect(page.locator(realRows)).toHaveCount(1);
  await expect(page.getByLabel('1. Hoạt động học – tên bước 1')).toHaveValue('Hoạt động 1');
  const day = (await api(U.tl, 'GET', DOCS)).data.dayPlans.find(
    (d) => String(d.classId) === String(cls.id) && d.weekStart === week.weekStart,
  );
  expect(day.days[0].sections.hoc.rows.map((r) => r.title)).toEqual(['Hoạt động 1']);
  expect(day.days[0].review).toBeUndefined();
});

// Tiền 11/11/2026: phần a/b/c của một mục không cố định — cô tự xóa được và thêm lại được; BE lưu phần đã xóa
test('ST-005-18 xóa tay phần a) và c) của mục Hoạt động chiều, lưu, tải lại vẫn mất; thêm lại được', async ({ page }) => {
  test.skip(!week, 'Không có tuần HK2 chưa dạy');
  await openDay(page);
  const sec = '4. Hoạt động chiều';
  const confirmIfAsked = async () => {
    const confirm = page.getByRole('dialog');
    if (await confirm.isVisible().catch(() => false)) await confirm.getByRole('button', { name: 'Xóa' }).click();
  };
  await page.getByRole('button', { name: `Xóa phần a) Mục đích, yêu cầu – ${sec}` }).click();
  await confirmIfAsked();
  await page.getByRole('button', { name: `Xóa phần Tiến hành – ${sec}` }).click();
  await confirmIfAsked();
  await expect(page.getByLabel(`${sec} – mục đích, yêu cầu`)).toHaveCount(0);
  await expect(page.getByLabel(`${sec} – tên bước mới`)).toHaveCount(0);
  await expect(page.getByLabel(`${sec} – chuẩn bị`)).toBeVisible();
  let saved = page.waitForResponse((r) => r.url().includes(`${DOCS}/day/`) && r.request().method() === 'PUT');
  await page.getByRole('button', { name: 'Lưu', exact: true }).click();
  expect((await saved).status()).toBe(200);
  await page.reload();
  await expect(page.getByRole('tab', { name: /Thứ 2/ })).toBeVisible({ timeout: 30_000 });
  await expect(page.getByLabel(`${sec} – mục đích, yêu cầu`)).toHaveCount(0);
  const day = (await api(U.tl, 'GET', DOCS)).data.dayPlans.find(
    (d) => String(d.classId) === String(cls.id) && d.weekStart === week.weekStart,
  );
  expect(day.days[0].sections.chieu.off).toEqual(['aims', 'rows']);
  // Thêm lại để các bước sau của chuỗi dùng đủ khung
  await page.getByRole('button', { name: `Thêm lại a) Mục đích, yêu cầu – ${sec}` }).click();
  await page.getByRole('button', { name: `Thêm lại c) Tiến hành – ${sec}` }).click();
  await expect(page.getByLabel(`${sec} – mục đích, yêu cầu`)).toBeVisible();
  saved = page.waitForResponse((r) => r.url().includes(`${DOCS}/day/`) && r.request().method() === 'PUT');
  await page.getByRole('button', { name: 'Lưu', exact: true }).click();
  expect((await saved).status()).toBe(200);
});

test('ST-005-03 gửi hồ sơ chủ đề còn mục trống ⇒ chữ đỏ đầu bảng và tại mục, không chỉ thông báo nổi', async ({ page }) => {
  test.skip(!week, 'Không có tuần HK2 chưa dạy');
  const docs = (await api(U.tl, 'GET', DOCS)).data;
  const dossier = docs.themeDossiers.find((d) => String(d.classId) === String(cls.id) && String(d.themeId) === String(week.themeId));
  test.skip(!dossier || dossier.blockedReason, `Hồ sơ chủ đề chưa gửi được (${dossier?.blockedReason})`);
  // Các tuần khác của chủ đề cần có giáo án ngày (BE chặn 7113 trước); soạn qua API, chừa trống mục Góc để BE trả 7390
  let version = dossier.version;
  for (const w of docs.weekPlans.filter((x) => String(x.classId) === String(cls.id) && String(x.themeId) === String(week.themeId))) {
    if (docs.dayPlans.some((d) => d.weekStart === w.weekStart && String(d.classId) === String(cls.id))) continue;
    const row = (title) => ({ id: crypto.randomUUID(), title, teacher: '', child: '', note: '' });
    const sec = (aims) => ({ aims, prep: '', rows: [row('')] });
    const days = [0, 1, 2, 3, 4].map((i) => {
      const d = new Date(`${w.weekStart}T00:00:00Z`);
      d.setUTCDate(d.getUTCDate() + i);
      return {
        date: d.toISOString().slice(0, 10),
        sections: { hoc: sec('[E2E] MĐ'), ngoai_troi: sec('[E2E] MĐ'), goc: sec(''), chieu: sec('[E2E] MĐ') },
      };
    });
    const res = await api(U.tl, 'PUT', `${DOCS}/day/dd_${w.id.slice(3)}`, {
      body: {
        id: `dd_${w.id.slice(3)}`,
        classId: String(cls.id),
        yearPlanId: String(w.yearPlanId),
        themeId: String(w.themeId),
        weekStart: w.weekStart,
        days,
        dayGoals: [[], [], [], [], []],
      },
      headers: { 'X-Class-Doc-Version': '-1', 'X-Dossier-Version': String(version) },
    });
    expect(res.status, res.desc).toBe(200);
    version = (await api(U.tl, 'GET', DOCS)).data.themeDossiers.find((d) => d.id === dossier.id).version;
  }
  await openDay(page);
  await page.getByRole('button', { name: 'Gửi duyệt hồ sơ chủ đề' }).click();
  const sent = page.waitForResponse((r) => r.url().includes(`${DOCS}/dossier/`) && r.url().endsWith('/actions'));
  await page.getByRole('dialog').getByRole('button', { name: 'Gửi duyệt' }).click();
  const res = await sent;
  expect(res.status()).toBe(400);
  const body = await res.json();
  expect(body.errorCode).toBe(7390);
  expect(body.data.details[0]).toMatchObject({ date: expect.any(String), section: expect.any(String) });
  await expect(page.getByRole('alert').filter({ hasText: /Còn \d+ mục chưa có nội dung/ })).toBeVisible();
  await expect(page.getByText('Mục này chưa có nội dung.').first()).toBeVisible();
});

test('ST-005-04 xuất file ở trang Giáo án ngày: một file cả tuần theo mẫu, không còn ô điều chỉnh', async ({ page }) => {
  test.skip(!week, 'Không có tuần HK2 chưa dạy');
  await openDay(page);
  await page.getByRole('button', { name: 'Xuất file' }).click();
  const preview = page.getByRole('dialog');
  await expect(preview).toBeVisible();
  const frame = preview.frameLocator('iframe').first();
  const root = (await preview.locator('iframe').count()) ? frame.locator('body') : preview;
  await expect(root.getByText('I. Chuẩn bị').first()).toBeVisible();
  await expect(root.getByText('I. Kế hoạch giáo dục ngày').first()).toBeVisible();
  await expect(root.getByText('II. Đánh giá trẻ trên ngày').first()).toBeVisible();
  await expect(root.getByText(/Kế hoạch điều chỉnh/)).toHaveCount(0);
});

test('ST-005-05 kế hoạch tuần (chỉ xem trên trang ngày): Chuẩn bị 3 đối tượng và bảng Hoạt động góc', async ({ page }) => {
  test.skip(!week, 'Không có tuần HK2 chưa dạy');
  await openDay(page);
  // Kế hoạch tuần là tab đầu cùng cấp với Thứ 2–6, không còn thẻ riêng phía trên (Tiền 12/11/2026)
  const tabs = page.getByRole('tab');
  await expect(tabs.first()).toHaveText('Kế hoạch tuần');
  await expect(tabs.nth(1)).toContainText('Thứ 2');
  await tabs.first().click();
  for (const t of ['1. Đối với cô', '2. Đối với trẻ', '3. Đối với phụ huynh']) await expect(page.getByText(t).first()).toBeVisible();
  await expect(page.getByRole('button', { name: 'IV. Hoạt động góc' })).toBeVisible();
});

// Tiền 12/11/2026: trang ngoài Kế hoạch giáo dục ngày như trang chủ đề nhưng chỉ có giáo án ngày
test('ST-005-21 trang ngoài Kế hoạch giáo dục ngày: tab học kỳ, mỗi chủ đề có trạng thái + Gửi duyệt riêng, dòng "Nhánh n: …"', async ({
  page,
}) => {
  await login(page, U.tl);
  await spaGo(page, `/education/day-plans/${cls.id}`);
  await expect(page.getByRole('tab', { name: /Học kỳ 1/ })).toBeVisible({ timeout: 30_000 });
  const firstCard = page
    .locator('section.card')
    .filter({ has: page.locator('.ga-class-plan-table') })
    .first();
  await expect(firstCard.locator('.card__title')).toContainText(/^Chủ đề \d+: /);
  await expect(firstCard.locator('tbody tr').first()).toContainText(/^Nhánh /);
  await expect(page.locator('.ga-class-plan-table').getByText('Kế hoạch giáo dục chủ đề', { exact: true })).toHaveCount(0);
  await expect(page.getByText(/Kế hoạch tuần · nhánh/)).toHaveCount(0);
  await expect(page.getByRole('button', { name: /Gửi duyệt học kỳ/ })).toHaveCount(0);
});
