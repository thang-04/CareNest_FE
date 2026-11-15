import { useEffect, useMemo, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useAsync } from '@/hooks/useAsync';
import { kitchenRecordsApi } from '@/services/kitchenRecordsApi';
import { nutritionCatalogApi } from '@/services/nutritionCatalogApi';
import { isIsoDate } from '@/utils/format';

// Gắn user vào deps để đổi tài khoản thì nạp lại; `enabled` chờ đủ tham số bắt buộc
const useRecordsQuery = (loader, deps, enabled = true) => {
  const { user } = useAuth();
  return useAsync(loader, [user?.id, ...deps], { enabled: enabled && !!user });
};

export const useKitchenDay = (campusId, date) =>
  useRecordsQuery(() => kitchenRecordsApi.getKitchenDay({ campusId, date }), [campusId, date], !!campusId && isIsoDate(date));

export const useFoodSamples = (campusId, from, to) =>
  useRecordsQuery(
    () => kitchenRecordsApi.listSamples({ campusId, from, to }),
    [campusId, from, to],
    !!campusId && isIsoDate(from) && isIsoDate(to) && from <= to,
  );

export const useMealPhotos = (campusId, date) =>
  useRecordsQuery(() => kitchenRecordsApi.listPhotos({ campusId, date }), [campusId, date], !!campusId && isIsoDate(date));

export const useMealPhotoWindows = () => useRecordsQuery(() => kitchenRecordsApi.getWindows(), []);

/**
 * Ảnh bữa tải qua client có token rồi đổi sang object URL cho thẻ img; thu hồi URL khi đổi ảnh hoặc rời màn.
 * Trả { url, loading, error }.
 */
export const useMealPhotoUrl = (photoId) => {
  const [state, setState] = useState({ url: '', loading: !!photoId, error: null });
  useEffect(() => {
    if (!photoId) {
      setState({ url: '', loading: false, error: null });
      return undefined;
    }
    let cancelled = false;
    let objectUrl = '';
    setState({ url: '', loading: true, error: null });
    kitchenRecordsApi
      .getPhotoBlob(photoId)
      .then((blob) => {
        if (cancelled) return;
        objectUrl = URL.createObjectURL(blob);
        setState({ url: objectUrl, loading: false, error: null });
      })
      .catch((error) => {
        if (!cancelled) setState({ url: '', loading: false, error });
      });
    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [photoId]);
  return state;
};

/** Loại món theo id (BE bếp hôm nay không trả loại món) để tô màu và tách hàng; chưa tải được thì Map rỗng. */
export const useDishTypeById = () => {
  const { data } = useRecordsQuery(() => nutritionCatalogApi.listDishes({}), []);
  return useMemo(() => new Map((data || []).map((dish) => [String(dish.id), dish.type])), [data]);
};
