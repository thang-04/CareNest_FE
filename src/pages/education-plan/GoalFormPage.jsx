import TeamSourceReview from '@/components/education-plan/TeamSourceReview';
import YearPlanSourceCard from '@/components/education-plan/YearPlanSourceCard';
import { RowMenu } from '@/components/ui/RowMenu';
import { branchScheduleIssue } from '@/models/education-plan/branchTemplateSchedule.mjs';
import { planLevel as levelOf, planRoute, inheritAnnual, reapplyTeamDraft } from '@/models/education-plan/planLevel.mjs';
import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams, useLocation } from 'react-router-dom';
import { useSchoolYear } from '@/contexts/SchoolYearContext';
import { ReviewActions } from '@/components/education-plan/reviewUi';
import { Download, FileDown, Save } from '@/components/ui/icons';
import { yearPlanFile } from '@/utils/education-plan/yearPlanDoc';
import { useEducationPlan } from '@/hooks/education-plan/useEducationPlan';
import { useYearPlanAutosave } from '@/hooks/education-plan/useYearPlanAutosave';
import { recoveryText } from '@/models/education-plan/yearPlanAutosave.mjs';
import { useLeaveGuard } from '@/hooks/useLeaveGuard';
import { LeaveConfirmModal } from '@/components/ui/LeaveConfirmModal';
import { ROLES } from '@/models/User';
import { AGE_GROUPS, DOMAINS, EDU_STATUS, SCHOOL_SCOPE, isStandardDomain } from '@/models/education-plan/educationPlanConstants';
import {
  duplicateAbbrThemeIds,
  duplicateNameIds,
  durationRangeIssue,
  mixedSubDomains,
  goalIdsToTicks,
  isBlankTheme,
  numberGoals,
  themeScheduleIssue,
  themeWithoutDates,
  toRows,
} from '@/models/education-plan/goalTable';
import { GoalTable, ThemeEventTable } from '@/components/education-plan/GoalTables';
import { submissionRequirementsIssue } from '@/models/education-plan/submitRequirements.mjs';
import { mergeImportedGoals } from '@/models/education-plan/importGoals.mjs';
import { mergeFilePlan } from '@/models/education-plan/importGoalFile.mjs';
import { ImportGoalFileModal } from '@/components/education-plan/ImportGoalFileModal';
import ImportGoalsModal from '@/components/education-plan/ImportGoalsModal';
import ImportThemesModal from '@/components/education-plan/ImportThemesModal';
import { mergeImportedThemes } from '@/models/education-plan/importThemes.mjs';
import CurriculumGoalsModal from '@/components/education-plan/CurriculumGoalsModal';
import {
  addContentsToExistingGoals,
  addSuggestedContents,
  curriculumAsSourcePlan,
  filterCurriculumContents,
  validContentSelection,
} from '@/models/education-plan/curriculum.mjs';
import { Card, Notice, PageHead, fmtDate } from '@/components/education-plan/eduUi';
import { VersionHistory } from '@/components/education-plan/VersionHistory';
import { yearPlanLines } from '@/models/education-plan/planHistory.mjs';
import DocPreviewModal from '@/components/education-plan/DocPreviewModal';

const suggestTitle = (year, ageGroupId) => {
  const ag = AGE_GROUPS.find((a) => a.id === ageGroupId);
  return ag ? `Kế hoạch giáo dục năm học ${year} nhóm tuổi ${ag.name.split(' (')[0]}` : '';
};

const uid = () => Math.random().toString(36).slice(2, 9);
// BE:EDU-10 — phiên sửa hết hạn sau 90 giây không có tín hiệu

const emptyDomain = (name) => ({ id: uid(), name, rows: [] });
// Luôn đủ 5 lĩnh vực theo thứ tự I–V; lĩnh vực khác (dữ liệu cũ) xếp cuối.
const normalizeDomains = (domains) => [
  ...DOMAINS.map((name) => domains.find((d) => d.name === name) || emptyDomain(name)),
  ...domains.filter((d) => !isStandardDomain(d.name)),
];
const editableStatus = (s) => !s || s === EDU_STATUS.DRAFT || s === EDU_STATUS.REJECTED || s === EDU_STATUS.EDITING;

const emptyForm = (schoolYear, ageGroupId = '') => ({
  title: suggestTitle(schoolYear, ageGroupId),
  ageGroupId,
  schoolYear,
  description: '',
  domains: DOMAINS.map((name) => emptyDomain(name)),
  themes: [],
  breaks: [],
});

// Kế hoạch đã lưu → dữ liệu form
const formOf = (goal) => ({
  ...emptyForm(goal.schoolYear),
  ...goal,
  // Bản nháp từng chọn mục tiêu cho chủ đề được đổi sang dấu tích ở cột "Chủ đề thực hiện"
  ...goalIdsToTicks(
    normalizeDomains(goal.domains.map((d) => ({ id: d.id || uid(), name: d.name, rows: toRows(d, uid) }))),
    // Chủ đề chưa có tên viết tắt thì lấy chữ cái đầu của tên
    goal.themes || [],
  ),
  breaks: goal.breaks || [],
});

const NO_THEME_NOTE = 'Chưa có chủ đề từ kế hoạch năm học nguồn để phân bổ nội dung.';

export function focusYearPlanIssue(root, issue) {
  const section = root?.querySelector(`.ga-plan-section--${issue.section}`);
  const target =
    (issue.control && section?.querySelector(`#${issue.control}`)) ||
    section?.querySelector('[aria-invalid="true"]') ||
    section?.querySelector('.ga-card-toggle');
  target?.scrollIntoView({ block: 'center' });
  target?.focus({ preventScroll: true });
}

