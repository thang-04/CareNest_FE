import { readDb, writeDb, clone, delay, ApiError } from '@/mocks/mockDatabase';
import { ensureSchoolSeeded, visibleClasses } from '@/mocks/schoolMockRepository';
import { AGE_GROUP_EXTRA, buildSeedSchoolConfig } from '@/mocks/schoolConfigSeed';
import { pushNotification } from '@/mocks/notificationMockRepository';
import { ROLES, ROLE_LABELS } from '@/models/User';
import {
  YEAR_STATUS,
  CONFIG_ROLES,
  PERMISSION_LEVEL,
  CONFIG_ROLE_LABELS,
  CLASS_FILL,
  TEACHERS_PER_CLASS,
  MEAL_SESSION_OPTIONS,
  mealSessionsLabel,
  PERMISSION_ACCESS,
  vpAreasOf,
  toAreasV2,
  AREA_ACTIONS,
  grantWrites,
  parseAreaGrant,
  composeAreaGrant,
  VP_AREAS,
  ACTIVATION_LEAD_DAYS,
  PLACEMENT_ACTION,
  PLACEMENT_ACTION_LABELS,
  PLACEMENT_IN_CLASS,
  READINESS_STEPS,
} from '@/models/school-config/schoolConfigConstants';
import { schoolNow } from '@/utils/attendance/attendanceTime';
import { PERMISSION_CATALOG, defaultGrants, grantsOf, isLockedGrant } from '@/models/school-config/permissionCatalog';
import { uid } from '@/utils/id';
import { formatDate, normalizeText } from '@/utils/format';
import {
  closeYearOpensOn,
  nextYearToActivate,
  canAssignTeachers,
  canViewTeamLeaders,
  teamLeaderActions,
  canViewTeacherAssignments,
  canAssignVicePrincipal,
  canConfigureCutoff,
  canConfigureSchool,
  canEditYearPlacement,
  canViewYearPlacement,
  yearPlacementCampus,
  canListCampuses,
  canManageCampus,
  canManageRolePermissions,
  canManageStaff,
  canViewStaff,
  canEditStaffProfile,
  areaAllows,
  canViewCampus,
  canViewSchoolStructure,
  isPrincipal,
} from '@/utils/school-config/schoolConfigPermissions';
import {
  firstError,
  hasErrors,
  validateAgeGroup,
  validateCampus,
  validateClass,
  validateClassTeachers,
  validateCutoff,
  validatePermissionChange,
  validateSchoolYear,
  validateStaffAccount,
  validateStaffProfile,
  validateVpAssignment,
  normalizePhone,
} from '@/utils/school-config/schoolConfigValidation';

/*
 * Fake backend of school configuration. Business rules live here (backend must repeat them):
 * - one ACTIVE school year; years do not overlap; closed years are read only (Academic Year entity, GBR-GEN-03);
 * - class names unique per school year + campus (SRS says per year: OPEN); records in use (children, attendance, assessments) are never deleted (MSG53);
 * - exactly one main campus; VP / teacher / team-leader assignments are per school year (GBR-GEN-03);
 * - one VP holds the shared-service responsibility (GBR-GEN-10);
 * - cutoff and permission changes keep editor, time and previous value (GBR-CFG-03, GBR-GEN-06).
 */

const COLLECTIONS = ['schoolYears', 'ageGroups', 'cutoffSettings', 'vpAssignments', 'teamLeaderAssignments', 'rolePermissions'];
const TEACHING_ROLES = [ROLES.TEACHER, ROLES.TEAM_LEADER];

const forbid = () => new ApiError(403, 'Bạn không có quyền thực hiện thao tác này');
const invalid = (errors) => new ApiError(422, firstError(errors), errors);
const notFound = (what) => new ApiError(404, `Không tìm thấy ${what}`);
const inUse = (why) => new ApiError(409, `Không thể xóa vì bản ghi đang được dữ liệu khác sử dụng: ${why}.`);
const now = () => new Date().toISOString();

const ensure = (db) => {
  const seed = buildSeedSchoolConfig();
  COLLECTIONS.forEach((key) => {
    db[key] ||= clone(seed[key]);
  });
  // Seed campuses have no main flag yet: the first campus is the main campus.
  if (db.campuses?.length && !db.campuses.some((c) => c.isMain)) db.campuses[0].isMain = true;
  // Dữ liệu cũ trong localStorage chưa có độ tuổi theo tháng / sĩ số tối đa của nhóm tuổi (SRS 4.1.4)
  db.ageGroups.forEach((g) => {
    if (g.ageFromMonths == null) Object.assign(g, { ageFromMonths: null, ageToMonths: null, maxClassSize: 50, ...AGE_GROUP_EXTRA[g.id] });
    delete g.ageRange;
    g.history ||= [];
    // Trước đây chỉ lưu số bữa: 3 = phụ sáng + trưa + chiều, 2 = trưa + chiều
    g.mealSessions ||= g.mealsPerDay === 3 ? ['MORNING', 'LUNCH', 'AFTERNOON'] : ['LUNCH', 'AFTERNOON'];
    g.mealsPerDay = g.mealSessions.length;
  });
  // Quyền PHT dạng cũ (mặc định theo mảng) -> dạng mới "＋ Thêm quyền quản lý" (giữ đúng quyền đang có)
  const roleGrants = grantsOf(db.rolePermissions, ROLES.VICE_PRINCIPAL);
  db.vpAssignments.forEach((a) => {
    if (!a.areasV2) {
      a.areas = toAreasV2(a, roleGrants);
      a.areasV2 = true;
    }
    // Trước đây PHT luôn xem nhân sự điểm trường mình: giữ thành "Hồ sơ nhân sự · Chỉ xem · campus mình"
    if (!a.staffArea) {
      if (!a.areas.staff && a.campusId) a.areas.staff = `VIEW@${a.campusId}`;
      a.staffArea = true;
    }
    // Mức cũ -> thao tác: Được sửa = Xem + Thêm + Sửa + Xóa (bỏ thao tác không áp dụng), Chỉ xem = Xem
    if (!a.areaActions) {
      a.areas = Object.fromEntries(
        Object.entries(a.areas || {}).map(([key, value]) => {
          const area = VP_AREAS.find((x) => x.key === key);
          const g = parseAreaGrant(value, a.campusId);
          const actions = Object.fromEntries(AREA_ACTIONS.map((k) => [k, g.actions[k] && (!area || area.actions.includes(k))]));
          return [key, composeAreaGrant({ actions, campusId: g.campusId })];
        }),
      );
      a.areaActions = true;
    }
    // Quyền tổ trưởng tách riêng: giữ cho PHT điểm trường chính đang có quyền sửa phân công; PHT khác do Hiệu trưởng mở thêm
    if (!a.teamLeaderArea) {
      const mainId = (db.campuses || []).find((c) => c.isMain)?.id || 'c1';
      if (a.campusId === mainId && grantWrites(a.areas?.teacherAssignment, a.campusId)) a.areas.teamLeaders = 'VCUD@ALL';
      a.teamLeaderArea = true;
    }
  });
  // Tổ trưởng theo điểm trường -> 1 tổ trưởng / nhóm tuổi / năm học cho cả trường: giữ Campus 1, không có thì người được giao gần nhất
  if (db.teamLeaderAssignments?.some((a) => a.campusId !== undefined)) {
    const kept = new Map();
    const dropped = [];
    const mainId = (db.campuses || []).find((c) => c.isMain)?.id || 'c1';
    const rank = (a) => [a.campusId === mainId ? 1 : 0, a.assignedAt || ''];
    db.teamLeaderAssignments.forEach((a) => {
      const key = `${a.schoolYear}|${a.ageGroupId}`;
      const prev = kept.get(key);
      if (!prev) kept.set(key, a);
      else {
        const [pm, pt] = rank(prev);
        const [am, at] = rank(a);
        const better = am > pm || (am === pm && at > pt);
        dropped.push(better ? prev : a);
        if (better) kept.set(key, a);
      }
    });
    db.teamLeaderAssignments = [...kept.values()].map(({ campusId, ...a }) => a);
    if (dropped.length) db.teamLeaderMigrationDropped = [...(db.teamLeaderMigrationDropped || []), ...dropped];
    db.schoolYears.forEach((y) => syncAssignments(db, y.id));
  }
  return db;
};

const needsMigration = (db) =>
  db.teamLeaderAssignments?.some((a) => a.campusId !== undefined) ||
  db.ageGroups?.some((g) => g.ageFromMonths == null || !g.history || !g.mealSessions) ||
  db.vpAssignments?.some((a) => !a.areasV2 || !a.staffArea || !a.areaActions || !a.teamLeaderArea);

const seeded = () => {
  ensureSchoolSeeded();
  const db = readDb();
  if (COLLECTIONS.some((k) => !db[k]) || (db.campuses?.length && !db.campuses.some((c) => c.isMain)) || needsMigration(db)) writeDb(ensure);
  return readDb();
};

const findYear = (db, id) => {
  const year = db.schoolYears.find((y) => y.id === id);
  if (!year) throw notFound('năm học');
  return year;
};

const assertOpenYear = (year) => {
  if (year.status === YEAR_STATUS.CLOSED) throw new ApiError(409, `Năm học ${year.name} đã kết thúc, không thể thay đổi`);
};

const sortYears = (list) => [...list].sort((a, b) => b.startDate.localeCompare(a.startDate));
const childCountOf = (db, classId) => (db.children || []).filter((ch) => ch.classId === classId && ch.status !== 'LEFT').length;
const userName = (db, id) => db.users.find((u) => u.id === id)?.fullName || '';
const sameName = (a, b) => normalizeText((a || '').trim()) === normalizeText((b || '').trim());
/** A class with attendance, meal or assessment records is history and is never deleted (SRS 4.1.3). */
const HISTORY_COLLECTIONS = ['attendance', 'dailyAssessments', 'periodicEvaluations', 'yearEndEvaluations'];
const classHasHistory = (db, classId) => HISTORY_COLLECTIONS.some((k) => (db[k] || []).some((r) => r.classId === classId));

