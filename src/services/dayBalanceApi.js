import { beClient } from '@/services/http/beClient';

/*
 * Cân đối khẩu phần theo ngày trên BE `/nutrition/day-balances`: dựng từ công thức món, tính thử (làm tròn, chấm lượng,
 * chất, tiền) và lưu. Mọi con số dẫn xuất do BE tính.
 */
const withDefaults = (balance) => ({
  ...balance,
  campuses: balance?.campuses || [],
  ageGroups: balance?.ageGroups || [],
  counts: balance?.counts || [],
  lines: balance?.lines || [],
  foods: balance?.foods || [],
  groups: balance?.groups || [],
  summary: balance?.summary || [],
});

/** Factory để test thay client HTTP. */
export const createDayBalanceApi = ({ client = beClient } = {}) => ({
  /** Trạng thái từng ngày học: [{ date, dayOff, saved, stale, passed, problems }]. */
  async getStatuses(from, to) {
    return (await client.get('/nutrition/day-balances', { params: { from, to } })) || [];
  },

  async getBalance(date, round) {
    return withDefaults(await client.get(`/nutrition/day-balances/${date}`, { params: { round } }));
  },

  async preview(date, round, body) {
    return withDefaults(await client.post(`/nutrition/day-balances/${date}/preview`, body, { params: { round } }));
  },

  async save(date, round, body) {
    return withDefaults(await client.put(`/nutrition/day-balances/${date}`, body, { params: { round } }));
  },
});

export const dayBalanceApi = createDayBalanceApi();
