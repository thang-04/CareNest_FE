import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { DEFAULT_SCHOOL_YEAR, SCHOOL_YEARS } from '@/config/app';
import { useAuth } from '@/contexts/AuthContext';
import { getSchoolYears } from '@/services/school-config/schoolConfigService';
import { DB_CHANGED_EVENT } from '@/mocks/dbEvents';

const SchoolYearContext = createContext(null);

const toOption = (y) => ({ id: y.id, label: (y.name || y.id).replace('-', ' - '), status: y.status });

/**
 * Current school year chosen in the header, shared by every page.
 * Use: const { schoolYear, setSchoolYear, schoolYears } = useSchoolYear();
 * The list comes from school configuration (#16); the static list in config/app.js is the fallback.
 */
export function SchoolYearProvider({ children }) {
  const { user } = useAuth();
  const [schoolYears, setSchoolYears] = useState(SCHOOL_YEARS);
  const [schoolYear, setChosenYear] = useState(DEFAULT_SCHOOL_YEAR);
  // Người dùng tự chọn năm ở header thì giữ; chưa chọn thì luôn theo năm đang hoạt động (kể cả sau khi chuyển năm)
  const picked = useRef(false);
  const setSchoolYear = useCallback((id) => {
    picked.current = true;
    setChosenYear(id);
  }, []);

  useEffect(() => {
    if (!user) return undefined;
    let alive = true;
    const load = () =>
      getSchoolYears(user)
        .then((list) => {
          if (!alive || !list?.length) return;
          const options = list.map(toOption);
          setSchoolYears(options);
          const active = (options.find((o) => o.status === 'ACTIVE') || options[0]).id;
          setChosenYear((current) => (picked.current && options.some((o) => o.id === current) ? current : active));
        })
        .catch(() => {
          /* role without access to the configuration: keep the static list */
        });
    load();
    window.addEventListener(DB_CHANGED_EVENT, load);
    return () => {
      alive = false;
      window.removeEventListener(DB_CHANGED_EVENT, load);
    };
  }, [user]);

  const value = useMemo(() => ({ schoolYear, setSchoolYear, schoolYears }), [schoolYear, setSchoolYear, schoolYears]);
  return <SchoolYearContext.Provider value={value}>{children}</SchoolYearContext.Provider>;
}

export const useSchoolYear = () => useContext(SchoolYearContext);
