import { test, expect } from '@playwright/test';
import { USERS, api, beReachable, sql } from '../support/realBe.mjs';
import { login } from '../support/ui.mjs';

/*
 * Module Hồ sơ trẻ, sức khỏe chạy với BE thật (plan docs/plans/active/2026-11-11-children-module-be-wiring.md, Phase 3).
 * Một trẻ riêng của bộ test đi hết vòng: danh sách, hồ sơ, sửa hồ sơ, xếp lớp, kỳ cân đo (PHT), nhập và sửa số đo (GV),
 * mở hồ sơ từ Tài khoản phụ huynh, cho nghỉ học, mở lại hồ sơ.
 * Phụ huynh của trẻ là một phụ huynh dữ liệu mẫu đã có tài khoản (trùng CCCD) và còn con đang học: HT tiếp nhận chỉ liên kết
 * tài khoản đó, không tạo tài khoản mới (tạo mới sinh user Keycloak mà bộ test không xóa được); cho nghỉ học không khóa tài
 * khoản đó (CHD-04: còn con đang học).
 * Dữ liệu: trẻ tên CHILD_NAME, kỳ cân đo tên bắt đầu bằng "[E2E]". cleanup() xóa đúng các dòng đó (kể cả liên kết phụ huynh
 * của trẻ) trước và sau bộ test (E2E_KEEP_DATA=1 để giữ lại khi soi lỗi).
 */
const CHILD_NAME = 'Bé Kiểm Thử Tự Động';
const DOB = '2022-03-15';
const ROUND_NAME = '[E2E] Kỳ cân đo tự động';
const STREET = '99 Đường Kiểm Thử';

const quote = (value) => `'${value.replace(/'/g, "''")}'`;

function cleanup() {
  sql(`DO $$
DECLARE
  kids bigint[] := array(SELECT id FROM children WHERE full_name = ${quote(CHILD_NAME)});
  camps bigint[] := array(SELECT id FROM health_check_campaigns WHERE name LIKE '[E2E]%');
  r record;
BEGIN
  DELETE FROM health_follow_up_images WHERE event_id IN (SELECT e.id FROM health_follow_up_events e
    JOIN health_follow_ups f ON f.id = e.follow_up_id WHERE f.child_id = ANY(kids));
  DELETE FROM health_follow_up_events WHERE follow_up_id IN (SELECT id FROM health_follow_ups WHERE child_id = ANY(kids))
    OR measurement_id IN (SELECT id FROM health_measurements WHERE child_id = ANY(kids) OR campaign_id = ANY(camps));
  DELETE FROM health_follow_ups WHERE child_id = ANY(kids);
  DELETE FROM health_measurement_edits WHERE measurement_id IN
    (SELECT id FROM health_measurements WHERE child_id = ANY(kids) OR campaign_id = ANY(camps));
  DELETE FROM health_measurements WHERE child_id = ANY(kids) OR campaign_id = ANY(camps);
  DELETE FROM health_check_absences WHERE child_id = ANY(kids) OR campaign_id = ANY(camps);
  DELETE FROM health_check_campaign_history WHERE campaign_id = ANY(camps);
  DELETE FROM health_check_campaigns WHERE id = ANY(camps);
  DELETE FROM notifications WHERE title LIKE '%[E2E]%' OR body LIKE '%[E2E]%';
  DELETE FROM child_allergies WHERE child_id = ANY(kids);
  DELETE FROM guardian_phone_change_requests WHERE child_id = ANY(kids);
  FOR r IN SELECT c.conrelid::regclass::text AS tbl, a.attname AS col FROM pg_constraint c
      JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = ANY(c.conkey)
      WHERE c.contype = 'f' AND c.confrelid = 'children'::regclass LOOP
    EXECUTE format('DELETE FROM %s WHERE %I = ANY($1)', r.tbl, r.col) USING kids;
  END LOOP;
  DELETE FROM children WHERE id = ANY(kids);
END $$;`);
}

