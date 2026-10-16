import { writeDb, clone, delay, ApiError } from '@/mocks/mockDatabase';
import { pushNotification } from '@/mocks/notificationMockRepository';
import { CHILD_STATUS } from '@/models/School';
import { FOLLOW_UP_LEVEL } from '@/models/children/childrenConstants';
import {
  CAMPAIGN_STATUS,
  CHILD_RESULT_STATUS,
  FOLLOW_UP_FIELD_LIMITS,
  FOLLOW_UP_STATUS,
  HEALTH_CHECK_FIELD_LIMITS,
} from '@/models/children/healthCheckConstants';
import { formatDate } from '@/utils/format';
import { uid } from '@/utils/id';
import { hasErrors, validateFollowUpAction, validateHealthCheck } from '@/utils/children/childrenValidation';
import {
  canManageHealthCheck,
  canUpdateFollowUp,
  canViewHealthChecks,
  isPrincipal,
  isVicePrincipal,
  teachesClass,
} from '@/utils/children/childrenPermissions';
import { ensureChildRecordsSeeded } from './childrenMockRepository';
import { campaignStatusOf, isOpenForEntry, unclosedCampaignOf } from './healthCheckRule';
import { screenMeasurement } from './healthScreeningRule';

/*
 * Backend giả của đợt khám sức khỏe (user chốt 2026-10-15, PROPOSED — chờ BE ghi HLT-07).
 * Owns db.healthCheckCampaigns và db.healthFollowUps (phiếu theo dõi, HLT-09 đề xuất); đọc db.healthMeasurements (nối qua campaignId).
 * Phạm vi: Hiệu trưởng mọi điểm trường; Phó hiệu trưởng điểm trường của mình; giáo viên/tổ trưởng điểm trường của lớp
 * được phân công và chỉ thấy lớp mình.
 */

const FORBIDDEN = 'Bạn không có quyền thực hiện thao tác này.';
const NOT_FOUND = 'Không tìm thấy đợt khám.';
const nowIso = () => new Date().toISOString();

const forbid = () => {
  throw new ApiError(403, FORBIDDEN);
};

const invalid = (errors, message = 'Thông tin chưa hợp lệ. Kiểm tra các ô được đánh dấu.') => {
  throw new ApiError(422, message, errors);
};

const userName = (db, id) => db.users?.find((u) => u.id === id)?.fullName || '';
const campusName = (db, id) => db.campuses?.find((c) => c.id === id)?.name || '';

/** Lớp người dùng được xem trong một điểm trường. */
const scopedClasses = (db, user, campusId) => {
  const ofCampus = db.classes.filter((c) => c.campusId === campusId);
  if (isPrincipal(user)) return ofCampus;
  if (isVicePrincipal(user)) return user.campusId === campusId ? ofCampus : [];
  return ofCampus.filter((c) => teachesClass(c, user));
};

const canSeeCampaign = (db, user, c) =>
  isPrincipal(user) || (isVicePrincipal(user) && user.campusId === c.campusId) || scopedClasses(db, user, c.campusId).length > 0;

const findCampaign = (db, id, user) => {
  const c = db.healthCheckCampaigns.find((x) => x.id === id);
  // Ngoài phạm vi trả 404 như không tồn tại, không lộ đợt của điểm trường khác.
  if (!c || !canSeeCampaign(db, user, c)) throw new ApiError(404, NOT_FOUND);
  return c;
};

const latestBefore = (db, childId, date, excludeId) =>
  db.healthMeasurements
    .filter((m) => m.childId === childId && m.id !== excludeId && m.date < date)
    .sort((a, b) => b.date.localeCompare(a.date))[0] || null;

const openFollowUpOf = (db, childId) =>
  (db.healthFollowUps || []).find((f) => f.childId === childId && f.status !== FOLLOW_UP_STATUS.CLOSED) || null;

