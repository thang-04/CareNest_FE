import { useCallback, useEffect, useRef, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useAsync } from '@/hooks/useAsync';
import {
  getChildDetail,
  getChildren,
  getHealthRecord,
  findParentAccountByCitizenId,
  getParentAccounts,
  getPlacementClasses,
} from '@/services/children/childrenService';
import { isValidCitizenId, normalizeCitizenId } from '@/utils/citizenId';

/** Children in the user's scope. filters: { keyword, campusId, classId, status, schoolYear } */
export function useChildRecords(filters = {}) {
  const { user } = useAuth();
  const key = JSON.stringify(filters);
  const { data, loading, error, reload } = useAsync(() => getChildren(filters, user), [key, user?.id], { refreshOnDataChange: true });
  return { children: data || [], loading, error, reload };
}

/** Profile bundle { child, cls, declaration, placements }. live=false on editing pages. */
export function useChildDetail(id, { live = true } = {}) {
  const { user } = useAuth();
  const { data, loading, error, reload } = useAsync(() => getChildDetail(id, user), [id, user?.id], {
    refreshOnDataChange: live,
    enabled: !!id,
  });
  return { detail: data, loading, error, reload };
}

/** Lớp tiếp nhận, xếp lớp được (kèm sĩ số hiện tại): BE chỉ trả lớp của năm học đang hoạt động (user chốt 2026-10-28, Y-3). */
export function usePlacementClasses() {
  const { user } = useAuth();
  const { data, loading, error, reload } = useAsync(() => getPlacementClasses({}, user), [user?.id], {
    refreshOnDataChange: true,
  });
  return { classes: data || [], loading, error, reload };
}

export function useParentAccounts(filters = {}) {
  const { user } = useAuth();
  const key = JSON.stringify(filters);
  const { data, loading, error, reload } = useAsync(() => getParentAccounts(filters, user), [key, user?.id], { refreshOnDataChange: true });
  return { rows: data || [], loading, error, reload };
}

/**
 * Tài khoản phụ huynh theo CCCD của từng ô phụ huynh (user chốt 2026-10-23): tra khi CCCD đủ 12 chữ số, nhớ kết quả theo số.
 * Trả hàm accountOf(idNumber) → tài khoản | null (không có / chưa tra xong). BE vẫn tự liên kết theo CCCD khi lưu.
 */
export function useCitizenIdAccounts(idNumbers, { enabled = true } = {}) {
  const { user } = useAuth();
  const [found, setFound] = useState({});
  const pending = useRef(new Set());
  const ids = [...new Set(idNumbers.map(normalizeCitizenId).filter(isValidCitizenId))];
  const key = ids.join(',');
  useEffect(() => {
    if (!enabled) return;
    key
      .split(',')
      .filter((id) => id && !(id in found) && !pending.current.has(id))
      .forEach((id) => {
        pending.current.add(id);
        findParentAccountByCitizenId(id, user)
          // Không tra được thì coi như chưa có tài khoản; BE kiểm lại khi lưu.
          .catch(() => null)
          .then((acc) => {
            pending.current.delete(id);
            setFound((f) => ({ ...f, [id]: acc }));
          });
      });
  }, [key, enabled, found, user]);
  return useCallback((idNumber) => found[normalizeCitizenId(idNumber)] || null, [found]);
}

/** Health record bundle { child, cls, declaration, measurements (newest first) }. */
export function useHealthRecord(childId, { live = true } = {}) {
  const { user } = useAuth();
  const { data, loading, error, reload } = useAsync(() => getHealthRecord(childId, user), [childId, user?.id], {
    refreshOnDataChange: live,
    enabled: !!childId,
  });
  return { record: data, loading, error, reload };
}