const enrollBody = (campusId, guardian) => ({
  child: {
    fullName: CHILD_NAME,
    dateOfBirth: DOB,
    gender: 'FEMALE',
    guardians: [{ ...guardian, relation: 'MOTHER', email: null, accountRecipient: true }],
    profile: {
      idNumber: null,
      premature: 'NO',
      gestationWeeks: 39,
      ethnicity: 'Kinh',
      beneficiary: 'Không',
      bloodType: null,
      address: { province: 'Hà Nội', ward: 'Cầu Giấy', street: '1 Láng' },
    },
  },
  declaration: {
    allergies: { state: 'NONE_REPORTED', items: [] },
    diet: { state: 'NONE_REPORTED', text: null },
    otherNotes: { state: 'NOT_PROVIDED', text: null },
    medicalHistory: {
      self: { state: 'NONE_REPORTED', text: null },
      family: { state: 'NONE_REPORTED', text: null },
      tbContact: { state: 'NONE_REPORTED', contactDate: null },
    },
  },
  classId: null,
  campusId,
});

const profileOf = async (childId) => (await api(USERS.principal, 'GET', `/children/${childId}/profile`)).data;
const healthOf = async (childId) => (await api(USERS.principal, 'GET', `/children/${childId}/health`)).data;

async function searchChild(page) {
  const box = page.getByPlaceholder('Tìm theo họ tên hoặc mã trẻ...');
  await box.fill(CHILD_NAME);
  await box.press('Enter');
}
const childRow = (page) => page.locator('tbody tr', { hasText: CHILD_NAME });

