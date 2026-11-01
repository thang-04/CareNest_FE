import { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
import { useSchoolYear } from '@/contexts/SchoolYearContext';
import { ReviewActions } from '@/components/education-plan/reviewUi';
import { Download, FileDown, Save, Upload } from '@/components/ui/icons';
import { yearPlanFile } from '@/utils/education-plan/yearPlanDoc';
import { useEducationPlan } from '@/hooks/education-plan/useEducationPlan';
import { useYearPlanAutosave } from '@/hooks/education-plan/useYearPlanAutosave';
import { recoveryText } from '@/models/education-plan/yearPlanAutosave.mjs';
import { useLeaveGuard } from '@/hooks/useLeaveGuard';
import { LeaveConfirmModal } from '@/components/ui/LeaveConfirmModal';
import { ROLES } from '@/models/User';
import {
  AGE_GROUPS,
  DOMAINS,
  EDU_ERROR_CODE,
  EDU_STATUS,
  SCHOOL_SCOPE,
  isStandardDomain,
} from '@/models/education-plan/educationPlanConstants';
import {
  duplicateAbbrThemeIds,
  goalIdsToTicks,
  isBlankTheme,
  numberGoals,
  themeScheduleIssue,
  toRows,
} from '@/models/education-plan/goalTable';
import { GoalTable, ThemeEventTable } from '@/components/education-plan/GoalTables';
import { mergeImportedGoals } from '@/models/education-plan/importGoals.mjs';
import { mergeFilePlan } from '@/models/education-plan/importGoalFile.mjs';
import { ImportGoalFileModal } from '@/components/education-plan/ImportGoalFileModal';
import ImportGoalsModal from '@/components/education-plan/ImportGoalsModal';
import ImportThemesModal from '@/components/education-plan/ImportThemesModal';
import { mergeImportedThemes } from '@/models/education-plan/importThemes.mjs';
import CurriculumGoalsModal from '@/components/education-plan/CurriculumGoalsModal';
import { addSuggestedContents, curriculumAsSourcePlan } from '@/models/education-plan/curriculum.mjs';
import { Card, DraftRecoveryNotice, Notice, PageHead, fmtDate } from '@/components/education-plan/eduUi';
import DocPreviewModal from '@/components/education-plan/DocPreviewModal';

const suggestTitle = (year, ageGroupId) => {
  const ag = AGE_GROUPS.find((a) => a.id === ageGroupId);
  return ag ? `Kế hoạch giáo dục năm học ${year} nhóm tuổi ${ag.name.split(' (')[0]}` : '';
};

const uid = () => Math.random().toString(36).slice(2, 9);
const editHandoffs = new Map();
// BE:EDU-10 — phiên sửa hết hạn sau 90 giây không có tín hiệu
const LEASE_TTL_MS = 90_000;

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

const NO_THEME_NOTE = 'Chưa có chủ đề. Thêm chủ đề ở phần "Chủ đề, sự kiện trong năm" phía trên để có cột tích chủ đề trong bảng này.';

/** Lập / sửa kế hoạch giáo dục năm học của một nhóm tuổi theo mẫu MN Thái Dương (Phó HT và tổ trưởng cùng soạn). */
export default function GoalFormPage() {
  const { id } = useParams();
  const location = useLocation();
  const handoffKey = location.state?.yearPlanHandoff;
  const transfer = useRef(editHandoffs.get(handoffKey)).current;
  const transferred = !!transfer && transfer.id === id;
  useEffect(() => {
    if (id && handoffKey) editHandoffs.delete(handoffKey);
  }, [id, handoffKey]);
  const { goals, schoolYear, saveGoal, startEditingGoal, finishEditingGoal, heartbeatGoal, toast, user, staff } = useEducationPlan();
  const [preview, setPreview] = useState(null);
  const { schoolYears: yearOptions } = useSchoolYear();
  const navigate = useNavigate();
  const existing = goals.find((g) => g.id === id);
  const isVp = user.role === ROLES.VICE_PRINCIPAL;
  const isLeader = user.role === ROLES.TEAM_LEADER;
  const allowedAgeGroupIds = isLeader ? [user.ageGroupId] : AGE_GROUPS.map((a) => a.id);

  const [form, setForm] = useState(() =>
    existing
      ? formOf(existing)
      : // Mã cố định ngay từ đầu để các lần lưu cùng ghi vào một kế hoạch
        { ...emptyForm(schoolYear, isLeader ? user.ageGroupId : ''), id: `g-${uid()}` },
  );
  const [errors, setErrors] = useState({});
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
  const yearOption = yearOptions.find((y) => y.label.replace(' - ', '-') === form.schoolYear.replace(' – ', '-'));
  const yearRange = {
    start: yearOption?.startDate || `${form.schoolYear.slice(0, 4)}-09-01`,
    end: yearOption?.endDate || `${Number(form.schoolYear.slice(0, 4)) + 1}-05-31`,
  };
  // Phó HT và tổ trưởng nhóm tuổi cùng soạn, mỗi lúc một người giữ khóa "Đang sửa" (BE:EDU-03, EDU-10);
  // đang chờ duyệt thì chỉ Phó HT tự sửa chỗ nhỏ. API thật dùng quyền BE trả; mock tự suy
  const editor = existing?.status === EDU_STATUS.EDITING ? existing.editing : null;
  const lockedByOther = !!editor && editor.userId !== user.id;
  const pendingEdit = isVp && existing?.status === EDU_STATUS.PENDING_VP;
  const permitted = existing?.permissions
    ? existing.permissions.canEdit
    : pendingEdit || (editableStatus(existing?.status) && !lockedByOther && (isVp || (isLeader && form.ageGroupId === user.ageGroupId)));

  const [leaseReady, setLeaseReady] = useState(!existing || transferred);
  const [leaseError, setLeaseError] = useState('');
  const [finishing, setFinishing] = useState(false);
  const leaseGeneration = useRef(0);
  const editRef = useRef({ sessionId: transferred ? transfer.sessionId : crypto.randomUUID(), revision: existing?.revision ?? 0 });
  const canEdit = permitted && !leaseError;

  // Dòng chủ đề / đợt nghỉ còn trống (vừa Enter thêm) không tính vào kiểm tra, cột tích và bản lưu
  const themes = form.themes.filter((t) => !isBlankTheme(t));
  const numbers = numberGoals(form.domains);
  const totalGoals = Object.keys(numbers).length;

  const outOfYear = [...form.themes, ...form.breaks].some((x) =>
    [x.start, x.end].some((d) => d && (d < yearRange.start || d > yearRange.end)),
  );
  const outOfYearMsg = `Có chủ đề hoặc đợt nghỉ nằm ngoài năm học (${fmtDate(yearRange.start)} – ${fmtDate(yearRange.end)}).`;
  const scheduleIssue = themeScheduleIssue(themes);
  const validate = (s) => {
    const e = {};
    if (s === 0) {
      if (!form.title.trim()) e.title = 'Nhập tên kế hoạch';
      if (!form.ageGroupId) e.ageGroupId = 'Chọn nhóm tuổi áp dụng';
      if (form.ageGroupId && dupGoal) e.ageGroupId = 'Nhóm tuổi này đã có kế hoạch năm học. Mở kế hoạch đã có để chỉnh sửa.';
    }
    if (s === 1) {
      const abbrs = themes.map((t) => t.abbr.trim().toLowerCase());
      if (themes.some((t) => !t.name.trim() || !t.abbr.trim()))
        e.themes = 'Mỗi chủ đề cần có tên và tên viết tắt (dùng làm cột "Chủ đề thực hiện" ở bảng mục tiêu).';
      // Viết tắt trùng: chặn gửi / ban hành nhưng chỉ báo đỏ tại ô (EDU-42), không hiện khung thông báo
      else if (abbrs.some((a, i) => abbrs.indexOf(a) !== i)) e.themeAbbr = true;
      else if (themes.some((t) => t.start && t.end && t.end < t.start)) e.themes = 'Có chủ đề có ngày kết thúc trước ngày bắt đầu.';
      else if (outOfYear) e.themes = outOfYearMsg;
      else if (scheduleIssue) e.themes = scheduleIssue;
      else if (totalGoals === 0) e.domains = 'Nhập ít nhất một mục tiêu';
    }
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  // Lỗi bảng chủ đề tính ngay khi gõ để báo tại chỗ; khi gửi / ban hành vẫn kiểm lại đầy đủ
  // Viết tắt trùng không vào đây: chỉ báo đỏ tại ô (EDU-42)
  const themeIssue = themes.some((t) => !t.name.trim() || !t.abbr.trim())
    ? 'Có chủ đề chưa có tên hoặc tên viết tắt.'
    : themes.some((t) => t.start && t.end && t.end < t.start)
      ? 'Có chủ đề có ngày kết thúc trước ngày bắt đầu.'
      : outOfYear
        ? outOfYearMsg
        : scheduleIssue;

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
          .map((r) => ({ id: r.id, code: `MT${nos[r.id]}`, text: r.text, contents: r.contents, requirements: [] })),
      })),
      ...extra,
    };
  };

  const pageAlive = useRef(true);
  useEffect(() => {
    pageAlive.current = true;
    return () => {
      pageAlive.current = false;
    };
  }, []);
  const finished = useRef(false);
  const heldId = useRef(transferred ? id : null);
  const handingOff = useRef(false);
  useEffect(() => {
    if (id) handingOff.current = false;
  }, [id]);
  const leaseTimer = useRef(null);
  const pendingHide = useRef(null);
  const retryLease = useRef(() => {});
  const lockId = existing?.id || (goals.some((g) => g.id === form.id) ? form.id : null);
  const saveReady = canEdit && leaseReady && !!form.ageGroupId && !!form.schoolYear && !dupGoal;
  const saver = useYearPlanAutosave({
    doc: form,
    setDoc: setForm,
    enabled: saveReady,
    mayBackup: !existing || (leaseReady && !leaseError),
    userId: user.id,
    planKey: id || `new-${schoolYear}`,
    onConflict: (error) => {
      setLeaseError(error.message || 'Đã mất quyền sửa');
      setLeaseReady(false);
    },
    save: async (snapshot, requestId) => {
      // BE:EDU-42 viết tắt chủ đề trùng: không lưu tới khi sửa
      if (duplicateAbbrThemeIds(snapshot.themes || []).size)
        throw Object.assign(new Error('Tên viết tắt của các chủ đề bị trùng.'), { status: 400 });
      const item = build(pendingEdit ? EDU_STATUS.PENDING_VP : EDU_STATUS.DRAFT, {}, snapshot);
      const saved = await saveGoal(item, { silent: true, edit: { ...editRef.current, requestId } });
      editRef.current.revision = saved.revision ?? editRef.current.revision;
      if (saved.id && !pageAlive.current && !handingOff.current) {
        await finishEditingGoal(saved.id, { edit: { ...editRef.current } });
        heldId.current = null;
      } else if (saved.id) heldId.current = saved.id;
      return formOf(saved);
    },
  });
  const leaseLatest = useRef({});
  leaseLatest.current = { startEditingGoal, finishEditingGoal, heartbeatGoal, saver, form, permitted };
  useEffect(() => {
    clearTimeout(leaseTimer.current);
    if (pendingHide.current) window.removeEventListener('pagehide', pendingHide.current);
    pendingHide.current = null;
    if (!lockId || !permitted) return undefined;
    let alive = true;
    const generation = ++leaseGeneration.current;
    const currentEdit = editRef.current;
    let busy = false;
    let contentConflict = false;
    // Lần cuối BE xác nhận phiên này còn giữ quyền (nhận quyền hoặc tín hiệu thành công)
    let lastBeat = 0;
    const acquire = async (initial = false) => {
      if (busy || !navigator.onLine || !alive || contentConflict) return;
      busy = true;
      try {
        const current = await leaseLatest.current.startEditingGoal(lockId, editRef.current, true);
        if (!alive) {
          if (generation !== leaseGeneration.current || handingOff.current) return;
          await leaseLatest.current.finishEditingGoal(lockId, { edit: { ...editRef.current } });
          return;
        }
        heldId.current = lockId;
        lastBeat = Date.now();
        if ((current.revision ?? 0) < editRef.current.revision) {
          setLeaseReady(true);
          return;
        }
        if (!initial && current.revision !== editRef.current.revision) {
          contentConflict = true;
          await leaseLatest.current.finishEditingGoal(lockId, { edit: { ...editRef.current } });
          heldId.current = null;
          setLeaseError('Kế hoạch đã được thay đổi ở nơi khác. Tải nội dung đang soạn để đối chiếu, không tự ghi đè.');
          setLeaseReady(false);
          return;
        }
        editRef.current.revision = current.revision ?? 0;
        if (initial && !leaseLatest.current.saver.unsaved) {
          const fresh = formOf(current);
          setForm(fresh);
          leaseLatest.current.saver.markClean(fresh);
        }
        setLeaseReady(true);
        setLeaseError('');
      } catch (error) {
        if (alive && error.status) {
          setLeaseError(error.message);
          setLeaseReady(false);
        }
      } finally {
        busy = false;
      }
    };
    retryLease.current = () => {
      if (leaseLatest.current.saver.unsaved || leaseLatest.current.saver.recovery) return;
      contentConflict = false;
      acquire(true);
    };
    if (heldId.current !== lockId) acquire(true);
    const pulse = async () => {
      if (busy || !alive || !navigator.onLine || finished.current || contentConflict) return;
      busy = true;
      try {
        await leaseLatest.current.heartbeatGoal(lockId, editRef.current);
        lastBeat = Date.now();
      } catch (error) {
        if (error.errorCode === EDU_ERROR_CODE.EDIT_SESSION_LOST && Date.now() - lastBeat < LEASE_TTL_MS - 5000) {
          // Quyền còn hạn mà bị từ chối ⇒ cùng tài khoản đã mở lại ở tab/máy khác và nhận quyền (EDU-10):
          // tab này dừng, không giành lại; bản giữ trên máy vẫn còn để đối chiếu
          contentConflict = true;
          heldId.current = null;
          if (alive) {
            setLeaseError('Đã mất quyền sửa: kế hoạch đang được mở ở tab hoặc máy khác.');
            setLeaseReady(false);
          }
        } else if (error.status === 409) {
          busy = false;
          await acquire();
        } else if (error.status && alive) {
          setLeaseError(error.message);
          setLeaseReady(false);
        }
      } finally {
        busy = false;
      }
    };
    const interval = setInterval(pulse, 20000);
    window.addEventListener('online', pulse);
    const hide = () => {
      if (heldId.current && !finished.current && !handingOff.current)
        leaseLatest.current.finishEditingGoal(heldId.current, { keepalive: true, edit: editRef.current });
    };
    window.addEventListener('pagehide', hide);
    return () => {
      alive = false;
      clearInterval(interval);
      window.removeEventListener('online', pulse);
      // Rời màn soạn rồi tải/đóng trang ngay: giữ pagehide tới khi nhả xong và gửi keepalive, không thì phiên
      // sửa bị giữ tới hết TTL (BE:EDU-10)
      pendingHide.current = hide;
      leaseTimer.current = setTimeout(async () => {
        await leaseLatest.current.saver.settle();
        if (heldId.current && !finished.current && !handingOff.current)
          await leaseLatest.current.finishEditingGoal(heldId.current, { keepalive: true, edit: currentEdit });
        heldId.current = null;
        window.removeEventListener('pagehide', hide);
        if (pendingHide.current === hide) pendingHide.current = null;
      }, 0);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lockId]);
  useEffect(() => {
    if (!id && lockId && !saver.unsaved) {
      handingOff.current = true;
      const handoff = crypto.randomUUID();
      editHandoffs.set(handoff, { id: lockId, sessionId: editRef.current.sessionId });
      const to = `/education/goals/${lockId}/edit${location.search}`;
      const state = { yearPlanHandoff: handoff, backTo: location.state?.backTo };
      navigate(to, { replace: true, state });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, lockId, saver.unsaved]);
  const guard = useLeaveGuard({ when: saver.unsaved && !finished.current, onSave: saver.save });
  const exitTo = (to) => () => {
    if (location.state?.backTo === to) return navigate(-1);
    if (location.state?.backToPrev === to) return navigate(-2);
    navigate(to, { replace: true });
  };
  const downloadRecovery = () => {
    const blob = new Blob([recoveryText(saver.recovery?.doc || form)], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'ke-hoach-nam-ban-khoi-phuc.txt';
    link.click();
    URL.revokeObjectURL(url);
  };

  // Kiểm tra các phần đang hiển thị trước khi gửi / ban hành.
  const checkBeforeFinish = () => validate(0) && validate(1);

  // submit: tổ trưởng gửi Phó HT duyệt; approve: Phó HT ban hành (bản mình soạn hoặc bản đang chờ)
  const finish = async (action, note) => {
    if (finishing) return null;
    setFinishing(true);
    const item =
      action === 'submit'
        ? build(EDU_STATUS.PENDING_VP, { sentAt: today(), sentBy: me, history: log('Gửi Phó hiệu trưởng duyệt', note) })
        : build(EDU_STATUS.APPROVED, {
            issued: me,
            history: log(pendingEdit ? 'Phó hiệu trưởng chỉnh sửa và ban hành' : 'Ban hành', note),
          });
    if (!(await saver.save())) {
      setFinishing(false);
      return null;
    }
    finished.current = true;
    const saved = await saveGoal(
      {
        ...build(item.status, {}, saver.current()),
        history: item.history,
        issued: item.issued,
        sentBy: item.sentBy,
        id: heldId.current || form.id,
      },
      { edit: { ...editRef.current, requestId: crypto.randomUUID() } },
    );
    if (!saved) {
      finished.current = false;
      setFinishing(false);
      return null;
    }
    saver.clearRecovery();
    toast(action === 'submit' ? 'Đã gửi Phó hiệu trưởng duyệt' : 'Đã ban hành kế hoạch năm học. Xuất file để in và ký.');
    guard.leaveNow(exitTo(`/education/goals/${saved.id}`));
    return saved;
  };

  /* ---------- Nhập dữ liệu ---------- */

  const importState = useRef(null);
  importState.current = { form, allowed: canEdit && leaseReady && !saver.recovery && !finishing && !leaseError };
  // BE:EDU-46 — bản xem trước của file: bổ sung như EDU-24, giữ dấu tích khớp viết tắt chủ đề đang có
  const importFile = (preview) => {
    const current = importState.current;
    if (!current.allowed) return false;
    const { patch, report, error } = mergeFilePlan(current.form, preview, () => `file-${uid()}`, { allowedAgeGroupIds });
    if (error) {
      toast(error, 'warn');
      return false;
    }
    set(patch);
    setImportReport(report);
    const parts = [`${report.added} mục tiêu`, report.themes && `${report.themes} chủ đề`, report.breaks && `${report.breaks} đợt nghỉ`]
      .filter(Boolean)
      .join(', ');
    const skipped = report.duplicates ? ` · bỏ qua ${report.duplicates} mục tiêu trùng` : '';
    const unavailable = report.unavailable.length ? ` · ${report.unavailable.length} mục tiêu chưa thêm được` : '';
    toast(`Đã bổ sung ${parts} từ file${skipped}${unavailable}`, report.added || report.themes || report.breaks ? 'ok' : 'warn');
    return true;
  };

  const importGoals = ({ source, selectedGoalIds }) => {
    const current = importState.current;
    if (!current.allowed) return false;
    const { domains, report } = mergeImportedGoals(current.form, source, selectedGoalIds, () => `import-${uid()}`);
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
      report.shifted && (report.themes || report.breaks) ? ` · đã dời ngày ${Math.abs(report.shifted)} năm, kiểm tra lại ngày` : '';
    toast(
      `${parts}${report.skipped ? ` · bỏ qua ${report.skipped} dòng đã có` : ''}${shifted}`,
      report.themes || report.breaks ? 'ok' : 'warn',
    );
    return true;
  };
  // BE:EDU-28 — mục tiêu của Bộ dựng thành kế hoạch nguồn để dùng chung cách ghép của EDU-24
  const importMinistryGoals = (goals) =>
    importGoals({ source: curriculumAsSourcePlan(goals), selectedGoalIds: goals.map((g) => `cg-${g.id}`) });
  const addMinistryContents = (goalRowId, suggestions) => {
    if (!importState.current.allowed) return false;
    const { domains, added, duplicates } = addSuggestedContents(importState.current.form, goalRowId, suggestions, () => `import-${uid()}`);
    if (added) set({ domains });
    toast(`Đã thêm ${added} nội dung${duplicates ? ` · bỏ qua ${duplicates} nội dung trùng` : ''}`, added ? 'ok' : 'warn');
    return true;
  };

  if (!permitted && !leaseError && !saver.recovery)
    return (
      <div className="page ga-page">
        <PageHead
          crumbs={[{ label: 'Kế hoạch giáo dục' }, { label: 'Mục tiêu năm học', to: '/education/goals' }]}
          title="Kế hoạch năm học"
        />
        <Notice tone="warn">
          {existing?.status === EDU_STATUS.APPROVED
            ? 'Kế hoạch đã ban hành nên không sửa được.'
            : existing?.status === EDU_STATUS.PENDING_VP
              ? 'Kế hoạch đang chờ Phó hiệu trưởng duyệt nên không sửa được.'
              : lockedByOther
                ? `Kế hoạch đang được ${editor.name} sửa từ ${editor.at}.`
                : 'Bạn chỉ lập, sửa được kế hoạch năm học của nhóm tuổi mình phụ trách.'}
        </Notice>
      </div>
    );

  return (
    <div className="page ga-page ga-class-editor">
      {leaseError && (
        <Notice tone="warn">
          {leaseError}{' '}
          <button type="button" className="btn" disabled={saver.unsaved || !!saver.recovery} onClick={() => retryLease.current()}>
            Thử nhận quyền sửa
          </button>
          <button type="button" className="btn" onClick={downloadRecovery}>
            Tải nội dung để đối chiếu
          </button>
        </Notice>
      )}
      {saver.recovery && (
        <DraftRecoveryNotice
          onRestore={saver.restore}
          onDismiss={saver.dismissRecovery}
          restoreDisabled={!leaseReady || saver.recovery.baseRevision !== (form.revision ?? 0)}
          note={
            saver.recovery.baseRevision !== (form.revision ?? 0)
              ? 'Kế hoạch trên hệ thống đã thay đổi sau đó nên không khôi phục được.'
              : ''
          }
          actions={
            saver.recovery.baseRevision !== (form.revision ?? 0) && (
              <button type="button" className="btn" onClick={downloadRecovery}>
                Tải nội dung để đối chiếu
              </button>
            )
          }
        />
      )}
      <fieldset disabled={!canEdit || !leaseReady || !!saver.recovery || finishing} className="ga-edit-fieldset">
        <div className="ga-sticky-head">
          <PageHead
            crumbs={[
              { label: 'Kế hoạch giáo dục' },
              { label: 'Mục tiêu năm học', to: '/education/goals' },
              { label: existing ? 'Chỉnh sửa' : 'Lập kế hoạch' },
            ]}
            title={existing ? 'Chỉnh sửa kế hoạch giáo dục năm học' : 'Lập kế hoạch giáo dục năm học'}
          />
          <div className="ga-year-toolbar" role="group" aria-label="Thao tác kế hoạch năm học">
            <button type="button" className="btn btn--sm btn--outline-primary" onClick={() => setFileOpen(true)}>
              <Upload size={16} aria-hidden /> Nhập file
            </button>
            <button type="button" className="btn btn--sm btn--outline-primary" onClick={() => setImporting(true)}>
              <Download size={16} aria-hidden /> Lấy từ kế hoạch có sẵn
            </button>
            <button
              type="button"
              className="btn btn--sm btn--outline-primary"
              disabled={!form.ageGroupId}
              onClick={() => setMinistryOpen(true)}
            >
              <Download size={16} aria-hidden /> Lấy từ Chương trình của Bộ
            </button>
            <button
              type="button"
              className="btn btn--sm btn--outline-primary"
              onClick={saver.save}
              disabled={!saveReady || saver.saving || (!saver.unsaved && !saver.error)}
              title="Lưu (Ctrl+S)"
            >
              <Save size={16} aria-hidden /> Lưu
            </button>
            <button
              type="button"
              className="btn btn--sm btn--outline-primary"
              onClick={() => setPreview(yearPlanFile(build(existing?.status || EDU_STATUS.DRAFT), numbers, staff))}
            >
              <FileDown size={16} aria-hidden /> Xuất
            </button>
            <ReviewActions
              name="kế hoạch năm học"
              sendTo="Phó HT"
              approveLabel={pendingEdit ? 'Lưu và ban hành' : 'Ban hành'}
              can={{ send: isLeader && !pendingEdit, approve: isVp }}
              variant="btn--outline-primary"
              beforeOpen={checkBeforeFinish}
              notes={{
                submit: `Gửi "${form.title}" cho Phó hiệu trưởng duyệt? Bạn không sửa được cho tới khi được ban hành hoặc bị trả lại.`,
                approve: `Ban hành "${form.title}"? Giáo viên trong khối sẽ thấy kế hoạch này. Sau đó xuất file để in và ký.`,
              }}
              onAct={finish}
            />
          </div>
          <p className="muted text-sm ga-year-save-status" aria-live="polite">
            {saveReady ? saver.label : leaseError || 'Chọn năm học và nhóm tuổi; đang chờ quyền sửa'}
          </p>
        </div>

        <Card title="Thông tin chung" num="1">
          <div className="table-wrap">
            <table className="table ga-plan-table ga-year-info" aria-label="Thông tin chung">
              <thead>
                <tr>
                  <th>Thông tin</th>
                  <th>Nội dung</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <th scope="row">
                    <label htmlFor="year">
                      Năm học <span className="req">*</span>
                    </label>
                  </th>
                  <td>
                    <input id="year" className="ga-cell-input" value={form.schoolYear} readOnly />
                  </td>
                </tr>
                <tr>
                  <th scope="row">
                    <label htmlFor="scope">Phạm vi áp dụng</label>
                  </th>
                  <td>
                    <input id="scope" className="ga-cell-input" value={SCHOOL_SCOPE} readOnly />
                  </td>
                </tr>
                <tr>
                  <th scope="row">
                    <label htmlFor="ag">
                      Nhóm tuổi áp dụng <span className="req">*</span>
                    </label>
                  </th>
                  <td>
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
                        set(keep ? { ageGroupId } : { ageGroupId, title: suggestTitle(form.schoolYear, ageGroupId) });
                      }}
                    >
                      <option value="">Chọn nhóm tuổi</option>
                      {AGE_GROUPS.map((a) => (
                        <option key={a.id} value={a.id}>
                          {a.name}
                        </option>
                      ))}
                    </select>
                    {errors.ageGroupId && (
                      <span id="ag-error" className="field__error" role="alert">
                        {errors.ageGroupId}
                      </span>
                    )}
                  </td>
                </tr>
                <tr>
                  <th scope="row">
                    <label htmlFor="author">Người soạn</label>
                  </th>
                  <td>
                    <input id="author" className="ga-cell-input" value={user.name} readOnly />
                  </td>
                </tr>
                <tr>
                  <th scope="row">
                    <label htmlFor="title">
                      Tên kế hoạch <span className="req">*</span>
                    </label>
                  </th>
                  <td>
                    <textarea
                      id="title"
                      rows={1}
                      className="ga-cell-input"
                      maxLength={150}
                      placeholder="Chọn nhóm tuổi áp dụng để hệ thống đề xuất tên"
                      value={form.title}
                      aria-invalid={!!errors.title}
                      aria-describedby={errors.title ? 'title-error' : undefined}
                      onChange={(e) => set({ title: e.target.value })}
                    />
                    <div className="ga-field-meta">
                      {errors.title && (
                        <span id="title-error" className="field__error" role="alert">
                          {errors.title}
                        </span>
                      )}
                      <span className="char-count">{form.title.length}/150</span>
                    </div>
                  </td>
                </tr>
                <tr>
                  <th scope="row">
                    <label htmlFor="desc">Mô tả</label>
                  </th>
                  <td>
                    <textarea
                      id="desc"
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

        <Card
          title="Chủ đề, sự kiện trong năm"
          num="2"
          actions={
            <button type="button" className="btn btn--sm btn--outline-primary" onClick={() => setImportingThemes(true)}>
              <Download size={16} aria-hidden /> Lấy chủ đề từ kế hoạch có sẵn
            </button>
          }
        >
          {errors.themes ? <Notice tone="err">{errors.themes}</Notice> : themeIssue && <Notice tone="warn">{themeIssue}</Notice>}
          <ThemeEventTable
            yearRange={yearRange}
            themes={form.themes}
            breaks={form.breaks}
            domains={form.domains}
            numbers={numbers}
            onChange={(patch) => set(patch)}
          />
        </Card>
        <Card title="Mục tiêu, nội dung giáo dục" num="3" actions={<span className="muted text-xs nowrap">{totalGoals} mục tiêu</span>}>
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
          {errors.domains && <Notice tone="err">{errors.domains}</Notice>}
          {themes.length === 0 && <Notice>{NO_THEME_NOTE}</Notice>}
          <GoalTable
            domains={form.domains}
            themes={themes}
            numbers={numbers}
            ageGroupId={form.ageGroupId}
            onChange={(domains) => set({ domains })}
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
            onImport={importFile}
            onClose={() => setFileOpen(false)}
          />
        )}

        {importing && (
          <ImportGoalsModal
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
