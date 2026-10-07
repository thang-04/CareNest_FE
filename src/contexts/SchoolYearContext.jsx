import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { DEFAULT_SCHOOL_YEAR, SCHOOL_YEARS } from '@/config/app';
import { useAuth } from '@/contexts/AuthContext';
import { getSchoolYears } from '@/services/school-config/schoolConfigService';

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
  const [schoolYear, setSchoolYear] = useState(DEFAULT_SCHOOL_YEAR);

  useEffect(() => {
    if (!user) return undefined;
    let alive = true;
    getSchoolYears(user)
      .then((list) => {
        if (!alive || !list?.length) return;
        const options = list.map(toOption);
        setSchoolYears(options);
        // Keep the chosen year if it still exists, otherwise open the active one.
        setSchoolYear((current) =>
          options.some((o) => o.id === current) ? current : (options.find((o) => o.status === 'ACTIVE') || options[0]).id,
        );
      })
      .catch(() => {
        /* role without access to the configuration: keep the static list */
      });
    return () => {
      alive = false;
    };
  }, [user]);

  const value = useMemo(() => ({ schoolYear, setSchoolYear, schoolYears }), [schoolYear, schoolYears]);
  return <SchoolYearContext.Provider value={value}>{children}</SchoolYearContext.Provider>;
}

export const useSchoolYear = () => useContext(SchoolYearContext);