/** Apply the assignments of the active year to the user accounts (what the system "grants"). */
const syncAssignments = (db, yearId) => {
  const year = db.schoolYears.find((y) => y.id === yearId);
  if (year?.status !== YEAR_STATUS.ACTIVE) return;
  db.vpAssignments
    .filter((a) => a.schoolYear === yearId)
    .forEach((a) => {
      const u = db.users.find((x) => x.id === a.userId);
      if (u) u.campusId = a.campusId;
    });
  const leaders = db.teamLeaderAssignments.filter((a) => a.schoolYear === yearId);
  db.users
    .filter((u) => TEACHING_ROLES.includes(u.role))
    .forEach((u) => {
      const lead = leaders.find((a) => a.userId === u.id);
      if (lead) {
        u.role = ROLES.TEAM_LEADER;
        u.ageGroupId = lead.ageGroupId;
      } else if (u.role === ROLES.TEAM_LEADER) {
        u.role = ROLES.TEACHER;
      }
    });
};

/* ---------------- Chuyển năm học: sẵn sàng, xếp lớp, kích hoạt (PROPOSED 13/10/2026) ---------------- */
const activeYearOf = (db) => db.schoolYears.find((y) => y.status === YEAR_STATUS.ACTIVE) || null;
const yearClasses = (db, yearId) => db.classes.filter((c) => c.schoolYear === yearId);
const activeCampuses = (db) => (db.campuses || []).filter((c) => !c.status || c.status === 'ACTIVE');
const campusLabel = (db, id) => {
  const c = (db.campuses || []).find((x) => x.id === id);
  return c?.shortName || c?.name || id;
};
const groupsByAge = (db) => [...db.ageGroups].sort((a, b) => (a.ageFromMonths ?? 0) - (b.ageFromMonths ?? 0));
/** Nhóm tuổi kế tiếp theo độ tuổi; nhóm lớn nhất không có (trẻ ra trường). */
const nextGroupId = (db, groupId) => {
  const list = groupsByAge(db);
  const i = list.findIndex((g) => g.id === groupId);
  return i >= 0 && i < list.length - 1 ? list[i + 1].id : null;
};
/** Trẻ được xếp từ năm đang hoạt động sang năm sắp diễn ra. */
const placementSource = (db, target) => {
  const active = activeYearOf(db);
  return active && active.id !== target.id ? active : null;
};
const sourceChildren = (db, source) => {
  if (!source) return [];
  const ids = new Set(yearClasses(db, source.id).map((c) => c.id));
  return (db.children || []).filter((ch) => ch.status === 'ACTIVE' && ids.has(ch.classId));
};
const placementsOf = (db, yearId) => (db.classPlacements || []).filter((p) => p.schoolYear === yearId);
const seatsTaken = (db, yearId, classId) =>
  placementsOf(db, yearId).filter((p) => PLACEMENT_IN_CLASS.includes(p.action) && p.toClassId === classId).length;
const isoMinusDays = (iso, n) => {
  const d = new Date(`${iso}T00:00:00`);
  d.setDate(d.getDate() - n);
  const pad = (x) => String(x).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};

/** Các bước chuẩn bị của một năm học, tính từ dữ liệu thật. Bước `required` chặn kích hoạt. */
const buildReadiness = (db, year) => {
  const classes = yearClasses(db, year.id);
  const groups = db.ageGroups.filter((g) => classes.some((c) => c.ageGroupId === g.id));
  const roomOf = (c) => (db.locations || []).find((l) => l.id === c.locationId);
  const noRoom = classes.filter((c) => !roomOf(c));
  const overRoom = classes.filter((c) => roomOf(c)?.capacity && c.capacity > roomOf(c).capacity);
  const vpMissing = activeCampuses(db).filter(
    (campus) => !db.vpAssignments.some((a) => a.schoolYear === year.id && a.campusId === campus.id),
  );
  // Mỗi nhóm tuổi có lớp trong năm cần 1 tổ trưởng cho cả trường
  const leaderGroups = [...new Set(classes.map((c) => c.ageGroupId))];
  const leaderMissing = leaderGroups.filter((g) => !db.teamLeaderAssignments.some((a) => a.schoolYear === year.id && a.ageGroupId === g));
  const source = placementSource(db, year);
  const toPlace = sourceChildren(db, source);
  const placed = new Set(placementsOf(db, year.id).map((p) => p.childId));
  const unplaced = toPlace.filter((ch) => !placed.has(ch.id));
  const cutoff = db.cutoffSettings.find((c) => c.schoolYear === year.id);
  const result = {
    info: { ok: true, detail: `${formatDate(year.startDate)} – ${formatDate(year.endDate)}` },
    ageGroups: {
      ok: db.ageGroups.length > 0 && db.ageGroups.every((g) => g.mealSessions?.length && g.maxClassSize > 0),
      detail: `${db.ageGroups.length} nhóm tuổi · ${groups.length} nhóm có lớp`,
    },
    classes: { ok: classes.length > 0, detail: classes.length ? `${classes.length} lớp` : 'Chưa có lớp nào' },
    rooms: {
      ok: classes.length > 0 && !noRoom.length && !overRoom.length,
      detail: noRoom.length
        ? `${noRoom.length} lớp chưa có phòng`
        : overRoom.length
          ? `${overRoom.length} lớp vượt sức chứa phòng`
          : `${classes.length}/${classes.length} lớp có phòng`,
    },
    vicePrincipals: {
      ok: !vpMissing.length,
      detail: vpMissing.length ? `Chưa phân công: ${vpMissing.map((c) => campusLabel(db, c.id)).join(', ')}` : 'Đủ các điểm trường',
    },
    teamLeaders: {
      ok: leaderGroups.length > 0 && !leaderMissing.length,
      detail: leaderGroups.length
        ? `${leaderGroups.length - leaderMissing.length}/${leaderGroups.length} nhóm tuổi có tổ trưởng (toàn trường)`
        : 'Chưa có lớp',
    },
    // Lớp chưa có giáo viên hoặc chưa có chủ nhiệm chặn kích hoạt; thiếu 1 GV chỉ cảnh báo (Cần chốt 22/10/2026)
    teachers: (() => {
      const empty = classes.filter((c) => !(c.teacherIds || []).length);
      const short = classes.filter((c) => (c.teacherIds || []).length > 0 && c.teacherIds.length < TEACHERS_PER_CLASS);
      const noHomeroom = classes.filter((c) => (c.teacherIds || []).length > 0 && !c.homeroomTeacherId);
      const ok = classes.length > 0 && !empty.length && !noHomeroom.length;
      return {
        ok,
        warning: ok && short.length > 0,
        detail: !classes.length
          ? 'Chưa có lớp'
          : !ok
            ? [empty.length && `${empty.length} lớp chưa có giáo viên`, noHomeroom.length && `${noHomeroom.length} lớp chưa có chủ nhiệm`]
                .filter(Boolean)
                .join(' · ')
            : ['Tất cả lớp có GV và chủ nhiệm', short.length && `${short.length} lớp thiếu 1 GV`].filter(Boolean).join(' · '),
      };
    })(),
    placement: {
      ok: !unplaced.length,
      detail: source
        ? `${toPlace.length - unplaced.length}/${toPlace.length} trẻ của năm ${source.name} đã xếp lớp`
        : 'Không có năm học đang hoạt động cần chuyển trẻ',
    },
    cutoff: { ok: !!cutoff, detail: cutoff ? cutoff.time : 'Chưa cài đặt' },
  };
  const steps = READINESS_STEPS.map(({ key, label, required }) => ({ key, label, required, ...result[key] }));
  const openFrom = isoMinusDays(year.startDate, ACTIVATION_LEAD_DAYS);
  const today = schoolNow().date;
  const blockers = [
    ...steps.filter((st) => st.required && !st.ok).map((st) => `${st.label}: ${st.detail}`),
    ...(today < openFrom ? [`Chỉ kích hoạt được từ ${formatDate(openFrom)} (${ACTIVATION_LEAD_DAYS} ngày trước ngày bắt đầu)`] : []),
  ];
  const plans = placementsOf(db, year.id);
  return {
    yearId: year.id,
    steps,
    openFrom,
    sourceYear: source ? { id: source.id, name: source.name } : null,
    impact: {
      move: plans.filter((p) => PLACEMENT_IN_CLASS.includes(p.action)).length,
      leave: plans.filter((p) => !PLACEMENT_IN_CLASS.includes(p.action)).length,
    },
    blockers,
    canActivate: year.status === YEAR_STATUS.PLANNED && !blockers.length,
  };
};

/** Lớp năm mới gợi ý cho một lớp cũ: cùng điểm trường, đúng nhóm tuổi, còn nhiều chỗ nhất. */
const suggestTarget = (db, target, campusId, ageGroupId) =>
  yearClasses(db, target.id)
    .filter((c) => c.campusId === campusId && c.ageGroupId === ageGroupId)
    .map((c) => ({ c, free: c.capacity - seatsTaken(db, target.id, c.id) }))
    .sort((a, b) => b.free - a.free || a.c.name.localeCompare(b.c.name, 'vi'))[0]?.c.id || null;

/** Trẻ đổi lớp / nghỉ theo bản xếp lớp khi kích hoạt năm học. */
const applyPlacements = (db, year, userId, at) => {
  placementsOf(db, year.id).forEach((p) => {
    const child = db.children.find((c) => c.id === p.childId);
    if (!child || child.status !== 'ACTIVE') return;
    const fromClassId = child.classId;
    if (PLACEMENT_IN_CLASS.includes(p.action)) {
      const cls = db.classes.find((c) => c.id === p.toClassId);
      if (!cls) return;
      child.classId = cls.id;
      child.campusId = cls.campusId;
    } else {
      child.status = 'LEFT';
      child.leftReason = p.action;
      child.leftAt = year.startDate;
    }
    child.history ||= [];
    child.history.push({ at, userId, action: `PLACEMENT_${p.action}`, schoolYear: year.id, fromClassId, toClassId: p.toClassId || null });
    p.appliedAt = at;
  });
};

