import { useSchoolYear } from '@/contexts/SchoolYearContext';

/**
 * Cờ khóa ghi của màn trẻ, sức khỏe theo năm học ở header: năm đã kết thúc (CFG-YR-01) hoặc năm sắp diễn ra chưa tới ngày
 * mở chuẩn bị (CHD-12). `useSchoolYear().yearLocked` chỉ xét CHD-12.
 */
export function useChildYearLock() {
  const { yearLocked, yearReadOnly } = useSchoolYear();
  return !!(yearLocked || yearReadOnly);
}
