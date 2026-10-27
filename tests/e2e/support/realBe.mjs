import { execFileSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { request } from '@playwright/test';

// Môi trường dev của CareNest_BE (docs/system/KEYCLOAK.md): user <tên>@gmail.com, mật khẩu chung của realm dev
export const BE_URL = process.env.E2E_BE_URL || 'http://localhost:8080/api';
const KC_TOKEN_URL = process.env.E2E_KC_TOKEN_URL || 'http://localhost:8180/realms/carenest/protocol/openid-connect/token';
// Mật khẩu chung của realm dev chỉ lấy từ môi trường, không ghi trong repo
export function devPassword() {
  if (!process.env.E2E_DEV_PASSWORD)
    throw new Error('Đặt biến môi trường E2E_DEV_PASSWORD = mật khẩu chung của realm dev trước khi chạy e2e');
  return process.env.E2E_DEV_PASSWORD;
}
const PG_CONTAINER = process.env.E2E_PG_CONTAINER || 'carenest_be-postgres-1';

export const USERS = {
  vp: 'viceprincipal@gmail.com',
  principal: 'principal@gmail.com',
  teacher1: 'teacher1@gmail.com',
  teacher2: 'teacher2@gmail.com',
};

// Dữ liệu riêng của bộ test: năm học 2027-2028, nhóm Mẫu giáo nhỡ (ag-4), lớp B1 của năm đó (teacher2 dạy)
export const E2E = {
  titlePrefix: '[E2E]',
  schoolYear: '2027-2028',
  ageGroupCode: 'ag-4',
  classroomName: 'Lớp B1',
  weekStart: '2027-09-06',
  // Phân công tạm do bộ test thêm; valid_from đặc biệt để nhận diện và xóa đúng các dòng này
  markerDate: '2026-01-01',
};

const tokens = new Map();
export async function tokenOf(email) {
  const cached = tokens.get(email);
  if (cached && cached.exp > Date.now() + 30_000) return cached.value;
  const res = await fetch(KC_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ client_id: 'carenest-dev', grant_type: 'password', username: email, password: devPassword() }), // carenest:allow-secret
  });
  const body = await res.json();
  if (!body.access_token) throw new Error(`Không lấy được token cho ${email}: ${body.error || res.status}`);
  tokens.set(email, { value: body.access_token, exp: Date.now() + body.expires_in * 1000 });
  return body.access_token;
}

/** Gọi BE thật như FE: bóc envelope { code, desc, data }; trả { status, data, desc }. */
export async function api(email, method, path, { body, headers } = {}) {
  const ctx = await request.newContext();
  try {
    const res = await ctx.fetch(`${BE_URL}${path}`, {
      method,
      headers: { Authorization: `Bearer ${await tokenOf(email)}`, ...(headers || {}) },
      ...(body !== undefined ? { data: body } : {}),
    });
    const text = await res.text();
    let json = null;
    try {
      json = text ? JSON.parse(text) : null;
    } catch {
      json = { raw: text };
    }
    return { status: res.status(), data: json?.data ?? json, desc: json?.desc };
  } finally {
    await ctx.dispose();
  }
}

/** Header phiên sửa kế hoạch năm (EDU-10): X-Edit-Session, X-Plan-Revision, X-Request-Id. */
export const editHeaders = (session, revision) => ({
  'X-Edit-Session': session,
  'X-Plan-Revision': String(revision ?? 0),
  'X-Request-Id': randomUUID(),
});
export const newSession = () => randomUUID();

export function sql(query) {
  return execFileSync(
    'docker',
    ['exec', PG_CONTAINER, 'psql', '-U', 'postgres', '-d', 'carenest', '-At', '-v', 'ON_ERROR_STOP=1', '-c', query],
    {
      encoding: 'utf8',
    },
  ).trim();
}

export async function beReachable() {
  try {
    const res = await fetch(BE_URL.replace(/\/api$/, '') + '/actuator/health');
    return res.ok;
  } catch {
    return false;
  }
}

