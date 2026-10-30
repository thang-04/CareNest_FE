import { readDb, writeDb, clone, delay, ApiError } from '@/mocks/mockDatabase';
import { ensureSchoolSeeded } from '@/mocks/schoolMockRepository';
import { buildSeedChildRecords, seedChildProfileOf, seedMedicalHistoryOf } from '@/mocks/childrenSeed';
import { PHONE_HAS_OTHER_ID, createBatchIdentityCheck, fillMissingCitizenIds, identityConflict } from '@/mocks/guardianIdentity';
import { OPEN_CAMPAIGN, buildSeedFollowUps, buildSeedHealthChecks } from '@/mocks/healthCheckSeed';
import { pushNotification } from '@/mocks/notificationMockRepository';
import { activatePendingGuardians, applyGuardianEdits, differsFromAccount } from '@/mocks/parentAccountMock';
import { activeYearId } from '@/mocks/roomManagers';
import { schoolYearIdOfDate } from '@/mocks/schoolYearScope';
import { CHILD_STATUS } from '@/models/School';
import {
  AI_TREND_STATUS,
  DECLARATION_STATE,
  FOLLOW_UP_LEVEL,
  MEASUREMENT_FIELD_LABELS,
  PARENT_ACCOUNT_STATUS,
} from '@/models/children/childrenConstants';
import { CAMPAIGN_KIND, CAMPAIGN_STATUS, FOLLOW_UP_CLOSE_OUTCOME } from '@/models/children/healthCheckConstants';
import { EXAM_STATUS, FOLLOW_UP_FINDING } from '@/models/children/healthExamForm';
import { PERMISSION_SCOPE } from '@/models/school-config/schoolConfigConstants';
import {
  PROFILE_FIELDS,
  PROFILE_FIELD_LABELS,
  emptyChildProfile,
  emptyMedicalHistory,
  formatAddress,
} from '@/models/children/childProfile';
import { isValidCitizenId, normalizeCitizenId } from '@/utils/citizenId';
import { formatDate, localDateOf, normalizeText, todayInput } from '@/utils/format';
import { uid } from '@/utils/id';
import { areaAccess, areaAllows } from '@/utils/school-config/schoolConfigPermissions';
import {
  hasErrors,
  normalizePhone,
  validateChildInfo,
  validateDeclaration,
  validateMeasurement,
} from '@/utils/children/childrenValidation';
import {
  canActivateParentsAt,
  canDeclareHealth,
  canEditChild,
  canEnrollChild,
  canLookupParentAccounts,
  canPlaceChild,
  canReadmitChild,
  canWithdrawChild,
  canRecordMeasurement,
  canViewChild,
  canViewChildren,
  canViewHealth,
  canViewParentAccounts,
  isPrincipal,
  isVicePrincipal,
} from '@/utils/children/childrenPermissions';
import { headCircumferenceUntil, screenMeasurement } from './healthScreeningRule';
import {
  addDays,
  applyFollowUpReminders,
  campaignKindOf,
  campaignStatusOf,
  closeFollowUpsOfWithdrawnChild,
  dueFollowUpReminders,
  followUpBrief,
  followUpEffectOf,
  isOpenForEntry,
  latestExternalOf,
  normalizeFollowUp,
  parentContactOf,
  toTimelineFollowUp,
  trackFollowUp,
} from './healthCheckRule';
import { readEnrollmentCsv } from './enrollmentImport';

/*
 * Fake backend of child records & child health. Owns: scope checks (GBR-GEN-01, GBR-GEN-09), enrollment and
 * placement (GBR-CP-01), declarations (GBR-CP-02), allergy confirmation (GBR-HLT-03), parent accounts (UC 3.9),
 * measurements with the rule-based screening (BMI, follow-up level) and edit log (GBR-HLT-01..03), and the AI trend draft (GBR-AI-*).
 * Collections: reads/writes db.children; owns db.healthMeasurements, db.healthDeclarations, db.parentAccounts,
 * db.childPlacements, db.healthTrendDrafts; reads db.healthCheckCampaigns and opens db.healthFollowUps (healthCheckMockRepository).
 */

const FORBIDDEN = 'Bạn không có quyền thực hiện thao tác này.';
const MAX_IMPORT_ROWS = 500;

const nowIso = () => new Date().toISOString();

// v3: đợt khám tháng 3, dữ liệu đầy đủ cho các đợt đã đóng, cân đo tại lớp tháng 12/2025, phiếu theo dõi đợt cũ.
// v4: phiếu theo dõi dài hạn (dòng thời gian), kết quả "Cần theo dõi sát" chưa trao đổi thì chưa công bố.
// v5: kết quả của đợt đang diễn ra theo phiếu Phụ lục II (kết luận bác sĩ, phiếu nháp, trao đổi tại buổi khám).
// v6: đủ trường hợp thử phiếu khám (mọi lớp c1, đợt đã đóng tháng 10 ở c2, phiếu theo dõi nhắc 30 ngày, quá hạn, gộp vòng).
// v7: phiếu khám có người đi cùng tự công bố khi lưu kết luận.
// v8: hành chính, tiền sử hỏi khi tiếp nhận (vài trẻ demo có sẵn).
// v9: khám trẻ đang có phiếu theo dõi (mẫu FOLLOW_UP), vấn đề đã biết, kết quả khi đóng phiếu.
// v10: có nguy cơ lao/có vấn đề thì không "Không cần tư vấn hay chuyển khám"; "Vấn đề này" chỉ hỏi trẻ có vấn đề đã biết.
// v11: phiếu mẫu lấy hành chính, tiền sử từ hồ sơ trẻ; người đi cùng là phụ huynh trong hồ sơ.
// v12: mọi kết quả đã kết luận đều đã công bố; phiếu mức Cần theo dõi sát có người đi cùng có ý kiến phụ huynh.
// v13: đợt sắp diễn ra ở c2 thành kỳ cân đo đang diễn ra (kỳ cân đo, user chốt 2026-10-31).
const HEALTH_SEED_VERSION = 13;
const SEED_MANAGED_FIELDS = ['headCircumferenceCm', 'grossMotor', 'fineMotor', 'campaignId', 'note', 'exam', 'examStatus'];

// Dữ liệu demo lưu bằng seed cũ: cập nhật bản ghi seed chưa bị sửa, thêm bản ghi seed còn thiếu; không xóa gì.
const upgradeSeedMeasurements = (d, seedMeasurements) => {
  const byId = new Map(d.healthMeasurements.map((m) => [m.id, m]));
  const has = new Set(d.healthMeasurements.map((m) => `${m.childId}|${m.date}`));
  seedMeasurements.forEach((s) => {
    const m = byId.get(s.id);
    if (m) {
      // Kết quả seed của đợt đang diễn ra có ngày theo hôm tạo DB: giữ ngày trong DB (khớp ngày của đợt trong DB).
      const sameSeedRecord = m.date === s.date || (s.campaignId === OPEN_CAMPAIGN.id && m.campaignId === OPEN_CAMPAIGN.id);
      if (!(m.edits || []).length && sameSeedRecord) {
        SEED_MANAGED_FIELDS.forEach((f) => (m[f] = s[f] ?? null));
        if (s.exam) Object.assign(m, { published: s.published, publishedAt: s.publishedAt });
        if (s.examStatus === EXAM_STATUS.DRAFT)
          Object.assign(m, { heightCm: s.heightCm, weightKg: s.weightKg, headCircumferenceCm: s.headCircumferenceCm });
      }
    } else if (!has.has(`${s.childId}|${s.date}`) && d.children.some((c) => c.id === s.childId)) d.healthMeasurements.push(s);
  });
};

// Đợt seed còn thiếu được thêm; đợt seed đã đóng mà người dùng chưa sửa/mở lại thì nhận thông tin seed mới.
// Đợt seed chưa đóng đổi loại (v13) mà người dùng chưa thao tác, chưa có kết quả thì thay bằng bản seed mới.
const upgradeSeedCampaigns = (d, seedCampaigns) => {
  seedCampaigns.forEach((s) => {
    const cur = d.healthCheckCampaigns.find((c) => c.id === s.id);
    const untouched = (c) => !(c.history || []).some((h) => h.action !== 'CREATED');
    if (!cur) d.healthCheckCampaigns.push(s);
    else if (cur.closedAt && s.closedAt && !(cur.history || []).some((h) => ['UPDATED', 'REOPENED'].includes(h.action)))
      Object.assign(cur, { examiner: s.examiner, note: s.note, absentChildIds: s.absentChildIds });
    else if (
      !cur.closedAt &&
      !cur.cancelledAt &&
      campaignKindOf(cur) !== campaignKindOf(s) &&
      untouched(cur) &&
      !d.healthMeasurements.some((m) => m.campaignId === cur.id)
    )
      Object.assign(cur, s);
  });
};

// Phiếu seed người dùng chưa thao tác (mọi sự kiện đều có trong bản seed mới) nhận bản seed mới; phiếu khác chuyển sang
// dạng dòng thời gian, giữ nội dung. Trẻ đã nghỉ học mà phiếu còn mở thì đóng phiếu như luồng cho nghỉ học mới.
const upgradeSeedFollowUps = (d, seedFollowUps) => {
  const seedById = new Map(seedFollowUps.map((f) => [f.id, f]));
  const untouched = (f, s) =>
    !!s && !f.closedAt === !s.closedAt && (f.history || []).every((e) => s.history.some((x) => x.action === e.action && x.at === e.at));
  const examOnOf = (id) => d.healthMeasurements.find((m) => m.id === id)?.date || null;
  d.healthFollowUps = d.healthFollowUps.map((f) =>
    untouched(f, seedById.get(f.id)) ? seedById.get(f.id) : toTimelineFollowUp(f, examOnOf),
  );
  seedFollowUps.filter((s) => !d.healthFollowUps.some((f) => f.id === s.id)).forEach((s) => d.healthFollowUps.push(s));
  d.children
    .filter((c) => c.status === CHILD_STATUS.LEFT)
    .forEach((c) => closeFollowUpsOfWithdrawnChild(d, c, c.leftReason || 'không ghi lý do', null));
  // v9: lần khám mẫu FOLLOW_UP trong phiếu cũ chưa có cờ newFinding ⇒ gắn theo lựa chọn của phiếu khám, tính lại trạng thái.
  d.healthFollowUps.forEach((f) => {
    let flagged = false;
    (f.history || []).forEach((e) => {
      if (e.action !== 'MEASUREMENT_ADDED' || e.newFinding !== undefined) return;
      const c = d.healthMeasurements.find((m) => m.id === e.measurementId)?.exam?.conclusion;
      if (!c?.followUpFinding) return;
      e.newFinding = c.followUpFinding === FOLLOW_UP_FINDING.NEW_FINDING || !!c.tbRisk;
      flagged = true;
    });
    if (flagged) f.status = normalizeFollowUp(f).status;
  });
};

/**
 * DB demo (một lần): mọi phụ huynh, tài khoản phụ huynh có CCCD (user yêu cầu 2026-10-21); người đi cùng ở phiếu khám
 * chọn từ phụ huynh của hồ sơ mà chưa có CCCD thì lấy CCCD của phụ huynh đó.
 */