/** Grants of the actor read again from the database (the client copy may be stale). */
const actor = (db, user) => {
  const permissions = grantsOf(db.rolePermissions, user.role);
  if (user.role !== ROLES.VICE_PRINCIPAL) return { ...user, permissions };
  const active = db.schoolYears.find((y) => y.status === YEAR_STATUS.ACTIVE);
  const a = db.vpAssignments.find((x) => x.userId === user.id && x.schoolYear === active?.id);
  return { ...user, permissions, areas: vpAreasOf(a, permissions) };
};
const ACTION_VERB = { create: 'phân công mới', update: 'đổi phân công', delete: 'gỡ phân công' };
const noAssignRight = (db, user, campusId, action) =>
  new ApiError(
    403,
    canViewTeacherAssignments(campusId, actor(db, user))
      ? `Bạn chưa được giao quyền ${ACTION_VERB[action] || 'sửa phân công'} giáo viên ở điểm trường này. Liên hệ Hiệu trưởng.`
      : 'Vai trò của bạn chưa được bật quyền "Phân công giáo viên" cho điểm trường này. Liên hệ Hiệu trưởng.',
  );

/** Tổ trưởng của năm (kèm điểm trường của giáo viên để hiển thị), nhóm tuổi có lớp, giáo viên chọn được ở mọi điểm trường. */
const teamLeaderData = (db, schoolYear) => {
  const classes = db.classes.filter((c) => c.schoolYear === schoolYear);
  return {
    teamLeaders: db.teamLeaderAssignments
      .filter((a) => a.schoolYear === schoolYear)
      .map((a) => ({ ...a, campusId: db.users.find((u) => u.id === a.userId)?.campusId || null })),
    // Cùng danh sách nhóm tuổi với màn Nhóm tuổi & lớp (kể cả nhóm chưa có lớp)
    leaderGroups: db.ageGroups.map((g) => ({ ...g, classCount: classes.filter((c) => c.ageGroupId === g.id).length })),
    leaderCandidates: db.users
      .filter((u) => TEACHING_ROLES.includes(u.role) && (u.status || 'ACTIVE') === 'ACTIVE')
      .map((u) => {
        // Đang làm tổ trưởng nhóm khác: chọn người này sẽ chuyển họ sang nhóm mới
        const lead = db.teamLeaderAssignments.find((a) => a.schoolYear === schoolYear && a.userId === u.id);
        const group = lead && db.ageGroups.find((g) => g.id === lead.ageGroupId);
        return {
          id: u.id,
          fullName: u.fullName,
          campusId: u.campusId,
          leadsAgeGroupId: lead?.ageGroupId || null,
          leadsGroup: group?.shortName || null,
        };
      })
      .sort((a, b) => (a.campusId || '').localeCompare(b.campusId || '') || a.fullName.localeCompare(b.fullName, 'vi')),
  };
};

const notify = (db, userId, title, message, link = '/') => pushNotification(db, { userId, type: 'ASSIGNMENT', title, message, link });

/* ---------- Staff accounts: what a role / campus / status change ends ---------- */
const openYearIds = (db) => new Set(db.schoolYears.filter((y) => y.status !== YEAR_STATUS.CLOSED).map((y) => y.id));
const isTeaching = (role) => TEACHING_ROLES.includes(role);
// Tổ trưởng là giáo viên được giao nhóm tuổi, không phải vai trò riêng khi đổi vai trò
const sameRole = (role) => (role === ROLES.TEAM_LEADER ? ROLES.TEACHER : role);
const campusName = (db, id) => db.campuses.find((c) => c.id === id)?.shortName || '—';

/** Lists the assignments of open school years that the change would end. */
const staffImpact = (db, u, next) => {
  const open = openYearIds(db);
  const leaving = next.status === 'INACTIVE';
  const items = [];
  const keepsVp = !leaving && next.role === ROLES.VICE_PRINCIPAL && (next.campusId || '') === (u.campusId || '');
  if (u.role === ROLES.VICE_PRINCIPAL && !keepsVp)
    db.vpAssignments
      .filter((a) => a.userId === u.id && open.has(a.schoolYear))
      .forEach((a) => {
        items.push({ kind: 'VP', text: `Phụ trách ${campusName(db, a.campusId)} năm học ${a.schoolYear}` });
        if (a.sharedService)
          items.push({
            kind: 'WARN',
            text: `Đang giữ dịch vụ chung (sửa thực đơn) năm ${a.schoolYear}: sẽ chưa có Phó HT nào giữ cho tới khi phân công lại`,
          });
      });
  const keepsTeaching = !leaving && isTeaching(next.role) && (next.campusId || '') === (u.campusId || '');
  if (isTeaching(u.role) && !keepsTeaching) {
    db.classes
      .filter((c) => open.has(c.schoolYear) && c.teacherIds.includes(u.id))
      .forEach((c) =>
        items.push({
          kind: 'CLASS',
          text: `Dạy ${c.name} (${campusName(db, c.campusId)}, ${c.schoolYear})${c.homeroomTeacherId === u.id ? ' – chủ nhiệm' : ''}: lớp sẽ thiếu giáo viên`,
        }),
      );
    db.teamLeaderAssignments
      .filter((a) => a.userId === u.id && open.has(a.schoolYear))
      .forEach((a) =>
        items.push({
          kind: 'LEADER',
          text: `Tổ trưởng ${db.ageGroups.find((g) => g.id === a.ageGroupId)?.shortName || a.ageGroupId} (toàn trường, ${a.schoolYear})`,
        }),
      );
  }
  return items;
};

/** Ends (archives) the assignments listed by staffImpact; history is kept in db.endedAssignments. */
const endAssignments = (db, u, next, user, reason) => {
  const open = openYearIds(db);
  const endedAt = now();
  const archive = (kind, record) =>
    (db.endedAssignments ||= []).push({ kind, record: clone(record), endedAt, endedBy: user.id, reason: (reason || '').trim() });
  const leaving = next.status === 'INACTIVE';
  const keepsVp = !leaving && next.role === ROLES.VICE_PRINCIPAL && (next.campusId || '') === (u.campusId || '');
  if (u.role === ROLES.VICE_PRINCIPAL && !keepsVp) {
    db.vpAssignments.filter((a) => a.userId === u.id && open.has(a.schoolYear)).forEach((a) => archive('VP', a));
    db.vpAssignments = db.vpAssignments.filter((a) => !(a.userId === u.id && open.has(a.schoolYear)));
  }
  const keepsTeaching = !leaving && isTeaching(next.role) && (next.campusId || '') === (u.campusId || '');
  if (isTeaching(u.role) && !keepsTeaching) {
    db.classes
      .filter((c) => open.has(c.schoolYear) && c.teacherIds.includes(u.id))
      .forEach((c) => {
        archive('CLASS_TEACHER', { classId: c.id, userId: u.id, homeroom: c.homeroomTeacherId === u.id });
        c.teacherIds = c.teacherIds.filter((t) => t !== u.id);
        if (c.homeroomTeacherId === u.id) c.homeroomTeacherId = c.teacherIds[0] || null;
      });
    db.teamLeaderAssignments.filter((a) => a.userId === u.id && open.has(a.schoolYear)).forEach((a) => archive('TEAM_LEADER', a));
    db.teamLeaderAssignments = db.teamLeaderAssignments.filter((a) => !(a.userId === u.id && open.has(a.schoolYear)));
  }
};

/** New Vice Principal with a campus: assignment of the active year with the role default areas. */
const assignVp = (db, u, campusId, user) => {
  const active = db.schoolYears.find((y) => y.status === YEAR_STATUS.ACTIVE);
  if (!active || db.vpAssignments.some((a) => a.userId === u.id && a.schoolYear === active.id)) return;
  db.vpAssignments.push({
    id: uid('vpa'),
    schoolYear: active.id,
    userId: u.id,
    campusId,
    sharedService: false,
    assignedBy: user.id,
    assignedAt: now(),
  });
};

