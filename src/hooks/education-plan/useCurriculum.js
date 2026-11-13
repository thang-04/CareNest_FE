import { useAsync } from '@/hooks/useAsync';
import { getCurriculumContents, getCurriculumGoals, getCurriculumSources } from '@/services/education-plan/educationPlanService';

/** Danh mục Chương trình GDMN của Bộ theo nhóm tuổi (BE:EDU-28): nguồn, mục tiêu, gợi ý nội dung. */
export function useCurriculum(ageGroupCode, { enabled = true, scope = null } = {}) {
  const active = enabled && !!ageGroupCode;
  const { data, loading, error, reload } = useAsync(
    () =>
      Promise.all([getCurriculumSources(), getCurriculumGoals(ageGroupCode), getCurriculumContents(ageGroupCode)]).then(
        ([sources, goals, contents]) => ({ sources, goals, contents }),
      ),
    [ageGroupCode, active, scope],
    { enabled: active },
  );
  return {
    sources: active ? data?.sources || [] : [],
    goals: active ? data?.goals || [] : [],
    contents: active ? data?.contents || [] : [],
    loading,
    error,
    reload,
  };
}