const GUARDIAN_ID_VERSION = 2;
const backfillGuardianIds = (d) => {
  fillMissingCitizenIds(d);
  const childById = new Map((d.children || []).map((c) => [c.id, c]));
  (d.healthMeasurements || []).forEach((m) => {
    const companion = m.exam?.admin?.companion;
    const g = companion?.guardianIndex != null ? childById.get(m.childId)?.guardians?.[companion.guardianIndex] : null;
    if (g && !companion.idNumber && g.fullName === companion.fullName) companion.idNumber = g.idNumber;
  });
  delete d.guardianIdSeeded;
  d.guardianIdVersion = GUARDIAN_ID_VERSION;
};

/**
 * DB demo (một lần): khai "Có tiếp xúc người bệnh lao" và phiếu khám "Có" đều có ngày tiếp xúc gần nhất (user chốt 2026-10-21).
 * Lấy ngày đã ghi ở phiếu khám/khai báo của cùng trẻ; không có thì 30 ngày trước ngày khai báo/ngày khám, không trước ngày sinh.
 */
const TB_CONTACT_DATE_VERSION = 1;
const backfillTbContactDates = (d) => {
  const childById = new Map((d.children || []).map((c) => [c.id, c]));
  const fallback = (childId, date) => {
    const dob = childById.get(childId)?.dateOfBirth || '';
    const day = addDays(date, -30);
    return day < dob ? dob : day;
  };
  const examDateOf = (childId) =>
    (d.healthMeasurements || [])
      .filter((m) => m.childId === childId && m.exam?.history?.tbContact === 'YES' && m.exam.history.tbContactDate)
      .sort((a, b) => b.date.localeCompare(a.date))[0]?.exam.history.tbContactDate || '';
  (d.healthDeclarations || []).forEach((decl) => {
    const tb = decl.medicalHistory?.tbContact;
    if (tb?.state !== DECLARATION_STATE.REPORTED || tb.contactDate) return;
    tb.contactDate = examDateOf(decl.childId) || fallback(decl.childId, (decl.declaredAt || nowIso()).slice(0, 10));
  });
  (d.healthMeasurements || []).forEach((m) => {
    const h = m.exam?.history;
    if (!h || h.tbContact !== 'YES' || h.tbContactDate) return;
    const declared = tbContactDateOf(declarationOf(d, m.childId)?.medicalHistory);
    h.tbContactDate = declared && declared <= m.date ? declared : fallback(m.childId, m.date);
  });
  d.tbContactDateVersion = TB_CONTACT_DATE_VERSION;
};

/**
 * DB demo (một lần): mọi trẻ đủ hành chính và tiền sử bắt buộc (user chốt 2026-10-22, "fill đầy ở hiện tại luôn").
 * Ô đã có giữ nguyên; ô trống, tiền sử "Chưa cung cấp" lấy giá trị giả của seed. Không ghi lịch sử, không gửi thông báo.
 */
const PROFILE_FILL_VERSION = 1;
const fillChildProfiles = (d) => {
  const blank = (v) => v === '' || v == null;
  const answered = [DECLARATION_STATE.REPORTED, DECLARATION_STATE.NONE_REPORTED];
  (d.children || []).forEach((child) => {
    const seed = seedChildProfileOf(child);
    const cur = child.profile || {};
    const pick = (k) => (blank(cur[k]) ? seed[k] : cur[k]);
    const premature = pick('premature');
    child.profile = cleanProfile({
      ...Object.fromEntries(['idNumber', 'ethnicity', 'beneficiary', 'bloodType'].map((k) => [k, pick(k)])),
      premature,
      gestationWeeks: blank(cur.gestationWeeks) ? (premature === 'YES' ? 35 : seed.gestationWeeks) : cur.gestationWeeks,
      address: Object.fromEntries(
        ['province', 'ward', 'street'].map((k) => [k, cur.address?.[k]?.trim() ? cur.address[k] : seed.address[k]]),
      ),
    });
    const decl = ensureDeclarationOf(d, child.id);
    const history = seedMedicalHistoryOf(child);
    const mh = decl.medicalHistory || {};
    decl.medicalHistory = cleanMedicalHistory(
      Object.fromEntries(['self', 'family', 'tbContact'].map((k) => [k, answered.includes(mh[k]?.state) ? mh[k] : history[k]])),
    );
  });
  d.profileFillVersion = PROFILE_FILL_VERSION;
};

/**
 * DB demo (một lần): mọi kết quả chưa công bố (trừ phiếu nháp) công bố luôn, không gửi thông báo (user chốt 2026-10-23).
 * Ngày công bố = ngày kết luận của phiếu khám, hoặc ngày tạo.
 */
const AUTO_PUBLISH_VERSION = 1;
const publishAllResults = (d) => {
  (d.healthMeasurements || []).forEach((m) => {
    if (m.published || isExamDraft(m)) return;
    Object.assign(m, { published: true, publishedAt: m.concludedAt || m.createdAt || nowIso(), publishedBy: m.measuredBy || null });
  });
  d.autoPublishVersion = AUTO_PUBLISH_VERSION;
};

/**
 * DB demo (một lần): API kích hoạt từng phụ huynh cũ (đã bỏ, AUTH-20) để tài khoản, phụ huynh ở "PENDING_ACTIVATION" — trạng thái
 * BE không có. Chuyển thành tài khoản đang hoạt động, vẫn bắt đổi mật khẩu lần đầu.
 */
const PARENT_STATUS_VERSION = 1;
const LEGACY_PENDING_ACTIVATION = 'PENDING_ACTIVATION';
const normalizeParentStatuses = (d) => {
  (d.parentAccounts || []).forEach((a) => {
    if (a.status === LEGACY_PENDING_ACTIVATION) Object.assign(a, { status: PARENT_ACCOUNT_STATUS.ACTIVE, mustChangePassword: true });
  });
  (d.children || []).forEach((c) =>
    (c.guardians || []).forEach((g) => {
      if (g.accountStatus === LEGACY_PENDING_ACTIVATION) g.accountStatus = PARENT_ACCOUNT_STATUS.ACTIVE;
    }),
  );
  d.parentStatusVersion = PARENT_STATUS_VERSION;
};

/**
 * Seed mọi collection sức khỏe (đo, khai báo, đợt khám, phiếu theo dõi). Dùng chung cho repository đợt khám.
 * Mock thay job hằng ngày của BE: mỗi lần đọc tạo nhắc quá hạn trao đổi / tới ngày hẹn khám lại còn thiếu.
 */
export const ensureChildRecordsSeeded = () => {
  ensureSchoolSeeded();
  let db = readDb();
  const ready =
    db.healthMeasurements &&
    db.healthDeclarations &&
    db.parentAccounts &&
    db.childPlacements &&
    db.healthTrendDrafts &&
    db.healthCheckCampaigns &&
    db.healthFollowUps;
  if (!ready || db.healthSeedVersion !== HEALTH_SEED_VERSION) {
    writeDb((d) => {
      const seed = buildSeedChildRecords({ children: d.children, classes: d.classes });
      const upgrading = d.healthSeedVersion !== HEALTH_SEED_VERSION;
      if (d.healthMeasurements && upgrading) upgradeSeedMeasurements(d, seed.healthMeasurements);
      d.healthMeasurements ||= seed.healthMeasurements;
      // Vắng khám của đợt seed tính trên kết quả đang có trong DB (sau khi nâng cấp).
      const seedCampaigns = buildSeedHealthChecks({ measurements: d.healthMeasurements, children: d.children });
      const seedFollowUps = buildSeedFollowUps(d.healthMeasurements).map(normalizeFollowUp);
      if (d.healthCheckCampaigns && upgrading) upgradeSeedCampaigns(d, seedCampaigns);
      if (d.healthFollowUps && upgrading) upgradeSeedFollowUps(d, seedFollowUps);
      d.healthSeedVersion = HEALTH_SEED_VERSION;
      d.healthDeclarations ||= seed.healthDeclarations;
      d.parentAccounts ||= seed.parentAccounts;
      d.childPlacements ||= seed.childPlacements;
      d.healthTrendDrafts ||= [];
      d.healthCheckCampaigns ||= seedCampaigns;
      d.healthFollowUps ||= seedFollowUps;
    });
    db = readDb();
  }
  if (db.guardianIdVersion !== GUARDIAN_ID_VERSION) {
    writeDb(backfillGuardianIds);
    db = readDb();
  }
  if (db.tbContactDateVersion !== TB_CONTACT_DATE_VERSION) {
    writeDb(backfillTbContactDates);
    db = readDb();
  }
  if (db.profileFillVersion !== PROFILE_FILL_VERSION) {
    writeDb(fillChildProfiles);
    db = readDb();
  }
  if (db.autoPublishVersion !== AUTO_PUBLISH_VERSION) {
    writeDb(publishAllResults);
    db = readDb();
  }
  if (db.parentStatusVersion !== PARENT_STATUS_VERSION) {
    writeDb(normalizeParentStatuses);
    db = readDb();
  }
  const due = dueFollowUpReminders(db);
  if (due.length === 0) return db;
  writeDb((d) => applyFollowUpReminders(d, due));
  return readDb();
};

const ensureSeeded = ensureChildRecordsSeeded;

const forbid = () => {
  throw new ApiError(403, FORBIDDEN);
};

const invalid = (errors, message = 'Thông tin chưa hợp lệ. Kiểm tra các ô được đánh dấu.') => {
  throw new ApiError(422, message, errors);
};

const userName = (db, id) => db.users?.find((u) => u.id === id)?.fullName || '';
const classOf = (db, child) => (child?.classId ? db.classes.find((c) => c.id === child.classId) || null : null);
const declarationOf = (db, childId) => db.healthDeclarations.find((d) => d.childId === childId) || null;
const activeCount = (db, classId) => db.children.filter((c) => c.classId === classId && c.status === CHILD_STATUS.ACTIVE).length;

const findChild = (db, id) => {
  const child = db.children.find((c) => c.id === id);
  if (!child) throw new ApiError(404, 'Không tìm thấy hồ sơ trẻ.');
  return child;
};

/**
 * Mức theo dõi hiện tại của trẻ (user chốt 2026-10-17, 2026-10-21):
 * - còn phiếu theo dõi mở ⇒ "Cần theo dõi sát" tới khi giáo viên đóng phiếu;
 * - không còn ⇒ mục mới hơn giữa lần khám gần nhất có xếp mức và phiếu đóng có kết quả theo lời bác sĩ (bình thường ⇒
 *   Không ghi nhận bất thường; chuyên khoa xác định có vấn đề ⇒ Vấn đề đã biết, ổn định); trùng ngày lấy phiếu đóng.
 * Phiếu nháp, cân đo ngoài đợt không đánh giá lại nên bỏ qua; đóng "không có kết quả chuyên khoa" giữ mức lần khám.
 */
/** Vấn đề đã biết của trẻ (phiếu theo dõi đóng "chuyên khoa xác định có vấn đề" hoặc lần khám "vấn đề đã biết"), hoặc null. */
export const knownConditionOf = (db, child) => latestHealthOf(db, child)?.knownCondition || null;

