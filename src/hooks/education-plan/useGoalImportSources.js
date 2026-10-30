import { useAsync } from '@/hooks/useAsync';
import { getGoalSource, listGoalSources } from '@/services/education-plan/educationPlanService';

const keyed = async (key, load) => {
  try {
    return { key, value: await load() };
  } catch (error) {
    error.importKey = key;
    throw error;
  }
};

export function useGoalImportSources({ schoolYear, ageGroupId, excludeId, sourceId, actor }) {
  const listKey = JSON.stringify([schoolYear, ageGroupId, excludeId, actor.id, actor.role, actor.ageGroupId]);
  const list = useAsync(() => keyed(listKey, () => listGoalSources({ schoolYear, ageGroupId, excludeId }, actor)), [listKey], {
    enabled: !!schoolYear,
  });
  const listError = list.error?.importKey === listKey ? list.error : null;
  const listReady = list.data?.key === listKey;
  const sources = listReady ? list.data.value : [];
  const currentId = sources.some((item) => item.id === sourceId) ? sourceId : sources[0]?.id || '';
  const sourceKey = `${listKey}:${currentId}`;
  const detail = useAsync(() => keyed(sourceKey, () => getGoalSource(currentId, actor)), [sourceKey], { enabled: !!currentId });
  const sourceError = detail.error?.importKey === sourceKey ? detail.error : null;
  const sourceReady = detail.data?.key === sourceKey;
  return {
    sources,
    sourceId: currentId,
    source: sourceReady ? detail.data.value : null,
    sourceKey,
    listError,
    sourceError,
    loadingList: !!schoolYear && (list.loading || (!listReady && !listError)),
    loadingSource: !!currentId && (detail.loading || (!sourceReady && !sourceError)),
    reloadList: list.reload,
    reloadSource: detail.reload,
    readFresh: () => getGoalSource(currentId, actor),
  };
}
