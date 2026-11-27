import { useAsync } from '@/hooks/useAsync';
import { getCutoffSetting } from '@/services/school-config/schoolConfigService';

export function useCutoffSetting(schoolYear, { live = true } = {}) {
  const { data, loading, error, reload } = useAsync(() => getCutoffSetting(schoolYear), [schoolYear], {
    refreshOnDataChange: live,
    enabled: !!schoolYear,
  });
  return { year: data?.year, setting: data?.setting, loading, error, reload };
}