const latestHealthOf = (db, child) => {
  const O = FOLLOW_UP_CLOSE_OUTCOME;
  const latest = (db.healthMeasurements || [])
    .filter((m) => m.childId === child.id && !isExamDraft(m))
    .sort((a, b) => b.date.localeCompare(a.date))
    .map((m) => ({ m, sc: screenMeasurement(m, child.dateOfBirth) }))
    .find(({ sc }) => sc.followUpLevel !== FOLLOW_UP_LEVEL.UNAVAILABLE);
  const campaign = latest?.m.campaignId ? (db.healthCheckCampaigns || []).find((c) => c.id === latest.m.campaignId) : null;
  const exam = latest
    ? {
        date: latest.m.date,
        followUpLevel: latest.sc.followUpLevel,
        campaignName: campaign?.name || null,
        source: 'EXAM',
        knownCondition: latest.sc.followUpLevel === FOLLOW_UP_LEVEL.KNOWN_STABLE ? latest.m.exam?.conclusion?.issueText || null : null,
        resultOn: null,
        followUpId: null,
        closedWithoutResultOn: null,
      }
    : null;
  const followUps = (db.healthFollowUps || []).filter((f) => f.childId === child.id);
  const open = followUps.find((f) => !f.closedAt);
  if (open)
    return {
      date: exam?.date || localDateOf(open.openedAt),
      campaignName: exam?.campaignName || null,
      followUpLevel: FOLLOW_UP_LEVEL.CLOSE_WATCH,
      source: 'FOLLOW_UP_OPEN',
      knownCondition: null,
      resultOn: null,
      followUpId: open.id,
      closedWithoutResultOn: null,
    };
  const byClosed = (a, b) => b.closedAt.localeCompare(a.closedAt);
  const decided = followUps.filter((f) => f.closeOutcome === O.DOCTOR_NORMAL || f.closeOutcome === O.KNOWN_CONDITION).sort(byClosed)[0];
  if (decided && (!exam || localDateOf(decided.closedAt) >= exam.date))
    return {
      date: localDateOf(decided.closedAt),
      campaignName: null,
      followUpLevel: decided.closeOutcome === O.KNOWN_CONDITION ? FOLLOW_UP_LEVEL.KNOWN_STABLE : FOLLOW_UP_LEVEL.NONE,
      source: 'FOLLOW_UP_CLOSED',
      knownCondition: decided.closeConditionText || null,
      resultOn: latestExternalOf(decided)?.on || null,
      followUpId: decided.id,
      closedWithoutResultOn: null,
    };
  if (!exam) return null;
  const noResult = followUps
    .filter((f) => f.closeOutcome === O.NO_SPECIALIST_RESULT && localDateOf(f.closedAt) >= exam.date)
    .sort(byClosed)[0];
  return noResult ? { ...exam, followUpId: noResult.id, closedWithoutResultOn: localDateOf(noResult.closedAt) } : exam;
};

/** Khai báo sức khỏe của trẻ; trẻ chưa có khai báo thì tạo phần trống để Chưa cung cấp (ghi từ phiếu theo dõi, điền dữ liệu demo). */
export const ensureDeclarationOf = (d, childId) => {
  let decl = declarationOf(d, childId);
  if (!decl) {
    decl = {
      childId,
      allergies: { state: DECLARATION_STATE.NOT_PROVIDED, items: [] },
      diet: { state: DECLARATION_STATE.NOT_PROVIDED, text: '' },
      otherNotes: { state: DECLARATION_STATE.NOT_PROVIDED, text: '' },
      history: [],
    };
    d.healthDeclarations.push(decl);
  }
  return decl;
};

export const KNOWN_CONDITION_HISTORY_MAX = 300;

/** Tiền sử bản thân sau khi thêm vấn đề đã biết; đã có đúng tên đó thì giữ nguyên. */
export const selfHistoryWith = (db, childId, condition) => {
  const self = declarationOf(db, childId)?.medicalHistory?.self;
  const current = self?.state === DECLARATION_STATE.REPORTED ? String(self.text || '').trim() : '';
  const parts = current ? current.split(/;\s*/) : [];
  if (parts.some((p) => normalizeText(p) === normalizeText(condition))) return current;
  return [...parts, condition].join('; ');
};

/** Đóng phiếu với "Chuyên khoa xác định có vấn đề" ⇒ ghi vấn đề vào tiền sử bản thân, có lịch sử; không gửi thông báo (D9). */
export const recordKnownCondition = (d, childId, condition, user, note) => {
  const text = selfHistoryWith(d, childId, condition);
  const decl = ensureDeclarationOf(d, childId);
  const before = decl.medicalHistory || null;
  const current = before || emptyMedicalHistory();
  if (current.self.state === DECLARATION_STATE.REPORTED && current.self.text === text) return;
  const next = { ...clone(current), self: { state: DECLARATION_STATE.REPORTED, text } };
  decl.medicalHistory = next;
  decl.history = [
    ...(decl.history || []),
    {
      action: 'UPDATED_FROM_FOLLOW_UP',
      userId: user.id,
      at: nowIso(),
      note,
      historyChange: { from: before ? clone(before) : null, to: clone(next) },
    },
  ];
};

const accountByPhone = (db, phone) => {
  const p = normalizePhone(phone);
  return (p && (db.parentAccounts || []).find((a) => normalizePhone(a.phone) === p)) || null;
};

const accountByCitizenId = (db, idNumber) => {
  const id = normalizeCitizenId(idNumber);
  return (isValidCitizenId(id) && (db.parentAccounts || []).find((a) => normalizeCitizenId(a.idNumber) === id)) || null;
};

/**
 * Nhận diện tài khoản phụ huynh theo CCCD (user chốt 2026-10-23, PROPOSED — chờ BE): CCCD trùng tài khoản ⇒ dùng họ tên, SĐT,
 * email của tài khoản, không tin dữ liệu (kể cả accountId) client gửi. Tài khoản cũ chưa có CCCD: khớp theo SĐT (D2 2026-10-21).
 */
const withAccounts = (db, guardians = []) =>
  guardians.map(({ accountId: _clientAccountId, ...g }) => {
    const byPhone = accountByPhone(db, g.phone);
    const acc = accountByCitizenId(db, g.idNumber) || (byPhone && !byPhone.idNumber ? byPhone : null);
    return acc ? { ...g, accountId: acc.id, fullName: acc.fullName, phone: acc.phone, email: acc.email || '' } : g;
  });

/**
 * Form tiếp nhận, Sửa hồ sơ (user chốt 2026-10-28): gắn tài khoản nhưng giữ thông tin client gửi — sửa ở hồ sơ thì tài khoản đổi theo.
 * Tài khoản nhận theo CCCD; đổi CCCD ở Sửa hồ sơ thì theo phụ huynh cũ cùng vị trí; tài khoản cũ chưa có CCCD khớp theo SĐT.
 */
const attachAccounts = (db, guardians = [], previous = []) =>
  guardians.map(({ accountId: _clientAccountId, ...g }, i) => {
    const old = previous[i];
    const oldAccount = old && old.accountStatus !== PARENT_ACCOUNT_STATUS.NOT_ACTIVATED ? accountByPhone(db, old.phone) : null;
    const byPhone = accountByPhone(db, g.phone);
    const acc = accountByCitizenId(db, g.idNumber) || oldAccount || (byPhone && !byPhone.idNumber ? byPhone : null);
    return acc ? { ...g, accountId: acc.id } : g;
  });

const accountOfGuardian = (db, g) => (g.accountId && db.parentAccounts.find((a) => a.id === g.accountId)) || null;

/** Sau khi lưu form/Sửa hồ sơ: thông tin khác tài khoản ⇒ cập nhật tài khoản (đổi SĐT ⇒ tên đăng nhập + mật khẩu mới, SMS). */
const applyAccountEdits = (db, guardians) =>
  guardians.flatMap((g) => {
    const acc = accountOfGuardian(db, g);
    if (!acc || !differsFromAccount(acc, g)) return [];
    return [{ fullName: g.fullName.trim(), phone: normalizePhone(g.phone), ...applyGuardianEdits(db, acc, g) }];
  });

/** Sau khi lưu: thêm trẻ vào tài khoản đã khớp, trạng thái phụ huynh theo tài khoản, bổ sung CCCD cho tài khoản cũ. */
const linkAccounts = (db, record, guardians) =>
  guardians.forEach((g, i) => {
    const acc = g.accountId && db.parentAccounts.find((a) => a.id === g.accountId);
    if (!acc) return;
    if (!acc.childIds.includes(record.id)) acc.childIds.push(record.id);
    if (!acc.idNumber) acc.idNumber = record.guardians[i].idNumber;
    record.guardians[i].accountStatus = acc.status;
  });

/** Child as returned to the UI: account internals only for Principal / VP. */
const toView = (db, child, user) => {
  const cls = classOf(db, child);
  const decl = declarationOf(db, child.id);
  const showAccounts = canViewParentAccounts(user);
  return {
    ...clone(child),
    profile: child.profile ? clone(child.profile) : emptyChildProfile(),
    guardians: (child.guardians || []).map((g) => {
      const { smsStatus, smsAt, ...rest } = g;
      // CCCD mọi vai xem như SĐT (user chốt 2026-10-21); bản ghi chưa có thì lấy từ tài khoản cùng SĐT.
      const idNumber = g.idNumber || accountByPhone(db, g.phone)?.idNumber || '';
      return showAccounts
        ? { ...rest, idNumber, smsStatus, smsAt }
        : { fullName: g.fullName, relation: g.relation, phone: g.phone, idNumber, email: g.email };
    }),
    className: cls?.name || '',
    ageGroupId: cls?.ageGroupId || '',
    schoolYear: cls?.schoolYear || '',
    hasDeclaration: !!decl,
    // Hộp xác nhận cho nghỉ học báo trước việc tự đóng phiếu theo dõi.
    openFollowUpId: (db.healthFollowUps || []).find((f) => f.childId === child.id && !f.closedAt)?.id || null,
    // Danh sách trẻ lọc được trẻ "Cần theo dõi" qua mọi đợt khám (user chốt 2026-10-17).
    latestHealth: latestHealthOf(db, child),
  };
};

/**
 * Lớp của trẻ trong một năm học (user chốt 2026-10-28, Y-2; CMR-04): lớp cuối cùng thuộc năm đó theo lịch sử xếp/chuyển lớp
 * (childPlacements) và chuyển năm học (history PLACEMENT_* của Xếp lớp năm học mới); không có lịch sử thì lớp hiện tại.
 */
const classInYear = (db, child, yearId) => {
  const moves = [
    ...db.childPlacements.filter((p) => p.childId === child.id),
    ...(child.history || []).filter((h) => h.fromClassId || h.toClassId),
  ].sort((a, b) => String(a.at).localeCompare(String(b.at)));
  const ids = [moves[0]?.fromClassId, ...moves.map((m) => m.toClassId), child.classId].filter(Boolean);
  const inYear = ids.map((id) => db.classes.find((c) => c.id === id)).filter((c) => c?.schoolYear === yearId);
  return inYear.at(-1) || null;
};

/**
 * Trẻ trong danh sách năm học yearId: có lớp thuộc năm đó ⇒ hiện với lớp, điểm trường của năm đó; trẻ chờ xếp lớp chỉ ở năm đang
 * hoạt động; trẻ nghỉ khi chưa có lớp ở năm của ngày nghỉ. Trạng thái giữ trạng thái hiện tại.
 */
