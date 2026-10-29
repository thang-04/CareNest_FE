import { useMemo } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useAsync } from '@/hooks/useAsync';
import { useClasses } from '@/hooks/useSchool';
import {
  getChildDevelopment,
  getDailyAssessment,
  getDailyAssessmentClasses,
  getEvaluation,
  getEvaluations,
  getRewardCandidates,
  getRewardProposal,
  getRewardProposals,
  getTicketBoard,
  getTicketSummary,
  getTicketOverview,
  getClassAssessmentOverview,
  getClassAssessmentDetail,
} from '@/services/assessment/assessmentService';
import { useSchoolYear } from '@/contexts/SchoolYearContext';
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

/**
 * Lớp của đánh giá hằng ngày / mở lại ngày đánh giá theo năm học ở header. BE trả lớp trong phạm vi kèm cờ teaches /
 * canUnlock; mock dùng phân công lớp. Giáo viên chỉ thấy lớp mình dạy, PHT / Hiệu trưởng thấy lớp trong phạm vi.
 */
export function useDailyAssessmentClasses() {
  const { user } = useAuth();
  const { schoolYear } = useSchoolYear();
  const { data, loading, error, reload } = useAsync(() => getDailyAssessmentClasses(schoolYear, user), [schoolYear, user?.id]);
  const classes = useMemo(
    () => (isLeader(user) ? data || [] : (data || []).filter((c) => c.teaches ?? isClassTeacher(c, user))),
    [data, user],
  );
  return { classes, loading, error, reload };
}

/** Phiếu đánh giá một lớp / ngày (dùng chung 2 view). Không tự tải lại nền để không mất phần cô đang nhập. */
export function useDailyAssessment(params) {
  const { user } = useAuth();
  const key = JSON.stringify(params || {});
  const { data, loading, error, reload } = useAsync(() => getDailyAssessment(params, user), [key, user?.id], {
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

/** Phiếu bé ngoan các lớp (PHT, Hiệu trưởng). */
export function useTicketOverview(params) {
  const { user } = useAuth();
  const key = JSON.stringify(params || {});
  const { data, loading, error, reload } = useAsync(() => getTicketOverview(params, user), [key, user?.id], {
    refreshOnDataChange: true,
  });
  return { overview: data, loading, error, reload };
}

/** Tổng hợp phiếu bé ngoan theo trẻ của lớp (năm học hoặc một tháng). */
export function useTicketSummary(params) {
  const { user } = useAuth();
  const key = JSON.stringify(params || {});
  const { data, loading, error, reload } = useAsync(() => getTicketSummary(params, user), [key, user?.id], {
    refreshOnDataChange: true,
    enabled: !!params?.classId,
  });
  return { summary: data, loading, error, reload };
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

/** Tổng quan đánh giá các lớp theo kỳ (PHT / Hiệu trưởng). */
export function useClassAssessmentOverview(params) {
  const { user } = useAuth();
  const key = JSON.stringify(params || {});
  const { data, loading, error, reload } = useAsync(() => getClassAssessmentOverview(params, user), [key, user?.id], {
    refreshOnDataChange: true,
  });
  return { overview: data, loading, error, reload };
}

/** Chi tiết đánh giá một lớp trong kỳ: từng trẻ và nhận xét. */
export function useClassAssessmentDetail(params) {
  const { user } = useAuth();
  const key = JSON.stringify(params || {});
  const { data, loading, error, reload } = useAsync(() => getClassAssessmentDetail(params, user), [key, user?.id], {
    refreshOnDataChange: true,
  });
  return { detail: data, loading, error, reload };
}
