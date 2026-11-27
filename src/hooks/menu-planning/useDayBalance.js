import { useAuth } from '@/contexts/AuthContext';
import { useAsync } from '@/hooks/useAsync';
import { dayBalanceApi } from '@/services/dayBalanceApi';

/** Bản cân đối của một ngày; màn đang nhập nên không tự nạp lại khi dữ liệu nơi khác đổi. */
export function useDayBalance(date, round) {
  const { user } = useAuth();
  return useAsync(() => dayBalanceApi.getBalance(date, round), [user?.id, date, round], {
    enabled: !!date && !!user,
    refreshOnDataChange: false,
  });
}

/** Trạng thái cân đối các ngày trong tuần; không đọc được thì tab ngày chỉ hiện ngày. */
export function useDayBalanceStatuses(from, to) {
  const { user } = useAuth();
  const { data, ...rest } = useAsync(() => dayBalanceApi.getStatuses(from, to).catch(() => []), [user?.id, from, to], {
    enabled: !!from && !!to && !!user,
  });
  return { statuses: data || [], ...rest };
}