const inSchoolYear = (db, view, child, yearId) => {
  const cls = classInYear(db, child, yearId);
  if (cls)
    return {
      ...view,
      classId: cls.id,
      className: cls.name,
      ageGroupId: cls.ageGroupId,
      schoolYear: cls.schoolYear,
      campusId: cls.campusId,
    };
  if (child.status === CHILD_STATUS.PENDING_PLACEMENT) return yearId === activeYearId(db) ? view : null;
  return child.status === CHILD_STATUS.LEFT && !child.classId && schoolYearIdOfDate(db, child.leftAt) === yearId ? view : null;
};

const assertView = (db, childId, user, check = canViewChild) => {
  const child = findChild(db, childId);
  if (!check(child, user, classOf(db, child))) forbid();
  return child;
};

// Họ tên so khớp giữ dấu, không phân biệt hoa thường và khoảng trắng: "Minh Anh" khác "Minh Ánh" (trẻ sinh đôi).
const nameKey = (v) =>
  String(v || '')
    .normalize('NFC')
    .trim()
    .replace(/\s+/g, ' ')
    .toLocaleLowerCase('vi');
const citizenIdsOf = (guardians) =>
  new Set((guardians || []).map((g) => normalizeCitizenId(g.idNumber)).filter((id) => isValidCitizenId(id)));

/**
 * Trùng hồ sơ (user chốt 2026-10-23, PROPOSED — chờ BE): cùng họ tên, ngày sinh và ít nhất một phụ huynh cùng CCCD.
 * Chỉ trùng họ tên, ngày sinh mà khác phụ huynh là hai trẻ khác nhau, tiếp nhận bình thường.
 * left: tìm trong trẻ đã nghỉ học (gợi ý mở lại hồ sơ cũ) thay vì trẻ đang học / chờ xếp lớp.
 */
const sameChildOf = (db, data, { excludeId, left = false } = {}) => {
  const name = nameKey(data.fullName);
  const ids = citizenIdsOf(data.guardians);
  if (!name || !data.dateOfBirth || !ids.size) return null;
  return (
    db.children.find(
      (c) =>
        c.id !== excludeId &&
        (c.status === CHILD_STATUS.LEFT) === left &&
        c.dateOfBirth === data.dateOfBirth &&
        nameKey(c.fullName) === name &&
        (c.guardians || []).some((g) => ids.has(normalizeCitizenId(g.idNumber))),
    ) || null
  );
};
const isDuplicate = (db, data, excludeId) => sameChildOf(db, data, { excludeId });
// Khóa so trùng giữa các dòng của cùng một file nhập.
const childKey = (child) => `${nameKey(child.fullName)}|${child.dateOfBirth}|${[...citizenIdsOf(child.guardians)].sort().join(',')}`;

const nextCode = (db) => {
  const prefix = `HS${new Date().getFullYear().toString().slice(2)}`;
  const used = new Set(db.children.map((c) => c.code));
  let n = db.children.length + 1;
  while (used.has(`${prefix}${String(n).padStart(3, '0')}`)) n += 1;
  return `${prefix}${String(n).padStart(3, '0')}`;
};

const cleanGuardians = (guardians, previous = []) =>
  guardians.map((g) => {
    // Đổi SĐT vẫn là phụ huynh cũ (nhận theo CCCD) ⇒ giữ trạng thái tài khoản.
    const id = normalizeCitizenId(g.idNumber);
    const old =
      (id && previous.find((p) => normalizeCitizenId(p.idNumber) === id)) ||
      previous.find((p) => normalizePhone(p.phone) === normalizePhone(g.phone));
    return {
      fullName: g.fullName.trim(),
      relation: g.relation,
      phone: g.phone.trim(),
      idNumber: normalizeCitizenId(g.idNumber),
      email: (g.email || '').trim(),
      accountStatus: old?.accountStatus || PARENT_ACCOUNT_STATUS.NOT_ACTIVATED,
      ...(old?.smsStatus ? { smsStatus: old.smsStatus, smsAt: old.smsAt } : {}),
    };
  });

const cleanMedicalHistory = (mh) => {
  const item = (v) => ({
    state: v?.state || DECLARATION_STATE.NOT_PROVIDED,
    text: v?.state === DECLARATION_STATE.REPORTED ? String(v.text || '').trim() : '',
  });
  const tbState = mh?.tbContact?.state || DECLARATION_STATE.NOT_PROVIDED;
  return {
    self: item(mh?.self),
    family: item(mh?.family),
    tbContact: { state: tbState, contactDate: tbState === DECLARATION_STATE.REPORTED ? mh.tbContact.contactDate || '' : '' },
  };
};

const cleanDeclaration = (d) => ({
  allergies: {
    state: d.allergies.state,
    items: d.allergies.state === DECLARATION_STATE.REPORTED ? d.allergies.items.map((x) => x.trim()).filter(Boolean) : [],
  },
  diet: { state: d.diet.state, text: d.diet.state === DECLARATION_STATE.REPORTED ? d.diet.text.trim() : '' },
  otherNotes: {
    state: d.otherNotes?.state || DECLARATION_STATE.NOT_PROVIDED,
    text: d.otherNotes?.state === DECLARATION_STATE.REPORTED ? d.otherNotes.text.trim() : '',
  },
  medicalHistory: cleanMedicalHistory(d.medicalHistory),
});

/** Hành chính hỏi khi tiếp nhận (dùng cho phiếu khám); ô trống giữ chuỗi rỗng, tuần thai là số. */
export const cleanProfile = (p) => {
  const s = (v, max = 100) =>
    String(v ?? '')
      .trim()
      .slice(0, max);
  const w = p?.gestationWeeks;
  return {
    idNumber: s(p?.idNumber, 20).replace(/\s/g, ''),
    premature: ['YES', 'NO'].includes(p?.premature) ? p.premature : '',
    gestationWeeks: w === '' || w == null || Number.isNaN(Number(w)) ? null : Math.round(Number(w)),
    ethnicity: s(p?.ethnicity),
    beneficiary: s(p?.beneficiary),
    // Nguồn chi trả luôn BHYT, không nhập ở form hay Excel (user chốt 2026-10-23, PROPOSED — chờ BE).
    paymentSource: 'BHYT',
    bloodType: s(p?.bloodType),
    address: { province: s(p?.address?.province), ward: s(p?.address?.ward), street: s(p?.address?.street, 300) },
  };
};

const maskId = (v) => (v ? `••••${String(v).slice(-3)}` : '');

/** Thay đổi hành chính theo từng ô cho lịch sử; số định danh chỉ hiện 3 số cuối. */
export const profileChanges = (from, to) => {
  const a = { ...emptyChildProfile(), ...from };
  const display = (p, k) => (k === 'address' ? formatAddress(p.address) : k === 'idNumber' ? maskId(p.idNumber) : (p[k] ?? ''));
  return PROFILE_FIELDS.filter((k) => String(display(a, k)) !== String(display(to, k))).map((k) => ({
    field: `profile.${k}`,
    label: PROFILE_FIELD_LABELS[k],
    from: display(a, k),
    to: display(to, k),
  }));
};

const schoolLeadersOf = (d, child) =>
  (d.users || []).filter((u) => u.role === 'PRINCIPAL' || (u.role === 'VICE_PRINCIPAL' && u.campusId === child.campusId)).map((u) => u.id);

/**
 * Khai "Có tiếp xúc với người bệnh lao" ⇒ báo Hiệu trưởng, Phó hiệu trưởng điểm trường, giáo viên lớp và cả người lưu
 * (user chốt 2026-10-17; thêm người lưu 2026-10-27); câu báo kèm ngày tiếp xúc gần nhất (2026-10-21). Câu trung tính;
 * không mở phiếu theo dõi.
 */
export const notifyTbContactReported = (d, child, actorId, contactDate) => {
  const cls = child.classId ? d.classes.find((c) => c.id === child.classId) : null;
  const ids = new Set([...schoolLeadersOf(d, child), ...(cls?.teacherIds || []), actorId].filter(Boolean));
  const when = contactDate ? ` (gần nhất ngày ${formatDate(contactDate)})` : '';
  ids.forEach((userId) =>
    pushNotification(d, {
      userId,
      type: 'CHILD_TB_CONTACT',
      title: 'Trẻ có tiền sử tiếp xúc với người bệnh lao',
      message: `Phụ huynh khai ${child.fullName} có tiền sử tiếp xúc với người bệnh lao${when}. Nhà trường trao đổi với phụ huynh về việc đưa trẻ đi khám sàng lọc; bác sĩ xem lại ở đợt khám tới.`,
      link: `/children/${child.id}/health-declaration`,
    }),
  );
};

/**
 * Ngày tiếp xúc gần nhất đã có mà đổi sang ngày khác (sửa khai báo hoặc lưu kết luận phiếu khám) ⇒ báo Hiệu trưởng,
 * Phó hiệu trưởng điểm trường và cả người lưu (user chốt 2026-10-21; thêm người lưu 2026-10-27); giáo viên khác không nhận.
 * source: nơi đổi.
 */
export const notifyTbContactDateChanged = (d, child, { from, to, source }, actorId) => {
  if (!from || !to || from === to) return;
  const ids = new Set([...schoolLeadersOf(d, child), actorId].filter(Boolean));
  ids.forEach((userId) =>
    pushNotification(d, {
      userId,
      type: 'CHILD_TB_CONTACT_DATE_CHANGED',
      title: 'Đổi ngày tiếp xúc với người bệnh lao',
      message: `Ngày tiếp xúc gần nhất với người bệnh lao của ${child.fullName} đổi từ ${formatDate(from)} sang ${formatDate(to)} (${source}).`,
      link: `/children/${child.id}/health-declaration`,
    }),
  );
};

const tbReported = (mh) => mh?.tbContact?.state === DECLARATION_STATE.REPORTED;
const tbContactDateOf = (mh) => (tbReported(mh) ? mh.tbContact.contactDate || '' : '');

/**
 * Placement checks (UC 3.10 step 4): class of the VP's campus, active, not full; chỉ lớp của năm học đang hoạt động — xếp lớp
 * năm sau ở màn Xếp lớp năm học mới (user chốt 2026-10-28, Y-3).
 */
const assertClassAvailable = (db, classId, user) => {
  const cls = db.classes.find((c) => c.id === classId);
  if (!cls || cls.status === 'INACTIVE') invalid({ classId: 'Lớp không tồn tại hoặc đã ngừng hoạt động' });
  if (cls.schoolYear !== activeYearId(db))
    invalid({ classId: 'Chỉ xếp vào lớp của năm học đang hoạt động. Xếp lớp cho năm học sau ở màn Xếp lớp năm học mới.' });
  if (!areaAllows(user, 'children', cls.campusId, true)) invalid({ classId: 'Chỉ xếp được vào lớp thuộc điểm trường bạn được giao' });
  if (activeCount(db, cls.id) >= cls.capacity) invalid({ classId: `${cls.name} đã đủ ${cls.capacity} trẻ. Chọn lớp khác.` });
  return cls;
};

/**
 * Điểm trường của trẻ tiếp nhận chưa xếp lớp (user chốt 2026-10-27, PROPOSED — chờ BE): người được giao toàn trường
 * (Hiệu trưởng, PHT toàn trường) phải chọn; PHT một điểm trường không gửi thì dùng điểm trường của mình.
 */
