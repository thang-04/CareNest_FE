import { useAsync } from '@/hooks/useAsync';
import { getCurriculumContents, getCurriculumGoals, getCurriculumSources } from '@/services/education-plan/educationPlanService';

/** Danh mục Chương trình GDMN của Bộ theo nhóm tuổi (BE:EDU-28): nguồn, mục tiêu, gợi ý nội dung. */
export function useCurriculum(ageGroupCode) {
  const { data, loading, error, reload } = useAsync(
    () =>
      Promise.all([getCurriculumSources(), getCurriculumGoals(ageGroupCode), getCurriculumContents(ageGroupCode)]).then(
        ([sources, goals, contents]) => ({ sources, goals, contents }),
      ),
    [ageGroupCode],
    { enabled: !!ageGroupCode },
  );
  return {
    sources: data?.sources || [],
    goals: data?.goals || [],
    contents: data?.contents || [],
    loading,
    error,
    reload,
  };
}
