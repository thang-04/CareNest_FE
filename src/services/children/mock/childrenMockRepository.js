import { normalizeRecipients } from '@/utils/children/accountRecipient';
import { readDb, writeDb, clone, delay, ApiError } from '@/mocks/mockDatabase';
import { prepareMockPortraits } from './enrollmentPhotoMock';
import { ensureSchoolSeeded, visibleClasses } from '@/mocks/schoolMockRepository';
import { buildSeedChildRecords, seedChildProfileOf, seedMedicalHistoryOf } from '@/mocks/childrenSeed';
import { PHONE_HAS_OTHER_ID, createBatchIdentityCheck, fillMissingCitizenIds, identityConflict } from '@/mocks/guardianIdentity';
import { MEASUREMENT_ROUND, OPEN_CAMPAIGN, buildSeedHealthChecks } from '@/mocks/healthCheckSeed';
import { pushNotification } from '@/mocks/notificationMockRepository';
import { activatePendingGuardians, applyGuardianEdits, differsFromAccount } from '@/mocks/parentAccountMock';
import { activeYearId } from '@/mocks/roomManagers';
import { schoolYearIdOfDate } from '@/mocks/schoolYearScope';
import { AGE_GROUPS, CHILD_STATUS } from '@/models/School';
import {
  AI_TREND_STATUS,
  DECLARATION_STATE,
  FOLLOW_UP_LEVEL,
  MEASUREMENT_FIELD_LABELS,
  MEASUREMENT_SOURCE,
  PARENT_ACCOUNT_STATUS,
} from '@/models/children/childrenConstants';
import { CAMPAIGN_KIND, CAMPAIGN_STATUS } from '@/models/children/healthCheckConstants';
import { EXAM_STATUS } from '@/models/children/healthExamForm';
import { PERMISSION_SCOPE } from '@/models/school-config/schoolConfigConstants';
import {
  PROFILE_FIELDS,
  PROFILE_FIELD_LABELS,
  emptyChildProfile,
  emptyMedicalHistory,
  formatAddress,
} from '@/models/children/childProfile';
import { isValidCitizenId, normalizeCitizenId } from '@/utils/citizenId';
import { formatDate, normalizeText, todayInput } from '@/utils/format';
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
import {
  isTrendStale,
  normalizeTrendContent,
  renderTrendSummary,
  trendPeriodOf,
  validateTrendContent,
  withinTrendPeriod,
} from '@/utils/children/healthTrend';
import { conclusionBrief, screenMeasurement } from './healthScreeningRule';
import {
  addDays,
  autoCloseReasonOf,
  campaignKindOf,
  campaignStatusOf,
  closeCampaign,
  expiredCampaignsOf,
  isOpenForEntry,
} from './healthCheckRule';
import { readEnrollmentTable, readEnrollmentCsv } from './enrollmentImport';

/*
 * Fake backend of child records & child health. Owns: scope checks (GBR-GEN-01, GBR-GEN-09), enrollment and
 * placement (GBR-CP-01), declarations (GBR-CP-02), allergy confirmation (GBR-HLT-03), parent accounts (UC 3.9),
 * measurements with derived values (BMI và mức BMI theo tuổi HLT-18, mức theo dõi theo bác sĩ HLT-10) and edit log
 * (GBR-HLT-01..03), cảnh báo sức khỏe ở Sổ sức khỏe (HLT-19), and the AI trend draft (GBR-AI-*).
 * Collections: reads/writes db.children; owns db.healthMeasurements, db.healthDeclarations, db.parentAccounts,
 * db.childPlacements, db.healthTrendDrafts; reads db.healthCheckCampaigns (healthCheckMockRepository).
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
// v14: bỏ phiếu theo dõi (HLT-16 bỏ, 2026-11-04); kỳ cân đo c2 có số đo (Lớp Lá A, 2 trẻ Lớp Mầm 1) để thấy cảnh báo BMI (HLT-18).
// v15: kết quả các đợt khám đã đóng là phiếu Phụ lục II đã kết luận như BE (bỏ mẫu cũ có vận động thô/tinh).
// v16, v17: phiếu của đợt cũ ghi tiếp xúc người bệnh lao chỉ khi đã xảy ra trước ngày khám, khi đó bác sĩ kết luận nguy cơ lao.
const HEALTH_SEED_VERSION = 17;
const SEED_MANAGED_FIELDS = ['headCircumferenceCm', 'grossMotor', 'fineMotor', 'campaignId', 'note', 'exam', 'examStatus', 'concludedAt'];

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

/**
 * Số đo seed của kỳ cân đo c2 chỉ thêm vào DB cũ khi kỳ trong DB còn nguyên (đang diễn ra, chưa ai sửa/đóng, chưa có kết quả);
 * khi đó kỳ nhận ngày theo hôm nay như bản seed để số đo seed nằm trong khoảng ngày của kỳ.
 */