const enrollCampusOf = (db, campusId, user) => {
  const grant = areaAccess(user, 'children');
  const id = campusId || (grant.scope === PERMISSION_SCOPE.CAMPUS ? grant.campusId || user.campusId : '');
  if (!id) invalid({ campusId: 'Chọn điểm trường tiếp nhận trẻ' });
  const campus = db.campuses.find((c) => c.id === id);
  if (!campus || campus.status === 'INACTIVE') invalid({ campusId: 'Điểm trường không tồn tại hoặc đã ngừng hoạt động' });
  if (!areaAllows(user, 'children', id, 'create')) invalid({ campusId: 'Chỉ tiếp nhận trẻ vào điểm trường bạn được giao' });
  return id;
};

/** Điểm trường nhận trẻ theo lớp hoặc điểm trường gửi lên; rỗng = điểm trường của PHT một điểm trường (như enrollCampusOf). */
const targetCampusOf = (db, { classId, campusId }) => db.classes.find((c) => c.id === classId)?.campusId || campusId || '';

const notifyClassTeachers = (db, cls, child) =>
  (cls?.teacherIds || []).forEach((teacherId) =>
    pushNotification(db, {
      userId: teacherId,
      type: 'CHILD_PLACED',
      title: 'Lớp có trẻ mới',
      message: `${child.fullName} đã được xếp vào ${cls.name}.`,
      link: `/children/${child.id}`,
    }),
  );

/**
 * CCCD/SĐT lệch với phụ huynh đã ghi ở tài khoản hoặc hồ sơ khác (D4) ⇒ lỗi theo ô; ô đã sai định dạng thì bỏ qua.
 * SĐT đã thuộc phụ huynh có CCCD khác báo dưới ô SĐT (CCCD là khóa nhận diện, user chốt 2026-10-23).
 */
const guardianConflicts = (db, guardians, errors = {}, excludeChildId) =>
  Object.fromEntries(
    (guardians || []).flatMap((g, i) => {
      if (errors[`guardians.${i}.idNumber`] || errors[`guardians.${i}.phone`]) return [];
      const sameAccount = (g.accountId && db.parentAccounts.find((a) => a.id === g.accountId)) || null;
      const message = identityConflict(db, g, { excludeChildId, sameAccount });
      if (!message) return [];
      return [[`guardians.${i}.${message === PHONE_HAS_OTHER_ID ? 'phone' : 'idNumber'}`, message]];
    }),
  );

const throwConflicts = (conflicts) => {
  if (hasErrors(conflicts))
    throw new ApiError(409, 'Số CCCD hoặc số điện thoại đã thuộc phụ huynh khác. Kiểm tra các ô được đánh dấu.', conflicts);
};

const validateEnrollment = (db, { child, declaration }, excludeId) => {
  const errors = {
    ...validateChildInfo(child),
    ...prefix('declaration', validateDeclaration(declaration, { dateOfBirth: child?.dateOfBirth })),
  };
  const dup = !errors.fullName && !errors.dateOfBirth ? isDuplicate(db, child, excludeId) : null;
  return { errors, dup, conflicts: guardianConflicts(db, child?.guardians, errors, excludeId) };
};

const prefix = (p, errors) => Object.fromEntries(Object.entries(errors).map(([k, v]) => [`${p}.${k}`, v]));

const createChild = (db, { child, declaration }, { classId, campusId, user }) => {
  const decl = cleanDeclaration(declaration);
  const record = {
    id: uid('ch'),
    code: nextCode(db),
    fullName: child.fullName.trim(),
    gender: child.gender,
    dateOfBirth: child.dateOfBirth,
    classId: classId || null,
    campusId,
    status: classId ? CHILD_STATUS.ACTIVE : CHILD_STATUS.PENDING_PLACEMENT,
    enrolledAt: todayInput(),
    // Người tiếp nhận chốt dị ứng ngay khi tiếp nhận, không chờ Hiệu trưởng duyệt (quyết định user 2026-10-14).
    allergies: [...decl.allergies.items],
    guardians: cleanGuardians(child.guardians),
    profile: cleanProfile(child.profile),
    history: [{ action: 'ENROLLED', userId: user.id, at: nowIso() }],
  };
  db.children.push(record);
  db.healthDeclarations.push({
    childId: record.id,
    ...decl,
    declaredBy: user.id,
    declaredAt: nowIso(),
    history: [{ action: 'DECLARED', userId: user.id, at: nowIso() }],
  });
  if (classId)
    db.childPlacements.push({ id: uid('pl'), childId: record.id, fromClassId: null, toClassId: classId, userId: user.id, at: nowIso() });
  if (tbReported(decl.medicalHistory)) notifyTbContactReported(db, record, user.id, tbContactDateOf(decl.medicalHistory));
  return record;
};

/** Kết quả tài khoản từng phụ huynh khi lưu form tiếp nhận: CREATED (tạo, gửi SMS) · LINKED (tài khoản có sẵn) · NOT_ACTIVATED. */
const guardianAccountsOf = (record, activated, edited = []) =>
  (record.guardians || []).map((g) => {
    const same = (r) => normalizePhone(r.phone) === normalizePhone(g.phone);
    const done = activated.find(same);
    const edit = edited.find(same);
    const linked = done || g.accountStatus !== PARENT_ACCOUNT_STATUS.NOT_ACTIVATED;
    const result = done?.newAccount ? 'CREATED' : linked ? 'LINKED' : 'NOT_ACTIVATED';
    // phoneChanged: tài khoản có sẵn đổi tên đăng nhập sang SĐT mới, mật khẩu mới gửi SMS (user chốt 2026-10-28).
    const smsStatus = done?.smsStatus || edit?.smsStatus || null;
    return { fullName: g.fullName, phone: g.phone, result, phoneChanged: !!edit?.phoneChanged, smsStatus };
  });

/** Phiếu khám còn nháp: chưa là kết quả, không hiện ở Sổ sức khỏe, xu hướng, phiếu theo dõi. */
export const isExamDraft = (m) => m.examStatus === EXAM_STATUS.DRAFT;

// Kết quả sàng lọc tính lại mỗi lần đọc (như BE trả giá trị dẫn xuất) nên dữ liệu demo cũ vẫn theo rule mới.
export const toMeasurementView = (db, m) => {
  const { nutritionStatus: _legacyStatus, ...stored } = clone(m);
  const child = db.children.find((c) => c.id === m.childId);
  const fields = {
    ...stored,
    campaignId: stored.campaignId ?? null,
    headCircumferenceCm: stored.headCircumferenceCm ?? null,
    grossMotor: stored.grossMotor ?? null,
    fineMotor: stored.fineMotor ?? null,
    exam: stored.exam ?? null,
    examStatus: stored.examStatus ?? null,
  };
  const campaign = fields.campaignId ? (db.healthCheckCampaigns || []).find((c) => c.id === fields.campaignId) : null;
  const screen = screenMeasurement(fields, child.dateOfBirth);
  const followUp = (db.healthFollowUps || []).find((f) => f.measurementIds.includes(m.id)) || null;
  return {
    ...fields,
    ...screen,
    campaignName: campaign?.name || null,
    // EXAM: kết quả của đợt khám (mở phiếu khám) · MEASUREMENT: số đo của kỳ cân đo · null: ngoài đợt.
    campaignKind: campaign ? campaignKindOf(campaign) : null,
    followUpId: followUp?.id || null,
    followUpEffect: followUpEffectOf(followUp, m.id),
    parentContact: parentContactOf(db, m, screen.followUpLevel),
    // Kết quả của đợt/kỳ đã đóng/hủy bị khóa tới khi HT/PHT mở lại.
    locked: !!campaign && !isOpenForEntry(campaign),
    measuredByName: userName(db, m.measuredBy),
    edits: (m.edits || []).map((e) => ({ ...e, userName: userName(db, e.userId) })),
  };
};

