import { useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useAsync } from '@/hooks/useAsync';
import { useMasterData } from '@/hooks/useMasterData';
import { dryStockApi } from '@/services/dryStockApi';
import { nutritionCatalogApi } from '@/services/nutritionCatalogApi';
import { PERMISSIONS } from '@/models/bePermissions';
import { hasBePermission } from '@/utils/bePermissions';

/** Hiện nút "Lập phiếu nhập" (chỉ ẩn/hiện; BE vẫn từ chối 403 khi không có quyền kho ở điểm trường đó). */
export function useCanManageStock() {
  const { user } = useAuth();
  return hasBePermission(user, PERMISSIONS.STOCK_MANAGE);
}

/**
 * Điểm trường đang xem ở các màn kho khô, lưu trên URL (?campusId=) để đổi tab hay mở từ "Bán trú hôm nay" vẫn giữ.
 * Danh sách điểm trường do hệ thống trả cho tài khoản; mặc định theo điểm trường của tài khoản, không có thì điểm đầu tiên.
 */
export function useStockCampus() {
  const { user } = useAuth();
  const md = useMasterData();
  const [params, setParams] = useSearchParams();
  const ids = md.campuses.map((c) => String(c.id));
  const campusId = [params.get('campusId'), user?.campusId].map((id) => String(id ?? '')).find((id) => ids.includes(id)) || ids[0] || '';
  const setCampusId = useCallback(
    (id) =>
      setParams(
        (prev) => {
          const next = new URLSearchParams(prev);
          next.set('campusId', id);
          return next;
        },
        { replace: true },
      ),
    [setParams],
  );
  return { campusId, setCampusId, campuses: md.campuses, canPick: ids.length > 1, loading: md.loading, error: md.error, reload: md.reload };
}

// Gắn user vào deps để đổi tài khoản thì nạp lại; `enabled` chờ đủ tham số bắt buộc (điểm trường, id)
const useStockQuery = (loader, deps, enabled = true) => {
  const { user } = useAuth();
  return useAsync(loader, [user?.id, ...deps], { enabled: enabled && !!user });
};

export const useReceipts = ({ campusId, from, to, status }) =>
  useStockQuery(() => dryStockApi.listReceipts({ campusId, from, to, status }), [campusId, from, to, status], !!campusId);

export const useReceipt = (id) => useStockQuery(() => dryStockApi.getReceipt(id), [id], !!id);

export const useLots = ({ campusId, foodId, includeEmpty }) =>
  useStockQuery(() => dryStockApi.listLots({ campusId, foodId, includeEmpty }), [campusId, foodId, includeEmpty], !!campusId);

export const useMovements = ({ campusId, from, to, foodId, type, page, size }) =>
  useStockQuery(
    () => dryStockApi.listMovements({ campusId, from, to, foodId, type, page, size }),
    [campusId, from, to, foodId, type, page, size],
    !!campusId,
  );

export const useShortfalls = (campusId) => useStockQuery(() => dryStockApi.listShortfalls({ campusId }), [campusId], !!campusId);

/** Thực phẩm bảo quản khô của danh mục (kho khô chỉ có loại này); BE kiểm tra lại khi lưu phiếu. */
export function useDryFoods() {
  const { data, ...rest } = useStockQuery(async () => (await nutritionCatalogApi.listFoods()).filter((f) => f.storage === 'DRY'), []);
  return { foods: data || [], ...rest };
}

export function useActiveSuppliers() {
  const { data, ...rest } = useStockQuery(() => nutritionCatalogApi.getSuppliers({ status: 'ACTIVE' }), []);
  return { suppliers: data || [], ...rest };
}
