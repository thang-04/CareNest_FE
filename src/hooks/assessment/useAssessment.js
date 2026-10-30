import { useMemo } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useAsync } from '@/hooks/useAsync';
import { useClasses } from '@/hooks/useSchool';
import {
  getChildDevelopment,
  getDevelopmentChildren,
  getDailyAssessment,
  getDailyAssessmentClasses,
  getEvaluation,
  getEvaluations,
  getRewardList,
  getRewardLists,
  getTicketBoard,
  getTicketSummary,
  getTicketOverview,
  getClassAssessmentOverview,
  getQualityReport,
  getProgramCompletion,
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

/** Trẻ trong phạm vi (GV: lớp mình, PHT: điểm trường, HT: toàn trường) theo năm học ở header. */
export function useDevelopmentChildren() {
  const { user } = useAuth();
  const { schoolYear } = useSchoolYear();
  const { data, loading, error, reload } = useAsync(() => getDevelopmentChildren({ schoolYear }, user), [schoolYear, user?.id], {
    refreshOnDataChange: true,
  });
  return { children: data || [], loading, error, reload };
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

/** Các lớp trong phạm vi và trạng thái danh sách khen thưởng của năm học ở header. */
export function useRewardLists() {
  const { user } = useAuth();
  const { schoolYear } = useSchoolYear();
  const { data, loading, error, reload } = useAsync(() => getRewardLists({ schoolYear }), [schoolYear, user?.id], {
    refreshOnDataChange: true,
  });
  return { rows: data || [], loading, error, reload };
}

export function useRewardList(classId) {
  const { user } = useAuth();
  const { data, loading, error, reload } = useAsync(() => getRewardList(classId), [classId, user?.id], { enabled: !!classId });
  return { detail: data, loading, error, reload };
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

/** Báo cáo chất lượng tháng (sổ chỉ đạo chuyên môn 4.1 + 4.2) cho PHT / Hiệu trưởng. */
/** Trẻ lớp 5–6 tuổi hoàn thành chương trình theo lớp (PHT / Hiệu trưởng). */
export function useProgramCompletion(params, { enabled = true } = {}) {
  const { user } = useAuth();
  const key = JSON.stringify(params || {});
  const { data, loading, error, reload } = useAsync(() => getProgramCompletion(params, user), [key, user?.id], {
    refreshOnDataChange: true,
    enabled,
  });
  return { report: data, loading, error, reload };
}

export function useQualityReport(params) {
  const { user } = useAuth();
  const key = JSON.stringify(params || {});
  const { data, loading, error, reload } = useAsync(() => getQualityReport(params, user), [key, user?.id], {
    refreshOnDataChange: true,
  });
  return { report: data, loading, error, reload };
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