/** Danh sách trẻ của lớp trong đợt + kết quả (BE trả, UI không tự tính). */
const rosterOf = (db, campaign, cls) => {
  const status = campaignStatusOf(campaign);
  const resultByChild = Object.fromEntries(db.healthMeasurements.filter((m) => m.campaignId === campaign.id).map((m) => [m.childId, m]));
  const absent = new Set(campaign.absentChildIds || []);
  const kids = db.children.filter(
    (ch) =>
      ch.classId === cls.id &&
      (resultByChild[ch.id] || (status === CAMPAIGN_STATUS.CLOSED ? absent.has(ch.id) : ch.status === CHILD_STATUS.ACTIVE)),
  );
  return kids
    .sort((a, b) => a.fullName.localeCompare(b.fullName, 'vi'))
    .map((ch) => {
      const m = resultByChild[ch.id];
      const screen = m ? screenMeasurement(m, ch.dateOfBirth) : null;
      const prev = latestBefore(db, ch.id, m?.date || campaign.startDate, m?.id);
      const prevCampaign = prev?.campaignId ? db.healthCheckCampaigns.find((c) => c.id === prev.campaignId) : null;
      const followUp = openFollowUpOf(db, ch.id);
      return {
        childId: ch.id,
        code: ch.code,
        fullName: ch.fullName,
        dateOfBirth: ch.dateOfBirth,
        classId: cls.id,
        className: cls.name,
        result: m
          ? CHILD_RESULT_STATUS.RECORDED
          : status === CAMPAIGN_STATUS.CLOSED
            ? CHILD_RESULT_STATUS.ABSENT
            : CHILD_RESULT_STATUS.NOT_RECORDED,
        measurementId: m?.id || null,
        date: m?.date || null,
        bmiStatus: screen?.bmiStatus || null,
        followUpLevel: screen?.followUpLevel || null,
        criteria: screen?.criteria || [],
        published: !!m?.published,
        previous: prev
          ? {
              date: prev.date,
              campaignName: prevCampaign?.name || null,
              followUpLevel: screenMeasurement(prev, ch.dateOfBirth).followUpLevel,
            }
          : null,
        followUp: followUp ? { id: followUp.id, status: followUp.status } : null,
      };
    });
};

const summarize = (rows) => ({
  total: rows.length,
  recorded: rows.filter((r) => r.result === CHILD_RESULT_STATUS.RECORDED).length,
  notRecorded: rows.filter((r) => r.result === CHILD_RESULT_STATUS.NOT_RECORDED).length,
  absent: rows.filter((r) => r.result === CHILD_RESULT_STATUS.ABSENT).length,
  watch: rows.filter((r) => r.followUpLevel === FOLLOW_UP_LEVEL.WATCH).length,
  closeWatch: rows.filter((r) => r.followUpLevel === FOLLOW_UP_LEVEL.CLOSE_WATCH).length,
});

const toCampaignView = (db, c, user) => {
  const rows = scopedClasses(db, user, c.campusId).flatMap((cls) => rosterOf(db, c, cls));
  const { absentChildIds: _absent, ...rest } = clone(c);
  return {
    ...rest,
    campusName: campusName(db, c.campusId),
    status: campaignStatusOf(c),
    createdByName: userName(db, c.createdBy),
    closedByName: userName(db, c.closedBy),
    hasResults: db.healthMeasurements.some((m) => m.campaignId === c.id),
    progress: summarize(rows),
    waitingFollowUpCount: (db.healthFollowUps || []).filter(
      (f) => f.status === FOLLOW_UP_STATUS.WAITING_PARENT_CONTACT && rows.some((r) => r.childId === f.childId),
    ).length,
    history: (c.history || []).map((h) => ({ ...h, userName: userName(db, h.userId) })),
  };
};

const cleanPayload = (p) => ({
  name: (p.name || '').trim().slice(0, HEALTH_CHECK_FIELD_LIMITS.name),
  startDate: p.startDate,
  endDate: p.endDate,
  examiner: (p.examiner || '').trim().slice(0, HEALTH_CHECK_FIELD_LIMITS.examiner),
  note: (p.note || '').trim().slice(0, HEALTH_CHECK_FIELD_LIMITS.note),
});

const notifyCampus = (db, campaign, title, message) => {
  const teacherIds = new Set(db.classes.filter((c) => c.campusId === campaign.campusId).flatMap((c) => c.teacherIds || []));
  const vpIds = (db.users || []).filter((u) => u.role === 'VICE_PRINCIPAL' && u.campusId === campaign.campusId).map((u) => u.id);
  [...teacherIds, ...vpIds].forEach((userId) =>
    pushNotification(db, { userId, type: 'HEALTH_CHECK', title, message, link: `/children/health-checks/${campaign.id}` }),
  );
};

