import { USE_MOCK } from '@/config/env';
import { facilityMockRepository as mock } from '@/services/facility/mock/facilityMockRepository';
import { facilityApi as api } from '@/services/facility/api/facilityApi';

/** Facade used by hooks/pages. VITE_USE_MOCK=false switches to Spring Boot. */
const repo = USE_MOCK ? mock : api;

export const getFacilityAssets = (filters, user) => repo.listAssets(filters, user);
export const getFacilityLocations = (user) => repo.getScopeLocations(user);

export const checkOpenIssue = (assetId, type, user) => repo.checkOpenIssue(assetId, type, user);
export const getIssues = (filters, user) => repo.listIssues(filters, user);
export const getIssueById = (id, user) => repo.getIssue(id, user);
export const reportIssue = (payload, user) => repo.createIssue(payload, user);
export const approveIssue = (id, body, user) => repo.approveIssue(id, body, user);
export const rejectIssue = (id, reason, user) => repo.rejectIssue(id, reason, user);

export const getRequests = (filters, user) => repo.listRequests(filters, user);
export const getRequestById = (id, user) => repo.getRequest(id, user);
export const submitRequest = (payload, user) => repo.createRequest(payload, user);
export const approveRequest = (id, note, user) => repo.approveRequest(id, note, user);
export const rejectRequest = (id, reason, user) => repo.rejectRequest(id, reason, user);
export const forwardRequest = (id, note, user) => repo.forwardRequest(id, note, user);

export const getMyReports = (user) => repo.listMyReports(user);

export const getProposals = (filters, user) => repo.listProposals(filters, user);
export const getProposalById = (id, user) => repo.getProposal(id, user);
export const getProposalSources = (user, proposalId) => repo.getProposalSources(user, proposalId);
export const saveProposalDraft = (id, payload, user) => repo.saveProposalDraft(id, payload, user);
export const submitProposal = (id, payload, user) => repo.submitProposal(id, payload, user);
export const cancelProposal = (id, reason, user) => repo.cancelProposal(id, reason, user);
export const approveProposal = (id, note, user) => repo.approveProposal(id, note, user);
export const rejectProposal = (id, reason, user) => repo.rejectProposal(id, reason, user);