export const childrenMockRepository = {
  /* ------------------------------ #27 Children list ------------------------------ */
  async listChildren(filters = {}, user) {
    await delay(150);
    if (!canViewChildren(user)) forbid();
    const db = ensureSeeded();
    const kw = normalizeText(filters.keyword).trim();
    const list = db.children
      .filter((c) => canViewChild(c, user, classOf(db, c)))
      // Danh sách không trả phần hành chính (có số định danh); xem ở hồ sơ trẻ.
      .flatMap((c) => {
        const { profile: _profile, ...rest } = toView(db, c, user);
        const view = filters.schoolYear ? inSchoolYear(db, rest, c, filters.schoolYear) : rest;
        return view ? [view] : [];
      })
      .filter((c) => !filters.campusId || c.campusId === filters.campusId)
      .filter((c) => !filters.classId || c.classId === filters.classId)
      .filter((c) => !filters.status || c.status === filters.status)
      .filter((c) => !kw || normalizeText(`${c.fullName} ${c.code}`).includes(kw));
    return list.sort((a, b) => a.className.localeCompare(b.className, 'vi') || a.fullName.localeCompare(b.fullName, 'vi'));
  },

  /* ------------------------------ #32 Child profile ------------------------------ */
  async getChildDetail(id, user) {
    await delay(120);
    const db = ensureSeeded();
    const child = assertView(db, id, user);
    const placements = db.childPlacements
      .filter((p) => p.childId === id)
      .map((p) => ({
        ...p,
        userName: userName(db, p.userId),
        fromClassName: db.classes.find((c) => c.id === p.fromClassId)?.name || '',
        toClassName: db.classes.find((c) => c.id === p.toClassId)?.name || '',
      }))
      .reverse();
    const decl = declarationOf(db, id);
    return {
      child: toView(db, child, user),
      cls: clone(classOf(db, child)),
      declaration: decl
        ? {
            ...clone(decl),
            medicalHistory: decl.medicalHistory ? clone(decl.medicalHistory) : emptyMedicalHistory(),
            declaredByName: userName(db, decl.declaredBy),
          }
        : null,
      placements,
    };
  },

  /* ------------------------------ #28 Enrollment form ------------------------------ */
  /**
   * Kiểm trùng hồ sơ trước khi tiếp nhận: data { fullName, dateOfBirth, guardianIdNumbers[] }.
   * Trả { kind: 'ACTIVE' } (trùng trẻ đang học/chờ xếp lớp ⇒ không tiếp nhận) hoặc { kind: 'LEFT' } (trẻ đã nghỉ học ⇒ gợi ý mở lại
   * hồ sơ cũ, user chốt 2026-10-23); null khi không trùng. Điểm trường khác: chỉ báo có, không lộ hồ sơ (GBR-GEN-01).
   */
  async checkDuplicate(data, user, excludeId) {
    await delay(100);
    if (!canEnrollChild(user)) forbid();
    const db = ensureSeeded();
    const query = { ...data, guardians: (data.guardianIdNumbers || []).map((idNumber) => ({ idNumber })) };
    const active = sameChildOf(db, query, { excludeId });
    const match = active || sameChildOf(db, query, { left: true });
    if (!match) return null;
    const kind = active ? 'ACTIVE' : 'LEFT';
    if (!areaAllows(user, 'children', match.campusId)) return { kind, sameCampus: false };
    return {
      kind,
      sameCampus: true,
      id: match.id,
      code: match.code,
      fullName: match.fullName,
      leftAt: match.leftAt || null,
      canReadmit: kind === 'LEFT' && canReadmitChild(match, user),
    };
  },

  /**
   * Kiểm CCCD/SĐT phụ huynh ngay ở bước 1 tiếp nhận, cùng kiểm như khi lưu (user chốt 2026-10-28, PROPOSED — chờ BE):
   * lệch phụ huynh đã có ⇒ 409 lỗi theo ô; hợp lệ ⇒ null.
   */
  async checkGuardianConflicts(guardians, user) {
    await delay(100);
    if (!canEnrollChild(user)) forbid();
    const db = ensureSeeded();
    throwConflicts(guardianConflicts(db, attachAccounts(db, guardians)));
    return null;
  },

  /** Mở lại hồ sơ trẻ đã nghỉ học (user chốt 2026-10-23): về Chờ xếp lớp, giữ mã, lịch sử, sức khỏe, tài khoản phụ huynh. */
  async readmitChild(childId, { reason } = {}, user) {
    await delay();
    const db = ensureSeeded();
    const child = findChild(db, childId);
    if (!canReadmitChild(child, user)) {
      if (child.status !== CHILD_STATUS.LEFT) throw new ApiError(409, 'Trẻ chưa nghỉ học, không cần mở lại hồ sơ.');
      forbid();
    }
    const text = String(reason || '').trim();
    if (!text) invalid({ reason: 'Nhập lý do tiếp nhận lại' });
    if (text.length > 300) invalid({ reason: 'Lý do tối đa 300 ký tự' });
    return writeDb((d) => {
      const target = findChild(d, childId);
      Object.assign(target, { status: CHILD_STATUS.PENDING_PLACEMENT, classId: null, readmittedAt: todayInput() });
      delete target.leftAt;
      delete target.leftReason;
      target.history = [...(target.history || []), { action: 'READMITTED', userId: user.id, at: nowIso(), note: text }];
      return toView(d, target, user);
    });
  },

  /** Lớp để tiếp nhận, xếp lớp: chỉ lớp của năm học đang hoạt động (user chốt 2026-10-28, Y-3). */
  async getPlacementClasses(_filters, user) {
    await delay(100);
    if (!isVicePrincipal(user) && !isPrincipal(user)) forbid();
    const db = ensureSeeded();
    const year = activeYearId(db);
    return db.classes
      .filter((c) => areaAllows(user, 'children', c.campusId, true) && c.status !== 'INACTIVE' && c.schoolYear === year)
      .map((c) => ({ ...clone(c), enrolledCount: activeCount(db, c.id) }));
  },

  async enrollChild(payload, user) {
    await delay();
    if (!canEnrollChild(user)) forbid();
    const db = ensureSeeded();
    // P-18 A (user chốt 2026-10-28): không có quyền kích hoạt ở điểm trường nhận trẻ ⇒ vẫn lưu, phụ huynh mới chờ kích hoạt.
    // Phụ huynh trùng CCCD tài khoản thì chỉ liên kết, thông tin theo tài khoản như nhập Excel (user đồng ý 2026-10-28; chờ BE).
    const manageAccounts = canActivateParentsAt(targetCampusOf(db, payload), user);
    const guardians = (manageAccounts ? attachAccounts : withAccounts)(db, payload.child?.guardians);
    const resolved = { ...payload, child: { ...payload.child, guardians } };
    const { errors, dup, conflicts } = validateEnrollment(db, resolved);
    if (hasErrors(errors)) invalid(errors);
    if (dup) throw new ApiError(409, 'Hồ sơ trẻ này đã tồn tại (trùng họ tên, ngày sinh và phụ huynh). Xem lại hồ sơ đã có.');
    throwConflicts(conflicts);
    return writeDb((d) => {
      // Lớp không bắt buộc khi tiếp nhận; có lớp thì vẫn kiểm sức chứa và campus, trẻ thuộc điểm trường của lớp.
      const cls = payload.classId ? assertClassAvailable(d, payload.classId, user) : null;
      if (cls && payload.campusId && cls.campusId !== payload.campusId) invalid({ classId: 'Lớp không thuộc điểm trường đã chọn' });
      const campusId = cls?.campusId || enrollCampusOf(d, payload.campusId, user);
      const record = createChild(d, resolved, { classId: cls?.id || null, campusId, user });
      // Tài khoản có sẵn: liên kết ngay khi lưu, không tạo tài khoản mới, không gửi mật khẩu (UC 3.9 nhánh đã có tài khoản).
      linkAccounts(d, record, guardians);
      // Thông tin sửa khác tài khoản có sẵn ⇒ tài khoản đổi theo; làm trước kích hoạt để phụ huynh đổi SĐT không bị coi là người mới.
      const edited = manageAccounts ? applyAccountEdits(d, guardians) : [];
      // Form tiếp nhận: tạo tài khoản cho phụ huynh chưa có và gửi SMS ngay; nhập Excel vẫn kích hoạt sau (user chốt 2026-10-28, L-14).
      const activated = manageAccounts ? activatePendingGuardians(d, record) : [];
      if (cls) notifyClassTeachers(d, cls, record);
      return { ...toView(d, record, user), guardianAccounts: guardianAccountsOf(record, activated, edited) };
    });
  },

  async updateChild(id, { child: input, reason }, user) {
    await delay();
    const db = ensureSeeded();
    const current = findChild(db, id);
    if (!canEditChild(current, user)) forbid();
    // Thông tin phụ huynh sửa được, tài khoản đổi theo (user chốt 2026-10-28; thay D5 "CCCD theo tài khoản").
    const guardians = attachAccounts(db, input.guardians, current.guardians);
    const child = { ...input, guardians };
    const errors = validateChildInfo(child);
    // Đổi cùng lúc CCCD và SĐT của phụ huynh đã có tài khoản dễ thành thay người khác vào tài khoản cũ.
    guardians.forEach((g, i) => {
      const acc = accountOfGuardian(db, g);
      const idChanged = !!acc?.idNumber && normalizeCitizenId(acc.idNumber) !== normalizeCitizenId(g.idNumber);
      if (idChanged && normalizePhone(acc.phone) !== normalizePhone(g.phone))
        errors[`guardians.${i}.idNumber`] ||=
          'Phụ huynh đã có tài khoản: không đổi cùng lúc CCCD và số điện thoại. Đổi từng thông tin, hoặc gỡ phụ huynh ở màn Tài khoản phụ huynh rồi thêm người mới.';
    });
    // Phụ huynh đã liên kết tài khoản chỉ gỡ ở màn Tài khoản phụ huynh (AUTH-19); bỏ ở đây thì tài khoản vẫn liên kết trẻ.
    const kept = new Set(guardians.map((g) => g.accountId).filter(Boolean));
    const dropped = (current.guardians || [])
      .filter((g) => g.accountStatus !== PARENT_ACCOUNT_STATUS.NOT_ACTIVATED)
      .map((g) => accountByPhone(db, g.phone))
      .filter((acc) => acc && (acc.childIds || []).includes(id) && !kept.has(acc.id));
    if (dropped.length)
      errors.guardians ||= `${dropped.map((acc) => acc.fullName).join(', ')} đã có tài khoản liên kết với trẻ nên không xóa ở hồ sơ. Gỡ liên kết ở màn Tài khoản phụ huynh.`;
    if (!reason?.trim()) errors.reason = 'Nhập lý do chỉnh sửa hồ sơ';
    if (hasErrors(errors)) invalid(errors);
    if (isDuplicate(db, child, id)) throw new ApiError(409, 'Đã có hồ sơ khác trùng họ tên, ngày sinh và phụ huynh. Xem lại hồ sơ đã có.');
    throwConflicts(guardianConflicts(db, guardians, errors, id));
    return writeDb((d) => {
      const target = findChild(d, id);
      const changes = [];
      const set = (field, value) => {
        if (JSON.stringify(target[field]) !== JSON.stringify(value)) changes.push({ field, from: target[field], to: value });
        target[field] = value;
      };
      set('fullName', child.fullName.trim());
      set('dateOfBirth', child.dateOfBirth);
      set('gender', child.gender);
      set('guardians', cleanGuardians(child.guardians, target.guardians));
      // Phụ huynh khớp tài khoản (theo CCCD): liên kết trẻ; tài khoản chưa có CCCD được bổ sung số vừa nhập (D2).
      linkAccounts(d, target, guardians);
      // accountChanges: tài khoản đổi theo thông tin vừa sửa; đổi SĐT ⇒ tên đăng nhập mới, mật khẩu mới gửi SMS.
      const accountChanges = applyAccountEdits(d, guardians);
      if (child.profile) {
        const next = cleanProfile(child.profile);
        changes.push(...profileChanges(target.profile, next));
        target.profile = next;
      }
      target.history = [...(target.history || []), { action: 'UPDATED', userId: user.id, at: nowIso(), note: reason.trim(), changes }];
      return { ...toView(d, target, user), accountChanges };
    });
  },

  /* ------------------------------ #28 Excel / CSV import ------------------------------ */
  async previewImport(file, user) {
    await delay(300);
    if (!canEnrollChild(user)) forbid();
    const name = file?.name || '';
    if (/\.xlsx?$/i.test(name)) {
      return {
        supported: false,
        fileName: name,
        message:
          'Bản chạy thử chỉ đọc được file .csv. File Excel (.xlsx) sẽ do máy chủ đọc khi nối backend. Hãy lưu file Excel dưới dạng "CSV UTF-8" rồi tải lên lại.',
        rows: [],
      };
    }
    if (!/\.csv$/i.test(name)) invalid({ file: 'Chỉ nhận file .xlsx hoặc .csv theo mẫu của trường' }, 'Định dạng file không được hỗ trợ.');
    const text = await file.text();
    const { missingColumns, rows } = readEnrollmentCsv(text);
    if (missingColumns.length) invalid({ file: `Thiếu cột: ${missingColumns.join(', ')}` }, 'File không đúng mẫu tiếp nhận trẻ.');
    if (rows.length === 0) invalid({ file: 'File không có dòng dữ liệu nào' }, 'File không có dữ liệu.');
    if (rows.length > MAX_IMPORT_ROWS) invalid({ file: `Mỗi lần nhập tối đa ${MAX_IMPORT_ROWS} trẻ` }, 'File quá lớn.');
    const db = ensureSeeded();
    const seen = new Map();
    const inFile = createBatchIdentityCheck();
    const checked = rows.map((raw) => {
      // Dòng có CCCD trùng tài khoản: dùng thông tin tài khoản, khi nhập sẽ liên kết (user chốt 2026-10-23).
      const guardians = withAccounts(db, raw.payload.child.guardians);
      const r = { ...raw, payload: { ...raw.payload, child: { ...raw.payload.child, guardians } } };
      const notes = guardians
        .filter((g) => g.accountId)
        .map(
          (g) =>
            `Phụ huynh đã có tài khoản (trùng CCCD): ${g.fullName} · ${g.phone}. Dùng thông tin tài khoản, trẻ được liên kết khi nhập.`,
        );
      const { errors, dup, conflicts } = validateEnrollment(db, r.payload);
      const messages = [...new Set([...Object.values(errors), ...Object.values(conflicts)])];
      if (dup) messages.push('Trẻ đã có hồ sơ trong hệ thống (trùng họ tên, ngày sinh và phụ huynh)');
      const left = dup ? null : sameChildOf(db, r.payload.child, { left: true });
      if (left)
        notes.push(`Trẻ từng học ở trường (hồ sơ cũ ${left.code}, đã nghỉ học): nên mở lại hồ sơ cũ ở Tiếp nhận trẻ thay vì nhập mới.`);
      const key = childKey(r.payload.child);
      if (r.payload.child.fullName && seen.has(key)) messages.push(`Trùng với dòng ${seen.get(key)} trong file`);
      else seen.set(key, r.rowNo);
      const g = r.payload.child.guardians[0];
      const fileIssue = !errors['guardians.0.idNumber'] && !errors['guardians.0.phone'] ? inFile(g, r.rowNo) : null;
      if (fileIssue) messages.push(fileIssue);
      return { ...r, errors: messages, notes };
    });
    return { supported: true, fileName: name, rows: checked };
  },

  /**
   * Valid rows become children waiting for placement; their declaration is saved as entered (UC 3.8 alt flow).
   * campusId: điểm trường của cả file (bắt buộc với người được giao toàn trường, như enrollCampusOf).
   */
  async importChildren(rows, user, campusId) {
    await delay();
    if (!canEnrollChild(user)) forbid();
    const db = ensureSeeded();
    if (!rows?.length) invalid({ file: 'Không có dòng hợp lệ để nhập' });
    const targetCampusId = enrollCampusOf(db, campusId, user);
    const keys = new Set();
    const inFile = createBatchIdentityCheck();
    const resolved = rows.map((r) => ({ ...r, child: { ...r.child, guardians: withAccounts(db, r.child?.guardians) } }));
    resolved.forEach((r, i) => {
      const { errors, dup, conflicts } = validateEnrollment(db, r);
      const key = childKey(r.child);
      const fileIssue = (r.child.guardians || []).some((g) => inFile(g, i + 1));
      if (hasErrors(errors) || hasErrors(conflicts) || dup || keys.has(key) || fileIssue)
        invalid({ file: 'File có dòng lỗi. Kiểm tra lại trước khi nhập.' });
      keys.add(key);
    });
    return writeDb((d) => {
      const created = resolved.map((r) => {
        const record = createChild(d, r, { classId: null, campusId: targetCampusId, user });
        linkAccounts(d, record, r.child.guardians);
        return record;
      });
      return { created: created.length, ids: created.map((c) => c.id) };
    });
  },

  /* ------------------------------ #29 Class placement ------------------------------ */
  async placeChild(childId, { classId, reason }, user) {
    await delay();
    const db = ensureSeeded();
    const child = findChild(db, childId);
    if (!canPlaceChild(child, user)) forbid();
    if (!classId) invalid({ classId: 'Chọn lớp cho trẻ' });
    if (child.classId === classId) invalid({ classId: 'Trẻ đang học lớp này. Chọn lớp khác.' });
    if (child.classId && !reason?.trim()) invalid({ reason: 'Nhập lý do chuyển lớp' });
    if (!declarationOf(db, childId)) invalid({ classId: 'Trẻ chưa có khai báo sức khỏe. Khai báo trước khi xếp lớp.' });
    return writeDb((d) => {
      const target = findChild(d, childId);
      const cls = assertClassAvailable(d, classId, user);
      // One class per child at a time: the transfer closes the old placement (data rule).
      d.childPlacements.push({
        id: uid('pl'),
        childId,
        fromClassId: target.classId,
        toClassId: cls.id,
        userId: user.id,
        at: nowIso(),
        reason: reason?.trim() || '',
      });
      target.classId = cls.id;
      // Điểm trường theo lớp (BE DOMAIN_MODEL: campus suy từ classroom): lớp ở điểm trường khác = chuyển điểm trường.
      target.campusId = cls.campusId;
      target.status = CHILD_STATUS.ACTIVE;
      notifyClassTeachers(d, cls, target);
      return toView(d, target, user);
    });
  },

  /** Cho nghỉ học: không xóa dữ liệu, chỉ chuyển trạng thái Đã nghỉ và giữ lớp cuối cùng để tra lịch sử. */
  async withdrawChild(childId, { leftAt, reason }, user) {
    await delay();
    const db = ensureSeeded();
    const child = findChild(db, childId);
    if (!canWithdrawChild(child, user)) forbid();
    const errors = {};
    if (!leftAt || !/^\d{4}-\d{2}-\d{2}$/.test(leftAt)) errors.leftAt = 'Chọn ngày nghỉ học';
    else if (leftAt > todayInput()) errors.leftAt = 'Ngày nghỉ học không được ở tương lai';
    else if (child.enrolledAt && leftAt < child.enrolledAt) errors.leftAt = 'Ngày nghỉ học không được trước ngày tiếp nhận';
    if (!reason?.trim()) errors.reason = 'Nhập lý do cho trẻ nghỉ học';
    else if (reason.trim().length > 300) errors.reason = 'Lý do tối đa 300 ký tự';
    if (hasErrors(errors)) invalid(errors);
    return writeDb((d) => {
      const target = findChild(d, childId);
      target.status = CHILD_STATUS.LEFT;
      target.leftAt = leftAt;
      target.leftReason = reason.trim();
      target.history = [...(target.history || []), { action: 'WITHDRAWN', userId: user.id, at: nowIso(), note: reason.trim() }];
      const closedFollowUps = closeFollowUpsOfWithdrawnChild(d, target, reason.trim(), user.id);
      const cls = classOf(d, target);
      (cls?.teacherIds || []).forEach((teacherId) =>
        pushNotification(d, {
          userId: teacherId,
          type: 'CHILD_WITHDRAWN',
          title: 'Trẻ nghỉ học',
          message: `${target.fullName} nghỉ học từ ngày ${formatDate(leftAt)}.${
            closedFollowUps ? ' Phiếu theo dõi sức khỏe của trẻ đã tự đóng.' : ''
          }`,
          link: `/children/${target.id}`,
        }),
      );
      return toView(d, target, user);
    });
  },

  /* ------------------------------ #30 Health declaration ------------------------------ */
  async saveDeclaration(childId, { declaration, reason }, user) {
    await delay();
    const db = ensureSeeded();
    const child = findChild(db, childId);
    if (!canDeclareHealth(child, user)) forbid();
    const errors = validateDeclaration(declaration, { dateOfBirth: child.dateOfBirth });
    const current = declarationOf(db, childId);
    if (current && !reason?.trim()) errors.reason = 'Nhập lý do thay đổi khai báo';
    if (hasErrors(errors)) invalid(errors);
    return writeDb((d) => {
      const clean = cleanDeclaration(declaration);
      let decl = declarationOf(d, childId);
      if (!decl) {
        decl = { childId, history: [] };
        d.healthDeclarations.push(decl);
      }
      const allergyChanged = JSON.stringify(decl.allergies) !== JSON.stringify(clean.allergies);
      const entry = { action: 'UPDATED', userId: user.id, at: nowIso(), note: reason?.trim() || '' };
      if (allergyChanged) entry.allergyChange = { from: decl.allergies ? clone(decl.allergies) : null, to: clone(clean.allergies) };
      const before = decl.medicalHistory || emptyMedicalHistory();
      if (JSON.stringify(before) !== JSON.stringify(clean.medicalHistory))
        entry.historyChange = { from: clone(before), to: clone(clean.medicalHistory) };
      // Chỉ báo khi chuyển sang "Có tiếp xúc", không báo lại khi lưu lại; đã có ngày mà đổi ngày thì báo BGH (2026-10-21).
      const newTbContact = !tbReported(before) && tbReported(clean.medicalHistory);
      const dateChange = { from: tbContactDateOf(before), to: tbContactDateOf(clean.medicalHistory), source: 'sửa khai báo sức khỏe' };
      Object.assign(decl, clean, { declaredBy: user.id, declaredAt: nowIso() });
      decl.history.push(entry);
      const target = findChild(d, childId);
      if (newTbContact) notifyTbContactReported(d, target, user.id, dateChange.to);
      else notifyTbContactDateChanged(d, target, dateChange, user.id);
      // Khai báo của Phó hiệu trưởng có hiệu lực ngay: bếp và điểm danh đọc danh sách mới.
      findChild(d, childId).allergies = [...clean.allergies.items];
      return clone(decl);
    });
  },

  /* ------------------------------ #31 Parent accounts ------------------------------ */
  /*
   * Kích hoạt tài khoản: khi lưu form tiếp nhận (enrollChild) hoặc cả nhà ở màn Tài khoản phụ huynh
   * (guardianMockRepository.activateGuardians) — AUTH-20; không còn kích hoạt từng phụ huynh.
   */
  /** Tra tài khoản phụ huynh theo CCCD (user chốt 2026-10-23): form tiếp nhận, Sửa hồ sơ hiện thông tin tài khoản; trẻ ngoài phạm vi chỉ đếm. */
  async findParentAccountByCitizenId(idNumber, user) {
    await delay(120);
    if (!canLookupParentAccounts(user)) forbid();
    const db = ensureSeeded();
    const acc = accountByCitizenId(db, idNumber);
    if (!acc) return null;
    const linked = db.children.filter((c) => acc.childIds.includes(c.id) && c.status !== CHILD_STATUS.LEFT);
    const visible = linked.filter((c) => canViewChild(c, user, classOf(db, c)));
    return {
      id: acc.id,
      fullName: acc.fullName,
      phone: acc.phone,
      idNumber: acc.idNumber,
      email: acc.email || '',
      status: acc.status,
      children: visible.map((c) => ({ id: c.id, code: c.code, fullName: c.fullName, className: classOf(db, c)?.name || '' })),
      otherChildrenCount: linked.length - visible.length,
      // Quan hệ ghi ở hồ sơ anh/chị, chỉ để gợi ý khi chọn quan hệ với trẻ mới.
      relation: linked.flatMap((c) => c.guardians || []).find((g) => normalizePhone(g.phone) === acc.phone)?.relation || '',
    };
  },

  /** Phụ huynh trên hồ sơ trẻ trong phạm vi, kèm trạng thái tài khoản (bảng tổng quan PHT đếm phụ huynh chưa kích hoạt). */
  async listParentAccounts(filters = {}, user) {
    await delay(150);
    if (!canViewParentAccounts(user)) forbid();
    const db = ensureSeeded();
    const kw = normalizeText(filters.keyword).trim();
    return db.children
      .filter((c) => c.status !== CHILD_STATUS.LEFT && canViewChild(c, user, classOf(db, c)))
      .flatMap((c) =>
        (c.guardians || []).map((g, index) => ({
          key: `${c.id}_${index}`,
          childId: c.id,
          childCode: c.code,
          childName: c.fullName,
          campusId: c.campusId,
          className: classOf(db, c)?.name || '',
          guardianIndex: index,
          guardian: clone(g),
          username: accountByPhone(db, g.phone)?.username || '',
        })),
      )
      .filter((r) => !filters.status || r.guardian.accountStatus === filters.status)
      .filter((r) => !kw || normalizeText(`${r.childName} ${r.childCode} ${r.guardian.fullName} ${r.guardian.phone}`).includes(kw));
  },

  /* ------------------------------ #33 Child health record ------------------------------ */
  async getHealthRecord(childId, user) {
    await delay(150);
    const db = ensureSeeded();
    const child = assertView(db, childId, user, canViewHealth);
    const measurements = db.healthMeasurements
      .filter((m) => m.childId === childId && !isExamDraft(m))
      .sort((a, b) => b.date.localeCompare(a.date))
      .map((m) => toMeasurementView(db, m));
    const decl = declarationOf(db, childId);
    const open = db.healthCheckCampaigns.find((c) => c.campusId === child.campusId && isOpenForEntry(c));
    const openResult = open ? db.healthMeasurements.find((m) => m.childId === childId && m.campaignId === open.id) : null;
    const followUps = db.healthFollowUps.filter((f) => f.childId === childId);
    const followUp = followUps.find((f) => !f.closedAt);
    return {
      child: toView(db, child, user),
      cls: clone(classOf(db, child)),
      declaration: clone(decl),
      measurements,
      rules: { headCircumferenceUntil: headCircumferenceUntil(child.dateOfBirth) },
      openCampaign: open
        ? {
            id: open.id,
            kind: campaignKindOf(open),
            name: open.name,
            startDate: open.startDate,
            endDate: open.endDate,
            resultMeasurementId: openResult?.id || null,
            // Đợt khám: DRAFT đang khám · CONCLUDED đã có kết luận · LEGACY nhập theo mẫu cũ. Kỳ cân đo: RECORDED đã cân đo.
            resultStatus: !openResult
              ? null
              : campaignKindOf(open) === CAMPAIGN_KIND.MEASUREMENT
                ? 'RECORDED'
                : openResult.examStatus || 'LEGACY',
          }
        : null,
      openFollowUp: followUp ? followUpBrief(followUp) : null,
      // Lời bác sĩ chuyên khoa phụ huynh báo lại, từ mọi phiếu của trẻ, mới nhất trước (user chốt 2026-10-16).
      externalResults: followUps
        .flatMap((f) =>
          f.history
            .filter((e) => e.action === 'EXTERNAL_RESULT')
            .map((e) => ({
              followUpId: f.id,
              on: e.on,
              note: e.note,
              facility: e.facility || '',
              images: e.images || [],
              nextVisitOn: e.nextVisitOn || null,
              byName: userName(db, e.userId),
              at: e.at,
            })),
        )
        .sort((a, b) => b.on.localeCompare(a.on) || b.at.localeCompare(a.at)),
    };
  },

  /* ------------------------------ #34 Health measurement form ------------------------------ */
  async saveMeasurement(childId, measurementId, payload, user) {
    await delay();
    const db = ensureSeeded();
    const child = findChild(db, childId);
    if (!canRecordMeasurement(child, user, classOf(db, child))) forbid();
    const existing = measurementId ? db.healthMeasurements.find((m) => m.id === measurementId && m.childId === childId) : null;
    if (measurementId && !existing) throw new ApiError(404, 'Không tìm thấy lần đo này.');
    // Kết quả trong đợt khám nhập bằng phiếu Phụ lục II (user chốt 2026-10-17). API này: số đo của kỳ cân đo, sửa số đo cũ
    // ngoài đợt và mẫu cũ. Tạo mới chỉ trong kỳ cân đo đang diễn ra của điểm trường (user chốt 2026-10-31).
    if (existing?.exam) throw new ApiError(409, 'Kết quả này là phiếu khám. Sửa ở trang phiếu khám của đợt.');
    const campaignId = existing ? (existing.campaignId ?? null) : payload.campaignId || null;
    const campaign = campaignId ? db.healthCheckCampaigns.find((c) => c.id === campaignId) : null;
    if (!existing) {
      const isRound = campaign && campaign.campusId === child.campusId && campaignKindOf(campaign) === CAMPAIGN_KIND.MEASUREMENT;
      if (!isRound) invalid({ campaignId: 'Chỉ nhập số đo trong kỳ cân đo của điểm trường. Kết quả đợt khám nhập bằng phiếu khám.' });
      if (db.healthMeasurements.some((m) => m.childId === childId && m.campaignId === campaignId))
        invalid({ campaignId: 'Trẻ đã có số đo trong kỳ này. Sửa lần đo đã có thay vì tạo mới.' });
    }
    if (campaignId && !campaign) throw new ApiError(404, 'Không tìm thấy đợt khám hoặc kỳ cân đo.');
    if (campaign && campaign.campusId !== child.campusId) forbid();
    if (campaign && !isOpenForEntry(campaign))
      throw new ApiError(
        409,
        campaignStatusOf(campaign) === CAMPAIGN_STATUS.CLOSED
          ? 'Đợt/kỳ đã đóng. Hiệu trưởng hoặc Phó hiệu trưởng mở lại nếu cần sửa kết quả.'
          : 'Đợt/kỳ chưa bắt đầu hoặc đã hủy, chưa nhập được kết quả.',
      );
    const until = headCircumferenceUntil(child.dateOfBirth);
    // GBR-GEN-06: a published (confirmed) result needs a reason to change.
    const errors = validateMeasurement(payload, {
      dateOfBirth: child.dateOfBirth,
      requireReason: !!existing?.published,
      headCircumferenceUntil: until,
    });
    if (!errors.date && campaign && (payload.date < campaign.startDate || payload.date > campaign.endDate))
      errors.date = 'Chọn ngày đo trong khoảng ngày của đợt/kỳ';
    if (hasErrors(errors)) invalid(errors);
    if (db.healthMeasurements.some((m) => m.childId === childId && m.date === payload.date && m.id !== measurementId))
      invalid({ date: 'Ngày này đã có kết quả đo. Sửa lần đo đã có thay vì tạo mới.' });
    return writeDb((d) => {
      const round1 = (v) => Math.round(Number(v) * 10) / 10;
      const hasHead = payload.date <= until && payload.headCircumferenceCm !== '' && payload.headCircumferenceCm != null;
      // Đánh giá vận động của mẫu cũ giữ nguyên khi sửa số đo.
      const values = {
        date: payload.date,
        heightCm: round1(payload.heightCm),
        weightKg: round1(payload.weightKg),
        headCircumferenceCm: hasHead ? round1(payload.headCircumferenceCm) : null,
        note: (payload.note || '').trim(),
      };
      if (!existing) {
        const created = {
          id: uid('hm'),
          childId,
          ...values,
          grossMotor: null,
          fineMotor: null,
          exam: null,
          examStatus: null,
          campaignId,
          measuredBy: user.id,
          // Mọi kết quả công bố cho phụ huynh ngay khi lưu (user chốt 2026-10-23).
          published: true,
          publishedAt: nowIso(),
          publishedBy: user.id,
          createdAt: nowIso(),
          edits: [],
        };
        d.healthMeasurements.push(created);
        trackFollowUp(d, child, created, toMeasurementView(d, created).followUpLevel, user);
        return toMeasurementView(d, created);
      }
      const target = d.healthMeasurements.find((m) => m.id === measurementId);
      const changes = Object.keys(values)
        .filter((k) => (target[k] ?? null) !== values[k])
        .map((k) => ({ field: k, label: MEASUREMENT_FIELD_LABELS[k], from: target[k] ?? null, to: values[k] }));
      if (changes.length === 0) return toMeasurementView(d, target);
      // GBR-HLT-03: lưu ai sửa, lúc nào, giá trị cũ và mới. Lưu là công bố lại bản mới; BE gửi phụ huynh thông báo cập nhật (2026-10-23).
      target.edits = [...(target.edits || []), { at: nowIso(), userId: user.id, reason: (payload.reason || '').trim(), changes }];
      Object.assign(target, values, { published: true, publishedAt: nowIso(), publishedBy: user.id });
      trackFollowUp(d, child, target, toMeasurementView(d, target).followUpLevel, user);
      return toMeasurementView(d, target);
    });
  },

  /* ------------------------------ #35 Health trend (AI) ------------------------------ */
  async analyzeHealthTrend(childId, user) {
    await delay(900);
    const db = ensureSeeded();
    const child = assertView(db, childId, user, canViewHealth);
    const history = db.healthMeasurements
      .filter((m) => m.childId === childId && !isExamDraft(m))
      .sort((a, b) => a.date.localeCompare(b.date))
      .map((m) => toMeasurementView(db, m));
    if (history.length < 2) return { status: AI_TREND_STATUS.NOT_ENOUGH_DATA, warnings: [], summary: '' };
    // Demo: children whose code ends in 5 simulate an AI outage (MSG30 path).
    if (/5$/.test(child.code)) throw new ApiError(503, 'Không dùng được trợ lý AI. Bạn vẫn xem được số đo và kết luận khám.');
    // GBR-AI-05: chỉ gửi mã nội bộ và số đo, không gửi tên/liên hệ. Không gửi phát triển, khám lâm sàng, kết luận
    // để AI không viết lời chẩn đoán (HLT-04, user chốt 2026-10-17).
    const aiInput = {
      ref: child.code,
      sex: child.gender,
      points: history.map(({ date, heightCm, weightKg, headCircumferenceCm, bmi }) => ({
        date,
        heightCm,
        weightKg,
        headCircumferenceCm,
        bmi,
      })),
    };
    const result = fakeTrendModel(aiInput);
    writeDb((d) => {
      d.healthTrendDrafts.push({
        id: uid('ai'),
        childId,
        sourceMeasurementIds: history.map((m) => m.id),
        ...result,
        createdAt: nowIso(),
        requestedBy: user.id,
      });
    });
    return { status: AI_TREND_STATUS.OK, draft: true, generatedAt: nowIso(), ...result };
  },
};