const assertManage = (user) => {
  if (!canManageHealthCheck(user)) forbid();
};

/* ------------------------------ Phiếu theo dõi ------------------------------ */
const FOLLOW_UP_NOT_FOUND = 'Không tìm thấy phiếu theo dõi.';
const FOLLOW_UP_ORDER = [
  FOLLOW_UP_STATUS.WAITING_PARENT_CONTACT,
  FOLLOW_UP_STATUS.PARENT_CONTACTED,
  FOLLOW_UP_STATUS.EXTERNAL_RESULT_RECORDED,
  FOLLOW_UP_STATUS.CLOSED,
];

const followUpContext = (db, f) => {
  const child = db.children.find((c) => c.id === f.childId) || null;
  const cls = child?.classId ? db.classes.find((c) => c.id === child.classId) || null : null;
  return { child, cls };
};

// Cùng phạm vi với sổ sức khỏe: Hiệu trưởng tất cả, PHT điểm trường của trẻ, giáo viên lớp hiện tại của trẻ.
const canSeeFollowUp = (db, user, f) => {
  const { child, cls } = followUpContext(db, f);
  if (!child) return false;
  if (isPrincipal(user)) return true;
  if (isVicePrincipal(user)) return child.campusId === user.campusId;
  return teachesClass(cls, user);
};

const toFollowUpView = (db, f, user, { full = false } = {}) => {
  const { child, cls } = followUpContext(db, f);
  const measurements = f.measurementIds
    .map((id) => db.healthMeasurements.find((m) => m.id === id))
    .filter(Boolean)
    .sort((a, b) => a.date.localeCompare(b.date));
  const campaignName = (m) => db.healthCheckCampaigns.find((c) => c.id === m.campaignId)?.name || null;
  const screened = measurements.map((m) => ({ m, sc: screenMeasurement(m, child.dateOfBirth) }));
  const last = screened[screened.length - 1];
  const entry = (x) => (x ? { on: x.on, note: x.note, byName: userName(db, x.by), at: x.at } : null);
  return {
    id: f.id,
    status: f.status,
    openedAt: f.openedAt,
    updatedAt: f.updatedAt,
    closedAt: f.closedAt,
    closedByName: userName(db, f.closedBy),
    closeReason: f.closeReason,
    child: {
      id: child.id,
      fullName: child.fullName,
      code: child.code,
      classId: child.classId,
      className: cls?.name || '',
      campusId: child.campusId,
      campusName: campusName(db, child.campusId),
    },
    latest: last
      ? {
          measurementId: last.m.id,
          date: last.m.date,
          campaignName: campaignName(last.m),
          followUpLevel: last.sc.followUpLevel,
          criteria: last.sc.criteria,
        }
      : null,
    contact: entry(f.contact),
    externalResult: entry(f.externalResult),
    canUpdate: f.status !== FOLLOW_UP_STATUS.CLOSED && canUpdateFollowUp(child, user, cls),
    ...(full
      ? {
          measurements: screened.map(({ m, sc }) => ({
            id: m.id,
            date: m.date,
            campaignName: campaignName(m),
            heightCm: m.heightCm,
            weightKg: m.weightKg,
            headCircumferenceCm: m.headCircumferenceCm ?? null,
            grossMotor: m.grossMotor ?? null,
            fineMotor: m.fineMotor ?? null,
            note: m.note || '',
            ...sc,
          })),
          history: (f.history || []).map((h) => ({ ...h, userName: userName(db, h.userId) })),
        }
      : {}),
  };
};

const findFollowUp = (db, id, user) => {
  const f = (db.healthFollowUps || []).find((x) => x.id === id);
  if (!f || !canSeeFollowUp(db, user, f)) throw new ApiError(404, FOLLOW_UP_NOT_FOUND);
  return f;
};

const assertUpdate = (db, f, user) => {
  const { child, cls } = followUpContext(db, f);
  if (!canUpdateFollowUp(child, user, cls)) forbid();
  if (f.status === FOLLOW_UP_STATUS.CLOSED) throw new ApiError(409, 'Phiếu theo dõi đã đóng.');
};

const updateFollowUp = (id, user, mutate) =>
  writeDb((d) => {
    const target = d.healthFollowUps.find((x) => x.id === id);
    const at = nowIso();
    mutate(target, at);
    target.updatedAt = at;
    return toFollowUpView(d, target, user, { full: true });
  });

