import { createContext, useCallback, useContext, useMemo } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/contexts/ToastContext';
import { useSchoolYear } from '@/contexts/SchoolYearContext';
import { useAsync } from '@/hooks/useAsync';
import { LoadingState, ErrorState } from '@/components/ui/States';
import { ROLES, ROLE_LABELS } from '@/models/User';
import * as service from '@/services/education-plan/educationPlanService';
import { AGE_GROUPS, CLASSES, toEduYear, fromEduYear } from '@/models/education-plan/educationPlanConstants';
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
export function EducationPlanProvider({ children }) {
  const { user: authUser } = useAuth();
  const toastApi = useToast();
  const { schoolYear: yearId, setSchoolYear, schoolYears } = useSchoolYear();
  // Kế hoạch năm, chủ đề, giáo án cũ và tài liệu của lớp (chủ đề nhánh, kế hoạch chủ đề, giáo án tuần) tải một lần
  const { data, setData, loading, error, reload } = useAsync(
    () =>
      Promise.all([service.getEducationPlans(), service.getClassPlans(yearId), service.getEduConfig()]).then(
        ([plans, classDocs, eduConfig]) => {
          // Cấu hình áp dụng trước khi vẽ để bảng, nhãn lĩnh vực và file xuất dùng cùng một bản
          applyEduConfig(eduConfig);
          return { ...plans, ...classDocs, eduConfig };
        },
      ),
    [yearId],
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
    const CLASS_KEY = { branch: 'branchPlans', theme: 'classThemePlans', week: 'weekPlans' };
    const actor = { id: user.id, fullName: user.name, role: user.role, ageGroupId: user.ageGroupId };
    const classCall =
      (call) =>
      async (kind, ...args) => {
        try {
          const saved = await call(kind, ...args, actor);
          setData((prev) => (prev ? { ...prev, [CLASS_KEY[kind]]: upsert(prev[CLASS_KEY[kind]] || [], saved) } : prev));
          return saved;
        } catch (err) {
          toastApi.error(err.message, 'Không thực hiện được');
          return null;
        }
      };
    const deleteIn = (key, call) => write(key, call, (list, id) => list.filter((x) => x.id !== id));

    return {
      goals: data?.goals || [],
      themes: data?.themes || [],
      lessons: data?.lessons || [],
      branchPlans: data?.branchPlans || [],
      classThemePlans: data?.classThemePlans || [],
      weekPlans: data?.weekPlans || [],
      // Lớp, giáo viên và tổ trưởng của năm đang chọn (cùng nguồn với tài liệu của lớp)
      classes: data?.classes || [],
      staff: data?.staff || [],
      eduConfig: withDefaults(data?.eduConfig),
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
      // Gửi / duyệt hồ sơ chủ đề đổi trạng thái cả giáo án các tuần: nạp lại để các tuần không giữ trạng thái cũ
      actOnClassDoc: async (kind, ...args) => {
        const saved = await classCall(service.actOnClassDoc)(kind, ...args);
        if (saved && kind === 'theme') reload({ silent: true });
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
          const res = await service.saveGoal(item, options);
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
      // Khóa "Đang sửa" (BE:EDU-10): trả kế hoạch mới nhất; người khác đang giữ khóa thì trả null, không báo lỗi
      startEditingGoal: async (id, edit, strict = false) => {
        try {
          const goal = await service.startEditingGoal(id, actor, edit);
          setData((prev) => (prev ? { ...prev, goals: upsert(prev.goals, goal) } : prev));
          return goal;
        } catch (err) {
          if (strict) throw err;
          if (err.status !== 409) toastApi.error(err.message, 'Không mở được trang soạn');
          reload({ silent: true });
          return null;
        }
      },
      heartbeatGoal: (id, edit) => service.heartbeatGoal(id, edit, actor),
      // Thoát trang soạn; lỗi mạng thì để BE tự nhả khóa sau thời hạn
      finishEditingGoal: async (id, opts) => {
        try {
          await service.finishEditingGoal(id, actor, opts);
        } catch {
          reload({ silent: true });
        }
      },
      deleteGoal: async (id) => {
        try {
          await service.deleteGoal(id, data?.goals.find((goal) => goal.id === id)?.revision);
          setData((prev) => (prev ? { ...prev, goals: prev.goals.filter((goal) => goal.id !== id) } : prev));
        } catch (error) {
          toastApi.error(error.message, 'Không xóa được');
        }
      },
      saveTheme: saveIn('themes', service.saveTheme),
      deleteTheme: deleteIn('themes', service.deleteTheme),
      saveLesson: saveIn('lessons', service.saveLesson),
      deleteLesson: deleteIn('lessons', service.deleteLesson),
    };
  }, [data, setData, reload, user, toast, toastApi, yearId, schoolYears, setSchoolYear]);

  if (loading && !data) return <LoadingState />;
  if (error && !data) return <ErrorState error={error} onRetry={reload} />;
  return <EducationPlanContext.Provider value={value}>{children}</EducationPlanContext.Provider>;
}

/** Data and actions of the education-plan module. Only valid inside EducationPlanProvider. */
export const useEducationPlan = () => useContext(EducationPlanContext);
