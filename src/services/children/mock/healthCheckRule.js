import { pushNotification } from '@/mocks/notificationMockRepository';
import { ROLES } from '@/models/User';
import { FOLLOW_UP_LEVEL } from '@/models/children/childrenConstants';
import { CAMPAIGN_STATUS, FOLLOW_UP_STATUS } from '@/models/children/healthCheckConstants';
import { todayInput } from '@/utils/format';
import { uid } from '@/utils/id';

/*
 * Backend giả: trạng thái đợt khám (user chốt 2026-10-15, PROPOSED — BE sở hữu rule thật).
 * Nhập/sửa kết quả chỉ khi đợt đang diễn ra; đợt đã đóng khóa kết quả tới khi Hiệu trưởng mở lại.
 */
export const campaignStatusOf = (c, today = todayInput()) => {
  if (c.cancelledAt) return CAMPAIGN_STATUS.CANCELLED;
  if (c.closedAt) return CAMPAIGN_STATUS.CLOSED;
  return today < c.startDate ? CAMPAIGN_STATUS.UPCOMING : CAMPAIGN_STATUS.IN_PROGRESS;
};

export const isOpenForEntry = (c) => !!c && campaignStatusOf(c) === CAMPAIGN_STATUS.IN_PROGRESS;

/** Đợt chưa đóng (sắp diễn ra hoặc đang diễn ra) của điểm trường: tối đa 1. */
export const unclosedCampaignOf = (db, campusId, excludeId) =>
  (db.healthCheckCampaigns || []).find((c) => c.campusId === campusId && c.id !== excludeId && !c.closedAt && !c.cancelledAt) || null;

/**
 * Kết quả "Cần theo dõi sát" ⇒ mở phiếu theo dõi; trẻ đã có phiếu chưa đóng thì ghi thêm kết quả vào phiếu đó (1 phiếu mở/trẻ).
 * Sửa số đo làm mức giảm không tự đóng phiếu: giáo viên đóng, ghi lý do (mặc định user duyệt 2026-10-15).
 */
export const trackFollowUp = (d, child, measurement, followUpLevel, user) => {
  if (followUpLevel !== FOLLOW_UP_LEVEL.CLOSE_WATCH) return null;
  d.healthFollowUps ||= [];
  const at = new Date().toISOString();
  const open = d.healthFollowUps.find((f) => f.childId === child.id && f.status !== FOLLOW_UP_STATUS.CLOSED);
  if (open) {
    if (!open.measurementIds.includes(measurement.id)) {
      open.measurementIds.push(measurement.id);
      open.history.push({ at, userId: user.id, action: 'MEASUREMENT_ADDED' });
      open.updatedAt = at;
    }
    return open;
  }
  const created = {
    id: uid('fu'),
    childId: child.id,
    campusId: child.campusId,
    measurementIds: [measurement.id],
    status: FOLLOW_UP_STATUS.WAITING_PARENT_CONTACT,
    openedAt: at,
    updatedAt: at,
    contact: null,
    externalResult: null,
    closeReason: null,
    closedAt: null,
    closedBy: null,
    history: [{ at, userId: user.id, action: 'OPENED' }],
  };
  d.healthFollowUps.push(created);
  (d.users || [])
    .filter((u) => u.role === ROLES.PRINCIPAL || (u.role === ROLES.VICE_PRINCIPAL && u.campusId === child.campusId))
    .forEach((u) =>
      pushNotification(d, {
        userId: u.id,
        type: 'HEALTH_FOLLOW_UP',
        title: 'Trẻ cần theo dõi sát',
        message: `${child.fullName} có kết quả khám ở mức Cần theo dõi sát. Giáo viên lớp sẽ trao đổi với phụ huynh.`,
        link: `/children/health-follow-ups/${created.id}`,
      }),
    );
  return created;
};