export const healthCheckMockRepository = {
  async listHealthChecks(filters = {}, user) {
    await delay(150);
    const db = ensureChildRecordsSeeded();
    if (!canViewHealthChecks(user)) forbid();
    return db.healthCheckCampaigns
      .filter((c) => canSeeCampaign(db, user, c))
      .filter((c) => !filters.campusId || c.campusId === filters.campusId)
      .map((c) => toCampaignView(db, c, user))
      .filter((c) => !filters.status || c.status === filters.status)
      .sort((a, b) => {
        const rank = (s) => (s === CAMPAIGN_STATUS.IN_PROGRESS ? 0 : s === CAMPAIGN_STATUS.UPCOMING ? 1 : 2);
        return rank(a.status) - rank(b.status) || b.startDate.localeCompare(a.startDate);
      });
  },

  async getHealthCheck(id, user) {
    await delay(150);
    const db = ensureChildRecordsSeeded();
    const c = findCampaign(db, id, user);
    const open = isOpenForEntry(c);
    const classes = scopedClasses(db, user, c.campusId).map((cls) => {
      const rows = rosterOf(db, c, cls);
      return {
        classId: cls.id,
        className: cls.name,
        ageGroupId: cls.ageGroupId,
        ...summarize(rows),
        canRecord: open && teachesClass(cls, user),
      };
    });
    const watchList = scopedClasses(db, user, c.campusId)
      .flatMap((cls) => rosterOf(db, c, cls))
      .filter((r) => r.followUpLevel === FOLLOW_UP_LEVEL.WATCH || r.followUpLevel === FOLLOW_UP_LEVEL.CLOSE_WATCH)
      .sort((a, b) =>
        a.followUpLevel === b.followUpLevel
          ? a.fullName.localeCompare(b.fullName, 'vi')
          : a.followUpLevel === FOLLOW_UP_LEVEL.CLOSE_WATCH
            ? -1
            : 1,
      );
    return { campaign: toCampaignView(db, c, user), classes, watchList };
  },

  async getHealthCheckClass(id, classId, user) {
    await delay(150);
    const db = ensureChildRecordsSeeded();
    const c = findCampaign(db, id, user);
    const cls = scopedClasses(db, user, c.campusId).find((x) => x.id === classId);
    if (!cls) throw new ApiError(404, 'Không tìm thấy lớp trong đợt khám này.');
    return {
      campaign: toCampaignView(db, c, user),
      cls: { id: cls.id, name: cls.name },
      children: rosterOf(db, c, cls),
      canRecord: isOpenForEntry(c) && teachesClass(cls, user),
    };
  },

  async createHealthCheck(payload, user) {
    await delay();
    const db = ensureChildRecordsSeeded();
    assertManage(user);
    const errors = validateHealthCheck(payload);
    if (hasErrors(errors)) invalid(errors);
    if (!db.campuses.some((c) => c.id === payload.campusId)) invalid({ campusId: 'Chọn điểm trường' });
    const unclosed = unclosedCampaignOf(db, payload.campusId);
    if (unclosed)
      invalid(
        { campusId: `Điểm trường đang có đợt "${unclosed.name}" chưa đóng. Đóng hoặc hủy đợt đó trước khi tạo đợt mới.` },
        'Mỗi điểm trường chỉ có một đợt khám chưa đóng.',
      );
    return writeDb((d) => {
      const created = {
        id: uid('hc'),
        ...cleanPayload(payload),
        campusId: payload.campusId,
        createdBy: user.id,
        createdAt: nowIso(),
        closedAt: null,
        closedBy: null,
        cancelledAt: null,
        absentChildIds: [],
        history: [{ at: nowIso(), userId: user.id, action: 'CREATED' }],
      };
      d.healthCheckCampaigns.push(created);
      notifyCampus(
        d,
        created,
        'Đợt khám sức khỏe mới',
        `${created.name}: khám từ ${formatDate(created.startDate)} đến ${formatDate(created.endDate)}. Giáo viên nhập kết quả cho lớp mình.`,
      );
      return toCampaignView(d, created, user);
    });
  },

  async updateHealthCheck(id, payload, user) {
    await delay();
    const db = ensureChildRecordsSeeded();
    assertManage(user);
    const c = findCampaign(db, id, user);
    if (c.closedAt || c.cancelledAt) throw new ApiError(409, 'Đợt khám đã đóng hoặc đã hủy, không sửa được thông tin.');
    const errors = validateHealthCheck({ ...payload, campusId: c.campusId });
    if (hasErrors(errors)) invalid(errors);
    const outside = db.healthMeasurements.find((m) => m.campaignId === id && (m.date < payload.startDate || m.date > payload.endDate));
    if (outside) invalid({ startDate: `Đã có kết quả ngày ${formatDate(outside.date)} nằm ngoài khoảng ngày mới.` });
    return writeDb((d) => {
      const target = d.healthCheckCampaigns.find((x) => x.id === id);
      Object.assign(target, cleanPayload(payload));
      target.history = [...(target.history || []), { at: nowIso(), userId: user.id, action: 'UPDATED' }];
      return toCampaignView(d, target, user);
    });
  },

  async cancelHealthCheck(id, user) {
    await delay();
    const db = ensureChildRecordsSeeded();
    assertManage(user);
    const c = findCampaign(db, id, user);
    if (c.closedAt || c.cancelledAt) throw new ApiError(409, 'Đợt khám đã đóng hoặc đã hủy.');
    if (db.healthMeasurements.some((m) => m.campaignId === id))
      throw new ApiError(409, 'Đợt khám đã có kết quả, không hủy được. Đóng đợt thay vì hủy.');
    return writeDb((d) => {
      const target = d.healthCheckCampaigns.find((x) => x.id === id);
      target.cancelledAt = nowIso();
      target.history = [...(target.history || []), { at: nowIso(), userId: user.id, action: 'CANCELLED' }];
      return toCampaignView(d, target, user);
    });
  },

  async closeHealthCheck(id, user) {
    await delay();
    const db = ensureChildRecordsSeeded();
    assertManage(user);
    const c = findCampaign(db, id, user);
    if (campaignStatusOf(c) !== CAMPAIGN_STATUS.IN_PROGRESS) throw new ApiError(409, 'Chỉ đóng được đợt khám đang diễn ra.');
    return writeDb((d) => {
      const target = d.healthCheckCampaigns.find((x) => x.id === id);
      const rows = d.classes.filter((cls) => cls.campusId === target.campusId).flatMap((cls) => rosterOf(d, target, cls));
      const view = summarize(rows);
      const waitingFollowUpCount = (d.healthFollowUps || []).filter(
        (f) => f.status === FOLLOW_UP_STATUS.WAITING_PARENT_CONTACT && rows.some((r) => r.childId === f.childId),
      ).length;
      // Trẻ chưa có kết quả khi đóng đợt ⇒ "Vắng khám"; kết quả của đợt bị khóa tới khi mở lại.
      target.absentChildIds = rows.filter((r) => r.result === CHILD_RESULT_STATUS.NOT_RECORDED).map((r) => r.childId);
      target.closedAt = nowIso();
      target.closedBy = user.id;
      target.history = [...(target.history || []), { at: nowIso(), userId: user.id, action: 'CLOSED' }];
      return { absentCount: view.notRecorded, waitingFollowUpCount, campaign: toCampaignView(d, target, user) };
    });
  },

  async reopenHealthCheck(id, body, user) {
    await delay();
    const db = ensureChildRecordsSeeded();
    assertManage(user);
    const c = findCampaign(db, id, user);
    if (campaignStatusOf(c) !== CAMPAIGN_STATUS.CLOSED) throw new ApiError(409, 'Chỉ mở lại được đợt khám đã đóng.');
    const reason = (body?.reason || '').trim();
    if (!reason) invalid({ reason: 'Nhập lý do mở lại đợt khám' });
    if (reason.length > HEALTH_CHECK_FIELD_LIMITS.reason) invalid({ reason: 'Lý do tối đa 300 ký tự' });
    const unclosed = unclosedCampaignOf(db, c.campusId, id);
    if (unclosed)
      throw new ApiError(409, `Điểm trường đang có đợt "${unclosed.name}" chưa đóng. Đóng hoặc hủy đợt đó trước khi mở lại đợt này.`);
    return writeDb((d) => {
      const target = d.healthCheckCampaigns.find((x) => x.id === id);
      target.closedAt = null;
      target.closedBy = null;
      target.absentChildIds = [];
      target.history = [...(target.history || []), { at: nowIso(), userId: user.id, action: 'REOPENED', reason }];
      notifyCampus(d, target, 'Đợt khám được mở lại', `${target.name} được mở lại để nhập hoặc sửa kết quả. Lý do: ${reason}`);
      return toCampaignView(d, target, user);
    });
  },

  async listHealthFollowUps(filters = {}, user) {
    await delay(150);
    const db = ensureChildRecordsSeeded();
    if (!canViewHealthChecks(user)) forbid();
    const inScope = db.healthFollowUps
      .filter((f) => canSeeFollowUp(db, user, f))
      .map((f) => toFollowUpView(db, f, user))
      .filter((f) => !filters.campusId || f.child.campusId === filters.campusId);
    // Số đếm theo trạng thái tính trên phạm vi + điểm trường, trước khi lọc trạng thái.
    const counts = Object.fromEntries(FOLLOW_UP_ORDER.map((st) => [st, inScope.filter((f) => f.status === st).length]));
    const items = inScope
      .filter((f) => !filters.status || f.status === filters.status)
      .sort((a, b) => FOLLOW_UP_ORDER.indexOf(a.status) - FOLLOW_UP_ORDER.indexOf(b.status) || b.updatedAt.localeCompare(a.updatedAt));
    return { items, counts };
  },

  async getHealthFollowUp(id, user) {
    await delay(150);
    const db = ensureChildRecordsSeeded();
    return toFollowUpView(db, findFollowUp(db, id, user), user, { full: true });
  },

  async recordFollowUpContact(id, body, user) {
    await delay();
    const db = ensureChildRecordsSeeded();
    const f = findFollowUp(db, id, user);
    assertUpdate(db, f, user);
    if (f.status !== FOLLOW_UP_STATUS.WAITING_PARENT_CONTACT) throw new ApiError(409, 'Phiếu đã ghi trao đổi với phụ huynh.');
    const errors = validateFollowUpAction('contact', body);
    if (hasErrors(errors)) invalid(errors);
    const note = body.note.trim().slice(0, FOLLOW_UP_FIELD_LIMITS.note);
    return updateFollowUp(id, user, (t, at) => {
      t.contact = { on: body.contactedOn, note, by: user.id, at };
      t.status = FOLLOW_UP_STATUS.PARENT_CONTACTED;
      t.history.push({ at, userId: user.id, action: 'PARENT_CONTACTED', note });
    });
  },

  async recordFollowUpExternalResult(id, body, user) {
    await delay();
    const db = ensureChildRecordsSeeded();
    const f = findFollowUp(db, id, user);
    assertUpdate(db, f, user);
    if (f.status !== FOLLOW_UP_STATUS.PARENT_CONTACTED)
      throw new ApiError(
        409,
        f.status === FOLLOW_UP_STATUS.WAITING_PARENT_CONTACT
          ? 'Ghi trao đổi với phụ huynh trước khi ghi kết quả khám bên ngoài.'
          : 'Phiếu đã có kết quả khám bên ngoài.',
      );
    const errors = validateFollowUpAction('external', body);
    if (hasErrors(errors)) invalid(errors);
    const note = body.note.trim().slice(0, FOLLOW_UP_FIELD_LIMITS.note);
    return updateFollowUp(id, user, (t, at) => {
      t.externalResult = { on: body.resultOn, note, by: user.id, at };
      t.status = FOLLOW_UP_STATUS.EXTERNAL_RESULT_RECORDED;
      t.history.push({ at, userId: user.id, action: 'EXTERNAL_RESULT', note });
    });
  },

  async closeFollowUp(id, body, user) {
    await delay();
    const db = ensureChildRecordsSeeded();
    const f = findFollowUp(db, id, user);
    assertUpdate(db, f, user);
    const errors = validateFollowUpAction('close', body);
    if (hasErrors(errors)) invalid(errors);
    const reason = body.reason.trim().slice(0, FOLLOW_UP_FIELD_LIMITS.reason);
    return updateFollowUp(id, user, (t, at) => {
      t.status = FOLLOW_UP_STATUS.CLOSED;
      t.closeReason = reason;
      t.closedAt = at;
      t.closedBy = user.id;
      t.history.push({ at, userId: user.id, action: 'CLOSED', note: reason });
    });
  },
};
