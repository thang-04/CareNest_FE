import { useAuth } from '@/contexts/AuthContext';
import { useAsync } from '@/hooks/useAsync';
import { dayBoardApi } from '@/services/dayBoardApi';

/** "Bán trú hôm nay" của một ngày; `campusId` rỗng = mọi điểm trường tài khoản được xem. */
export const useDayBoard = (date, campusId) => {
  const { user } = useAuth();
  return useAsync(() => dayBoardApi.getDayBoard({ date, campusId }), [user?.id, date, campusId], { enabled: !!date && !!user });
};
