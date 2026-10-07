import { useAuth } from '@/contexts/AuthContext';
import { useAsync } from '@/hooks/useAsync';
import {
  getFacilityAssets,
  getFacilityLocations,
  getIssues,
  getIssueById,
  getRequests,
  getRequestById,
  getMyReports,
  getProposals,
  getProposalById,
  getProposalSources,
} from '@/services/facility/facilityService';

/** Lists refresh when another role changes the demo data; detail pages pass live=false while typing. */
const useList = (loader, filters, enabled = true) => {
  const { user } = useAuth();
  const key = JSON.stringify(filters || {});
  return useAsync(() => loader(filters, user), [key, user?.id], { refreshOnDataChange: true, enabled: enabled && !!user });
};

const useOne = (loader, id, live) => {
  const { user } = useAuth();
  return useAsync(() => loader(id, user), [id, user?.id], { refreshOnDataChange: live, enabled: !!id && !!user });
};

export function useFacilityAssets(filters) {
  const { data, loading, error, reload } = useList(getFacilityAssets, filters);
  return { assets: data || [], loading, error, reload };
}

export function useFacilityLocations() {
  const { user } = useAuth();
  const { data, loading, error } = useAsync(() => getFacilityLocations(user), [user?.id], { enabled: !!user });
  return { locations: data || [], loading, error };
}

export function useIssues(filters, { enabled = true } = {}) {
  const { data, loading, error, reload } = useList(getIssues, filters, enabled);
  return { issues: data || [], loading, error, reload };
}

export function useIssue(id, { live = true } = {}) {
  const { data, loading, error, reload } = useOne(getIssueById, id, live);
  return { issue: data, loading, error, reload };
}

export function useRequests(filters, { enabled = true } = {}) {
  const { data, loading, error, reload } = useList(getRequests, filters, enabled);
  return { requests: data || [], loading, error, reload };
}

export function useRequest(id, { live = true } = {}) {
  const { data, loading, error, reload } = useOne(getRequestById, id, live);
  return { request: data, loading, error, reload };
}

export function useMyReports() {
  const { user } = useAuth();
  const { data, loading, error, reload } = useAsync(() => getMyReports(user), [user?.id], { refreshOnDataChange: true, enabled: !!user });
  return { issues: data?.issues || [], requests: data?.requests || [], loading, error, reload };
}

export function useProposals(filters, { enabled = true } = {}) {
  const { data, loading, error, reload } = useList(getProposals, filters, enabled);
  return { proposals: data || [], loading, error, reload };
}

export function useProposal(id, { live = true } = {}) {
  const { data, loading, error, reload } = useOne(getProposalById, id, live);
  return { proposal: data, loading, error, reload };
}

/** Approved issues / requests that can still join a proposal (the edited proposal's own sources included). */
export function useProposalSources(proposalId) {
  const { user } = useAuth();
  const { data, loading, error, reload } = useAsync(() => getProposalSources(user, proposalId), [user?.id, proposalId], {
    enabled: !!user,
  });
  return { sources: data || [], loading, error, reload };
}
