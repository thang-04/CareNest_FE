import { createContext, useCallback, useContext, useEffect, useMemo } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/contexts/ToastContext';
import { useSchoolYear } from '@/contexts/SchoolYearContext';
import { useAsync } from '@/hooks/useAsync';
import { LoadingState, ErrorState } from '@/components/ui/States';
import { ROLES, ROLE_LABELS } from '@/models/User';
import * as service from '@/services/education-plan/educationPlanService';
import { AGE_GROUPS, CLASSES, EDU_STATUS, toEduYear, fromEduYear } from '@/models/education-plan/educationPlanConstants';
import { applyEduConfig, withDefaults } from '@/models/education-plan/eduConfig';

const EducationPlanContext = createContext(null);

const now = () => {
  const d = new Date();
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
};

const initialsOf = (name = '') => {
  const parts = name.trim().split(/\s+/);
  return ((parts[0]?.[0] || '') + (parts.length > 1 ? parts[parts.length - 1][0] : '')).toUpperCase();
};

const titleOf = (u) => {
  if (u.role === ROLES.TEAM_LEADER) {
    const group = AGE_GROUPS.find((g) => g.id === u.ageGroupId);
    return `${ROLE_LABELS[u.role]}${group ? ` ${group.name.split(' (')[0]}` : ''} (toàn trường)`;
  }
  if (u.role === ROLES.TEACHER) {
    const cls = CLASSES.find((c) => c.id === u.classId);
    return cls ? `Giáo viên lớp ${cls.name}` : ROLE_LABELS[u.role];
  }
  return ROLE_LABELS[u.role] || u.role;
};

const TOAST_TYPES = { ok: 'success', err: 'error', warn: 'warning', info: 'info' };

const upsert = (list, item) => {
  const i = list.findIndex((x) => x.id === item.id);
  if (i === -1) return [item, ...list];
  const next = list.slice();
  next[i] = item;
  return next;
};

/**
 * Loads goals, theme plans and lesson plans once for every education-plan page and exposes
 * save/delete actions. Writes update the screen right away, then go to the service.
 */

const NEXT_SIGNER = {
  [EDU_STATUS.PENDING_TL]: 'Tổ trưởng',
  [EDU_STATUS.PENDING_VP]: 'Phó hiệu trưởng',
  [EDU_STATUS.PENDING_HT]: 'Hiệu trưởng',
};
/** Câu báo sau khi gửi / duyệt / trả lại tài liệu lớp, theo trạng thái mới. */
export const actDoneText = (kind, action, status) => {
  const name = { branch: 'chủ đề nhánh', semester: 'học kỳ', dossier: 'hồ sơ chủ đề' }[kind] || 'kế hoạch chủ đề';
  const next = NEXT_SIGNER[status];
  if (action === 'extend') return `Đã mở khóa ${name}`;
  if (action === 'revise') return `Đã tạo phiên bản điều chỉnh ${name}`;
  if (action === 'reject') return `Đã trả lại ${name}`;
  if (action === 'submit') return next ? `Đã gửi ${next} duyệt ${name}` : `Đã gửi ${name}`;
  return next ? `Đã duyệt ${name}, chuyển ${next} duyệt tiếp` : `Đã duyệt ${name}`;
};

