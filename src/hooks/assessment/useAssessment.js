import { useMemo } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useAsync } from '@/hooks/useAsync';
import { useClasses } from '@/hooks/useSchool';
import {
  getChildDevelopment,
  getDailySheet,
  getEvaluation,
  getEvaluations,
  getRewardCandidates,
  getRewardProposal,
  getRewardProposals,
  getTicketBoard,
} from '@/services/assessment/assessmentService';
import { isClassTeacher, isLeader } from '@/utils/assessment/assessmentPermissions';

/**
 * Classes this module works with: the classes a teacher / team leader teaches (footnote 2 of the matrix),
 * or the visible classes of a leader (Principal: school, Vice Principal: campus).
 */
export function useAssessmentClasses() {
  const { user } = useAuth();
  const { classes, loading, error, reload } = useClasses();
  const list = useMemo(() => (isLeader(user) ? classes : classes.filter((c) => isClassTeacher(c, user))), [classes, user]);
  return { classes: list, loading, error, reload };
}

/** live=false on pages with unsaved input so background refreshes never reset what the user typed. */
export function useDailySheet(params, { live = false } = {}) {
  const { user } = useAuth();
  const key = JSON.stringify(params || {});
  const { data, loading, error, reload } = useAsync(() => getDailySheet(params, user), [key, user?.id], {
    refreshOnDataChange: live,
    enabled: !!params?.classId && !!params?.date,
  });
  return { sheet: data, loading, error, reload };
}

export function useChildDevelopment(childId, params) {
  const { user } = useAuth();
  const key = JSON.stringify(params || {});
  const { data, loading, error, reload } = useAsync(() => getChildDevelopment(childId, params, user), [childId, key, user?.id], {
    refreshOnDataChange: true,
    enabled: !!childId && !!params?.start,
  });
  return { development: data, loading, error, reload };
}

export function useEvaluations(kind, filters) {
  const { user } = useAuth();
  const key = JSON.stringify(filters || {});
  const { data, loading, error, reload } = useAsync(() => getEvaluations(kind, filters, user), [kind, key, user?.id], {
    refreshOnDataChange: true,
  });
  return { evaluations: data || [], loading, error, reload };
}

export function useEvaluation(kind, id, { live = true } = {}) {
  const { user } = useAuth();
  const { data, loading, error, reload } = useAsync(() => getEvaluation(kind, id, user), [kind, id, user?.id], {
    refreshOnDataChange: live,
    enabled: !!id,
  });
  return { detail: data, loading, error, reload };
}

export function useTicketBoard(params) {
  const { user } = useAuth();
  const key = JSON.stringify(params || {});
  const { data, loading, error, reload } = useAsync(() => getTicketBoard(params, user), [key, user?.id], {
    refreshOnDataChange: true,
    enabled: !!params?.classId,
  });
  return { board: data, loading, error, reload };
}

export function useRewardProposals(filters) {
  const { user } = useAuth();
  const key = JSON.stringify(filters || {});
  const { data, loading, error, reload } = useAsync(() => getRewardProposals(filters, user), [key, user?.id], {
    refreshOnDataChange: true,
  });
  return { proposals: data || [], loading, error, reload };
}

export function useRewardProposal(id, { live = true } = {}) {
  const { user } = useAuth();
  const { data, loading, error, reload } = useAsync(() => getRewardProposal(id, user), [id, user?.id], {
    refreshOnDataChange: live,
    enabled: !!id,
  });
  return { detail: data, loading, error, reload };
}

export function useRewardCandidates(schoolYear) {
  const { user } = useAuth();
  const { data, loading, error, reload } = useAsync(() => getRewardCandidates(schoolYear, user), [schoolYear, user?.id], {
    enabled: !!schoolYear,
  });
  return { groups: data || [], loading, error, reload };
}
