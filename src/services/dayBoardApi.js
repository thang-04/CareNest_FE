import { beClient } from '@/services/http/beClient';

/*
 * "Bán trú hôm nay" trên BE `GET /nutrition/day-board`: trạng thái từng việc của mỗi điểm trường trong một ngày.
 * Hiệu trưởng và Phó hiệu trưởng đọc được; vai trò khác nhận 403. Không tự tính trạng thái ở FE.
 */
const blank = (v) => v === '' || v == null;
const params = (obj) => Object.fromEntries(Object.entries(obj).filter(([, v]) => !blank(v)));

/** Factory để test thay client HTTP. */
export const createDayBoardApi = ({ client = beClient } = {}) => ({
  /** `campusId` bỏ trống = mọi điểm trường mà tài khoản được xem. */
  async getDayBoard({ date, campusId } = {}) {
    const board = await client.get('/nutrition/day-board', { params: params({ date, campusId }) });
    return { ...board, campuses: board?.campuses || [] };
  },
});

export const dayBoardApi = createDayBoardApi();