export const schoolConfigMockRepository = {
  /* ---------------- School years (#16, #17) ---------------- */
  async getSchoolYears(user) {
    await delay(120);
    if (!canViewSchoolStructure(user)) throw forbid();
    const db = seeded();
    return sortYears(db.schoolYears).map((y) => ({
      ...clone(y),
      classCount: db.classes.filter((c) => c.schoolYear === y.id).length,
    }));
  },

  async getSchoolYearById(id, user) {
    await delay(80);
    if (!canViewSchoolStructure(user)) throw forbid();
    return clone(findYear(seeded(), id));
  },

  async saveSchoolYear(id, form, user) {
    await delay();
    if (!canConfigureSchool(user)) throw forbid();
    seeded();
    return writeDb((db) => {
      const current = id ? findYear(db, id) : null;
      if (current) assertOpenYear(current);
      const others = db.schoolYears.filter((y) => y.id !== id);
      const name = (form.name || '').trim();
      const errors = validateSchoolYear({ ...form, name }, others);
      if (hasErrors(errors)) throw invalid(errors);
      // The year id is used by classes and the header selector: it can change only before anything uses it.
      if (current && current.name !== name && current.status !== YEAR_STATUS.PLANNED)
        throw invalid({ name: 'Chỉ đổi được tên năm học khi năm học chưa bắt đầu' });
      if (current && current.name !== name && db.classes.some((c) => c.schoolYear === current.id))
        throw invalid({ name: 'Năm học đã có lớp, không thể đổi tên' });
      if (current) {
        const previous = `${current.name}: ${formatDate(current.startDate)} – ${formatDate(current.endDate)}`;
        Object.assign(current, { id: name, name, startDate: form.startDate, endDate: form.endDate });
        current.history.push({ action: 'UPDATED', userId: user.id, at: now(), note: `Trước: ${previous}` });
        return clone(current);
      }
      const year = {
        id: name,
        name,
        startDate: form.startDate,
        endDate: form.endDate,
        status: YEAR_STATUS.PLANNED,
        history: [{ action: 'CREATED', userId: user.id, at: now() }],
      };
      db.schoolYears.push(year);
      return clone(year);
    });
  },

  /** Các bước chuẩn bị và điều kiện kích hoạt (PENDING BE: GET /school-years/{id}/readiness). */
  async getYearReadiness(id, user) {
    await delay(120);
    if (!canConfigureSchool(user)) throw forbid();
    const db = seeded();
    return buildReadiness(db, findYear(db, id));
  },

  /**
   * Only one active year: activating closes the current one in the same transaction, moves the children
   * per the placement and applies the new year's assignments. Blocked until every required step is done
   * and from ACTIVATION_LEAD_DAYS before the start date; the user must type the year name.
   */
  async activateSchoolYear(id, { confirmName } = {}, user) {
    await delay();
    if (!canConfigureSchool(user)) throw forbid();
    seeded();
    return writeDb((db) => {
      const year = findYear(db, id);
      if (year.status !== YEAR_STATUS.PLANNED) throw new ApiError(409, 'Chỉ kích hoạt được năm học sắp diễn ra');
      // Kích hoạt theo thứ tự: chỉ năm sắp diễn ra bắt đầu sớm nhất
      const next = nextYearToActivate(db.schoolYears);
      if (next && next.id !== year.id) throw new ApiError(409, `Kích hoạt năm học ${next.name} trước`);
      if ((confirmName || '').trim() !== year.name) throw invalid({ confirmName: `Gõ đúng "${year.name}" để xác nhận` });
      const readiness = buildReadiness(db, year);
      if (!readiness.canActivate) throw new ApiError(409, `Chưa kích hoạt được năm học ${year.name}: ${readiness.blockers.join('; ')}.`);
      const at = now();
      db.schoolYears
        .filter((y) => y.status === YEAR_STATUS.ACTIVE)
        .forEach((y) => {
          y.status = YEAR_STATUS.CLOSED;
          y.history.push({ action: 'CLOSED', userId: user.id, at, note: `Khi kích hoạt năm học ${year.name}` });
          db.classes.filter((c) => c.schoolYear === y.id).forEach((c) => (c.status = 'CLOSED'));
        });
      applyPlacements(db, year, user.id, at);
      year.status = YEAR_STATUS.ACTIVE;
      year.history.push({ action: 'ACTIVATED', userId: user.id, at });
      syncAssignments(db, year.id);
      return clone(year);
    });
  },

  /* ---------------- Xếp lớp năm học mới (PENDING BE: GET/PUT /school-years/{id}/placements) ---------------- */
  async getPlacements(yearId, user) {
    await delay(150);
    if (!canViewYearPlacement(user)) throw forbid();
    const db = seeded();
    // PHT chỉ thấy điểm trường được giao (toàn trường nếu Hiệu trưởng giao toàn trường)
    const onlyCampus = yearPlacementCampus(user);
    const mine = (c) => !onlyCampus || c.campusId === onlyCampus;
    const target = findYear(db, yearId);
    const source = placementSource(db, target);
    const saved = new Map(placementsOf(db, yearId).map((p) => [p.childId, p]));
    const targets = yearClasses(db, yearId)
      .filter(mine)
      .map((c) => ({
        id: c.id,
        name: c.name,
        campusId: c.campusId,
        ageGroupId: c.ageGroupId,
        capacity: c.capacity,
        taken: seatsTaken(db, yearId, c.id),
      }))
      .sort((a, b) => a.campusId.localeCompare(b.campusId) || a.name.localeCompare(b.name, 'vi'));
    const classes = source
      ? yearClasses(db, source.id)
          .filter(mine)
          .map((c) => {
            const next = nextGroupId(db, c.ageGroupId);
            return {
              id: c.id,
              name: c.name,
              campusId: c.campusId,
              ageGroupId: c.ageGroupId,
              nextAgeGroupId: next,
              graduating: !next,
              suggestedTargetId: next ? suggestTarget(db, target, c.campusId, next) : null,
              children: (db.children || [])
                .filter((ch) => ch.classId === c.id && ch.status === 'ACTIVE')
                .sort((a, b) => a.fullName.localeCompare(b.fullName, 'vi'))
                .map((ch) => ({
                  id: ch.id,
                  code: ch.code,
                  fullName: ch.fullName,
                  photoUrl: ch.photoUrl || null,
                  birthDate: ch.birthDate,
                  placement: clone(saved.get(ch.id) || null),
                })),
            };
          })
          .sort((a, b) => a.campusId.localeCompare(b.campusId) || a.name.localeCompare(b.name, 'vi'))
      : [];
    return {
      year: clone(target),
      sourceYear: source ? { id: source.id, name: source.name } : null,
      editable: target.status === YEAR_STATUS.PLANNED && !!source && canEditYearPlacement(user, onlyCampus || undefined),
      ageGroups: groupsByAge(db).map((g) => ({ id: g.id, shortName: g.shortName || g.name })),
      campuses: activeCampuses(db)
        .filter((c) => !onlyCampus || c.id === onlyCampus)
        .map((c) => ({ id: c.id, name: campusLabel(db, c.id) })),
      classes,
      targets,
    };
  },

  /** items: [{ childId, action, toClassId }] – ghi đè theo từng trẻ; trẻ không có trong items giữ nguyên. */
  async savePlacements(yearId, { items } = {}, user) {
    await delay();
    if (!canEditYearPlacement(user, yearPlacementCampus(user) || undefined)) throw forbid();
    seeded();
    return writeDb((db) => {
      const target = findYear(db, yearId);
      if (target.status !== YEAR_STATUS.PLANNED) throw new ApiError(409, 'Chỉ xếp lớp cho năm học sắp diễn ra');
      const source = placementSource(db, target);
      if (!source) throw new ApiError(409, 'Không có năm học đang hoạt động để chuyển trẻ');
      const pool = new Map(sourceChildren(db, source).map((ch) => [ch.id, ch]));
      const errors = {};
      (items || []).forEach((it) => {
        const child = pool.get(it.childId);
        if (!child) return (errors[it.childId] = 'Trẻ không thuộc lớp của năm học đang hoạt động');
        const from = db.classes.find((c) => c.id === child.classId);
        if (!canEditYearPlacement(user, from.campusId)) return (errors[it.childId] = 'Trẻ thuộc điểm trường bạn không được giao xếp lớp');
        const next = nextGroupId(db, from.ageGroupId);
        if (!PLACEMENT_ACTION_LABELS[it.action]) return (errors[it.childId] = 'Chọn kết quả xếp lớp');
        if (it.action === PLACEMENT_ACTION.GRADUATE && next) return (errors[it.childId] = 'Chỉ trẻ nhóm tuổi lớn nhất được ra trường');
        if (it.action === PLACEMENT_ACTION.PROMOTE && !next) return (errors[it.childId] = 'Nhóm tuổi lớn nhất: chọn Ra trường hoặc Ở lại');
        if (PLACEMENT_IN_CLASS.includes(it.action)) {
          const to = db.classes.find((c) => c.id === it.toClassId && c.schoolYear === target.id);
          if (!to) return (errors[it.childId] = 'Chọn lớp năm học mới');
          const want = it.action === PLACEMENT_ACTION.PROMOTE ? next : from.ageGroupId;
          if (to.ageGroupId !== want)
            return (errors[it.childId] = `${to.name} không đúng nhóm tuổi cho "${PLACEMENT_ACTION_LABELS[it.action]}"`);
        }
        return null;
      });
      if (hasErrors(errors)) throw new ApiError(422, 'Kiểm tra lại các trẻ được đánh dấu.', errors);
      const at = now();
      db.classPlacements ||= [];
      (items || []).forEach((it) => {
        const record = {
          schoolYear: target.id,
          childId: it.childId,
          fromClassId: pool.get(it.childId).classId,
          action: it.action,
          toClassId: PLACEMENT_IN_CLASS.includes(it.action) ? it.toClassId : null,
          updatedBy: user.id,
          updatedAt: at,
        };
        const i = db.classPlacements.findIndex((p) => p.schoolYear === target.id && p.childId === it.childId);
        if (i >= 0) db.classPlacements[i] = { ...db.classPlacements[i], ...record };
        else db.classPlacements.push({ id: uid('plc'), ...record });
      });
      // Không vượt sĩ số tối đa của lớp năm mới (đã ≤ min(nhóm tuổi, sức chứa phòng))
      const over = yearClasses(db, target.id).filter((c) => seatsTaken(db, target.id, c.id) > c.capacity);
      if (over.length)
        throw new ApiError(
          409,
          `Vượt sĩ số tối đa: ${over.map((c) => `${c.name} (${seatsTaken(db, target.id, c.id)}/${c.capacity})`).join(', ')}. Chọn lớp khác cho một số trẻ.`,
        );
      return { saved: (items || []).length };
    });
  },

  /** Xếp tự động trẻ chưa xếp: cả lớp lên nhóm tuổi kế tiếp (lớp còn nhiều chỗ nhất), nhóm lớn nhất ra trường. */
  async autoPlace(yearId, user, { campusId: askedCampus, ageGroupId } = {}) {
    await delay();
    const onlyCampus = yearPlacementCampus(user);
    if (!canEditYearPlacement(user, onlyCampus || undefined)) throw forbid();
    // PHT được giao 1 điểm trường: chỉ tự xếp trong điểm trường đó
    const campusId = onlyCampus || askedCampus;
    seeded();
    return writeDb((db) => {
      const target = findYear(db, yearId);
      if (target.status !== YEAR_STATUS.PLANNED) throw new ApiError(409, 'Chỉ xếp lớp cho năm học sắp diễn ra');
      const source = placementSource(db, target);
      if (!source) throw new ApiError(409, 'Không có năm học đang hoạt động để chuyển trẻ');
      db.classPlacements ||= [];
      const done = new Set(placementsOf(db, target.id).map((p) => p.childId));
      const at = now();
      const result = { promoted: 0, graduated: 0, unplaced: [] };
      // Có phạm vi (đang lọc trên màn hình) thì chỉ xếp các lớp năm cũ trong phạm vi đó
      const inScope = (c) => (!campusId || c.campusId === campusId) && (!ageGroupId || c.ageGroupId === ageGroupId);
      yearClasses(db, source.id)
        .filter(inScope)
        .forEach((from) => {
          const next = nextGroupId(db, from.ageGroupId);
          let left = 0;
          // Giữ cả lớp cùng một lớp mới; lớp đó hết chỗ mới chuyển sang lớp còn nhiều chỗ nhất
          let toClassId = next ? suggestTarget(db, target, from.campusId, next) : null;
          sourceChildren(db, source)
            .filter((ch) => ch.classId === from.id && !done.has(ch.id))
            .forEach((ch) => {
              const full = (id) => {
                const c = db.classes.find((x) => x.id === id);
                return !c || seatsTaken(db, target.id, c.id) >= c.capacity;
              };
              if (next && full(toClassId)) toClassId = suggestTarget(db, target, from.campusId, next);
              const to = db.classes.find((c) => c.id === toClassId);
              if (next && (!to || seatsTaken(db, target.id, to.id) >= to.capacity)) {
                left += 1;
                return;
              }
              db.classPlacements.push({
                id: uid('plc'),
                schoolYear: target.id,
                childId: ch.id,
                fromClassId: from.id,
                action: next ? PLACEMENT_ACTION.PROMOTE : PLACEMENT_ACTION.GRADUATE,
                toClassId: next ? toClassId : null,
                updatedBy: user.id,
                updatedAt: at,
              });
              result[next ? 'promoted' : 'graduated'] += 1;
            });
          if (left) result.unplaced.push({ className: from.name, count: left });
        });
      return result;
    });
  },

  async closeSchoolYear(id, user) {
    await delay();
    if (!canConfigureSchool(user)) throw forbid();
    seeded();
    return writeDb((db) => {
      const year = findYear(db, id);
      if (year.status !== YEAR_STATUS.ACTIVE) throw new ApiError(409, 'Chỉ kết thúc được năm học đang hoạt động');
      if (schoolNow().date < closeYearOpensOn(year))
        throw new ApiError(409, `Chỉ kết thúc được năm học từ ${formatDate(closeYearOpensOn(year))} (sau ngày kết thúc)`);
      year.status = YEAR_STATUS.CLOSED;
      year.history.push({ action: 'CLOSED', userId: user.id, at: now() });
      // Classes close with their academic year (Class entity lifecycle).
      db.classes.filter((c) => c.schoolYear === id).forEach((c) => (c.status = 'CLOSED'));
      return clone(year);
    });
  },

  async deleteSchoolYear(id, user) {
    await delay();
    if (!canConfigureSchool(user)) throw forbid();
    seeded();
    writeDb((db) => {
      const year = findYear(db, id);
      if (year.status !== YEAR_STATUS.PLANNED) throw new ApiError(409, 'Chỉ xóa được năm học chưa bắt đầu');
      // Năm chưa bắt đầu: xóa luôn lớp và dữ liệu chuẩn bị của năm (Cần chốt 22/10/2026)
      const classIds = new Set(db.classes.filter((c) => c.schoolYear === id).map((c) => c.id));
      db.classes = db.classes.filter((c) => !classIds.has(c.id));
      db.classPlacements = (db.classPlacements || []).filter((p) => p.schoolYear !== id);
      db.schoolYears = db.schoolYears.filter((y) => y.id !== id);
      db.vpAssignments = db.vpAssignments.filter((a) => a.schoolYear !== id);
      db.teamLeaderAssignments = db.teamLeaderAssignments.filter((a) => a.schoolYear !== id);
      db.cutoffSettings = db.cutoffSettings.filter((s) => s.schoolYear !== id);
    });
  },

  /* ---------------- Age groups & classes (#18) ---------------- */
  async getStructure({ schoolYear, campusId } = {}, user) {
    await delay(140);
    if (!canViewSchoolStructure(user)) throw forbid();
    const db = seeded();
    const year = findYear(db, schoolYear);
    const scope = isPrincipal(user) ? db.classes : visibleClasses(db, user);
    const classes = scope
      .filter((c) => c.schoolYear === schoolYear && (!campusId || c.campusId === campusId))
      .map((c) => {
        const childCount = childCountOf(db, c.id);
        // Năm sắp diễn ra: trẻ đã xếp lớp chỉ là dự kiến, chuyển vào lớp khi kích hoạt năm học
        const plannedCount = year.status === YEAR_STATUS.PLANNED ? seatsTaken(db, schoolYear, c.id) : null;
        const seats = childCount + (plannedCount || 0);
        // Trạng thái hiển thị do "BE" tính: mức đầy lớp, thiếu giáo viên (mỗi lớp 2 GV), chưa có phòng
        const fill = seats >= c.capacity ? CLASS_FILL.FULL : seats >= c.capacity * 0.9 ? CLASS_FILL.NEAR : CLASS_FILL.OPEN;
        return {
          ...c,
          childCount,
          plannedCount,
          fill,
          missingTeachers: Math.max(0, TEACHERS_PER_CLASS - c.teacherIds.length),
          noRoom: !c.locationId,
        };
      });
    // Tổ trưởng: 1 người / nhóm tuổi cho cả trường; campusId = điểm trường của giáo viên đó (để hiển thị)
    const teamLeaders = db.teamLeaderAssignments
      .filter((a) => a.schoolYear === schoolYear)
      .map((a) => ({ ageGroupId: a.ageGroupId, userId: a.userId, campusId: db.users.find((u) => u.id === a.userId)?.campusId || null }));
    const groupStats = Object.fromEntries(
      db.ageGroups.map((g) => {
        const list = classes.filter((c) => c.ageGroupId === g.id);
        return [
          g.id,
          {
            classCount: list.length,
            enrolled: list.reduce((s, c) => s + c.childCount, 0),
            planned: year.status === YEAR_STATUS.PLANNED ? list.reduce((s, c) => s + (c.plannedCount || 0), 0) : null,
            capacity: list.reduce((s, c) => s + c.capacity, 0),
          },
        ];
      }),
    );
    return { year: clone(year), ageGroups: clone(db.ageGroups), classes: clone(classes), teamLeaders, groupStats };
  },

  async getAgeGroups() {
    await delay(60);
    return clone(seeded().ageGroups);
  },

  async saveAgeGroup(id, form, user) {
    await delay();
    if (!canConfigureSchool(user)) throw forbid();
    seeded();
    return writeDb((db) => {
      const open = openYearIds(db);
      const usedClasses = id
        ? db.classes.filter((c) => c.ageGroupId === id && open.has(c.schoolYear)).map((c) => ({ ...c, childCount: childCountOf(db, c.id) }))
        : [];
      const errors = validateAgeGroup(
        form,
        db.ageGroups.filter((g) => g.id !== id),
        { blockingClasses: usedClasses },
      );
      if (hasErrors(errors)) throw invalid(errors);
      const data = {
        name: form.name.trim(),
        shortName: form.shortName.trim(),
        ageFromMonths: Number(form.ageFromMonths),
        ageToMonths: Number(form.ageToMonths),
        mealSessions: MEAL_SESSION_OPTIONS.filter((x) => form.mealSessions.includes(x)),
        mealsPerDay: form.mealSessions.length,
        maxClassSize: Number(form.maxClassSize),
        nutritionNote: (form.nutritionNote || '').trim(),
      };
      if (id) {
        const group = db.ageGroups.find((g) => g.id === id);
        if (!group) throw notFound('nhóm tuổi');
        const previous = `${group.name}: ${group.ageFromMonths}–${group.ageToMonths} tháng, bữa ${mealSessionsLabel(group)}, tối đa ${group.maxClassSize} trẻ/lớp`;
        Object.assign(group, data);
        (group.history ||= []).push({ action: 'UPDATED', userId: user.id, at: now(), note: `Trước: ${previous}` });
        return clone(group);
      }
      const group = { id: uid('ag'), ...data, history: [{ action: 'CREATED', userId: user.id, at: now() }] };
      db.ageGroups.push(group);
      return clone(group);
    });
  },

  async deleteAgeGroup(id, user) {
    await delay();
    if (!canConfigureSchool(user)) throw forbid();
    seeded();
    writeDb((db) => {
      if (db.classes.some((c) => c.ageGroupId === id)) throw inUse('nhóm tuổi đã có lớp');
      if (db.teamLeaderAssignments.some((a) => a.ageGroupId === id)) throw inUse('nhóm tuổi đã có tổ trưởng');
      db.ageGroups = db.ageGroups.filter((g) => g.id !== id);
    });
  },

  async saveClass(id, form, user) {
    await delay();
    if (!canConfigureSchool(user)) throw forbid();
    seeded();
    return writeDb((db) => {
      const year = findYear(db, form.schoolYear);
      assertOpenYear(year);
      const cls = id ? db.classes.find((c) => c.id === id) : null;
      if (id && !cls) throw notFound('lớp');
      if (cls) assertOpenYear(findYear(db, cls.schoolYear));
      const enrolled = cls ? childCountOf(db, id) : 0;
      const ageGroup = db.ageGroups.find((g) => g.id === form.ageGroupId) || null;
      const room = (db.locations || []).find((l) => l.id === form.locationId);
      const errors = validateClass(
        form,
        db.classes.filter((c) => c.id !== id),
        { ageGroup, room, enrolled },
      );
      if (!db.campuses.some((c) => c.id === form.campusId)) errors.campusId = 'Điểm trường không tồn tại';
      if (!ageGroup) errors.ageGroupId = 'Nhóm tuổi không tồn tại';
      if (form.locationId && room?.campusId !== form.campusId) errors.locationId = 'Phòng học không thuộc điểm trường đã chọn';
      else if (room && room.id !== cls?.locationId && room.status && room.status !== 'ACTIVE') errors.locationId = 'Phòng đã ngừng sử dụng';
      else if (room) {
        const other = db.classes.find((c) => c.id !== id && c.schoolYear === form.schoolYear && c.locationId === room.id);
        if (other) errors.locationId = `Phòng đang là phòng của ${other.name} trong năm học này`;
      }
      if (hasErrors(errors)) throw invalid(errors);
      const data = {
        name: form.name.trim(),
        campusId: form.campusId,
        ageGroupId: form.ageGroupId,
        schoolYear: form.schoolYear,
        capacity: Number(form.capacity),
        locationId: form.locationId,
      };
      if (cls) {
        // Lớp đã có trẻ: không đổi nhóm tuổi / điểm trường (SRS 4.1.5); lưu lớp không bao giờ xếp hay chuyển trẻ
        if (enrolled && cls.ageGroupId !== data.ageGroupId) throw invalid({ ageGroupId: 'Lớp đã có trẻ, không đổi được nhóm tuổi' });
        if (cls.campusId !== data.campusId && (enrolled || cls.teacherIds.length))
          throw invalid({ campusId: 'Lớp đã có trẻ hoặc giáo viên, không thể chuyển sang điểm trường khác' });
        const previous = `${cls.name}: sĩ số tối đa ${cls.capacity}`;
        Object.assign(cls, data);
        (cls.history ||= []).push({ action: 'UPDATED', userId: user.id, at: now(), note: `Trước: ${previous}` });
        return clone(cls);
      }
      const created = {
        id: uid('cls'),
        ...data,
        homeroomTeacherId: null,
        teacherIds: [],
        status: 'ACTIVE',
        history: [{ action: 'CREATED', userId: user.id, at: now() }],
      };
      db.classes.push(created);
      return clone(created);
    });
  },

  async deleteClass(id, user) {
    await delay();
    if (!canConfigureSchool(user)) throw forbid();
    seeded();
    writeDb((db) => {
      const cls = db.classes.find((c) => c.id === id);
      if (!cls) throw notFound('lớp');
      assertOpenYear(findYear(db, cls.schoolYear));
      if ((db.children || []).some((ch) => ch.classId === id)) throw inUse('lớp đã có trẻ');
      if (classHasHistory(db, id)) throw inUse('lớp đã có dữ liệu điểm danh, suất ăn hoặc đánh giá');
      db.classes = db.classes.filter((c) => c.id !== id);
    });
  },

  /**
   * Reuse the classes of an earlier school year (SRS 4.1.3 "Copy from Previous Year", extended to any other year).
   * Copies name, age group, campus, room and capacity only – never teachers or children; names already in the target year are skipped.
   */
  async copyClasses(targetYearId, { sourceYearId, classIds } = {}, user) {
    await delay();
    if (!canConfigureSchool(user)) throw forbid();
    seeded();
    return writeDb((db) => {
      const target = findYear(db, targetYearId);
      assertOpenYear(target);
      const source = findYear(db, sourceYearId);
      if (source.id === target.id) throw invalid({ sourceYearId: 'Chọn một năm học khác để sao chép' });
      const picked = db.classes.filter((c) => c.schoolYear === source.id && (!classIds || classIds.includes(c.id)));
      const copied = [];
      const skipped = [];
      const withoutRoom = [];
      // Phòng ngừng sử dụng hoặc đã có lớp khác trong năm đích thì để trống phòng, Hiệu trưởng xếp lại sau
      const roomFree = (locId) => {
        const loc = (db.locations || []).find((l) => l.id === locId);
        return (
          !!loc && (!loc.status || loc.status === 'ACTIVE') && !db.classes.some((x) => x.schoolYear === target.id && x.locationId === locId)
        );
      };
      picked.forEach((c) => {
        const group = db.ageGroups.find((g) => g.id === c.ageGroupId);
        if (db.classes.some((x) => x.schoolYear === target.id && x.campusId === c.campusId && sameName(x.name, c.name)))
          return skipped.push({ name: c.name, reason: 'Điểm trường đã có lớp cùng tên trong năm học' });
        if (!group) return skipped.push({ name: c.name, reason: 'Nhóm tuổi không còn tồn tại' });
        const locationId = c.locationId && roomFree(c.locationId) ? c.locationId : null;
        if (c.locationId && !locationId) withoutRoom.push(c.name);
        // Sĩ số không vượt sức chứa phòng giữ lại
        const roomCap = (db.locations || []).find((l) => l.id === locationId)?.capacity || c.capacity;
        db.classes.push({
          id: uid('cls'),
          name: c.name,
          campusId: c.campusId,
          ageGroupId: c.ageGroupId,
          schoolYear: target.id,
          // Năm đích: không vượt sĩ số tối đa của nhóm tuổi và sức chứa phòng giữ lại
          capacity: Math.min(c.capacity, roomCap, group.maxClassSize || c.capacity),
          locationId,
          homeroomTeacherId: null,
          teacherIds: [],
          status: 'ACTIVE',
          history: [{ action: 'COPIED', userId: user.id, at: now(), note: `Sao chép từ năm học ${source.name}` }],
        });
        return copied.push(c.name);
      });
      return { copied, skipped, withoutRoom };
    });
  },

  /* ---------------- Cutoff (#19) ---------------- */
  /** Readable by every signed-in user: attendance and meal modules need the active cutoff. */
  async getCutoffSetting(schoolYear) {
    await delay(80);
    const db = seeded();
    const year = findYear(db, schoolYear);
    const setting = db.cutoffSettings.find((s) => s.schoolYear === schoolYear) || null;
    return { year: clone(year), setting: clone(setting) };
  },

  async saveCutoffSetting(schoolYear, form, user) {
    await delay();
    if (!canConfigureCutoff(user)) throw forbid();
    seeded();
    return writeDb((db) => {
      const year = findYear(db, schoolYear);
      assertOpenYear(year);
      const errors = validateCutoff(form, year);
      if (hasErrors(errors)) throw invalid(errors);
      let setting = db.cutoffSettings.find((s) => s.schoolYear === schoolYear);
      const previousTime = setting?.time || null;
      if (setting && setting.time === form.time && setting.effectiveFrom === form.effectiveFrom)
        throw invalid({ time: 'Giờ chốt và ngày áp dụng chưa thay đổi' });
      if (!setting) {
        setting = { schoolYear, history: [] };
        db.cutoffSettings.push(setting);
      }
      Object.assign(setting, {
        time: form.time,
        effectiveFrom: form.effectiveFrom,
        updatedBy: user.id,
        updatedAt: now(),
      });
      setting.history.unshift({
        time: form.time,
        effectiveFrom: form.effectiveFrom,
        previousTime,
        userId: user.id,
        at: now(),
        note: (form.note || '').trim(),
      });
      db.users
        .filter((u) => u.role === ROLES.VICE_PRINCIPAL)
        .forEach((u) =>
          notify(
            db,
            u.id,
            'Giờ chốt điểm danh thay đổi',
            `Từ ${form.effectiveFrom}, điểm danh và suất ăn khóa lúc ${form.time} (năm học ${year.name}).`,
          ),
        );
      return clone(setting);
    });
  },

  /* ---------------- Campuses (#20, #21, #22) ---------------- */
  async getCampuses(schoolYear, user) {
    await delay(120);
    if (!canListCampuses(user)) throw forbid();
    const db = seeded();
    return clone(
      db.campuses
        .filter((c) => canViewCampus(c, user))
        .map((c) => {
          const classes = db.classes.filter((cl) => cl.campusId === c.id && cl.schoolYear === schoolYear);
          return {
            ...c,
            classCount: classes.length,
            childCount: classes.reduce((s, cl) => s + childCountOf(db, cl.id), 0),
            vicePrincipals: db.users
              .filter((u) => u.role === ROLES.VICE_PRINCIPAL && u.campusId === c.id)
              .map((u) => ({ id: u.id, fullName: u.fullName })),
          };
        }),
    );
  },

  async getCampusDetail(id, schoolYear, user) {
    await delay(120);
    const db = seeded();
    const campus = db.campuses.find((c) => c.id === id);
    if (!campus) throw notFound('điểm trường');
    if (!canViewCampus(campus, user)) throw forbid();
    const classes = db.classes
      .filter((c) => c.campusId === id && c.schoolYear === schoolYear)
      .map((c) => ({ ...c, childCount: childCountOf(db, c.id) }));
    const staffOf = (role) => db.users.filter((u) => u.role === role && u.campusId === id);
    return clone({
      campus,
      classes,
      ageGroups: db.ageGroups,
      vicePrincipals: staffOf(ROLES.VICE_PRINCIPAL),
      teachers: db.users.filter((u) => TEACHING_ROLES.includes(u.role) && u.campusId === id),
      kitchen: {
        locations: db.locations.filter((l) => l.campusId === id && l.type === 'KITCHEN'),
        staff: staffOf(ROLES.KITCHEN_STAFF),
      },
    });
  },

  async saveCampus(id, form, user) {
    await delay();
    if (!canManageCampus(user)) throw forbid();
    seeded();
    return writeDb((db) => {
      const errors = validateCampus(
        form,
        db.campuses.filter((c) => c.id !== id),
      );
      if (hasErrors(errors)) throw invalid(errors);
      const current = id ? db.campuses.find((c) => c.id === id) : null;
      if (id && !current) throw notFound('điểm trường');
      if (current?.isMain && !form.isMain)
        throw invalid({ isMain: 'Trường phải có đúng một điểm trường chính. Hãy chọn điểm trường chính khác trước.' });
      const data = {
        code: form.code.trim(),
        name: form.name.trim(),
        shortName: form.shortName.trim(),
        address: form.address.trim(),
        phone: normalizePhone(form.phone),
        isMain: !!form.isMain,
      };
      // Exactly one main campus (Campus entity).
      if (data.isMain) db.campuses.forEach((c) => (c.isMain = false));
      if (current) {
        Object.assign(current, data, { updatedBy: user.id, updatedAt: now() });
        return clone(current);
      }
      const campus = { id: uid('c'), ...data, createdBy: user.id, createdAt: now() };
      if (!db.campuses.some((c) => c.isMain)) campus.isMain = true;
      db.campuses.push(campus);
      return clone(campus);
    });
  },

  async deleteCampus(id, user) {
    await delay();
    if (!canManageCampus(user)) throw forbid();
    seeded();
    writeDb((db) => {
      const campus = db.campuses.find((c) => c.id === id);
      if (!campus) throw notFound('điểm trường');
      if (campus.isMain) throw inUse('đây là điểm trường chính');
      if (db.classes.some((c) => c.campusId === id)) throw inUse('điểm trường đã có lớp');
      if (db.users.some((u) => u.campusId === id)) throw inUse('điểm trường đã có nhân sự');
      if (db.locations.some((l) => l.campusId === id)) throw inUse('điểm trường đã có phòng, bếp');
      if ((db.children || []).some((ch) => ch.campusId === id)) throw inUse('điểm trường đã có trẻ');
      db.campuses = db.campuses.filter((c) => c.id !== id);
    });
  },

  /* ---------------- Staff accounts (PROPOSED 10/10/2026: SRS 4.4 "User account – Create / Edit / Deactivate", footnote 8) ---------------- */
  /** Hiệu trưởng: mọi tài khoản. PHT: chỉ xem nhân sự điểm trường mình (không gồm Hiệu trưởng). */
  async getStaffAccounts(user) {
    await delay(120);
    if (!canViewStaff(user)) throw forbid();
    const db = seeded();
    const open = openYearIds(db);
    // PHT: nhân sự của các điểm trường trong phạm vi quyền "Hồ sơ nhân sự" (không gồm Hiệu trưởng)
    const list = canManageStaff(user)
      ? db.users
      : db.users.filter((u) => u.role !== ROLES.PRINCIPAL && u.campusId && areaAllows(user, 'staff', u.campusId));
    return clone(
      list.map((u) => ({
        ...u,
        status: u.status || 'ACTIVE',
        vpAssignments: db.vpAssignments.filter((a) => a.userId === u.id && open.has(a.schoolYear)),
        classes: db.classes
          .filter((c) => open.has(c.schoolYear) && c.teacherIds.includes(u.id))
          .map((c) => ({ id: c.id, name: c.name, schoolYear: c.schoolYear })),
        leads: db.teamLeaderAssignments.filter((a) => a.userId === u.id && open.has(a.schoolYear)),
      })),
    );
  },

  /** PHT (hoặc Hiệu trưởng) sửa thông tin hồ sơ nhân sự; không đổi vai trò, điểm trường, trạng thái. */
  async updateStaffProfile(id, form, user) {
    await delay();
    seeded();
    return writeDb((db) => {
      const target = db.users.find((u) => u.id === id);
      if (!target) throw notFound('nhân sự');
      if (!canEditStaffProfile(target, user)) throw forbid();
      const errors = validateStaffProfile(
        form,
        db.users.filter((u) => u.id !== id),
      );
      if (hasErrors(errors)) throw invalid(errors);
      const before = { fullName: target.fullName, email: target.email, phone: target.phone };
      Object.assign(target, {
        fullName: form.fullName.trim(),
        email: form.email.trim().toLowerCase(),
        phone: normalizePhone(form.phone),
        dateOfBirth: form.dateOfBirth || null,
        qualification: (form.qualification || '').trim(),
        note: (form.note || '').trim(),
      });
      (target.profileHistory ||= []).push({ at: now(), userId: user.id, before });
      return clone(target);
    });
  },

  /** What a role / campus / status change ends (shown before confirming). */
  async getStaffImpact(id, form, user) {
    await delay(80);
    if (!canManageStaff(user)) throw forbid();
    const db = seeded();
    const u = db.users.find((x) => x.id === id);
    if (!u) throw notFound('tài khoản');
    return clone(staffImpact(db, u, form));
  },

  async saveStaffAccount(id, form, user) {
    await delay();
    if (!canManageStaff(user)) throw forbid();
    seeded();
    return writeDb((db) => {
      const current = id ? db.users.find((x) => x.id === id) : null;
      if (id && !current) throw notFound('tài khoản');
      if (current?.role === ROLES.PRINCIPAL) throw new ApiError(409, 'Không đổi được tài khoản Hiệu trưởng ở màn này');
      const errors = validateStaffAccount(
        form,
        db.users.filter((x) => x.id !== id),
      );
      if (form.campusId && !db.campuses.some((c) => c.id === form.campusId)) errors.campusId = 'Điểm trường không tồn tại';
      if (hasErrors(errors)) throw invalid(errors);
      const data = {
        fullName: form.fullName.trim().replace(/\s+/g, ' '),
        email: form.email.trim().toLowerCase(),
        phone: normalizePhone(form.phone),
      };
      if (!current) {
        const created = {
          id: uid('u'),
          ...data,
          role: form.role,
          campusId: form.campusId || null,
          locationIds: [],
          status: 'ACTIVE',
          roleHistory: [{ at: now(), userId: user.id, from: null, to: form.role, campusId: form.campusId || null, note: 'Tạo tài khoản' }],
        };
        db.users.push(created);
        if (form.role === ROLES.VICE_PRINCIPAL && form.campusId) assignVp(db, created, form.campusId, user);
        notify(
          db,
          created.id,
          'Tài khoản CareNest đã được tạo',
          `Vai trò: ${ROLE_LABELS[form.role]}. Hãy đăng nhập và đổi mật khẩu.`,
          '/account/profile',
        );
        return clone(created);
      }
      const roleChanged = sameRole(current.role) !== form.role;
      const campusChanged = (current.campusId || '') !== (form.campusId || '');
      if (roleChanged || campusChanged) {
        if (!(form.reason || '').trim()) throw invalid({ reason: 'Nhập lý do đổi vai trò / điểm trường' });
        endAssignments(db, current, { role: form.role, campusId: form.campusId, status: current.status || 'ACTIVE' }, user, form.reason);
        (current.roleHistory ||= []).push({
          at: now(),
          userId: user.id,
          from: current.role,
          to: form.role,
          fromCampusId: current.campusId || null,
          campusId: form.campusId || null,
          note: form.reason.trim(),
        });
        // Giữ "Tổ trưởng" nếu vẫn là giáo viên cùng điểm trường; ngược lại nhận vai trò mới
        current.role = form.role === ROLES.TEACHER && current.role === ROLES.TEAM_LEADER && !campusChanged ? ROLES.TEAM_LEADER : form.role;
        current.campusId = form.campusId || null;
        if (form.role === ROLES.VICE_PRINCIPAL && form.campusId) assignVp(db, current, form.campusId, user);
        notify(
          db,
          current.id,
          'Vai trò của bạn đã thay đổi',
          `Vai trò mới: ${ROLE_LABELS[form.role]}${form.campusId ? ` · ${db.campuses.find((c) => c.id === form.campusId)?.shortName}` : ''}. Có hiệu lực từ lần đăng nhập tiếp theo.`,
          '/account/profile',
        );
      }
      Object.assign(current, data);
      return clone(current);
    });
  },

  async setStaffStatus(id, status, reason, user) {
    await delay();
    if (!canManageStaff(user)) throw forbid();
    seeded();
    return writeDb((db) => {
      const u = db.users.find((x) => x.id === id);
      if (!u) throw notFound('tài khoản');
      if (u.role === ROLES.PRINCIPAL || u.id === user.id) throw new ApiError(409, 'Không vô hiệu hóa được tài khoản Hiệu trưởng');
      if (!(reason || '').trim()) throw invalid({ reason: 'Nhập lý do' });
      if (status === 'INACTIVE') endAssignments(db, u, { role: u.role, campusId: u.campusId, status }, user, reason);
      u.status = status;
      (u.roleHistory ||= []).push({ at: now(), userId: user.id, from: u.role, to: u.role, status, note: reason.trim() });
      return clone(u);
    });
  },

  /* ---------------- Vice principal assignment (#23) ---------------- */
  async getViceAssignments(schoolYear, user) {
    await delay(120);
    if (!canAssignVicePrincipal(user)) throw forbid();
    const db = seeded();
    const year = findYear(db, schoolYear);
    const roleGrants = grantsOf(db.rolePermissions, ROLES.VICE_PRINCIPAL);
    const rows = db.users
      .filter((u) => u.role === ROLES.VICE_PRINCIPAL)
      .map((u) => {
        const assignment = db.vpAssignments.find((a) => a.schoolYear === schoolYear && a.userId === u.id) || null;
        return { user: u, assignment: assignment && { ...assignment, areas: vpAreasOf(assignment, roleGrants) } };
      });
    return clone({ year, rows });
  },

  async saveViceAssignment(schoolYear, userId, form, user) {
    await delay();
    if (!canAssignVicePrincipal(user)) throw forbid();
    seeded();
    return writeDb((db) => {
      const year = findYear(db, schoolYear);
      assertOpenYear(year);
      const vp = db.users.find((u) => u.id === userId && u.role === ROLES.VICE_PRINCIPAL);
      if (!vp) throw notFound('Phó hiệu trưởng');
      const errors = validateVpAssignment(form);
      if (form.campusId && !db.campuses.some((c) => c.id === form.campusId)) errors.campusId = 'Điểm trường không tồn tại';
      if (hasErrors(errors)) throw invalid(errors);
      // Chỉ lưu các mảng được thêm; kiểm tra mức và điểm trường hợp lệ
      const areas = {};
      Object.entries(form.areas || {}).forEach(([key, value]) => {
        const area = VP_AREAS.find((x) => x.key === key);
        const g = parseAreaGrant(value, form.campusId);
        if (!area) throw invalid({ areas: 'Mảng quyền không hợp lệ' });
        if (g.access === PERMISSION_ACCESS.NONE) return;
        // Bỏ thao tác không áp dụng cho mảng; mảng "linked" thì Thêm / Sửa / Xóa đi cùng nhau
        const writes = area.actions.some((k) => k !== 'view' && g.actions[k]);
        g.actions = Object.fromEntries(
          AREA_ACTIONS.map((k) => [k, k === 'view' || (area.actions.includes(k) && (area.linked ? writes : g.actions[k]))]),
        );
        // Mảng chỉ có phạm vi toàn trường (thực đơn, tổ trưởng nhóm tuổi)
        if (!area.scopes.includes('CAMPUS')) g.campusId = null;
        if (g.campusId && !db.campuses.some((c) => c.id === g.campusId))
          throw invalid({ areas: `${area.label}: điểm trường không tồn tại` });
        areas[key] = composeAreaGrant(g);
      });
      // Sửa thực đơn = dịch vụ chung: chỉ một Phó hiệu trưởng mỗi năm (GBR-GEN-10)
      const sharedService = grantWrites(areas.menu);
      if (sharedService) {
        const other = db.vpAssignments.find(
          (x) => x.schoolYear === schoolYear && x.userId !== userId && grantWrites(vpAreasOf(x).menu, x.campusId),
        );
        if (other)
          throw invalid({
            areas: `Thực đơn & dịch vụ bán trú đang do ${userName(db, other.userId)} quản lý. Mỗi năm học chỉ một Phó hiệu trưởng được thêm, sửa, xóa thực đơn; đổi người đó về chỉ Xem trước.`,
          });
      }
      let a = db.vpAssignments.find((x) => x.schoolYear === schoolYear && x.userId === userId);
      const before = a ? { campusId: a.campusId, sharedService: a.sharedService, areas: a.areas } : null;
      if (!a) {
        a = { id: uid('vpa'), schoolYear, userId };
        db.vpAssignments.push(a);
      }
      Object.assign(a, {
        campusId: form.campusId,
        sharedService,
        areas,
        areasV2: true,
        staffArea: true,
        areaActions: true,
        teamLeaderArea: true,
        assignedBy: user.id,
        assignedAt: now(),
      });
      a.history = [...(a.history || []), { before, userId: user.id, at: now(), note: (form.note || '').trim() }];
      syncAssignments(db, schoolYear);
      const campus = db.campuses.find((c) => c.id === form.campusId);
      notify(
        db,
        userId,
        'Bạn được phân công phụ trách điểm trường',
        `Năm học ${year.name}: phụ trách ${campus.shortName || campus.name}${a.sharedService ? ', kèm dịch vụ chung (bán trú toàn trường)' : ''}.`,
      );
      return clone(a);
    });
  },

  /* ---------------- Teacher assignment (#26) ---------------- */
  async getTeacherAssignments({ schoolYear, campusId }, user) {
    await delay(140);
    const db = seeded();
    if (!canViewTeacherAssignments(campusId, actor(db, user))) throw noAssignRight(db, user, campusId);
    const year = findYear(db, schoolYear);
    return clone({
      year,
      ageGroups: db.ageGroups,
      // campusId 'all' = toàn trường (chỉ khi quyền phân công có phạm vi toàn trường)
      classes: db.classes
        .filter((c) => (campusId === 'all' || c.campusId === campusId) && c.schoolYear === schoolYear)
        .map((c) => ({ ...c, childCount: childCountOf(db, c.id) }))
        .sort((a, b) => a.campusId.localeCompare(b.campusId) || a.name.localeCompare(b.name, 'vi')),
      teachers: db.users.filter((u) => TEACHING_ROLES.includes(u.role) && (campusId === 'all' || u.campusId === campusId)),
    });
  },

  /** Tổ trưởng nhóm tuổi của năm học (toàn trường) và giáo viên có thể chọn ở mọi điểm trường. */
  /** Mock chưa lưu lịch sử theo ngày: trả phân công hiện tại (BE thật trả đủ lịch sử). */
  async getClassTeacherHistory(classId) {
    await delay();
    seeded();
    const db = readDb();
    const cls = db.classes.find((c) => c.id === classId);
    if (!cls) throw notFound('lớp');
    return (cls.teacherIds || []).map((userId) => ({
      id: `${classId}-${userId}`,
      userId,
      fullName: db.users.find((u) => u.id === userId)?.fullName || userId,
      homeroom: userId === cls.homeroomTeacherId,
      validFrom: null,
      validTo: null,
      current: true,
      assignedByName: null,
      assignedAt: null,
    }));
  },

  async getTeamLeaderHistory(ageGroupId, schoolYear) {
    await delay();
    seeded();
    const db = readDb();
    return db.teamLeaderAssignments
      .filter((a) => a.ageGroupId === ageGroupId && a.schoolYear === schoolYear)
      .map((a) => ({
        id: `${ageGroupId}-${a.userId}`,
        userId: a.userId,
        fullName: db.users.find((u) => u.id === a.userId)?.fullName || a.userId,
        homeroom: false,
        validFrom: null,
        validTo: null,
        current: true,
        assignedByName: null,
        assignedAt: null,
      }));
  },

  async getTeamLeaders({ schoolYear }, user) {
    await delay(100);
    const db = seeded();
    if (!canViewTeamLeaders(actor(db, user))) throw forbid();
    findYear(db, schoolYear);
    return clone(teamLeaderData(db, schoolYear));
  },

  async saveClassTeachers(classId, form, user) {
    await delay();
    seeded();
    return writeDb((db) => {
      const cls = db.classes.find((c) => c.id === classId);
      if (!cls) throw notFound('lớp');
      // Lớp chưa có giáo viên = Thêm; đã có = Sửa
      const action = cls.teacherIds?.length ? 'update' : 'create';
      if (!canAssignTeachers(cls.campusId, actor(db, user), action)) throw noAssignRight(db, user, cls.campusId, action);
      const year = findYear(db, cls.schoolYear);
      assertOpenYear(year);
      // Còn 1 giáo viên mà không chọn chủ nhiệm ⇒ người còn lại làm chủ nhiệm; năm đang học không để lớp trống
      if (!form.homeroomTeacherId && (form.teacherIds || []).length === 1) form = { ...form, homeroomTeacherId: form.teacherIds[0] };
      const errors = validateClassTeachers(form, { requireHomeroom: false });
      if (!(form.teacherIds || []).length && year.status === YEAR_STATUS.ACTIVE)
        errors.teacherIds = 'Năm học đang hoạt động: chọn giáo viên thay thế';
      const allowed = new Set(db.users.filter((u) => TEACHING_ROLES.includes(u.role) && u.campusId === cls.campusId).map((u) => u.id));
      if ((form.teacherIds || []).some((t) => !allowed.has(t))) errors.teacherIds = 'Chỉ phân công giáo viên thuộc điểm trường của lớp';
      // Mỗi giáo viên dạy một lớp trong năm học (Cần chốt 18/10/2026)
      const busy = (form.teacherIds || [])
        .map((t) => [t, db.classes.find((c) => c.id !== cls.id && c.schoolYear === cls.schoolYear && c.teacherIds?.includes(t))])
        .find(([, c]) => c);
      if (!errors.teacherIds && busy)
        errors.teacherIds = `Giáo viên ${db.users.find((u) => u.id === busy[0])?.fullName || busy[0]} đang dạy lớp ${busy[1].name}; gỡ ở lớp đó trước`;
      if (hasErrors(errors)) throw invalid(errors);
      const added = form.teacherIds.filter((t) => !cls.teacherIds.includes(t));
      cls.teacherIds = [...form.teacherIds];
      cls.homeroomTeacherId = form.homeroomTeacherId || null;
      cls.assignmentHistory = [...(cls.assignmentHistory || []), { teacherIds: cls.teacherIds, userId: user.id, at: now() }];
      added.forEach((t) =>
        notify(
          db,
          t,
          'Bạn được phân công lớp mới',
          `Năm học ${year.name}: bạn phụ trách ${cls.name}${t === cls.homeroomTeacherId ? ' (chủ nhiệm)' : ''}.`,
        ),
      );
      return clone(cls);
    });
  },

  async saveTeamLeader({ schoolYear, ageGroupId, userId }, user) {
    await delay();
    seeded();
    return writeDb((db) => {
      // 1 tổ trưởng / nhóm tuổi / năm học cho cả trường. Gỡ = Xóa; nhóm chưa có = Thêm; thay người = Sửa
      const current = db.teamLeaderAssignments.find((a) => a.schoolYear === schoolYear && a.ageGroupId === ageGroupId);
      const action = !userId ? 'delete' : current ? 'update' : 'create';
      if (!teamLeaderActions(actor(db, user))[action])
        throw new ApiError(
          403,
          `Bạn chưa được giao quyền ${ACTION_VERB[action]} tổ trưởng nhóm tuổi. Liên hệ Hiệu trưởng (quyền "Phân công tổ trưởng nhóm tuổi").`,
        );
      const year = findYear(db, schoolYear);
      assertOpenYear(year);
      if (!db.ageGroups.some((g) => g.id === ageGroupId)) throw notFound('nhóm tuổi');
      if (userId && !db.users.some((u) => u.id === userId && TEACHING_ROLES.includes(u.role) && (u.status || 'ACTIVE') === 'ACTIVE'))
        throw invalid({ userId: 'Tổ trưởng phải là giáo viên đang làm việc' });
      // Một giáo viên làm tổ trưởng tối đa một nhóm tuổi trong năm học
      db.teamLeaderAssignments = db.teamLeaderAssignments.filter(
        (a) => a.schoolYear !== schoolYear || !(a.ageGroupId === ageGroupId || (userId && a.userId === userId)),
      );
      let created = null;
      if (userId) {
        created = { id: uid('tla'), schoolYear, ageGroupId, userId, assignedBy: user.id, assignedAt: now() };
        db.teamLeaderAssignments.push(created);
        const group = db.ageGroups.find((g) => g.id === ageGroupId);
        notify(db, userId, 'Bạn được phân công tổ trưởng nhóm tuổi', `Năm học ${year.name}: tổ trưởng ${group.name}.`);
      }
      syncAssignments(db, schoolYear);
      return clone(created);
    });
  },

  /* ---------------- Roles & permissions (#24, #25) ---------------- */
  async getRolePermissions(user) {
    await delay(100);
    if (!canManageRolePermissions(user)) throw forbid();
    const db = seeded();
    return clone(
      CONFIG_ROLES.map((role) => {
        const entry = db.rolePermissions.find((r) => r.role === role) || { role, grants: defaultGrants(role), history: [] };
        const userCount = db.users.filter((u) => u.role === role).length;
        return { ...entry, userCount, history: entry.history.map((h) => ({ ...h, userName: userName(db, h.userId) })) };
      }),
    );
  },

  async saveRolePermissions(role, { grants, reason }, user) {
    await delay();
    if (!canManageRolePermissions(user)) throw forbid();
    if (!CONFIG_ROLES.includes(role)) throw notFound('vai trò');
    seeded();
    return writeDb((db) => {
      const errors = validatePermissionChange({ reason });
      if (hasErrors(errors)) throw invalid(errors);
      let entry = db.rolePermissions.find((r) => r.role === role);
      if (!entry) {
        entry = { role, grants: defaultGrants(role), history: [] };
        db.rolePermissions.push(entry);
      }
      const levels = Object.values(PERMISSION_LEVEL);
      const changes = PERMISSION_CATALOG.filter((p) => grants[p.code] && grants[p.code] !== entry.grants[p.code]).map((p) => ({
        code: p.code,
        from: entry.grants[p.code] || PERMISSION_LEVEL.NONE,
        to: grants[p.code],
      }));
      if (changes.some((c) => !levels.includes(c.to))) throw new ApiError(422, 'Mức quyền không hợp lệ');
      if (changes.some((c) => isLockedGrant(role, c.code)))
        throw new ApiError(422, `${CONFIG_ROLE_LABELS[role]} phải giữ quyền quản lý phân quyền`);
      if (!changes.length) throw new ApiError(422, 'Chưa có thay đổi nào để lưu');
      changes.forEach((c) => (entry.grants[c.code] = c.to));
      entry.history.unshift({ userId: user.id, at: now(), reason: reason.trim(), changes });
      return clone(entry);
    });
  },
};
