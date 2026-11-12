import { axiosClient } from '@/services/http/axiosClient';

/*
 * Khi nối BE, header năm học (SchoolYearContext qua beClient) dùng tên năm "2026-2027" làm id; adapter gọi bằng axiosClient
 * (module children) phải gửi id số của BE. Bảng tên <-> id đọc từ GET /school-years, giữ trong bộ nhớ, đọc lại khi gặp tên lạ
 * (giống beClient). Giá trị không phải tên năm (id số, rỗng) giữ nguyên.
 */
const YEAR_NAME = /^\d{4}-\d{4}$/;
let years = null;

export async function toBeSchoolYear(value) {
  if (typeof value !== 'string' || !YEAR_NAME.test(value)) return value;
  if (!years?.some((y) => y.name === value)) {
    const list = await axiosClient.get('/school-years');
    years = (Array.isArray(list) ? list : []).map((y) => ({ id: y.id, name: y.name }));
  }
  return years.find((y) => y.name === value)?.id ?? value;
}