const userId = (username) => sql(`select id from user_accounts where username = '${username}'`);
export const ids = () => {
  const year = sql(`select id from school_years where name = '${E2E.schoolYear}'`);
  const ageGroup = sql(`select id from age_groups where code = '${E2E.ageGroupCode}'`);
  const classroom = sql(`select id from classrooms where name = '${E2E.classroomName}' and school_year_id = ${year}`);
  return {
    year: Number(year),
    ageGroup: Number(ageGroup),
    classroom: Number(classroom),
    teacher1: Number(userId('teacher1')),
    teacher2: Number(userId('teacher2')),
  };
};

/** Xóa dữ liệu bộ test để lại (chỉ kế hoạch có tiêu đề [E2E] và phân công có ngày đánh dấu). */
export function cleanup() {
  const { year, ageGroup } = ids();
  sql(
    `delete from edu_learning_resources where class_doc_id in (select d.id from edu_class_docs d join edu_year_plans p on p.id = d.year_plan_id where p.title like '${E2E.titlePrefix}%');` +
      `delete from edu_year_plans where title like '${E2E.titlePrefix}%' and school_year_id = ${year} and age_group_id = ${ageGroup};` +
      `delete from staff_assignments where valid_from = '${E2E.markerDate}' and staff_role = 'AGE_GROUP_TEAM_LEADER';` +
      // Khôi phục phân công Tổ trưởng bị tạm ngưng (dời valid_from +100 năm) về đúng ngày cũ
      `update staff_assignments set valid_from = valid_from - interval '100 years' where staff_role = 'AGE_GROUP_TEAM_LEADER' and valid_from >= '2100-01-01';`,
  );
}

/** Tổ trưởng tạm cho nhóm tuổi của bộ test (chỉ dòng có ngày đánh dấu). */
export function addTeamLeader(user) {
  const { ageGroup } = ids();
  const id = user === 'teacher1' ? ids().teacher1 : ids().teacher2;
  sql(
    `insert into staff_assignments (user_id, staff_role, age_group_id, valid_from) values (${id}, 'AGE_GROUP_TEAM_LEADER', ${ageGroup}, '${E2E.markerDate}')`,
  );
}
/** Web (shim đăng nhập dev) chỉ đọc phân công Tổ trưởng đầu tiên ⇒ tạm ngưng phân công Tổ trưởng khác của user; cleanup() khôi phục. */
export function suspendOtherTeamLeads(user) {
  const id = user === 'teacher1' ? ids().teacher1 : ids().teacher2;
  sql(
    `update staff_assignments set valid_from = valid_from + interval '100 years' where user_id = ${id} and staff_role = 'AGE_GROUP_TEAM_LEADER' and valid_from <> '${E2E.markerDate}' and valid_from < '2100-01-01'`,
  );
}

export function removeTeamLeader(user) {
  const id = user === 'teacher1' ? ids().teacher1 : ids().teacher2;
  sql(`delete from staff_assignments where user_id = ${id} and valid_from = '${E2E.markerDate}' and staff_role = 'AGE_GROUP_TEAM_LEADER'`);
}

/** Nội dung kế hoạch năm tối thiểu đủ để gửi/ban hành: 1 mục tiêu, 1 chủ đề đúng 1 tuần học. */
export async function yearPlanBody(title, { domainId } = {}) {
  const { year, ageGroup } = ids();
  let domain = domainId;
  if (!domain) {
    const cfg = await api(USERS.vp, 'GET', '/education-plans/config');
    domain = cfg.data.domains[0].id;
  }
  return {
    schoolYearId: year,
    ageGroupId: ageGroup,
    title,
    description: 'Dữ liệu kiểm thử tự động',
    domains: [
      {
        domainId: domain,
        rows: [{ kind: 'goal', text: 'Trẻ tự phục vụ (E2E)', contents: [{ text: 'Tự cất đồ dùng (E2E)', themeKeys: ['t1'] }] }],
      },
    ],
    themes: [
      { key: 't1', name: 'Trường mầm non (E2E)', abbr: 'TMN', startDate: E2E.weekStart, endDate: '2027-09-10', festivals: '', note: '' },
    ],
    breaks: [],
  };
}