test.describe.serial('Hồ sơ trẻ, sức khỏe trên BE thật', () => {
  // Lớp của teacher1 trong năm học đang hoạt động: trẻ của bộ test xếp vào đây để GV nhập số đo
  let klass;
  // Phụ huynh dữ liệu mẫu: tài khoản đang hoạt động, có CCCD, còn con đang học
  let GUARDIAN;
  let childId;
  let measurementId;

  test.beforeAll(async () => {
    test.skip(!(await beReachable()), 'BE thật không chạy');
    cleanup();
    const [id, name, campusId] = sql(
      `SELECT c.id, c.name, c.campus_id FROM staff_assignments s JOIN classrooms c ON c.id = s.classroom_id
       JOIN school_years y ON y.id = c.school_year_id AND y.status = 'ACTIVE'
       JOIN user_accounts u ON u.id = s.user_id WHERE u.username = 'teacher1' AND s.staff_role = 'TEACHER' ORDER BY c.id LIMIT 1`,
    ).split('|');
    klass = { id, name, campusId };
    const [fullName, phone, idNumber] = sql(
      `SELECT u.full_name, u.username, u.citizen_id FROM user_accounts u WHERE u.primary_role = 'PARENT' AND u.status = 'ACTIVE'
       AND u.citizen_id IS NOT NULL AND u.username ~ '^0[0-9]{9}$' AND EXISTS (SELECT 1 FROM guardian_child_links l JOIN children c ON c.id = l.child_id
       WHERE l.user_id = u.id AND c.status = 'ACTIVE' AND c.full_name <> ${quote(CHILD_NAME)}) ORDER BY u.id LIMIT 1`,
    ).split('|');
    GUARDIAN = { fullName, phone, idNumber };
    const res = await api(USERS.principal, 'POST', '/children/enrollments', { body: enrollBody(Number(campusId), GUARDIAN) });
    expect(res.status, res.desc).toBeLessThan(300);
    childId = String(res.data.id);
  });

  test.afterAll(() => {
    if (!process.env.E2E_KEEP_DATA) cleanup();
  });

  test('CHD-01, CHD-02: danh sách tìm được trẻ chờ xếp lớp và mở hồ sơ', async ({ page }) => {
    await login(page, USERS.principal);
    await page.goto('/children');
    await searchChild(page);
    await expect(childRow(page)).toHaveCount(1);
    await expect(childRow(page)).toContainText('Chưa xếp lớp');
    await expect(childRow(page)).toContainText('Chờ xếp lớp');
    await expect(childRow(page)).toContainText(GUARDIAN.fullName);

    await childRow(page).getByText(CHILD_NAME, { exact: true }).click();
    await expect(page).toHaveURL(new RegExp(`/children/${childId}$`));
    await expect(page.getByRole('heading', { level: 1, name: CHILD_NAME })).toBeVisible();
    await expect(page.getByRole('main').getByRole('link', { name: 'Xếp lớp', exact: true })).toBeVisible();
    await expect(page.getByText('Không tìm thấy hồ sơ trẻ')).toHaveCount(0);
  });

  test('CHD-05, AUTH-21: sửa hồ sơ lưu được, SĐT phụ huynh đã lưu chỉ đọc', async ({ page }) => {
    await login(page, USERS.principal);
    await page.goto(`/children/${childId}`);
    await page.getByRole('main').getByRole('link', { name: 'Sửa hồ sơ' }).click();
    await expect(page).toHaveURL(new RegExp(`/children/${childId}/edit$`));
    await expect(page.getByLabel('Họ và tên trẻ')).toHaveValue(CHILD_NAME);
    const phone = page.getByLabel('Số điện thoại');
    await expect(phone).toHaveValue(GUARDIAN.phone);
    await expect(phone).toHaveAttribute('readonly', '');

    await page.getByLabel('Nơi ở — Số nhà/thôn/xóm').fill(STREET);
    await page.getByLabel('Lý do chỉnh sửa').fill('Gia đình báo đổi địa chỉ (kiểm thử)');
    await page.getByRole('button', { name: 'Lưu thay đổi' }).click();
    await expect(page).toHaveURL(new RegExp(`/children/${childId}$`));

    const saved = await profileOf(childId);
    expect(JSON.stringify(saved.child)).toContain(STREET);
    expect(saved.child.guardians[0].phone).toBe(GUARDIAN.phone);
    expect(saved.child.guardians[0].relation).toBe('MOTHER');
  });

  test('CHD-03: xếp lớp từ hồ sơ, lớp hiện sĩ số theo giới hạn', async ({ page }) => {
    await login(page, USERS.principal);
    await page.goto(`/children/${childId}`);
    await page.getByRole('main').getByRole('link', { name: 'Xếp lớp', exact: true }).click();
    await expect(page).toHaveURL(new RegExp(`/children/placement\\?childId=${childId}`));
    await expect(page.getByRole('heading', { name: `Xếp lớp: ${CHILD_NAME}` })).toBeVisible();

    const campus = page.getByLabel('Điểm trường');
    if (await campus.count()) await campus.selectOption(klass.campusId);
    const option = page.locator('.tr-class-option', { hasText: klass.name }).first();
    await expect(option).toContainText(/Sĩ số: \d+\/\d+/);
    await option.click();
    await page.locator('.page-actions').getByRole('button', { name: 'Xếp vào lớp' }).click();
    await page.getByRole('dialog').getByRole('button', { name: 'Xếp vào lớp' }).click();

    await expect.poll(async () => (await profileOf(childId)).child.status).toBe('ACTIVE');
    expect(String((await profileOf(childId)).child.classId)).toBe(klass.id);
  });

  test('HLT-08: PHT tạo kỳ cân đo cho điểm trường của mình', async ({ page }) => {
    await login(page, USERS.vp);
    await page.goto('/children/health-checks/new?kind=MEASUREMENT');
    await expect(page.getByLabel('Điểm trường')).toHaveValue(klass.campusId);
    await page.getByLabel('Tên kỳ cân đo').fill(ROUND_NAME);
    await page.getByRole('button', { name: 'Tạo kỳ cân đo' }).click();
    // Kỳ cân đo khác của điểm trường bắt đầu chưa tới 2 tháng 15 ngày: BE cảnh báo, người tạo xác nhận vẫn tạo
    const proceed = page.getByRole('dialog').getByRole('button', { name: 'Vẫn tạo' });
    await page.waitForURL(/\/children\/health-checks\/\d+$/, { timeout: 5_000 }).catch(async () => {
      await proceed.click();
      await page.waitForURL(/\/children\/health-checks\/\d+$/);
    });
    await expect(page.getByRole('heading', { level: 1, name: ROUND_NAME })).toBeVisible();
  });

  test('HLT-09, HLT-13: giáo viên lớp nhập rồi sửa số đo trong sổ sức khỏe', async ({ page }) => {
    await login(page, USERS.teacher1);
    await page.goto(`/children/${childId}/health`);
    await expect(page.getByText(CHILD_NAME).first()).toBeVisible();
    await page.getByRole('main').getByRole('link', { name: 'Nhập số đo' }).first().click();
    await expect(page).toHaveURL(new RegExp(`/children/${childId}/health/new`));
    await page.getByLabel('Chiều cao (cm)').fill('105.5');
    await page.getByLabel('Cân nặng (kg)').fill('17.2');
    await page.getByRole('button', { name: 'Lưu số đo' }).click();

    await expect.poll(async () => (await healthOf(childId)).measurements.length).toBe(1);
    const first = (await healthOf(childId)).measurements[0];
    expect(Number(first.heightCm)).toBe(105.5);
    expect(Number(first.weightKg)).toBe(17.2);
    measurementId = String(first.id);

    await page.goto(`/children/${childId}/health/${measurementId}/edit`);
    await expect(page.getByLabel('Chiều cao (cm)')).toHaveValue('105.5');
    await page.getByLabel('Chiều cao (cm)').fill('106');
    await page.getByLabel('Lý do sửa').fill('Đo lại do trẻ đứng chưa thẳng');
    await page.getByRole('button', { name: 'Lưu số đo' }).click();
    await expect.poll(async () => Number((await healthOf(childId)).measurements[0].heightCm)).toBe(106);
    expect((await healthOf(childId)).measurements[0].edits.length).toBe(1);
  });

  test('AUTH-18: Tài khoản phụ huynh mở đúng bé theo link, mở được hồ sơ trẻ để sửa', async ({ page }) => {
    await login(page, USERS.principal);
    // Link "Tài khoản phụ huynh" ở hồ sơ trẻ: mở thẳng hộp phụ huynh của bé (id trẻ của BE là số, trên URL là chuỗi)
    await page.goto(`/children/activation?childId=${childId}`);
    const dialog = page.getByRole('dialog');
    await expect(dialog).toContainText(`Phụ huynh của bé ${CHILD_NAME}`);
    await expect(dialog).toContainText(GUARDIAN.fullName);
    await expect(dialog).toContainText(klass.name);

    // Bé chưa có tài khoản phụ huynh (dữ liệu mẫu): nút sửa thông tin mở hồ sơ trẻ của BE (lỗi cũ: "Không tìm thấy hồ sơ
    // trẻ" khi module trẻ còn dữ liệu demo). Chỉ mở trang sửa, không lưu.
    const [seedId, seedName] = sql(
      `SELECT c.id, c.full_name FROM children c WHERE c.status = 'ACTIVE' AND c.full_name <> ${quote(CHILD_NAME)}
       AND NOT EXISTS (SELECT 1 FROM guardian_child_links l WHERE l.child_id = c.id) ORDER BY c.id LIMIT 1`,
    ).split('|');
    await page.goto(`/children/activation?childId=${seedId}`);
    await expect(page.getByRole('dialog')).toContainText(`Phụ huynh của bé ${seedName}`);
    await page.getByRole('dialog').getByRole('link', { name: 'Sửa thông tin ở hồ sơ trẻ' }).click();
    await expect(page).toHaveURL(new RegExp(`/children/${seedId}/edit$`));
    await expect(page.getByLabel('Họ và tên trẻ')).toHaveValue(seedName);
    await expect(page.getByText('Không tìm thấy hồ sơ trẻ')).toHaveCount(0);
  });

  test('CHD-04: cho nghỉ học, danh sách mặc định ẩn trẻ đã nghỉ', async ({ page }) => {
    await login(page, USERS.principal);
    await page.goto('/children');
    await searchChild(page);
    await childRow(page).getByRole('button', { name: `Thao tác khác ${CHILD_NAME}` }).click();
    await page.getByRole('menuitem', { name: 'Cho nghỉ học' }).click();
    const dialog = page.getByRole('dialog');
    await dialog.getByLabel('Lý do').fill('Gia đình chuyển nơi ở (kiểm thử)');
    await dialog.getByRole('button', { name: 'Cho nghỉ học' }).click();

    await expect(childRow(page)).toHaveCount(0);
    expect((await profileOf(childId)).child.status).toBe('LEFT');
    await page.locator('.stat-grid').getByText('Đã nghỉ học').click();
    await expect(childRow(page)).toHaveCount(1);
    await expect(childRow(page)).toContainText('Đã nghỉ');
  });

  test('CHD-04: tiếp nhận trùng trẻ đã nghỉ thì mở lại hồ sơ cũ', async ({ page }) => {
    await login(page, USERS.principal);
    await page.goto('/children/new');
    await page.getByLabel('Họ và tên trẻ').fill(CHILD_NAME);
    await page.getByLabel('Ngày sinh').fill(DOB);
    await page.getByRole('radio', { name: 'Nữ' }).check();
    await page.getByRole('group', { name: /^Sinh non/ }).getByRole('radio', { name: 'Không' }).check();
    await page.getByRole('spinbutton', { name: /^Tuần thai khi sinh/ }).fill('39');
    await page.getByRole('textbox', { name: /^Dân tộc/ }).fill('Kinh');
    await page.getByRole('textbox', { name: /^Đối tượng/ }).fill('Không');
    for (const [row, value] of [
      ['Nơi ở — Tỉnh/thành', 'Hà Nội'],
      ['Nơi ở — Phường/xã', 'Cầu Giấy'],
    ]) {
      await page.getByRole('row', { name: new RegExp(row) }).getByRole('combobox').fill(value);
      await page.keyboard.press('Tab');
    }
    await page.getByRole('textbox', { name: /^Nơi ở — Số nhà/ }).fill('1 Láng');
    await page.getByLabel('Số CCCD').fill(GUARDIAN.idNumber);
    // CCCD trùng tài khoản: họ tên, SĐT tự điền theo tài khoản (có thể chỉ đọc) ⇒ chỉ điền khi ô còn sửa được
    for (const [label, value] of [
      [/^Họ và tên(?! trẻ)/, GUARDIAN.fullName],
      [/^Số điện thoại/, GUARDIAN.phone],
    ]) {
      const box = page.getByRole('textbox', { name: label });
      if (await box.isEditable()) await box.fill(value);
    }
    await page.getByLabel('Quan hệ với trẻ').selectOption('Mẹ');
    await page.getByRole('button', { name: 'Tiếp tục' }).click();

    await expect(page.getByRole('alert').filter({ hasText: 'đã nghỉ học' })).toBeVisible();
    await page.getByRole('button', { name: 'Mở lại hồ sơ cũ' }).click();
    const dialog = page.getByRole('dialog');
    await dialog.getByLabel('Lý do tiếp nhận lại').fill('Gia đình chuyển về lại (kiểm thử)');
    await dialog.getByRole('button', { name: 'Mở lại hồ sơ' }).click();

    await expect(page).toHaveURL(new RegExp(`/children/${childId}$`));
    expect((await profileOf(childId)).child.status).toBe('PENDING_PLACEMENT');
  });
});
