import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { OverrideWizardModal } from '@/components/permissions/OverrideWizardModal';

const PermissionGrantContext = createContext({ openPermissionGrant: () => {} });

/**
 * Chủ chứa hộp "Gán quyền ngoại lệ": màn nào cũng mở được tại chỗ (vd. thẻ Phó hiệu trưởng)
 * mà không import code của module phân quyền. staff cần userId, fullName, role.
 */
export function PermissionGrantProvider({ children }) {
  const [request, setRequest] = useState(null); // { staff, onSaved }
  const location = useLocation();

  const openPermissionGrant = useCallback((staff, onSaved) => setRequest({ staff, onSaved }), []);
  const close = useCallback(() => setRequest(null), []);
  const value = useMemo(() => ({ openPermissionGrant }), [openPermissionGrant]);

  // Đổi trang (nút Back của trình duyệt…) thì đóng hộp, tránh hộp treo trên màn không liên quan
  useEffect(() => {
    setRequest(null);
  }, [location.pathname]);

  return (
    <PermissionGrantContext.Provider value={value}>
      {children}
      {request && <OverrideWizardModal open initialStaff={request.staff} onClose={close} onSaved={request.onSaved} />}
    </PermissionGrantContext.Provider>
  );
}

export function usePermissionGrant() {
  return useContext(PermissionGrantContext);
}