export function EducationPlanProvider({ children }) {
  const { user: authUser } = useAuth();
  const toastApi = useToast();
  const { schoolYear: yearId, setSchoolYear, schoolYears } = useSchoolYear();
  // Kế hoạch năm, chủ đề, giáo án cũ và tài liệu của lớp (chủ đề nhánh, kế hoạch chủ đề, giáo án tuần) tải một lần
  const { data, setData, loading, error, reload } = useAsync(
    () =>
      Promise.all([service.getEducationPlans(authUser), service.getClassPlans(yearId, authUser), service.getEduConfig(authUser)]).then(
        ([plans, classDocs, eduConfig]) => {
          // Cấu hình áp dụng trước khi vẽ để bảng, nhãn lĩnh vực và file xuất dùng cùng một bản
          applyEduConfig(eduConfig);
          return { ...plans, ...classDocs, eduConfig };
        },
      ),
    [yearId, authUser.id],
    { refreshOnDataChange: true },
  );

  const toast = useCallback((message, tone = 'ok') => toastApi[TOAST_TYPES[tone] || 'success'](message), [toastApi]);

  const user = useMemo(() => {
    // Đăng nhập Keycloak dev (beClient) trả id dạng chuỗi số, nhóm tuổi theo id; module so id số như class-docs BE
    // và dùng mã nhóm tuổi ("ag-3") ⇒ đổi về đúng dạng, mã lấy từ danh sách tổ trưởng BE trả
    const numeric = (v) => (/^\d+$/.test(String(v ?? '')) ? Number(v) : v);
    const id = numeric(authUser.id);
    const leader = (data?.staff || []).find((s) => s.id === id && s.role === ROLES.TEAM_LEADER);
    return {
      id,
      role: authUser.role,
      roles: authUser.roles,
      name: authUser.fullName,
      title: titleOf(authUser),
      initials: initialsOf(authUser.fullName),
      ageGroupId: /^\d+$/.test(String(authUser.ageGroupId ?? '')) ? (leader?.ageGroupId ?? authUser.ageGroupId) : authUser.ageGroupId,
      classId: authUser.classId == null ? authUser.classId : String(authUser.classId),
    };
  }, [authUser, data?.staff]);

  const value = useMemo(() => {
    const yearName = (id) => {
      const option = schoolYears.find((y) => y.id === id);
      return option ? option.label.replace(' - ', '-') : String(id ?? '');
    };

    const write = (key, call, apply) => async (arg) => {
      setData((prev) => (prev ? { ...prev, [key]: apply(prev[key], arg) } : prev));
      try {
        await call(arg);
      } catch (err) {
        toastApi.error(err.message, 'Không lưu được');
        reload({ silent: true });
      }
    };
    const saveIn = (key, call) => write(key, call, upsert);
    // Tài liệu của lớp: chờ kết quả từ service (quyền, trạng thái do service quyết định) rồi mới cập nhật màn hình
    // Spec 003: gói học kỳ (semester), hồ sơ chủ đề (dossier) là gốc gửi/duyệt; giáo án ngày (day) tách khỏi tuần
    const CLASS_KEY = {
      branch: 'branchPlans',
      theme: 'classThemePlans',
      week: 'weekPlans',
      day: 'dayPlans',
      semester: 'semesterPackages',
      dossier: 'themeDossiers',
    };
    const actor = { id: user.id, fullName: user.name, role: user.role, roles: user.roles, ageGroupId: user.ageGroupId };
    const refreshPlans = async () => {
      const plans = await service.getEducationPlans(actor);
      setData((prev) => (prev ? { ...prev, ...plans } : prev));
      return plans;
    };
    const classCall =
      (call) =>
      async (kind, ...args) => {
        try {
          const [docOrId, body, , supplied] = args;
          const current = (data?.[CLASS_KEY[kind]] || []).find((doc) => doc.id === (docOrId?.id || docOrId));
          // Gốc chứa tài liệu: giáo án ngày ⇒ hồ sơ chủ đề; kế hoạch tuần ⇒ gốc của kế hoạch chủ đề (containerKey do BE trả)
          const sameTheme = (doc) =>
            doc.classId === docOrId?.classId && doc.yearPlanId === docOrId?.yearPlanId && doc.themeId === docOrId?.themeId;
          const themeDoc = (data?.classThemePlans || []).find(sameTheme);
          const roots = [...(data?.themeDossiers || []), ...(data?.semesterPackages || [])];
          const root =
            (kind === 'week' || kind === 'day') &&
            (roots.find((doc) => kind === 'week' && doc.id === themeDoc?.containerKey) ||
              (data?.themeDossiers || []).find(sameTheme) ||
              (!data?.themeDossiers?.length && themeDoc));
          const options = { version: current?.version, dossierVersion: current?.dossierVersion ?? root?.version, ...supplied };
          const saved =
            call === service.saveClassDoc
              ? await call(
                  kind,
                  {
                    ...docOrId,
                    version: docOrId.version ?? current?.version ?? -1,
                    dossierVersion: docOrId.dossierVersion ?? options.dossierVersion,
                  },
                  actor,
                  options,
                )
              : await call(kind, docOrId, body, actor, options);
          setData((prev) => (prev ? { ...prev, [CLASS_KEY[kind]]: upsert(prev[CLASS_KEY[kind]] || [], saved) } : prev));
          await reload({ silent: true });
          return saved;
        } catch (err) {
          toastApi.error(err.message, 'Không thực hiện được');
          args[3]?.onError?.(err);
          if (err.status === 409 || err.status === 403) reload({ silent: true });
          return null;
        }
      };
    const deleteIn = (key, call) => write(key, call, (list, id) => list.filter((x) => x.id !== id));

    return {
      refreshPlans,
      // Tài liệu của lớp (hồ sơ chủ đề chờ duyệt…) do người khác đổi; tải lại im lặng, không đụng kế hoạch năm/tổ
      refreshClassDocs: async () => {
        const classDocs = await service.getClassPlans(yearId, actor);
        setData((prev) => (prev ? { ...prev, ...classDocs } : prev));
        return classDocs;
      },
      refreshGoal: async (id) => {
        const plans = await refreshPlans();
        const goal = plans.goals.find((item) => item.id === id);
        if (!goal) throw new Error('Kế hoạch không còn trong phạm vi truy cập.');
        return goal;
      },
      goals: data?.goals || [],
      themes: data?.themes || [],
      lessons: data?.lessons || [],
      branchPlans: data?.branchPlans || [],
      classThemePlans: data?.classThemePlans || [],
      weekPlans: data?.weekPlans || [],
      dayPlans: data?.dayPlans || [],
      semesterPackages: data?.semesterPackages || [],
      themeDossiers: data?.themeDossiers || [],
      semesterConfigMissing: !!data?.semesterConfigMissing,
      // Lớp, giáo viên và tổ trưởng của năm đang chọn (cùng nguồn với tài liệu của lớp)
      classes: data?.classes || [],
      staff: data?.staff || [],
      eduConfig: withDefaults(data?.eduConfig),
      creationCapabilities: data?.creationCapabilities || [],
      saveWorkflowPolicy: async (cfg) => {
        try {
          const saved = await service.saveWorkflowPolicy(cfg, actor);
          applyEduConfig(saved);
          setData((prev) => (prev ? { ...prev, eduConfig: saved } : prev));
          reload({ silent: true });
          return saved;
        } catch (err) {
          toastApi.error(err.message, 'Không lưu được người tạo/duyệt');
          reload({ silent: true });
          return null;
        }
      },
      saveEduConfig: async (cfg) => {
        try {
          const saved = await service.saveEduConfig(cfg, actor);
          applyEduConfig(saved);
          setData((prev) => (prev ? { ...prev, eduConfig: saved } : prev));
          return saved;
        } catch (err) {
          toastApi.error(err.message, 'Không lưu được cấu hình');
          return null;
        }
      },
      saveClassDoc: classCall(service.saveClassDoc),
      // BE:EDU-27 — ô điều chỉnh của kế hoạch ngày; trả bản đã lưu, lỗi thì báo và trả null
      // BE:EDU-25 — tạo phiên bản điều chỉnh của kế hoạch năm đã ban hành
      createGoalVersion: async (id, curriculumSourcePlanId) => {
        try {
          const edit = {
            sessionId: crypto.randomUUID(),
            revision: data?.goals.find((g) => g.id === id)?.revision ?? 0,
            requestId: crypto.randomUUID(),
          };
          const plan = await service.createGoalVersion(id, actor, { ...edit, curriculumSourcePlanId });
          setData((prev) => (prev ? { ...prev, goals: upsert(prev.goals, plan) } : prev));
          return plan;
        } catch (err) {
          toastApi.error(err.message, 'Không tạo được phiên bản');
          return null;
        }
      },
      getGoalChanges: service.getGoalChanges,
      unlockGoal: async (id, body) => {
        try {
          const plan = await service.unlockGoal(id, body);
          setData((prev) => (prev ? { ...prev, goals: upsert(prev.goals, plan) } : prev));
          toast('Đã mở khóa kế hoạch');
          return plan;
        } catch (err) {
          toastApi.error(err, 'Không mở khóa được');
          return null;
        }
      },
      // Gửi / duyệt hồ sơ chủ đề đổi trạng thái cả giáo án các tuần: nạp lại để các tuần không giữ trạng thái cũ
      actOnClassDoc: async (kind, ...args) => {
        const saved = await classCall(service.actOnClassDoc)(kind, ...args);
        if (saved && ['theme', 'semester', 'dossier'].includes(kind)) reload({ silent: true });
        // Báo kết quả sau khi gửi / duyệt / trả lại (Tiền 05/11)
        if (saved) toast(actDoneText(kind, args[1]?.action, saved.status));
        return saved;
      },
      role: user.role,
      user,
      toast,
      // Header giữ id năm (số khi nối BE thật); module này dùng tên năm ('2026-2027') nên đổi qua nhãn của lựa chọn
      schoolYear: toEduYear(yearName(yearId)),
      schoolYears: schoolYears.map((y) => toEduYear(yearName(y.id))),
      setYear: (label) => setSchoolYear(schoolYears.find((y) => yearName(y.id) === fromEduYear(label))?.id ?? fromEduYear(label)),
      historyEntry: (action, extra = {}) => ({ action, by: user.name, role: ROLE_LABELS[user.role], at: now(), tone: '', ...extra }),
      // Trả bản đã lưu (API thật: id do BE cấp, thay bản tạm cùng id cũ); lỗi thì báo, nạp lại và trả null
      saveGoal: async (item, options = {}) => {
        if (!options.silent) setData((prev) => (prev ? { ...prev, goals: upsert(prev.goals, item) } : prev));
        try {
          const res = await service.saveGoal(item, { ...options, actor: user });
          const saved = res?.id ? res : item;
          setData((prev) =>
            prev
              ? {
                  ...prev,
                  goals: upsert(
                    prev.goals.filter((g) => g.id !== item.id || g.id === saved.id),
                    saved,
                  ),
                }
              : prev,
          );
          return saved;
        } catch (err) {
          if (options.silent) throw err;
          toastApi.error(err.message, 'Không lưu được');
          reload({ silent: true });
          return null;
        }
      },
      resolveGoalReview: async (id, reviewItemId, expectedSourcePlanId, edit) => {
        const goal = await service.resolveGoalReview(id, reviewItemId, expectedSourcePlanId, edit, actor);
        setData((prev) => (prev ? { ...prev, goals: upsert(prev.goals, goal) } : prev));
        return goal;
      },
      // Ném lỗi BE (403/409/5xx) cho màn gọi hiển thị; chỉ bỏ khỏi danh sách khi BE đã xóa
      deleteGoal: async (id) => {
        await service.deleteGoal(id, data?.goals.find((goal) => goal.id === id)?.revision, user);
        setData((prev) => (prev ? { ...prev, goals: prev.goals.filter((goal) => goal.id !== id) } : prev));
      },
      saveTheme: saveIn('themes', service.saveTheme),
      deleteTheme: deleteIn('themes', service.deleteTheme),
      saveLesson: saveIn('lessons', service.saveLesson),
      deleteLesson: deleteIn('lessons', service.deleteLesson),
    };
  }, [data, setData, reload, user, toast, toastApi, yearId, schoolYears, setSchoolYear]);

  useEffect(() => {
    if (error?.status === 403) setData(null);
  }, [error, setData]);

  if (loading && !data) return <LoadingState />;
  if (error && (!data || error.status === 403)) return <ErrorState error={error} onRetry={reload} />;
  return <EducationPlanContext.Provider value={value}>{children}</EducationPlanContext.Provider>;
}

/** Data and actions of the education-plan module. Only valid inside EducationPlanProvider. */
export const useEducationPlan = () => useContext(EducationPlanContext);
