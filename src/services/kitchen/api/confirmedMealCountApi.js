import { beClient } from '@/services/http/beClient';

/*
 * Sổ báo ăn đã xác nhận (/kitchen/meal-count) đọc BE thật GET /meal-counts: đúng số bếp sẽ dùng (BE NUT-03), HT/PHT
 * xem trên Web vì bếp chỉ dùng App (BE AUTH-21). Đổi dạng BE sang dạng màn bếp; thực đơn, món dị ứng chưa có BE ⇒ để trống.
 */
const toSession = (count) => {
  const confirmed = count.status === 'CONFIRMED';
  return {
    session: count.session,
    hasMenu: true,
    // OPEN = BE tạm tính trước giờ chốt, chưa có sổ
    status: count.status === 'OPEN' ? 'NONE' : count.status,
    confirmedAt: count.confirmedAt,
    changedAt: confirmed ? count.confirmedAt : null,
    classes: confirmed
      ? count.classes.map(({ classId, className, normal, substitute }) => ({ classId, className, normal, substitute, affectedDishes: [] }))
      : [],
    totals: confirmed ? { normal: count.totals.normal, substitute: count.totals.substitute } : null,
    adjustments: confirmed ? count.adjustments : [],
    warnings: [],
  };
};

export const confirmedMealCountApi = {
  getConfirmedMealCount: async ({ campusId, date }) => {
    const day = await beClient.get('/meal-counts', { params: { date } });
    return (day?.counts || []).filter((count) => String(count.campusId) === String(campusId)).map(toSession);
  },
};