const seedRoundReady = (d, seedRound) => {
  const cur = (d.healthCheckCampaigns || []).find((c) => c.id === seedRound.id);
  if (!cur) return true;
  const untouched =
    !cur.closedAt &&
    !cur.cancelledAt &&
    campaignKindOf(cur) === CAMPAIGN_KIND.MEASUREMENT &&
    !(cur.history || []).some((h) => h.action !== 'CREATED') &&
    !d.healthMeasurements.some((m) => m.campaignId === cur.id);
  if (untouched) Object.assign(cur, { name: seedRound.name, startDate: seedRound.startDate, endDate: seedRound.endDate });
  return untouched;
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
 * v2: tuần thai bắt buộc mọi trẻ (2026-11-04) ⇒ tuần thai trống điền 35 (sinh non) hoặc 39.
 */
const PROFILE_FILL_VERSION = 2;
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

/** Seed mọi collection sức khỏe (đo, khai báo, đợt khám, kỳ cân đo). Dùng chung cho repository đợt khám. */
export const ensureChildRecordsSeeded = () => {
  ensureSchoolSeeded();
  let db = readDb();
  const ready =
    db.healthMeasurements &&
    db.healthDeclarations &&
    db.parentAccounts &&
    db.childPlacements &&
    db.healthTrendDrafts &&
    db.healthCheckCampaigns;
  if (!ready || db.healthSeedVersion !== HEALTH_SEED_VERSION) {
    writeDb((d) => {
      const seed = buildSeedChildRecords({ children: d.children, classes: d.classes });
      const upgrading = d.healthSeedVersion !== HEALTH_SEED_VERSION;
      if (d.healthMeasurements && upgrading) {
        const seedRound = buildSeedHealthChecks({ children: d.children }).find((c) => c.id === MEASUREMENT_ROUND.id);
        const roundReady = seedRoundReady(d, seedRound);
        upgradeSeedMeasurements(
          d,
          seed.healthMeasurements.filter((m) => roundReady || m.campaignId !== MEASUREMENT_ROUND.id),
        );
      }
      d.healthMeasurements ||= seed.healthMeasurements;
      // Vắng khám của đợt seed tính trên kết quả đang có trong DB (sau khi nâng cấp).
      const seedCampaigns = buildSeedHealthChecks({ measurements: d.healthMeasurements, children: d.children });
      if (d.healthCheckCampaigns && upgrading) upgradeSeedCampaigns(d, seedCampaigns);
      // Phiếu theo dõi bỏ cùng HLT-16 (2026-11-04): DB demo cũ không giữ collection này.
      delete d.healthFollowUps;
      d.healthSeedVersion = HEALTH_SEED_VERSION;
      d.healthDeclarations ||= seed.healthDeclarations;
      d.parentAccounts ||= seed.parentAccounts;
      d.childPlacements ||= seed.childPlacements;
      d.healthTrendDrafts ||= [];
      d.healthCheckCampaigns ||= seedCampaigns;
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
  // Như việc chạy lúc nửa đêm của BE (HLT-17): đợt khám, kỳ cân đo quá ngày kết thúc tự đóng, trẻ chưa có kết quả thành vắng.
  const expired = expiredCampaignsOf(db);
  if (expired.length === 0) return db;
  writeDb((d) => {
    expired.forEach((campaign) => {
      const target = d.healthCheckCampaigns.find((c) => c.id === campaign.id);
      closeCampaign(d, target, null, autoCloseReasonOf(target));
    });
  });
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

/** Kết quả đã công bố của trẻ, mới nhất trước (phiếu nháp chưa là kết quả). */
const resultsOf = (db, child) =>
  (db.healthMeasurements || [])
    .filter((m) => m.childId === child.id && !isExamDraft(m))
    .sort((a, b) => b.date.localeCompare(a.date))
    .map((m) => ({ m, sc: screenMeasurement(m, child) }));

const campaignNameOf = (db, campaignId) => (campaignId && (db.healthCheckCampaigns || []).find((c) => c.id === campaignId)?.name) || null;

/** Cảnh báo hiện tại theo bác sĩ (HLT-10, HLT-19): lần khám gần nhất có kết luận; null khi chưa có. Số đo của kỳ cân đo không tính. */
const latestExamOf = (db, child) => {
  const found = resultsOf(db, child).find(
    ({ sc }) => sc.source === MEASUREMENT_SOURCE.EXAM && sc.followUpLevel !== FOLLOW_UP_LEVEL.UNAVAILABLE,
  );
  if (!found) return null;
  const { m, sc } = found;
  return {
    measurementId: m.id,
    campaignId: m.campaignId ?? null,
    campaignName: campaignNameOf(db, m.campaignId),
    date: m.date,
    followUpLevel: sc.followUpLevel,
    conclusionCategory: sc.conclusionCategory,
    conclusion: conclusionBrief(m),
  };
};

/** Cảnh báo hiện tại theo BMI (HLT-18, HLT-19): lần đo gần nhất có mức BMI (kỳ cân đo; mock: cả kết quả mẫu cũ); null khi chưa có. */
const latestBmiOf = (db, child) => {
  const found = resultsOf(db, child).find(({ sc }) => sc.bmiStatus);
  if (!found) return null;
  const { m, sc } = found;
  return {
    measurementId: m.id,
    campaignId: m.campaignId ?? null,
    campaignName: campaignNameOf(db, m.campaignId),
    date: m.date,
    ageMonths: sc.ageMonths,
    bmi: sc.bmi,
    bmiStatus: sc.bmiStatus,
    bmiZScore: sc.bmiZScore,
  };
};

/** Khai báo sức khỏe của trẻ; trẻ chưa có khai báo thì tạo phần trống để Chưa cung cấp (ghi tiền sử từ phiếu khám, điền dữ liệu demo). */
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
    if (!acc || !record.guardians[i].accountRecipient) return;
    if (!acc.childIds.includes(record.id)) acc.childIds.push(record.id);
    if (!acc.idNumber) acc.idNumber = record.guardians[i].idNumber;
    record.guardians[i].accountId = acc.id;
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
        : {
            fullName: g.fullName,
            relation: g.relation,
            phone: g.phone,
            idNumber,
            email: g.email,
            ...(g.photoUrl ? { photoUrl: g.photoUrl } : {}),
          };
    }),
    className: cls?.name || '',
    ageGroupId: cls?.ageGroupId || '',
    schoolYear: cls?.schoolYear || '',
    hasDeclaration: !!decl,
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
const batchDuplicateOf = (seen, child) =>
  seen.find(
    (entry) =>
      nameKey(entry.child.fullName) === nameKey(child.fullName) &&
      entry.child.dateOfBirth === child.dateOfBirth &&
      [...citizenIdsOf(entry.child.guardians)].some((id) => citizenIdsOf(child.guardians).has(id)),
  );

const nextCode = (db) => {
  const prefix = `HS${new Date().getFullYear().toString().slice(2)}`;
  const used = new Set(db.children.map((c) => c.code));
  let n = db.children.length + 1;
  while (used.has(`${prefix}${String(n).padStart(3, '0')}`)) n += 1;
  return `${prefix}${String(n).padStart(3, '0')}`;
};

const cleanGuardians = (guardians, previous = []) =>
  normalizeRecipients(guardians).map((g) => {
    // Đổi SĐT vẫn là phụ huynh cũ (nhận theo CCCD) ⇒ giữ trạng thái tài khoản.
    const id = normalizeCitizenId(g.idNumber);
    const old =
      (id && previous.find((p) => normalizeCitizenId(p.idNumber) === id)) ||
      previous.find((p) => normalizePhone(p.phone) === normalizePhone(g.phone));
    return {
      id: old?.id || uid('cg'),
      ...(old?.accountId ? { accountId: old.accountId } : {}),
      accountRecipient: previous.length ? !!old?.accountRecipient || (guardians.length === 1 && previous.length === 1) : g.accountRecipient,
      fullName: g.fullName.trim(),
      relation: g.relation,
      phone: g.phone.trim(),
      idNumber: normalizeCitizenId(g.idNumber),
      email: (g.email || '').trim(),
      ...(g.photoUrl || old?.photoUrl ? { photoUrl: g.photoUrl || old.photoUrl } : {}),
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

/** Hành chính hỏi khi tiếp nhận (dùng cho phiếu khám); ô trống giữ chuỗi rỗng, tuần thai là số và lưu cho mọi trẻ (2026-11-04). */
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
 * (user chốt 2026-10-17; thêm người lưu 2026-10-27); câu báo kèm ngày tiếp xúc gần nhất (2026-10-21). Câu trung tính.
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
    ...(child.photoUrl ? { photoUrl: child.photoUrl } : {}),
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
  (record.guardians || [])
    .filter((g) => g.accountRecipient)
    .map((g) => {
      const same = (r) => normalizePhone(r.phone) === normalizePhone(g.phone);
      const done = activated.find(same);
      const edit = edited.find(same);
      const linked = done || g.accountStatus !== PARENT_ACCOUNT_STATUS.NOT_ACTIVATED;
      const result = done?.newAccount ? 'CREATED' : linked ? 'LINKED' : 'NOT_ACTIVATED';
      // phoneChanged: tài khoản có sẵn đổi tên đăng nhập sang SĐT mới, mật khẩu mới gửi SMS (user chốt 2026-10-28).
      const smsStatus = done?.smsStatus || edit?.smsStatus || null;
      return { fullName: g.fullName, phone: g.phone, result, phoneChanged: !!edit?.phoneChanged, smsStatus };
    });

/** Phiếu khám còn nháp: chưa là kết quả, không hiện ở Sổ sức khỏe, xu hướng, cảnh báo. */
export const isExamDraft = (m) => m.examStatus === EXAM_STATUS.DRAFT;

// Giá trị dẫn xuất (BMI, mức BMI theo tuổi, mức theo dõi) tính lại mỗi lần đọc như BE nên dữ liệu demo cũ vẫn theo rule mới.
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
  const screen = screenMeasurement(fields, child);
  return {
    ...fields,
    ...screen,
    // Kết luận bác sĩ rút gọn như BE (phiếu đã kết luận), cho ô cảnh báo.
    conclusion: conclusionBrief(fields),
    campaignName: campaign?.name || null,
    // EXAM: kết quả của đợt khám (mở phiếu khám) · MEASUREMENT: số đo của kỳ cân đo · null: ngoài đợt.
    campaignKind: campaign ? campaignKindOf(campaign) : null,
    // Như BE: chỉ sửa trong đợt/kỳ đang diễn ra; đợt/kỳ đóng/hủy khóa tới khi HT/PHT mở lại, lần đo cũ ngoài đợt luôn khóa
    // (HLT-01: không cân đo lẻ, user chọn 2026-11-04).
    locked: !campaign || !isOpenForEntry(campaign),
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

  /**
   * Lớp, nhóm tuổi của một năm học cho bộ lọc, gợi ý nhóm tuổi (BE: GET /school-structure). all: PHT xem hồ sơ trẻ toàn
   * trường thấy lớp mọi điểm trường như useClasses({ all }).
   */
  async getClassOptions(schoolYear, user, { all = false } = {}) {
    await delay(80);
    const db = ensureSchoolSeeded();
    const yearId = schoolYear || activeYearId(db);
    const classes = (all ? db.classes || [] : visibleClasses(db, user)).filter((c) => c.schoolYear === yearId);
    return clone({ year: { id: yearId, name: String(yearId).replace('-', ' - '), startDate: null }, ageGroups: AGE_GROUPS, classes });
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
    const guardians = (manageAccounts ? attachAccounts : withAccounts)(db, normalizeRecipients(payload.child?.guardians));
    let resolved = { ...payload, child: { ...payload.child, guardians } };
    const { errors, dup, conflicts } = validateEnrollment(db, resolved);
    if (hasErrors(errors)) invalid(errors);
    if (dup) throw new ApiError(409, 'Hồ sơ trẻ này đã tồn tại (trùng họ tên, ngày sinh và phụ huynh). Xem lại hồ sơ đã có.');
    throwConflicts(conflicts);
    resolved = { ...resolved, child: await prepareMockPortraits(resolved.child) };
    return writeDb((d) => {
      // Lớp không bắt buộc khi tiếp nhận; có lớp thì vẫn kiểm sức chứa và campus, trẻ thuộc điểm trường của lớp.
      const cls = payload.classId ? assertClassAvailable(d, payload.classId, user) : null;
      if (cls && payload.campusId && cls.campusId !== payload.campusId) invalid({ classId: 'Lớp không thuộc điểm trường đã chọn' });
      const campusId = cls?.campusId || enrollCampusOf(d, payload.campusId, user);
      const record = createChild(d, resolved, { classId: cls?.id || null, campusId, user });
      // Tài khoản có sẵn: liên kết ngay khi lưu, không tạo tài khoản mới, không gửi mật khẩu (UC 3.9 nhánh đã có tài khoản).
      linkAccounts(d, record, guardians);
      // Thông tin sửa khác tài khoản có sẵn ⇒ tài khoản đổi theo; làm trước kích hoạt để phụ huynh đổi SĐT không bị coi là người mới.
      const edited = manageAccounts
        ? applyAccountEdits(
            d,
            guardians.filter((g) => g.accountRecipient),
          )
        : [];
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
    const errors = validateChildInfo(child, { requireRecipient: false });
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
      const accountChanges = applyAccountEdits(
        d,
        guardians.filter((g) => d.parentAccounts.some((a) => a.id === g.accountId && a.childIds.includes(id))),
      );
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
    if (/\.xls$/i.test(name)) {
      return {
        supported: false,
        fileName: name,
        message:
          'Bản chạy thử chỉ đọc được file .csv. File Excel (.xlsx) sẽ do máy chủ đọc khi nối backend. Hãy lưu file Excel dưới dạng "CSV UTF-8" rồi tải lên lại.',
        rows: [],
      };
    }
    if (!/\.(csv|xlsx)$/i.test(name))
      invalid({ file: 'Chỉ nhận file .xlsx hoặc .csv theo mẫu của trường' }, 'Định dạng file không được hỗ trợ.');
    const parsed = /\.xlsx$/i.test(name)
      ? readEnrollmentTable(await (await import('read-excel-file/browser')).default(file))
      : readEnrollmentCsv(await file.text());
    const { missingColumns, rows } = parsed;
    if (missingColumns.length) invalid({ file: `Thiếu cột: ${missingColumns.join(', ')}` }, 'File không đúng mẫu tiếp nhận trẻ.');
    if (rows.length === 0) invalid({ file: 'File không có dòng dữ liệu nào' }, 'File không có dữ liệu.');
    if (rows.length > MAX_IMPORT_ROWS) invalid({ file: `Mỗi lần nhập tối đa ${MAX_IMPORT_ROWS} trẻ` }, 'File quá lớn.');
    const db = ensureSeeded();
    const seen = [];
    const inFile = createBatchIdentityCheck();
    const checked = rows.map((raw) => {
      // Dòng có CCCD trùng tài khoản: dùng thông tin tài khoản, khi nhập sẽ liên kết (user chốt 2026-10-23).
      const guardians = withAccounts(db, normalizeRecipients(raw.payload.child.guardians));
      const r = { ...raw, payload: { ...raw.payload, child: { ...raw.payload.child, guardians } } };
      const notes = guardians
        .filter((g) => g.accountId)
        .map(
          (g) =>
            `Phụ huynh đã có tài khoản (trùng CCCD): ${g.fullName} · ${g.phone}. Dùng thông tin tài khoản, chỉ liên kết người được chọn khi kích hoạt sau khi nhập.`,
        );
      const { errors, dup, conflicts } = validateEnrollment(db, r.payload);
      const { accountRecipient: selectionError, ...baseErrors } = errors;
      const messages = [...new Set([...Object.values(baseErrors), ...Object.values(conflicts)])];
      if (dup) messages.push('Trẻ đã có hồ sơ trong hệ thống (trùng họ tên, ngày sinh và phụ huynh)');
      const left = dup ? null : sameChildOf(db, r.payload.child, { left: true });
      if (left)
        notes.push(`Trẻ từng học ở trường (hồ sơ cũ ${left.code}, đã nghỉ học): nên mở lại hồ sơ cũ ở Tiếp nhận trẻ thay vì nhập mới.`);
      const duplicateRow = batchDuplicateOf(seen, r.payload.child);
      if (duplicateRow) messages.push(`Trùng với dòng ${duplicateRow.rowNo} trong file`);
      seen.push({ child: r.payload.child, rowNo: r.rowNo });
      r.payload.child.guardians.forEach((g, index) => {
        const fileIssue = !errors[`guardians.${index}.idNumber`] && !errors[`guardians.${index}.phone`] ? inFile(g, r.rowNo) : null;
        if (fileIssue) messages.push(fileIssue);
      });
      return { ...r, errors: messages, selectionError: selectionError || null, notes };
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
    const seen = [];
    const inFile = createBatchIdentityCheck();
    const resolved = rows.map((r) => ({
      ...r,
      child: { ...r.child, guardians: withAccounts(db, normalizeRecipients(r.child?.guardians)) },
    }));
    resolved.forEach((r, i) => {
      const { errors, dup, conflicts } = validateEnrollment(db, r);
      const duplicateRow = batchDuplicateOf(seen, r.child);
      const fileIssue = (r.child.guardians || []).some((g) => inFile(g, i + 1));
      if (hasErrors(errors) || hasErrors(conflicts) || dup || duplicateRow || fileIssue)
        invalid({ file: 'File có dòng lỗi. Kiểm tra lại trước khi nhập.' });
      seen.push({ child: r.child, rowNo: i + 1 });
    });
    return writeDb((d) => {
      const created = resolved.map((r) => {
        const record = createChild(d, r, { classId: null, campusId: targetCampusId, user });
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
      const cls = classOf(d, target);
      (cls?.teacherIds || []).forEach((teacherId) =>
        pushNotification(d, {
          userId: teacherId,
          type: 'CHILD_WITHDRAWN',
          title: 'Trẻ nghỉ học',
          message: `${target.fullName} nghỉ học từ ngày ${formatDate(leftAt)}.`,
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
    return {
      child: toView(db, child, user),
      cls: clone(classOf(db, child)),
      declaration: clone(decl),
      measurements,
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
      // Cảnh báo hiện tại ở đầu Sổ sức khỏe (HLT-19): kết luận bác sĩ của lần khám gần nhất, mức BMI của lần đo gần nhất.
      latestExam: latestExamOf(db, child),
      latestBmi: latestBmiOf(db, child),
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
    // Kết quả trong đợt khám nhập bằng phiếu Phụ lục II (user chốt 2026-10-17). API này: số đo của kỳ cân đo (cả mẫu cũ của
    // đợt/kỳ còn mở). Tạo mới chỉ trong kỳ cân đo đang diễn ra của điểm trường (user chốt 2026-10-31); lần đo cũ ngoài đợt chỉ
    // xem, như BE (user chọn 2026-11-04).
    if (existing?.exam) throw new ApiError(409, 'Kết quả này là phiếu khám. Sửa ở trang phiếu khám của đợt.');
    if (existing && !existing.campaignId)
      throw new ApiError(409, 'Lần đo không thuộc đợt khám, kỳ cân đo nào nên chỉ xem được, không sửa.');
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
    // GBR-GEN-06: a published (confirmed) result needs a reason to change.
    const errors = validateMeasurement(payload, { requireReason: !!existing?.published });
    if (hasErrors(errors)) invalid(errors);
    // Ngày đo do BE ghi (user chốt 2026-11-04): số đo mới = hôm nay kẹp vào khoảng ngày của kỳ, sửa giữ ngày; request không còn
    // date, headCircumferenceCm. Kỳ cân đo tự đóng sau ngày kết thúc (HLT-17, 2026-11-04) nên phần kẹp chỉ còn là chốt chặn.
    const today = todayInput();
    const date = existing
      ? existing.date
      : today < campaign.startDate
        ? campaign.startDate
        : today > campaign.endDate
          ? campaign.endDate
          : today;
    if (!existing && db.healthMeasurements.some((m) => m.childId === childId && m.date === date))
      throw new ApiError(409, `Ngày đo ${formatDate(date)} trẻ đã có kết quả đo khác. Báo Hiệu trưởng hoặc Phó hiệu trưởng`);
    return writeDb((d) => {
      const round1 = (v) => Math.round(Number(v) * 10) / 10;
      // Kỳ cân đo không đo vòng đầu (HLT-01, 2026-11-04): số đo mới không có; sửa giữ vòng đầu, vận động của dữ liệu cũ.
      const values = {
        heightCm: round1(payload.heightCm),
        weightKg: round1(payload.weightKg),
        note: (payload.note || '').trim(),
      };
      if (!existing) {
        const created = {
          id: uid('hm'),
          childId,
          date,
          ...values,
          headCircumferenceCm: null,
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
      return toMeasurementView(d, target);
    });
  },

  /* ------------------------------ #35 Health trend (AI) ------------------------------ */
  // BE giả của HealthTrendServiceImpl (HLT-02, HLT-05, HLT-21): mỗi lần phân tích lưu một bản nháp; nhân viên đọc bản mới nhất.
  async analyzeHealthTrend(childId, period = 'ALL', user) {
    await delay(900);
    const db = ensureSeeded();
    const child = assertView(db, childId, user, canViewHealth);
    // HLT-21: chỉ lần đo trong khoảng đang chọn trên biểu đồ, tính lùi từ hôm nay
    const history = withinTrendPeriod(trendHistory(db, childId), period);
    if (history.length < 2)
      return { status: AI_TREND_STATUS.NOT_ENOUGH_DATA, period, draft: false, stale: false, warnings: [], summary: '', content: null };
    // Demo: children whose code ends in 5 simulate an AI outage (MSG30 path).
    if (/5$/.test(child.code)) throw new ApiError(503, 'Không dùng được trợ lý AI. Bạn vẫn xem được số đo và kết luận khám.');
    // GBR-AI-05: chỉ gửi số đo, không gửi tên/liên hệ/kết luận khám (HLT-04)
    const { warnings, content } = fakeTrendModel(
      history.map(({ date, heightCm, weightKg }) => ({ date, heightCm, weightKg })),
      period,
    );
    const saved = {
      id: uid('ai'),
      childId,
      period,
      sourceMeasurementIds: history.map((m) => m.id),
      status: 'DRAFT',
      source: 'AI',
      model: 'mock-trend',
      warnings,
      content,
      summary: renderTrendSummary(content),
      createdAt: nowIso(),
      requestedBy: user.id,
      approvedBy: null,
      approvedAt: null,
    };
    writeDb((d) => {
      d.healthTrendDrafts.push(saved);
    });
    return toTrendView(db, saved, false);
  },

  async getLatestHealthTrend(childId, user) {
    await delay(150);
    const db = ensureSeeded();
    assertView(db, childId, user, canViewHealth);
    const latest = latestTrend(db, childId);
    return latest ? toTrendView(db, latest, trendStaleOf(db, latest)) : null;
  },

  async approveHealthTrend(childId, interpretationId, content, user) {
    await delay(300);
    const db = ensureSeeded();
    const child = assertView(db, childId, user, canViewHealth);
    // HLT-21: chỉ GV đang phân công lớp hiện tại của trẻ được sửa, duyệt (cùng điều kiện nhập số đo HLT-09)
    if (!canRecordMeasurement(child, user, classOf(db, child)))
      throw new ApiError(403, 'Chỉ giáo viên phụ trách lớp của trẻ được sửa và duyệt giải thích xu hướng');
    const draft = (db.healthTrendDrafts || []).find((t) => t.id === interpretationId && t.childId === childId);
    if (!draft) throw new ApiError(404, 'Không tìm thấy bản giải thích xu hướng sức khỏe');
    if (draft.status === 'APPROVED') return toTrendView(db, draft, trendStaleOf(db, draft));
    let patch = {};
    if (content) {
      const errors = validateTrendContent(content, draft.warnings);
      if (Object.keys(errors).length) throw new ApiError(400, 'Dữ liệu không hợp lệ', errors);
      const edited = normalizeTrendContent(content);
      // AI-02: nhân sự sửa nội dung ⇒ chịu trách nhiệm nội dung (source HUMAN)
      if (JSON.stringify(edited) !== JSON.stringify(draft.content))
        patch = { content: edited, summary: renderTrendSummary(edited), source: 'HUMAN' };
    }
    let approved;
    writeDb((d) => {
      const target = d.healthTrendDrafts.find((t) => t.id === interpretationId);
      Object.assign(target, patch, { status: 'APPROVED', approvedBy: user.id, approvedAt: nowIso() });
      approved = { ...target };
    });
    return toTrendView(db, approved, trendStaleOf(db, approved));
  },
};

const trendHistory = (db, childId) =>
  db.healthMeasurements
    .filter((m) => m.childId === childId && !isExamDraft(m))
    .sort((a, b) => a.date.localeCompare(b.date))
    .map((m) => toMeasurementView(db, m));

const latestTrend = (db, childId) =>
  (db.healthTrendDrafts || [])
    .filter((t) => t.childId === childId)
    .reduce((latest, t) => (!latest || t.createdAt >= latest.createdAt ? t : latest), null);

// HLT-21: đã có số đo công bố khác lúc phân tích ⇒ cần phân tích lại
const trendStaleOf = (db, t) =>
  isTrendStale(
    t.sourceMeasurementIds,
    withinTrendPeriod(trendHistory(db, t.childId), t.period || 'ALL').map((m) => m.id),
  );

/** Cùng shape HealthTrendAnalysisResponse của BE; bản lưu trước HLT-21 (không có content) giữ summary cũ. */
const toTrendView = (db, t, stale) => ({
  id: t.id,
  status: AI_TREND_STATUS.OK,
  period: t.period || 'ALL',
  draft: t.status !== 'APPROVED',
  stale,
  generatedAt: t.createdAt,
  summary: t.summary,
  content: t.content || null,
  warnings: t.warnings || [],
  source: t.source || 'AI',
  model: t.model || null,
  approvedBy: t.approvedBy || null,
  approvedByName: t.approvedBy ? userName(db, t.approvedBy) : null,
  approvedAt: t.approvedAt || null,
});

/** Fake AI theo luật cảnh báo của BE (HLT-02): chỉ mô tả số đo, không chẩn đoán, không khuyên điều trị (HLT-04, HLT-21). */
const fakeTrendModel = (points, period) => {
  // HLT-21: tổng quan mở đầu bằng khoảng phân tích
  const within = `Trong ${trendPeriodOf(period).phrase}`;
  const last = points[points.length - 1];
  const prev = points[points.length - 2];
  const num = (n) => n.toLocaleString('vi-VN', { maximumFractionDigits: 1 });
  const days = Math.round((new Date(last.date) - new Date(prev.date)) / 86400000);
  const dw = Math.round((last.weightKg - prev.weightKg) * 10) / 10;
  const dh = Math.round((last.heightCm - prev.heightCm) * 10) / 10;
  const warnings = [];
  if (dw <= -0.2)
    warnings.push({ code: 'WEIGHT_DROP', level: 'warning', text: `Cân nặng giảm ${num(Math.abs(dw))} kg so với lần đo trước.` });
  if (dh <= 0 && days >= 90)
    warnings.push({ code: 'HEIGHT_STALL', level: 'warning', text: 'Chiều cao chưa tăng giữa hai lần đo gần nhất.' });
  if (!warnings.length)
    warnings.push({ code: 'NORMAL', level: 'info', text: 'Các chỉ số lần đo gần nhất nằm trong khoảng bình thường theo chuẩn WHO.' });
  const alerts = warnings.filter((w) => w.code !== 'NORMAL');
  const changes = [
    Number.isFinite(dw) && `cân nặng ${dw >= 0 ? 'tăng' : 'giảm'} ${num(Math.abs(dw))} kg`,
    Number.isFinite(dh) && `chiều cao tăng ${num(Math.max(dh, 0))} cm`,
  ].filter(Boolean);
  const content = {
    overview: alerts.length
      ? `${within}, có ${alerts.length} điểm cần chú ý trong ${points.length} lần đo.`
      : // HLT-21: chỉ NORMAL mới viết "trẻ phát triển ổn định" kèm số liệu
        `${within}, trẻ phát triển ổn định${changes.length ? `: so với lần đo trước, ${changes.join(', ')}` : ''}, các chỉ số trong khoảng chuẩn WHO.`,
    attentionPoints: alerts.map((w) => ({ warningCode: w.code, text: w.text })),
    positives: dh > 0 ? [`Chiều cao tăng ${num(dh)} cm so với lần đo trước.`] : [],
    followUps: [
      { type: 'RECHECK_NEXT_ROUND', text: 'Theo dõi tiếp ở kỳ cân đo sau.' },
      ...(alerts.length ? [{ type: 'TALK_TO_PARENT', text: 'Trao đổi với phụ huynh về ăn uống, giấc ngủ ở nhà.' }] : []),
    ],
    limitations: points.length <= 2 ? 'Mới có 2 lần đo, xu hướng chưa chắc chắn.' : null,
  };
  return { warnings, content };
};
