import { useCallback, useEffect, useRef, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useAsync } from '@/hooks/useAsync';
import { DB_CHANGED_EVENT } from '@/mocks/mockDatabase';
import { getAccount, getRoster, getStaffCampuses, getStaffClassrooms, searchAccounts } from '@/services/account/staffService';
import { createRosterRequestGate } from '@/utils/account/rosterRequestGate';

/** Danh sách tài khoản theo phạm vi người xem; page bắt đầu từ 0 (BE PageResponse). */
export function useStaffAccounts({ role, status, campusId, q, staffOnly = false, page = 0, size = 20 } = {}, { enabled = true } = {}) {
  const { user } = useAuth();
  return useAsync(
    () => searchAccounts({ role, status, campusId, q, staffOnly, page, size }, user),
    [role, status, campusId, q, staffOnly, page, size, user?.id],
    { refreshOnDataChange: true, enabled: !!user && enabled },
  );
}

export function useStaffAccount(userId, { live = true } = {}) {
  const { user } = useAuth();
  return useAsync(() => getAccount(userId, user), [userId, user?.id], { refreshOnDataChange: live, enabled: !!user && !!userId });
}

export function useStaffRoster(campusId) {
  const { user } = useAuth();
  const gate = useRef(null);
  if (!gate.current) gate.current = createRosterRequestGate(getRoster);
  const [state, setState] = useState({ data: null, loading: !!campusId, error: null });
  const reload = useCallback(
    async ({ silent = false } = {}) => {
      if (!user || !campusId) {
        gate.current.cancel();
        setState({ data: null, loading: false, error: null });
        return;
      }
      setState((previous) => ({ data: silent ? previous.data : null, loading: !silent, error: null }));
      await gate.current.run(
        campusId,
        user,
        (data) => setState({ data, loading: false, error: null }),
        (error) => setState({ data: null, loading: false, error }),
      );
    },
    [campusId, user],
  );

  useEffect(() => {
    reload();
    return () => gate.current.cancel();
  }, [reload]);

  useEffect(() => {
    const refresh = () => reload({ silent: true });
    window.addEventListener(DB_CHANGED_EVENT, refresh);
    window.addEventListener('storage', refresh);
    return () => {
      window.removeEventListener(DB_CHANGED_EVENT, refresh);
      window.removeEventListener('storage', refresh);
    };
  }, [reload]);

  return { ...state, reload };
}

export function useStaffCampuses() {
  const { user } = useAuth();
  return useAsync(() => getStaffCampuses(user), [user?.id], { enabled: !!user });
}

export function useStaffClassrooms(campusId) {
  const { user } = useAuth();
  return useAsync(() => getStaffClassrooms(campusId, user), [campusId, user?.id], { enabled: !!user && !!campusId });
}

/** Campus trong phạm vi + lớp năm học hiện tại của các campus đó, để hiển thị tên và chọn phân công. */
export function useStaffStructure({ enabled = true } = {}) {
  const { user } = useAuth();
  const { data, loading, error, reload } = useAsync(
    async () => {
      const campuses = await getStaffCampuses(user);
      const lists = await Promise.all(campuses.map((c) => getStaffClassrooms(c.id, user)));
      return { campuses, classrooms: lists.flat() };
    },
    [user?.id],
    { enabled: !!user && enabled },
  );
  const campuses = data?.campuses || [];
  const classrooms = data?.classrooms || [];
  const campusName = (id) => campuses.find((c) => String(c.id) === String(id))?.name || `Điểm trường #${id}`;
  const classroomName = (id) => classrooms.find((c) => String(c.id) === String(id))?.name || `Lớp #${id}`;
  /** Mô tả phạm vi của một phân công. */
  const describe = (a) =>
    a.staffRole === 'PRINCIPAL' ? 'Toàn trường' : a.classroomId ? classroomName(a.classroomId) : campusName(a.campusId);
  return { campuses, classrooms, campusName, classroomName, describe, loading, error, reload };
}
