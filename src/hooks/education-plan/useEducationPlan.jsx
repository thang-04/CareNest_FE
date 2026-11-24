import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/contexts/ToastContext';
import { useSchoolYear } from '@/contexts/SchoolYearContext';
import { useAsync } from '@/hooks/useAsync';
import { USE_MOCK } from '@/config/env';
import { LoadingState, ErrorState } from '@/components/ui/States';
import { ROLES, ROLE_LABELS } from '@/models/User';
import * as service from '@/services/education-plan/educationPlanService';
import { AGE_GROUPS, EDU_STATUS, toEduYear, fromEduYear } from '@/models/education-plan/educationPlanConstants';
import { applyEduConfig, withDefaults } from '@/models/education-plan/eduConfig';
import { mergeGoals } from '@/models/education-plan/planVersions.mjs';
import { educationSchoolYears, sameSchoolYearId } from '@/models/education-plan/schoolYearScope.mjs';

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

const titleOf = (u, classes) => {
  if (u.role === ROLES.TEAM_LEADER) {
    const group = AGE_GROUPS.find((g) => g.id === u.ageGroupId);
    return `${ROLE_LABELS[u.role]}${group ? ` ${group.name.split(' (')[0]}` : ''} (toàn trường)`;
  }
  if (u.role === ROLES.TEACHER) {
    const cls = classes.find((c) => String(c.id) === String(u.classId));
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
  const name = { branch: 'chủ đề nhánh', semester: 'học kỳ', dossier: 'kế hoạch giáo dục ngày' }[kind] || 'kế hoạch chủ đề';
  const next = NEXT_SIGNER[status];
  if (action === 'extend') return `Đã mở khóa ${name}`;
  if (action === 'revise') return `Đã tạo phiên bản điều chỉnh ${name}`;
  if (action === 'reject') return `Đã trả lại ${name}`;
  if (action === 'submit') return next ? `Đã gửi ${next} duyệt ${name}` : `Đã gửi ${name}`;
  return next ? `Đã duyệt ${name}, chuyển ${next} duyệt tiếp` : `Đã duyệt ${name}`;
};

/**
 * lightDocs (edu-list-paging, Tiền 25/11/2026): trang danh sách không dùng nội dung tài liệu lớp ⇒ chỉ tải lớp/nhân sự,
 * không tải cả gói /class-docs (vài MB); trang tự tải danh sách gọn có phân trang.
 */
export function EducationPlanProvider({ children, yearScoped = true, reviewView = false, lightDocs = false }) {
  const { user: authUser } = useAuth();
  const toastApi = useToast();
  const { schoolYear: pickedYear, setSchoolYear, schoolYears } = useSchoolYear();
  const yearOptions = useMemo(() => educationSchoolYears(schoolYears, USE_MOCK), [schoolYears]);
  const yearOption =
    yearOptions.find((year) => sameSchoolYearId(year.headerId, pickedYear)) ??
    yearOptions.find((year) => sameSchoolYearId(year.id, pickedYear));
  const yearId = yearScoped ? (yearOption?.id ?? null) : null;
  const scope = useMemo(
    () => ({ yearId, userId: authUser.id, reviewView, lightDocs, classRefreshSequence: 0, loadingGoalIds: new Set() }),
    [yearId, authUser.id, reviewView, lightDocs],
  );
  const activeScope = useRef(scope);
  activeScope.current = scope;
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  const isActive = useCallback(() => mounted.current && activeScope.current === scope, [scope]);
  // Kế hoạch năm, chủ đề, giáo án cũ và tài liệu của lớp (chủ đề nhánh, kế hoạch chủ đề, giáo án tuần) tải một lần
  const {
    data,
    setData: setAsyncData,
    loading,
    error,
    reload: reloadAsync,
  } = useAsync(
    () =>
      Promise.all([
        yearId == null ? { goals: [] } : service.getEducationPlans(authUser, { schoolYearId: yearId }),
        yearId == null
          ? {}
          : lightDocs
            ? service.getClassDocContext(yearId, authUser)
            : service.getClassPlans(yearId, authUser, reviewView),
        service.getEduConfig(authUser),
      ]).then(([plans, classDocs, eduConfig]) => {
        // Cấu hình áp dụng trước khi vẽ để bảng, nhãn lĩnh vực và file xuất dùng cùng một bản
        if (isActive()) applyEduConfig(eduConfig);
        return { ...plans, goals: mergeGoals(goalsRef.current, plans.goals), ...classDocs, eduConfig };
      }),
    [yearId, authUser.id, reviewView, lightDocs],
    { refreshOnDataChange: true },
  );

  // Phản hồi cũ chỉ cập nhật màn đã khởi tạo tác vụ, kể cả khi chọn A → B → A.
  const setData = useCallback(
    (next) => {
      if (isActive()) setAsyncData(next);
    },
    [isActive, setAsyncData],
  );
  const reload = useCallback(
    (options) => {
      if (isActive()) return reloadAsync(options);
    },
    [isActive, reloadAsync],
  );
  const goalsRef = useRef([]);
  goalsRef.current = data?.goals || [];
  // Chi tiết kế hoạch năm/tổ tải khi trang cần (useGoalDetails); một id chỉ tải một lần cùng lúc
  const loadingGoals = scope.loadingGoalIds;
  const ensureGoals = useCallback(
    async (ids) => {
      const need = ids.filter((id) => id && !loadingGoals.has(id));
      if (!need.length) return;
      need.forEach((id) => loadingGoals.add(id));
      try {
        const details = await Promise.all(need.map((id) => service.getGoal(id, authUser)));
        const scoped = details.filter((goal) => sameSchoolYearId(goal?.schoolYearId, yearId));
        setData((prev) =>
          prev
            ? {
                ...prev,
                goals: scoped.reduce(
                  (list, goal) => (goal.status === 'APPROVED' || list.some((item) => item.id === goal.id) ? upsert(list, goal) : list),
                  prev.goals,
                ),
              }
            : prev,
        );
      } finally {
        need.forEach((id) => loadingGoals.delete(id));
      }
    },
    [setData, authUser, loadingGoals, yearId],
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
      title: titleOf(authUser, data?.classes || []),
      initials: initialsOf(authUser.fullName),
      ageGroupId: /^\d+$/.test(String(authUser.ageGroupId ?? '')) ? (leader?.ageGroupId ?? authUser.ageGroupId) : authUser.ageGroupId,
      classId: authUser.classId == null ? authUser.classId : String(authUser.classId),
    };
  }, [authUser, data?.staff, data?.classes]);

  const value = useMemo(() => {
    const yearName = (year) => String(year?.label ?? '').replace(' - ', '-');

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
    // Spec 003: kế hoạch giáo dục chủ đề (semester), kế hoạch giáo dục ngày (dossier) là gốc gửi/duyệt; giáo án ngày (day) tách khỏi tuần
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
      if (yearId == null) return { goals: [] };
      const plans = await service.getEducationPlans(actor, { schoolYearId: yearId });
      setData((prev) => (prev ? { ...prev, ...plans, goals: mergeGoals(prev.goals, plans.goals) } : prev));
      return plans;
    };
    const classCall =
      (call) =>
      async (kind, ...args) => {
        try {
          const [docOrId, body, , supplied] = args;
          const current = (data?.[CLASS_KEY[kind]] || []).find((doc) => doc.id === (docOrId?.id || docOrId));
          // Gốc chứa tài liệu: giáo án ngày ⇒ kế hoạch giáo dục ngày; kế hoạch tuần ⇒ gốc của kế hoạch chủ đề (containerKey do BE trả)
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
          scope.classRefreshSequence += 1;
          if (!['extend', 'reopen_review_deadline'].includes(body?.action)) {
            setData((prev) => (prev ? { ...prev, [CLASS_KEY[kind]]: upsert(prev[CLASS_KEY[kind]] || [], saved) } : prev));
          }
          await reload({ silent: true });
          return saved;
        } catch (err) {
          if (isActive()) toastApi.error(err.message, 'Không thực hiện được');
          args[3]?.onError?.(err);
          if (err.status === 409 || err.status === 403) reload({ silent: true });
          return null;
        }
      };
    const deleteIn = (key, call) => write(key, call, (list, id) => list.filter((x) => x.id !== id));

    return {
      reload,
      refreshPlans,
      // Tài liệu của lớp (kế hoạch giáo dục ngày chờ duyệt…) do người khác đổi; tải lại im lặng, không đụng kế hoạch năm/tổ
      refreshClassDocs: async () => {
        if (yearId == null) return;
        const sequence = ++scope.classRefreshSequence;
        const classDocs = scope.lightDocs
          ? await service.getClassDocContext(yearId, actor)
          : await service.getClassPlans(yearId, actor, scope.reviewView);
        if (sequence === scope.classRefreshSequence) setData((prev) => (prev ? { ...prev, ...classDocs } : prev));
        return classDocs;
      },
      refreshGoal: async (id) => {
        const plans = await refreshPlans();
        if (!plans.goals.some((item) => item.id === id)) throw new Error('Kế hoạch không còn trong phạm vi truy cập.');
        // Danh sách chỉ có bản tóm tắt ⇒ lấy chi tiết mới nhất của đúng kế hoạch này
        const goal = await service.getGoal(id, actor);
        setData((prev) => (prev ? { ...prev, goals: upsert(prev.goals, goal) } : prev));
        return goal;
      },
      ensureGoals,
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
      saveEduConfig: async (cfg) => {
        try {
          const saved = await service.saveEduConfig(cfg, actor);
          if (isActive()) applyEduConfig(saved);
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
          if (isActive()) toast('Đã mở hạn');
          return plan;
        } catch (err) {
          if (isActive()) toastApi.error(err, 'Không mở khóa được');
          return null;
        }
      },
      // Gửi / duyệt kế hoạch giáo dục ngày đổi trạng thái cả giáo án các tuần: nạp lại để các tuần không giữ trạng thái cũ
      actOnClassDoc: async (kind, ...args) => {
        const saved = await classCall(service.actOnClassDoc)(kind, ...args);
        if (saved && ['theme', 'semester', 'dossier'].includes(kind)) reload({ silent: true });
        // Báo kết quả sau khi gửi / duyệt / trả lại (Tiền 05/11)
        if (saved && isActive()) toast(actDoneText(kind, args[1]?.action, saved.status));
        return saved;
      },
      role: user.role,
      user,
      toast,
      // Nội dung theo ID năm từ đầu API tới trang. Nhãn vẫn dùng cho biểu mẫu và hiển thị.
      schoolYearId: yearId,
      schoolYear: toEduYear(yearName(yearOption)),
      schoolYears: yearOptions.map((year) => toEduYear(yearName(year))),
      yearOption,
      yearOptions,
      setYear: (label) => {
        const year = yearOptions.find((option) => yearName(option) === fromEduYear(label));
        if (year) setSchoolYear(year.headerId);
      },
      historyEntry: (action, extra = {}) => ({ action, by: user.name, role: ROLE_LABELS[user.role], at: now(), tone: '', ...extra }),
      // Trả bản đã lưu (API thật: id do BE cấp, thay bản tạm cùng id cũ); lỗi thì báo, nạp lại và trả null
      saveGoal: async (item, options = {}) => {
        // publish: HT ban hành thẳng (EDU-110 (8)) đổi trạng thái như duyệt ⇒ nạp lại từ service
        const reviewAction = ['approve', 'reject', 'publish'].includes(options.action);
        if (!options.silent && !reviewAction) setData((prev) => (prev ? { ...prev, goals: upsert(prev.goals, item) } : prev));
        try {
          const res = await service.saveGoal(item, { ...options, actor: user });
          const saved = res?.id ? res : item;
          if (reviewAction) {
            await reload({ silent: true });
            return saved;
          }
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
  }, [data, setData, reload, user, toast, toastApi, yearId, yearOption, yearOptions, setSchoolYear, ensureGoals, isActive, scope]);

  useEffect(() => {
    if (error?.status === 403) setData(null);
  }, [error, setData]);

  if (loading && !data) return <LoadingState />;
  if (error && (!data || error.status === 403)) return <ErrorState error={error} onRetry={reload} />;
  return <EducationPlanContext.Provider value={value}>{children}</EducationPlanContext.Provider>;
}

/**
 * Tải chi tiết các kế hoạch năm/tổ mà trang đang mở cần (danh sách chỉ có bản tóm tắt). loading = còn kế hoạch chưa tải xong.
 */
export function useGoalDetails(ids) {
  const { goals, ensureGoals } = useContext(EducationPlanContext);
  const missing = [...new Set(ids.filter(Boolean).map(String))].filter((id) => goals.find((g) => g.id === id)?.summary);
  const key = missing.join(',');
  const [error, setError] = useState(null);
  useEffect(() => {
    if (!key) return;
    setError(null);
    ensureGoals(key.split(',')).catch(setError);
  }, [key, ensureGoals]);
  return { loading: !!key && !error, error };
}

/** Data and actions of the education-plan module. Only valid inside EducationPlanProvider. */
export const useEducationPlan = () => useContext(EducationPlanContext);