/** Fake AI: describes recorded changes only – no diagnosis, no treatment advice (GBR-AI-03). */
const fakeTrendModel = ({ points }) => {
  const last = points[points.length - 1];
  const prev = points[points.length - 2];
  const num = (n) => n.toLocaleString('vi-VN', { maximumFractionDigits: 1 });
  const months = Math.max(1, Math.round((new Date(last.date) - new Date(prev.date)) / (30.4 * 86400000)));
  const dw = Math.round((last.weightKg - prev.weightKg) * 10) / 10;
  const dh = Math.round((last.heightCm - prev.heightCm) * 10) / 10;
  const warnings = [];
  if (dw < 0)
    warnings.push({
      level: 'warning',
      text: `Cân nặng giảm ${num(Math.abs(dw))} kg so với lần đo trước (${months} tháng). Nên đo lại ở lần khám tiếp theo.`,
    });
  else if (dw / months < 0.1)
    warnings.push({ level: 'warning', text: `Cân nặng tăng chậm: +${num(dw)} kg trong ${months} tháng. Nên tiếp tục theo dõi.` });
  if (dh <= 0) warnings.push({ level: 'info', text: 'Chiều cao không thay đổi so với lần đo trước. Có thể kiểm tra lại cách đo.' });
  if (last.headCircumferenceCm != null && prev.headCircumferenceCm != null && last.headCircumferenceCm < prev.headCircumferenceCm)
    warnings.push({ level: 'info', text: 'Vòng đầu nhỏ hơn lần đo trước. Có thể kiểm tra lại cách đo ở lần khám tiếp theo.' });
  if (last.bmi != null && prev.bmi != null && Math.abs(last.bmi - prev.bmi) >= 1.5)
    warnings.push({
      level: 'info',
      text: `Chỉ số BMI thay đổi ${num(Math.abs(last.bmi - prev.bmi))} so với lần đo trước. Nên xem cùng tình trạng dinh dưỡng bác sĩ ghi ở lần khám.`,
    });
  const summary =
    warnings.length === 0
      ? `Chiều cao (+${num(dh)} cm) và cân nặng (+${num(dw)} kg) tăng đều qua ${points.length} lần đo, không thấy thay đổi bất thường.`
      : `Có ${warnings.length} điểm cần chú ý trong ${points.length} lần đo gần đây.`;
  return { summary, warnings };
};