/** Lập / sửa kế hoạch giáo dục năm học của một nhóm tuổi theo mẫu MN Thái Dương (Phó HT và tổ trưởng cùng soạn). */
export default function GoalFormPage({ planLevel = 'TEAM' }) {
  const annual = planLevel === 'SCHOOL_YEAR';
  const basePath = planRoute({ planLevel });
  const pageLabel = annual ? 'Kế hoạch năm học' : 'Kế hoạch giáo dục tổ';
  const { id } = useParams();
  const location = useLocation();
  const {
    goals: allGoals,
    schoolYear,
    saveGoal,
    refreshGoal,
    refreshPlans,
    resolveGoalReview,
    toast,
    user,
    staff,
    eduConfig,
  } = useEducationPlan();
  const levelsAvailable = eduConfig?.durationPolicyAvailable !== false;
  const goals = allGoals.filter((g) => levelOf(g) === planLevel);
  const [preview, setPreview] = useState(null);
  const { schoolYears: yearOptions } = useSchoolYear();
  const navigate = useNavigate();
  const existing = goals.find((g) => g.id === id);
  const teamEditing = !annual && !!existing;
  const isVp = user.role === ROLES.VICE_PRINCIPAL;
  const isLeader = user.role === ROLES.TEAM_LEADER;
  const annualPolicy = eduConfig?.workflowPolicy?.schoolYear || { creators: [ROLES.VICE_PRINCIPAL], reviewers: [ROLES.PRINCIPAL] };
  const annualCreator = annualPolicy.creators.includes(user.role) && !annualPolicy.reviewers.includes(user.role);
  const allowedAgeGroupIds =
    eduConfig?.[annual ? 'schoolYearCreationScopes' : 'yearCreationScopes'] ??
    (annual ? (annualCreator ? AGE_GROUPS.map((a) => a.id) : []) : isLeader ? [user.ageGroupId] : AGE_GROUPS.map((a) => a.id));

  const [form, setForm] = useState(() =>
    existing
      ? formOf(existing)
      : // Mã cố định ngay từ đầu để các lần lưu cùng ghi vào một kế hoạch
        {
          ...emptyForm(schoolYear, isLeader ? user.ageGroupId : ''),
          ...(!annual ? { title: '' } : {}),
          planLevel,
          branchTemplates: [],
          id: `g-${uid()}`,
        },
  );
  const [preservedDraft, setPreservedDraft] = useState(null);
  const [resolving, setResolving] = useState(false);
  const [reviewError, setReviewError] = useState('');
  const inherited = !annual && form.sourceMode === 'INHERITED';
  const annualSources = allGoals.filter(
    (g) =>
      levelOf(g) === 'SCHOOL_YEAR' &&
      g.status === EDU_STATUS.APPROVED &&
      (g.current ?? !allGoals.some((next) => next.sourcePlanId === g.id && next.status === EDU_STATUS.APPROVED)) &&
      g.schoolYear === form.schoolYear &&
      (!form.ageGroupId || g.ageGroupId === form.ageGroupId),
  );
  const [errors, setErrors] = useState({});
  const planRoot = useRef(null);
  const errorSummary = useRef(null);
  const focusValidation = useRef(false);
  const planIssues = Object.entries(errors)
    .filter(([key]) => key !== 'domains' && key !== 'themes')
    .map(([key, message]) => ({
      key,
      message: typeof message === 'string' ? message : 'Có tên viết tắt chủ đề bị trùng. Kiểm tra các ô báo đỏ.',
      section: key === 'source' ? 'source' : ['title', 'ageGroupId'].includes(key) ? 'info' : key === 'domains' ? 'goals' : 'themes',
      control: key === 'title' ? 'title' : key === 'ageGroupId' ? 'ag' : key === 'source' ? 'annual-source' : null,
    }));
  useEffect(() => {
    if (!focusValidation.current) return;
    focusValidation.current = false;
    if (!Object.keys(errors).length) return;
    errorSummary.current?.scrollIntoView({ block: 'center' });
    errorSummary.current?.focus({ preventScroll: true });
  }, [errors]);

  // BE:EDU-25 — phiên bản điều chỉnh dùng chung (năm học, nhóm tuổi) với các bản trước nên không tính là trùng
  const sameScope = existing && existing.schoolYear === form.schoolYear && existing.ageGroupId === form.ageGroupId;
  const dupGoal = !sameScope && goals.some((g) => g.id !== form.id && g.schoolYear === form.schoolYear && g.ageGroupId === form.ageGroupId);
  const [importing, setImporting] = useState(false);
  const [importingThemes, setImportingThemes] = useState(false);
  const [ministryOpen, setMinistryOpen] = useState(false);
  const [importReport, setImportReport] = useState(null);
  const [fileOpen, setFileOpen] = useState(false);

  const set = (patch) => {
    setForm((f) => ({ ...f, ...patch }));
    setErrors((e) => {
      const next = { ...e };
      Object.keys(patch).forEach((k) => delete next[k]);
      return next;
    });
  };
  // Ngày bắt đầu, kết thúc năm học của kế hoạch: lịch chỉ cho chọn ngày trong khoảng này (BE kiểm lại khi lưu)
  const yearOption = yearOptions.find((y) => y.label.replace(/\s*[-–]\s*/g, '-') === form.schoolYear.replace(/\s*[-–]\s*/g, '-'));
  const fileYearRange = { start: yearOption?.startDate, end: yearOption?.endDate };
  const yearRange = {
    start: yearOption?.startDate || `${form.schoolYear.slice(0, 4)}-09-01`,
    end: yearOption?.endDate || `${Number(form.schoolYear.slice(0, 4)) + 1}-05-31`,
  };
  // Phó HT và tổ trưởng nhóm tuổi cùng soạn, mỗi lúc một người giữ khóa "Đang sửa" (BE:EDU-03, EDU-10);
  const isReviewStatus = existing?.status === 'REVIEW' || existing?.status === EDU_STATUS.PENDING_VP;
  const pendingEdit = false;
  const permitted = !existing
    ? allowedAgeGroupIds.includes(form.ageGroupId) || (!form.ageGroupId && allowedAgeGroupIds.length > 0)
    : existing?.permissions
      ? existing.permissions.canEdit
      : !isReviewStatus && editableStatus(existing?.status) && (isVp || (isLeader && form.ageGroupId === user.ageGroupId));

  const [contentReady, setContentReady] = useState(true);
  const [contentError, setContentError] = useState('');
  const [finishing, setFinishing] = useState(false);
  const editRef = useRef({ revision: existing?.revision ?? 0 });
  const canEdit = permitted;

  // Dòng chủ đề / đợt nghỉ còn trống (vừa Enter thêm) không tính vào kiểm tra, cột tích và bản lưu
  const themes = form.themes.filter((t) => !isBlankTheme(t));
  const numbers = numberGoals(form.domains);
  const totalGoals = Object.keys(numbers).length;

  const outOfYear = [...form.themes, ...form.breaks].some((x) =>
    [x.start, x.end].some((d) => d && (d < yearRange.start || d > yearRange.end)),
  );
  const outOfYearMsg = `Có chủ đề hoặc đợt nghỉ nằm ngoài năm học (${fmtDate(yearRange.start)} – ${fmtDate(yearRange.end)}).`;
  const durationPolicy =
    form.durationPolicySnapshot ||
    (existing
      ? { mode: 'MISSING_OR_UNKNOWN' }
      : {
          mode: 'BOUNDED',
          ...(eduConfig?.durationPolicy || { theme: { minWeeks: 2, maxWeeks: 4 }, branch: { minWeeks: 1, maxWeeks: 2 } }),
        });
  const durationTheme = themes
    .map((t) => durationRangeIssue(t, form.breaks, durationPolicy?.theme, `Chủ đề "${t.name || t.abbr}"`))
    .find(Boolean);
  const scheduleIssue =
    themeScheduleIssue(themes, form.breaks) ||
    durationTheme ||
    branchScheduleIssue(form.branchTemplates || [], form.breaks, durationPolicy?.branch);
  // EDU-52: chỉ khi bấm Ban hành mới bắt buộc chọn ngày cho mọi chủ đề
  const [requireDates, setRequireDates] = useState(false);
  const validate = (s, action) => {
    const e = {};
    if (s === 0) {
      if (!form.title.trim()) e.title = 'Nhập tên kế hoạch';
      if (!annual && !existing && levelsAvailable && !form.curriculumSourcePlanId) e.source = 'Chọn kế hoạch năm học đã ban hành';
      if (!form.ageGroupId) e.ageGroupId = 'Chọn nhóm tuổi áp dụng';
      if (form.ageGroupId && dupGoal) e.ageGroupId = `Nhóm tuổi này đã có ${pageLabel.toLowerCase()}. Mở kế hoạch đã có để chỉnh sửa.`;
    }
    if (s === 1) {
      const requiredIssue = submissionRequirementsIssue({
        ...form,
        planLevel,
        durationPolicySnapshot: durationPolicy,
      });
      if (requiredIssue) {
        const isThemeIssue =
          requiredIssue.includes('chủ đề') ||
          requiredIssue.includes('Chủ đề') ||
          requiredIssue.includes('thời lượng') ||
          requiredIssue.includes('Nhánh') ||
          requiredIssue.includes('nhánh');
        setErrors(isThemeIssue ? { themes: requiredIssue } : { domains: requiredIssue });
        return false;
      }
      if (!annual && (form.reviewItems || []).some((item) => !item.resolved)) {
        setErrors({ source: 'Còn mục cần rà soát theo nguồn mới. Sửa dấu tích và xác nhận từng mục trước khi gửi.' });
        return false;
      }
      if (annual && (form.branchTemplates || []).some((t) => !t.name?.trim())) {
        setErrors({ themes: 'Nhập tên chủ đề nhánh / dự án hoặc xóa dòng chưa dùng trước khi gửi.' });
        return false;
      }
      const abbrs = themes.map((t) => t.abbr.trim().toLowerCase());
      if (themes.some((t) => !t.name.trim() || !t.abbr.trim()))
        e.themes = 'Mỗi chủ đề cần có tên và tên viết tắt (dùng làm cột "Chủ đề thực hiện" ở bảng mục tiêu).';
      // Viết tắt trùng: chặn gửi / ban hành nhưng chỉ báo đỏ tại ô (EDU-42), không hiện khung thông báo
      else if (abbrs.some((a, i) => abbrs.indexOf(a) !== i)) e.themeAbbr = true;
      else if (themes.some((t) => t.start && t.end && t.end < t.start)) e.themes = 'Có chủ đề có ngày kết thúc trước ngày bắt đầu.';
      else if (outOfYear) e.themes = outOfYearMsg;
      else if (scheduleIssue) e.themes = scheduleIssue;
      else if (action === 'approve' && themeWithoutDates(themes))
        e.themes = `Chủ đề "${themeWithoutDates(themes).name || themeWithoutDates(themes).abbr}" chưa chọn Từ ngày, Đến ngày. Chọn ngày cho mọi chủ đề trước khi ban hành.`;
      else if (totalGoals === 0) e.domains = 'Nhập ít nhất một mục tiêu';
      // EDU-51: tên trùng trong cùng lĩnh vực con đã báo đỏ tại ô
      else if (duplicateNameIds(form.domains).size)
        e.domains = 'Có tên bị trùng trong cùng lĩnh vực con (dòng báo đỏ). Sửa trước khi gửi hoặc ban hành.';
      // EDU-53: lĩnh vực có lĩnh vực con thì mọi dòng phải thuộc một lĩnh vực con
      else if (mixedSubDomains(form.domains).length)
        e.domains = `Lĩnh vực ${mixedSubDomains(form.domains).join(', ')} đã có lĩnh vực con nhưng còn dòng chưa thuộc lĩnh vực con nào. Thêm lĩnh vực con ở ô trên cùng của lĩnh vực trước khi gửi hoặc ban hành.`;
    }
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const today = () => new Date().toISOString().slice(0, 10);
  const me = { userId: user.id, name: user.name, role: user.role, title: user.title, at: today() };
  const log = (action, note) => [...(form.history || []), { at: today(), by: user.name, action, ...(note ? { note } : {}) }];
  const build = (status, extra = {}, source = form) => {
    const ag = AGE_GROUPS.find((a) => a.id === source.ageGroupId);
    const agCode = (ag?.name.split(' (')[0] || 'X')
      .split(' ')
      .map((w) => w[0])
      .join('')
      .slice(0, 3)
      .toUpperCase();
    // Giữ nguyên dữ liệu đang gõ; gửi duyệt/ban hành mới kiểm tra đầy đủ.
    const domains = source.domains;
    const nos = numberGoals(domains);
    return {
      planLevel,
      sourceMode: source.sourceMode,
      curriculumSourcePlanId: source.curriculumSourcePlanId,
      branchTemplates: source.branchTemplates || [],
      durationPolicySnapshot:
        source.durationPolicySnapshot?.mode && source.durationPolicySnapshot.mode !== 'MISSING_OR_UNKNOWN'
          ? source.durationPolicySnapshot
          : eduConfig?.durationPolicy
            ? { mode: 'BOUNDED', ...eduConfig.durationPolicy }
            : { mode: 'BOUNDED', theme: { minWeeks: 2, maxWeeks: 4 }, branch: { minWeeks: 1, maxWeeks: 2 } },
      remapWarnings: source.remapWarnings,
      sourceChanges: source.sourceChanges,
      previousSourcePlanId: source.previousSourcePlanId,
      reviewItems: source.reviewItems || [],
      newItems: source.newItems || [],
      revision: source.revision,
      contentRevision: source.contentRevision,
      id: source.id || `g-${uid()}`,
      code: source.code || `KHNH-${source.schoolYear.slice(2, 4)}${source.schoolYear.slice(-2)}-${agCode}`,
      schoolYear: source.schoolYear,
      ageGroupId: source.ageGroupId,
      title: source.title,
      description: source.description,
      status,
      createdAt: source.createdAt || today(),
      sentAt: source.sentAt || null,
      createdBy: source.createdBy || user.name,
      owner: source.owner || me,
      sentBy: source.sentBy || null,
      issued: source.issued || null,
      history: source.history || [],
      // Phiên bản (BE:EDU-25) do service cấp, giữ nguyên khi lưu
      versionNo: source.versionNo || 1,
      sourcePlanId: source.sourcePlanId || null,
      file: source.file || null,
      themes: source.themes,
      breaks: source.breaks,
      // items: danh sách mục tiêu (số MT, câu mục tiêu, nội dung) để các màn đọc mục tiêu năm vẫn dùng được
      domains: domains.map((d) => ({
        ...d,
        items: d.rows
          .filter((r) => r.kind === 'goal')
          .map((r) => ({
            id: r.id,
            code: r.displayLabel?.trim() || `MT${nos[r.id]}`,
            text: r.text,
            contents: r.contents,
            requirements: [],
          })),
      })),
      ...extra,
    };
  };

  const finished = useRef(false);
  const savedId = useRef(id || null);
  const currentPlanId = existing?.id || (goals.some((g) => g.id === form.id) ? form.id : null);
  const saveReady =
    canEdit &&
    (!annual || levelsAvailable) &&
    contentReady &&
    !!form.ageGroupId &&
    !!form.schoolYear &&
    !dupGoal &&
    (annual || !!existing || annualSources.some((source) => source.id === form.curriculumSourcePlanId));
  const saver = useYearPlanAutosave({
    doc: form,
    setDoc: setForm,
    enabled: saveReady,
    mayBackup: !existing || (contentReady && !contentError),
    userId: user.id,
    planKey: id || `new-${planLevel}-${schoolYear}`,
    onConflict: (error) => {
      setContentError(error.message || 'Đã mất quyền sửa');
      setContentReady(false);
    },
    save: async (snapshot, requestId) => {
      // BE:EDU-42 viết tắt chủ đề trùng: không lưu tới khi sửa
      if (duplicateAbbrThemeIds(snapshot.themes || []).size)
        throw Object.assign(new Error('Tên viết tắt của các chủ đề bị trùng.'), { status: 400 });
      if (!snapshot.title.trim()) throw Object.assign(new Error('Nhập tên kế hoạch'), { status: 400 });
      if (!annual && !existing && !annualSources.some((source) => source.id === snapshot.curriculumSourcePlanId))
        throw Object.assign(new Error('Nguồn không còn hợp lệ. Tải lại danh sách và chọn kế hoạch năm học hiện hành.'), { status: 409 });
      const item = build(pendingEdit ? EDU_STATUS.PENDING_VP : EDU_STATUS.DRAFT, {}, snapshot);
      const saved = await saveGoal(item, { silent: true, edit: { ...editRef.current, requestId } });
      editRef.current.revision = saved.revision ?? editRef.current.revision;
      if (saved.id) savedId.current = saved.id;
      return formOf(saved);
    },
  });
  const reloadContent = async () => {
    setPreservedDraft((old) => old || structuredClone(form));
    try {
      await saver.settle();
      const fresh = currentPlanId ? await refreshGoal(currentPlanId) : null;
      if (fresh) {
        editRef.current.revision = fresh.revision ?? 0;
        const value = formOf(fresh);
        setForm(value);
        saver.markClean(value);
      } else await refreshPlans();
      setContentReady(true);
      setContentError('');
    } catch (error) {
      setContentError(error.message);
    }
  };
  useEffect(() => {
    if (!id && currentPlanId && !saver.unsaved) {
      navigate(`${basePath}/${currentPlanId}/edit${location.search}`, {
        replace: true,
        state: { backTo: location.state?.backTo },
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, currentPlanId, saver.unsaved]);
  const guard = useLeaveGuard({ when: saver.unsaved && !finished.current, onSave: saver.save });
  const exitTo = (to) => () => {
    if (location.state?.backTo === to) return navigate(-1);
    if (location.state?.backToPrev === to) return navigate(-2);
    navigate(to, { replace: true });
  };
  const downloadRecovery = (doc = form) => {
    const blob = new Blob([recoveryText(doc)], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'ke-hoach-nam-ban-khoi-phuc.txt';
    link.click();
    URL.revokeObjectURL(url);
  };

  // EDU-10: mốc giữ khi bản trên hệ thống đã đổi revision thì chỉ xem/đối chiếu, không ghi đè
  const historyBlock = (entry) => {
    if (!contentReady || finishing) return 'Chưa có quyền sửa kế hoạch này nên chỉ xem được.';
    if (entry && entry.baseRevision !== (form.revision ?? 0))
      return 'Kế hoạch trên hệ thống đã thay đổi sau thời điểm này nên không dùng lại được. Tải nội dung để đối chiếu.';
    return null;
  };

  // Thẻ 1, 2, 3 thu gọn được (Tiền 03/11); trạng thái chỉ giữ trong màn
  const [folded, setFolded] = useState({});
  const fold = (key) => ({ collapsed: !!folded[key], onToggle: () => setFolded((f) => ({ ...f, [key]: !f[key] })) });

  // Kiểm tra trước khi gửi / ban hành; mở lại mọi thẻ để thấy chỗ báo lỗi
  const checkBeforeFinish = (action) => {
    setFolded({});
    // BE:EDU-52 (Tiền 10/11/2026): điều kiện ban hành chặn từ bước gửi ⇒ báo "Chọn ngày" cả khi gửi
    setRequireDates(action === 'approve' || action === 'submit');
    focusValidation.current = true;
    return validate(0) && validate(1, action);
  };

  // submit: tổ trưởng gửi Phó HT duyệt; approve: Phó HT ban hành (bản mình soạn hoặc bản đang chờ)
  const finish = async (action, note) => {
    if (finishing) return null;
    setFinishing(true);
    setReviewError('');
    const item =
      action === 'submit'
        ? build('REVIEW', { sentAt: today(), sentBy: me, history: log('Gửi duyệt', note) })
        : build(EDU_STATUS.APPROVED, {
            issued: me,
            history: log('Ban hành', note),
          });
    try {
      if (!(await saver.save())) {
        const msg = saver.error
          ? 'Không thể lưu bản nháp. Vui lòng kiểm tra lại thông tin.'
          : 'Không thể lưu bản nháp trước khi gửi duyệt.';
        setReviewError(msg);
        toast(msg, 'err');
        throw new Error(msg);
      }
      finished.current = true;
      const targetId = savedId.current || form.id;
      const saved = await saveGoal(
        {
          ...build(item.status, {}, saver.current()),
          durationPolicySnapshot: durationPolicy,
          history: item.history,
          issued: item.issued,
          sentBy: item.sentBy,
          id: targetId,
        },
        { action, silent: true, edit: { ...editRef.current, requestId: crypto.randomUUID() } },
      );
      if (!saved) {
        throw new Error('Máy chủ không phản hồi kết quả sau khi gửi.');
      }
      saver.clearRecovery();
      toast(action === 'submit' ? `Đã gửi ${pageLabel.toLowerCase()} để duyệt` : `Đã ban hành ${pageLabel.toLowerCase()}`);
      guard.leaveNow(exitTo(`${basePath}/${saved.id}`));
      return saved;
    } catch (error) {
      setReviewError(error.message);
      toast(error.message, 'err');
      if (error.status === 409 || error.status === 403) {
        setContentError(error.message);
        setContentReady(false);
      }
      finished.current = false;
      throw error;
    } finally {
      setFinishing(false);
    }
  };

  /* ---------- Nhập dữ liệu ---------- */

  const importState = useRef(null);
  importState.current = { form, yearRange: fileYearRange, allowed: annual && canEdit && contentReady && !finishing && !contentError };
  // EDU-46: áp dụng nguyên tử theo chế độ, dùng khoảng năm học cấu hình của hệ thống.
  const importFile = (preview, mode) => {
    const current = importState.current;
    if (!current.allowed) return false;
    const { patch, report, error } = mergeFilePlan(current.form, preview, () => `file-${uid()}`, {
      allowedAgeGroupIds,
      yearRange: current.yearRange,
      mode,
    });
    if (error) {
      toast(error, 'warn');
      return false;
    }
    set(patch);
    setImportReport(report);
    const warnings = report.warnings.length || report.missingThemes.length;
    toast(
      warnings
        ? 'Đã áp dụng file. Kiểm tra cảnh báo và nội dung rồi bấm Lưu.'
        : 'Đã áp dụng file vào bản đang soạn. Bấm Lưu để ghi thay đổi.',
      warnings ? 'warn' : 'ok',
    );
    return true;
  };

  const importGoals = ({ source, selectedGoalIds, dropSubIds = [] }) => {
    const current = importState.current;
    if (!current.allowed) return false;
    const { domains, report } = mergeImportedGoals(current.form, source, selectedGoalIds, () => `import-${uid()}`, { dropSubIds });
    if (report.added) set({ domains });
    setImportReport(report);
    const skipped = report.duplicates ? ` · bỏ qua ${report.duplicates} mục tiêu trùng` : '';
    const unavailable = report.unavailable.length ? ` · ${report.unavailable.length} mục tiêu chưa thêm được` : '';
    toast(`Đã thêm ${report.added} mục tiêu${skipped}${unavailable}`, report.added ? 'ok' : 'warn');
    return true;
  };
  // BE:EDU-43 — chủ đề, đợt nghỉ lấy từ kế hoạch khác thêm vào cuối; ngày ngoài năm học do kiểm tra sẵn có báo để sửa
  const importThemes = ({ source, themeIds, breakIds }) => {
    if (!importState.current.allowed) return false;
    const {
      themes: nextThemes,
      breaks: nextBreaks,
      report,
    } = mergeImportedThemes(importState.current.form, source, { themeIds, breakIds }, () => `import-${uid()}`);
    if (report.themes || report.breaks) set({ themes: nextThemes, breaks: nextBreaks });
    const parts = [`Đã thêm ${report.themes} chủ đề`, report.breaks && `${report.breaks} đợt nghỉ`].filter(Boolean).join(', ');
    const shifted =
      report.shifted && (report.themes || report.breaks) ? ' · ngày giữ như kế hoạch nguồn, xem gợi ý dời ngày ở bảng chủ đề' : '';
    toast(
      `${parts}${report.skipped ? ` · bỏ qua ${report.skipped} dòng đã có` : ''}${shifted}`,
      report.themes || report.breaks ? 'ok' : 'warn',
    );
    return true;
  };
  // BE:EDU-28 — mục tiêu của Bộ dựng thành kế hoạch nguồn để dùng chung cách ghép của EDU-24
  // Mục tiêu đã có trong bản soạn thì chỉ thêm nội dung mới tích vào đúng mục tiêu đó (Tiền 04/11)
  const importMinistryGoals = (goals) => {
    const current = importState.current;
    if (!current.allowed) return false;
    const makeId = () => `import-${uid()}`;
    const existing = addContentsToExistingGoals(current.form, goals, makeId);
    const rest = goals.filter((g) => !existing.matched.has(g.id));
    const { domains, report } = mergeImportedGoals(
      { ...current.form, domains: existing.domains },
      curriculumAsSourcePlan(rest),
      rest.map((g) => `cg-${g.id}`),
      makeId,
    );
    if (report.added || existing.added) set({ domains });
    setImportReport(report);
    const contents = existing.added ? ` · thêm ${existing.added} nội dung vào mục tiêu đã có` : '';
    const unavailable = report.unavailable.length ? ` · ${report.unavailable.length} mục tiêu chưa thêm được` : '';
    toast(`Đã thêm ${report.added} mục tiêu${contents}${unavailable}`, report.added || existing.added ? 'ok' : 'warn');
    return true;
  };
  const addMinistryContents = (goalRowId, suggestions, context) => {
    if (!importState.current.allowed) return false;
    const current = importState.current.form;
    if (!context || context.formId !== current.id || context.ageGroupId !== current.ageGroupId) return false;
    const eligible = filterCurriculumContents(current, context.filter, context.catalog);
    const valid = validContentSelection(current, context.filter, goalRowId, eligible, new Set(suggestions.map((c) => c.id)));
    if (!valid.targetId || valid.items.length !== suggestions.length || !valid.items.length) return false;
    const { domains, added, duplicates } = addSuggestedContents(current, valid.targetId, valid.items, () => `import-${uid()}`);
    if (added) set({ domains });
    toast(`Đã thêm ${added} nội dung${duplicates ? ` · bỏ qua ${duplicates} nội dung trùng` : ''}`, added ? 'ok' : 'warn');
    return true;
  };

  if (!permitted && !contentError)
    return (
      <div className="page ga-page">
        <PageHead crumbs={[{ label: 'Kế hoạch giáo dục' }, { label: pageLabel, to: basePath }]} title={pageLabel} />
        <Notice tone="warn">
          {existing?.status === EDU_STATUS.APPROVED
            ? 'Kế hoạch đã ban hành nên không sửa được.'
            : isReviewStatus
              ? `Kế hoạch đang ở trạng thái duyệt nên không sửa được.`
              : 'Bạn chỉ lập, sửa được kế hoạch giáo dục tổ của nhóm tuổi mình phụ trách.'}
        </Notice>
      </div>
    );

  return (
    <div ref={planRoot} className={`page ga-page ga-class-editor ga-year-page${annual ? ' ga-annual-plan' : ' ga-team-plan'}`}>
      {contentError && (
        <Notice tone="warn">
          <div className="row row--wrap gap-2">
            <span>{contentError}</span>
            <button type="button" className="btn" onClick={reloadContent}>
              Tải nội dung mới để đối chiếu
            </button>
            <button type="button" className="btn" onClick={() => downloadRecovery()}>
              Tải nội dung để đối chiếu
            </button>
          </div>
        </Notice>
      )}
      {preservedDraft && (
        <Notice tone="warn">
          <div className="stack">
            <span>
              Nội dung trước khi tải lại được giữ để đối chiếu: {preservedDraft.title}. Kiểm tra cây nguồn mới trước khi áp dụng lại.
            </span>
            <div className="row row--wrap gap-2">
              <button type="button" className="btn" onClick={() => downloadRecovery(preservedDraft)}>
                Tải nội dung trước khi tải lại
              </button>
              {!annual && contentReady && !contentError && (
                <button
                  type="button"
                  className="btn"
                  onClick={() => {
                    setForm((fresh) => reapplyTeamDraft(fresh, preservedDraft));
                    setPreservedDraft(null);
                  }}
                >
                  Áp dụng lại tên, mô tả và dấu tích còn hợp lệ
                </button>
              )}
            </div>
          </div>
        </Notice>
      )}
      {annual && !levelsAvailable && (
        <Notice tone="warn">Bạn đang soạn bản xem trước. Máy chủ chưa hỗ trợ lưu và gửi duyệt kế hoạch năm học.</Notice>
      )}
      <fieldset disabled={!canEdit || !contentReady || finishing || resolving} className="ga-edit-fieldset">
        <div className="ga-sticky-head">
          <PageHead
            crumbs={[
              { label: 'Kế hoạch giáo dục' },
              { label: pageLabel, to: basePath },
              { label: existing ? 'Chỉnh sửa' : 'Lập kế hoạch' },
            ]}
            title={`${existing ? 'Chỉnh sửa' : 'Lập'} ${pageLabel.toLowerCase()}`}
          />
          <div className="ga-year-toolbar" role="group" aria-label={annual ? 'Thao tác kế hoạch năm học' : 'Thao tác kế hoạch giáo dục tổ'}>
            {annual && (
              <div className="ga-year-toolbar__group">
                <RowMenu
                  label="Lấy và nhập nội dung kế hoạch năm học"
                  text="Lấy / nhập nội dung"
                  icon={<Download size={16} aria-hidden />}
                  className="btn btn--sm btn--outline-primary"
                  items={[
                    { label: 'Lấy kế hoạch năm', icon: Download, onClick: () => setImporting(true) },
                    {
                      label: 'Lấy từ Chương trình của Bộ',
                      icon: Download,
                      disabled: !form.ageGroupId,
                      onClick: () => setMinistryOpen(true),
                    },
                    { label: 'Nhập file', icon: Download, onClick: () => setFileOpen(true) },
                  ]}
                />
              </div>
            )}
            <div className="ga-year-toolbar__group ga-year-toolbar__group--end">
              <p className="muted text-sm ga-year-save-status" aria-live="polite">
                {saveReady ? saver.label : contentError || 'Chọn năm học và nhóm tuổi; đang chờ quyền sửa'}
              </p>
              {annual && canEdit && (
                <VersionHistory
                  drafts={saver.drafts}
                  saved={saver.saved()}
                  current={form}
                  unsaved={saver.unsaved}
                  linesOf={yearPlanLines}
                  onUse={(entry, doc) => saver.restore(entry || { doc })}
                  blockedReason={historyBlock}
                  actions={(entry, doc) =>
                    entry && (
                      <button type="button" className="btn" onClick={() => downloadRecovery(doc)}>
                        Tải nội dung để đối chiếu
                      </button>
                    )
                  }
                />
              )}
              <button
                type="button"
                className="btn btn--sm btn--primary"
                onClick={saver.save}
                disabled={!saveReady || saver.saving || (!saver.unsaved && !saver.error)}
                title="Lưu (Ctrl+S)"
              >
                <Save size={16} aria-hidden /> Lưu
              </button>
              <ReviewActions
                name={pageLabel.toLowerCase()}
                approveLabel={pendingEdit ? 'Lưu và ban hành' : 'Ban hành'}
                can={{
                  send:
                    !contentError &&
                    !(form.reviewItems || []).some((item) => !item.resolved) &&
                    (!annual || levelsAvailable) &&
                    (existing?.permissions ? existing.permissions.canSubmit : canEdit),
                  approve: false,
                }}
                variant="btn--outline-primary"
                unsaved={saver.unsaved}
                onSave={saver.save}
                beforeOpen={checkBeforeFinish}
                notes={{
                  submit: 'Kế hoạch sẽ bị khóa cho tới khi được ban hành hoặc trả lại.',
                  approve: `Ban hành "${form.title}"? Giáo viên trong khối sẽ thấy kế hoạch này. Sau đó xuất file để in và ký.`,
                }}
                onAct={finish}
              />
              <button
                type="button"
                className="btn btn--sm btn--outline-primary"
                onClick={() => setPreview(yearPlanFile(build(existing?.status || EDU_STATUS.DRAFT), numbers, staff))}
              >
                <FileDown size={16} aria-hidden /> Xuất file
              </button>
            </div>
          </div>
        </div>

        {reviewError && <Notice tone="err">{reviewError}</Notice>}

        {!existing && dupGoal && (
          <Notice tone="warn">
            Nhóm tuổi này đã có kế hoạch trong năm học, kể cả bản chưa ban hành. <Link to={basePath}>Mở danh sách kế hoạch</Link> để tiếp
            tục bản hiện có.
          </Notice>
        )}

        {planIssues.length > 0 && (
          <Notice tone="err">
            <div ref={errorSummary} tabIndex={-1} role="alert" aria-label="Các phần cần kiểm tra" className="ga-plan-error-summary">
              <strong>Kiểm tra các mục sau trước khi gửi:</strong>
              <ul>
                {planIssues.map((issue) => (
                  <li key={issue.key}>
                    <button
                      type="button"
                      className="link-btn"
                      onClick={() => {
                        setFolded((current) => ({ ...current, [issue.section]: false }));
                        requestAnimationFrame(() => focusYearPlanIssue(planRoot.current, issue));
                      }}
                    >
                      {issue.message}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          </Notice>
        )}

        <Card title="1. Thông tin chung" className="ga-plan-section--info" {...fold('info')}>
          <div className="table-wrap">
            <table
              className={`table ga-plan-table ga-goal-table ga-year-info ${annual ? 'ga-info-annual' : 'ga-info-team'}${teamEditing ? ' ga-info-fixed' : ''}`}
              aria-label="Thông tin chung"
            >
              <thead>
                <tr>
                  <th className="cell--fixed">Thông tin</th>
                  <th className={teamEditing ? 'cell--fixed' : 'ga-th-editable'}>Nội dung</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <th scope="row" className="cell--fixed">
                    <label htmlFor="year">
                      Năm học <span className="req">*</span>
                    </label>
                  </th>
                  <td className="cell--fixed">
                    <input id="year" className="ga-cell-input" value={form.schoolYear} readOnly />
                  </td>
                </tr>
                <tr>
                  <th scope="row" className="cell--fixed">
                    <label htmlFor="scope">Phạm vi áp dụng</label>
                  </th>
                  <td className="cell--fixed">
                    <input id="scope" className="ga-cell-input" value={SCHOOL_SCOPE} readOnly />
                  </td>
                </tr>
                <tr>
                  <th scope="row" className="cell--fixed">
                    <label htmlFor="ag">
                      Nhóm tuổi áp dụng <span className="req">*</span>
                    </label>
                  </th>
                  <td className={isLeader || !!existing ? 'cell--fixed' : 'ga-cell-editable'}>
                    <select
                      id="ag"
                      className="ga-cell-input"
                      value={form.ageGroupId}
                      disabled={isLeader || !!existing}
                      aria-invalid={!!errors.ageGroupId}
                      aria-describedby={errors.ageGroupId ? 'ag-error' : undefined}
                      onChange={(e) => {
                        const ageGroupId = e.target.value;
                        const keep = form.title.trim() && form.title !== suggestTitle(form.schoolYear, form.ageGroupId);
                        set(!annual || keep ? { ageGroupId } : { ageGroupId, title: suggestTitle(form.schoolYear, ageGroupId) });
                      }}
                    >
                      <option value="">Chọn nhóm tuổi</option>
                      {AGE_GROUPS.map((a) => {
                        const taken = !existing && goals.some((g) => g.schoolYear === form.schoolYear && g.ageGroupId === a.id);
                        return (
                          <option key={a.id} value={a.id} disabled={taken || (!existing && !allowedAgeGroupIds.includes(a.id))}>
                            {a.name}
                            {taken ? ' — Đã có kế hoạch' : ''}
                          </option>
                        );
                      })}
                    </select>
                    {errors.ageGroupId && (
                      <span id="ag-error" className="field__error" role="alert">
                        {errors.ageGroupId}
                      </span>
                    )}
                  </td>
                </tr>
                <tr>
                  <th scope="row" className="cell--fixed">
                    <label htmlFor="author">Người soạn</label>
                  </th>
                  <td className="cell--fixed">
                    <input id="author" className="ga-cell-input" value={user.name} readOnly />
                  </td>
                </tr>
                <tr>
                  <th scope="row" className="cell--fixed">
                    <label htmlFor="title">
                      Tên kế hoạch <span className="req">*</span>
                    </label>
                  </th>
                  <td className={teamEditing ? 'cell--fixed' : 'ga-cell-editable'}>
                    <div className="ga-year-title-field">
                      <input
                        id="title"
                        type="text"
                        readOnly={teamEditing}
                        className="ga-cell-input"
                        maxLength={150}
                        placeholder="Chọn nhóm tuổi áp dụng để hệ thống đề xuất tên"
                        value={form.title}
                        aria-invalid={!!errors.title}
                        aria-describedby={errors.title ? 'title-error' : undefined}
                        onChange={(e) => set({ title: e.target.value })}
                      />
                      <span className="char-count">{form.title.length}/150</span>
                    </div>
                    {errors.title && (
                      <div className="ga-field-meta">
                        <span id="title-error" className="field__error" role="alert">
                          {errors.title}
                        </span>
                      </div>
                    )}
                  </td>
                </tr>
                <tr>
                  <th scope="row" className="cell--fixed">
                    <label htmlFor="desc">Mô tả</label>
                  </th>
                  <td className={teamEditing ? 'cell--fixed' : 'ga-cell-editable'}>
                    <textarea
                      id="desc"
                      readOnly={teamEditing}
                      rows={2}
                      className="ga-cell-input"
                      maxLength={500}
                      placeholder="Căn cứ xây dựng, phạm vi áp dụng"
                      value={form.description}
                      onChange={(e) => set({ description: e.target.value })}
                    />
                    <div className="ga-field-meta">
                      <span className="char-count">{form.description.length}/500</span>
                    </div>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </Card>

        {!annual && (levelsAvailable || !!existing) && (
          <YearPlanSourceCard plan={form} source={allGoals.find((g) => String(g.id) === String(form.curriculumSourcePlanId))}>
            {!existing && levelsAvailable && (
              <label className="field" htmlFor="annual-source">
                <span>Kế hoạch năm học đã ban hành</span>
                <select
                  id="annual-source"
                  className="select"
                  value={form.curriculumSourcePlanId || ''}
                  aria-invalid={!!errors.source}
                  aria-describedby={errors.source ? 'annual-source-error' : undefined}
                  onChange={(e) => {
                    const source = annualSources.find((g) => String(g.id) === e.target.value);
                    if (source)
                      set({ ...inheritAnnual(source, form.curriculumSourcePlanId ? form : undefined), ageGroupId: source.ageGroupId });
                  }}
                >
                  <option value="">Chọn kế hoạch năm học</option>
                  {annualSources.map((g) => (
                    <option key={g.id} value={g.id}>
                      {g.title} · Phiên bản {g.versionNo || 1}
                    </option>
                  ))}
                </select>
                {errors.source && (
                  <span id="annual-source-error" role="alert" className="text-danger">
                    {errors.source}
                  </span>
                )}
                <button
                  type="button"
                  className="btn btn--sm"
                  onClick={async () => {
                    const fresh = await refreshPlans();
                    if (fresh) {
                      setContentError('');
                      setContentReady(true);
                    }
                  }}
                >
                  Tải lại danh sách nguồn
                </button>
                {!annualSources.length && (
                  <Notice tone="warn">
                    Chưa có kế hoạch năm học đã ban hành cho nhóm tuổi này. Hãy hoàn thành và duyệt kế hoạch năm học trước.
                  </Notice>
                )}
              </label>
            )}
          </YearPlanSourceCard>
        )}
        {!annual && (
          <>
            {reviewError && <Notice tone="err">{reviewError}</Notice>}
            <TeamSourceReview
              plan={form}
              busy={resolving || !saveReady || saver.saving}
              onResolve={async (reviewItem) => {
                if (resolving) return;
                setResolving(true);
                setReviewError('');
                try {
                  if (!(await saver.save())) return;
                  const current = saver.current();
                  const saved = await resolveGoalReview(
                    savedId.current || form.id,
                    reviewItem.reviewItemId,
                    current.curriculumSourcePlanId,
                    { ...editRef.current, requestId: crypto.randomUUID() },
                  );
                  editRef.current.revision = saved.revision ?? editRef.current.revision;
                  const value = formOf(saved);
                  setForm(value);
                  saver.markClean(value);
                } catch (error) {
                  setReviewError(error.message);
                  if (error.status === 409 || error.status === 403) {
                    setContentError(error.message);
                    setContentReady(false);
                  }
                } finally {
                  setResolving(false);
                }
              }}
            />
          </>
        )}
        {inherited && <Notice>Nội dung kế thừa từ kế hoạch năm học được giữ cố định. Tích từng nội dung vào chủ đề ở phần 2.</Notice>}
        <Card
          title="2. Mục tiêu nội dung giáo dục cuối độ tuổi"
          className="ga-plan-section--goals"
          {...fold('goals')}
          actions={<span className="muted text-xs nowrap">{totalGoals} mục tiêu</span>}
        >
          {importReport?.unavailable.length > 0 && (
            <Notice tone="warn">
              <span>Chưa thêm được các mục tiêu sau:</span>
              <ul>
                {importReport.unavailable.map((item) => (
                  <li key={item.id}>
                    {item.label}: {item.reason}
                  </li>
                ))}
              </ul>
            </Notice>
          )}
          {errors.domains &&
            !errors.domains.includes('nội dung') &&
            !errors.domains.includes('mục tiêu') &&
            !errors.domains.includes('chủ đề') &&
            !errors.domains.includes('nhóm') && <Notice tone="err">{errors.domains}</Notice>}
          {!annual && themes.length === 0 && <p className="text-danger text-sm text-right">{NO_THEME_NOTE}</p>}
          <GoalTable
            reviewItems={form.reviewItems}
            newItems={form.newItems}
            domains={form.domains}
            themes={annual ? [] : themes}
            readOnly={!annual}
            fixedCells={!annual}
            editLabels={annual}
            canAssignContents={!annual}
            canEditContents={!annual}
            numbers={numbers}
            ageGroupId={form.ageGroupId}
            canSuggest={importState.current.allowed}
            suggestionScope={form.id || id || 'new'}
            onChange={(domains) => set({ domains })}
          />
        </Card>
        <Card
          title={annual ? '3. Dự kiến chủ đề / sự kiện năm học' : '3. Dự kiến chủ đề, sự kiện trong năm'}
          className="ga-plan-section--themes"
          {...fold('themes')}
          actions={
            annual && (
              <button type="button" className="btn btn--sm btn--outline-primary" onClick={() => setImportingThemes(true)}>
                <Download size={16} aria-hidden /> Lấy chủ đề từ kế hoạch có sẵn
              </button>
            )
          }
        >
          {errors.themes &&
            !errors.themes.includes('tuần học') &&
            !errors.themes.includes('Thứ 2') &&
            !errors.themes.includes('trùng thời gian') &&
            !errors.themes.includes('trống ngày') &&
            !errors.themes.includes('kết thúc trước') && <Notice tone="err">{errors.themes}</Notice>}
          <ThemeEventTable
            reviewItems={form.reviewItems}
            newItems={form.newItems}
            hideGoals={annual}
            branchTemplates={form.branchTemplates || []}
            durationPolicy={durationPolicy}
            readOnly={!annual}
            fixedFields={!annual}
            branchEditable={!annual}
            yearRange={yearRange}
            themes={form.themes}
            breaks={form.breaks}
            domains={form.domains}
            numbers={numbers}
            requireDates={requireDates}
            onChange={(patch) => set(patch)}
          />
        </Card>

        {ministryOpen && (
          <CurriculumGoalsModal
            ageGroupId={form.ageGroupId}
            form={form}
            onClose={() => setMinistryOpen(false)}
            onImportGoals={importMinistryGoals}
            onAddContents={addMinistryContents}
          />
        )}

        {importingThemes && (
          <ImportThemesModal
            planLevel={planLevel}
            excludeId={form.id}
            defaultAgeGroupId={form.ageGroupId}
            defaultYear={form.schoolYear}
            form={form}
            onClose={() => setImportingThemes(false)}
            onImport={importThemes}
          />
        )}

        {fileOpen && (
          <ImportGoalFileModal
            form={form}
            themes={themes}
            allowedAgeGroupIds={allowedAgeGroupIds}
            yearRange={fileYearRange}
            onImport={importFile}
            onClose={() => setFileOpen(false)}
          />
        )}

        {importing && (
          <ImportGoalsModal
            planLevel={planLevel}
            excludeId={form.id}
            defaultAgeGroupId={form.ageGroupId}
            defaultYear={form.schoolYear}
            onClose={() => setImporting(false)}
            onImport={importGoals}
          />
        )}
      </fieldset>
      {preview && <DocPreviewModal file={preview} onClose={() => setPreview(null)} />}
      <LeaveConfirmModal
        {...guard.modal}
        canSave={saveReady}
        onDiscard={() => {
          saver.clearRecovery();
          guard.modal.onDiscard();
        }}
      />
    </div>
  );
}
