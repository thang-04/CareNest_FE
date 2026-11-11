import { useAuth } from '@/contexts/AuthContext';
import { useAsync } from '@/hooks/useAsync';
import { freshGoodsApi } from '@/services/freshGoodsApi';
import { isIsoDate } from '@/utils/format';

// Gắn user vào deps để đổi tài khoản thì nạp lại; `enabled` chờ đủ tham số bắt buộc
const useFreshQuery = (loader, deps, enabled = true) => {
  const { user } = useAuth();
  return useAsync(loader, [user?.id, ...deps], { enabled: enabled && !!user });
};

export const useFreshForecasts = (campusId) => useFreshQuery(() => freshGoodsApi.listForecasts({ campusId }), [campusId], !!campusId);

export const useFreshForecast = (id) => useFreshQuery(() => freshGoodsApi.getForecast(id), [id], !!id);

export const useFreshCheck = (campusId, date) =>
  useFreshQuery(() => freshGoodsApi.getCheck({ campusId, date }), [campusId, date], !!campusId && isIsoDate(date));
