import { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams, useSearchParams, useLocation } from 'react-router-dom';
import { useSchoolYear } from '@/contexts/SchoolYearContext';
import { ReviewActions } from '@/components/education-plan/reviewUi';
import { ArrowLeft, ArrowRight, Download, FileDown, Printer, Save, Upload } from '@/components/ui/icons';
import { downloadYearPlanDoc, printYearPlan } from '@/utils/education-plan/yearPlanDoc';
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
import { goalIdsToTicks, isBlankBreak, isBlankTheme, nestUnderFirstSub, numberGoals, toRows } from '@/models/education-plan/goalTable';
import { GoalTable, PlanTabs, ThemeEventTable } from '@/components/education-plan/GoalTables';
import { mergeImportedGoals } from '@/models/education-plan/importGoals.mjs';
import { exportGoalsCsv, parseGoalsCsv } from '@/utils/education-plan/goalCsv';
import ImportGoalsModal from '@/components/education-plan/ImportGoalsModal';
import CurriculumGoalsModal from '@/components/education-plan/CurriculumGoalsModal';
import { addSuggestedContents, curriculumAsSourcePlan } from '@/models/education-plan/curriculum.mjs';
import { Card, DraftRecoveryNotice, Field, Notice, PageHead, Stepper, fmtDate } from '@/components/education-plan/eduUi';

const suggestTitle = (year, ageGroupId) => {
  const ag = AGE_GROUPS.find((a) => a.id === ageGroupId);
  return ag ? `Kế hoạch giáo dục năm học ${year} nhóm tuổi ${ag.name.split(' (')[0]}` : '';
};

const STEPS = ['Thông tin chung', 'Mục tiêu, nội dung và chủ đề', 'Xác nhận'];
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

const POPUP_BLOCKED = 'Trình duyệt chặn cửa sổ in. Cho phép cửa sổ bật lên rồi bấm lại.';
const NO_THEME_NOTE = 'Chưa có chủ đề. Thêm chủ đề ở tab "Chủ đề và sự kiện" để có cột tích chủ đề trong bảng này.';

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
  const [params] = useSearchParams();
  const { goals, schoolYear, saveGoal, startEditingGoal, finishEditingGoal, heartbeatGoal, toast, user } = useEducationPlan();
  const { schoolYears: yearOptions } = useSchoolYear();
  const navigate = useNavigate();
  const existing = goals.find((g) => g.id === id);
  const isVp = user.role === ROLES.VICE_PRINCIPAL;
  const isLeader = user.role === ROLES.TEAM_LEADER;

  const [form, setForm] = useState(() =>
    existing
      ? formOf(existing)
      : // Mã cố định ngay từ đầu để các lần lưu cùng ghi vào một kế hoạch
        { ...emptyForm(schoolYear, isLeader ? user.ageGroupId : ''), id: `g-${uid()}` },
  );
  // Mục tiêu là tab đầu (Tiền chọn 14/10); cột "Chủ đề thực hiện" hiện khi đã thêm chủ đề ở tab sau
  const [tab, setTab] = useState('goals');
  const [step, setStep] = useState(() => (params.get('buoc') === 'ky' ? 2 : 0));
  const [maxReached, setMaxReached] = useState(existing ? 2 : 0);
  const [errors, setErrors] = useState({});
  // BE:EDU-25 — phiên bản điều chỉnh dùng chung (năm học, nhóm tuổi) với các bản trước nên không tính là trùng
  const sameScope = existing && existing.schoolYear === form.schoolYear && existing.ageGroupId === form.ageGroupId;
  const dupGoal = !sameScope && goals.some((g) => g.id !== form.id && g.schoolYear === form.schoolYear && g.ageGroupId === form.ageGroupId);
  const [importing, setImporting] = useState(false);
  const [ministryOpen, setMinistryOpen] = useState(false);
  const [importReport, setImportReport] = useState(null);
  const fileRef = useRef(null);

  const set = (patch) => {
    setForm((f) => ({ ...f, ...patch }));
    setErrors((e) => {
      const next = { ...e };
      Object.keys(patch).forEach((k) => delete next[k]);
      return next;
    });
  };
  const ageName = AGE_GROUPS.find((a) => a.id === form.ageGroupId)?.name;
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
  const breaks = form.breaks.filter((b) => !isBlankBreak(b));
  const numbers = numberGoals(form.domains);
  const csvName = `ke-hoach-nam-hoc-${form.schoolYear.replace(/\s/g, '')}.csv`;
  const totalGoals = Object.keys(numbers).length;

  const outOfYear = [...form.themes, ...form.breaks].some((x) =>
    [x.start, x.end].some((d) => d && (d < yearRange.start || d > yearRange.end)),
  );
  const outOfYearMsg = `Có chủ đề hoặc đợt nghỉ nằm ngoài năm học (${fmtDate(yearRange.start)} – ${fmtDate(yearRange.end)}).`;
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
      else if (abbrs.some((a, i) => abbrs.indexOf(a) !== i)) e.themes = 'Tên viết tắt của các chủ đề bị trùng.';
      else if (themes.some((t) => t.start && t.end && t.end < t.start)) e.themes = 'Có chủ đề có ngày kết thúc trước ngày bắt đầu.';
      else if (outOfYear) e.themes = outOfYearMsg;
      else if (totalGoals === 0) e.domains = 'Nhập ít nhất một mục tiêu';
      // Mở đúng tab đang có lỗi
      if (e.themes) setTab('themes');
      else if (e.domains) setTab('goals');
    }
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  // Lỗi bảng chủ đề tính ngay khi gõ để báo tại chỗ; khi bấm Tiếp theo / Gửi vẫn kiểm lại đầy đủ
  const themeAbbrs = themes.map((t) => t.abbr.trim().toLowerCase()).filter(Boolean);
  const themeIssue = themes.some((t) => !t.name.trim() || !t.abbr.trim())
    ? 'Có chủ đề chưa có tên hoặc tên viết tắt.'
    : themeAbbrs.some((a, i) => themeAbbrs.indexOf(a) !== i)
      ? 'Tên viết tắt của các chủ đề bị trùng.'
      : themes.some((t) => t.start && t.end && t.end < t.start)
        ? 'Có chủ đề có ngày kết thúc trước ngày bắt đầu.'
        : outOfYear
          ? outOfYearMsg
          : null;

  const next = () => {
    if (!validate(step)) return;
    const n = Math.min(step + 1, STEPS.length - 1);
    setStep(n);
    setMaxReached((m) => Math.max(m, n));
    window.scrollTo({ top: 0 });
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
      window.removeEventListener('pagehide', hide);
      leaseTimer.current = setTimeout(async () => {
        await leaseLatest.current.saver.settle();
        if (heldId.current && !finished.current && !handingOff.current)
          await leaseLatest.current.finishEditingGoal(heldId.current, { edit: currentEdit });
        heldId.current = null;
      }, 0);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lockId]);
  useEffect(() => {
    if (!id && lockId && !saver.unsaved) {
      handingOff.current = true;
      const handoff = crypto.randomUUID();
      editHandoffs.set(handoff, { id: lockId, sessionId: editRef.current.sessionId });
      navigate(`/education/goals/${lockId}/edit`, { replace: true, state: { yearPlanHandoff: handoff } });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, lockId, saver.unsaved]);
  const guard = useLeaveGuard({ when: saver.unsaved && !finished.current, onSave: saver.save });
  const switchTab = (nextTab) => {
    if (nextTab !== tab) {
      setTab(nextTab);
    }
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

  // Trước khi mở hộp gửi / ban hành: thiếu thông tin thì mở đúng bước có lỗi
  const checkBeforeFinish = () => {
    for (const s of [0, 1]) {
      if (!validate(s)) {
        setStep(s);
        setMaxReached((m) => Math.max(m, s));
        return false;
      }
    }
    return true;
  };

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
    guard.leaveNow(`/education/goals/${saved.id}`);
    return saved;
  };

  /* ---------- Nhập dữ liệu ---------- */

  const abbrToId = (themes) => Object.fromEntries(themes.map((t) => [t.abbr.trim().toLowerCase(), t.id]));

  // Nhập file CSV (mẫu giống file xuất): thêm các hàng chưa có; cột chủ đề khớp theo tên viết tắt ở phần B.
  const importCsv = async (file) => {
    if (!file) return;
    const { domains: parsed, skipped } = parseGoalsCsv(await file.text());
    const ids = abbrToId(themes);
    const toIds = (abbrs) => abbrs.map((a) => ids[a.toLowerCase()]).filter(Boolean);
    let added = 0;
    const nextDomains = form.domains.map((d) => {
      const src = parsed.find((p) => p.domain === d.name);
      if (!src) return d;
      const fresh = src.rows
        .filter((r) => !d.rows.some((x) => x.kind === r.kind && x.text.trim().toLowerCase() === r.text.toLowerCase()))
        .map((r) =>
          r.kind === 'goal'
            ? {
                id: uid(),
                kind: 'goal',
                text: r.text,
                contents: r.contents.map((c) => ({ id: uid(), text: c.text, themes: toIds(c.themes) })),
              }
            : { id: uid(), kind: r.kind, text: r.text },
        );
      added += fresh.filter((r) => r.kind === 'goal').length;
      const kept = d.rows.filter((r) => r.text.trim() || r.kind !== 'goal' || r.contents.length);
      return { ...d, rows: nestUnderFirstSub([...kept, ...fresh]) };
    });
    set({ domains: nextDomains });
    if (fileRef.current) fileRef.current.value = '';
    const skipNote = skipped ? `. Bỏ qua ${skipped} dòng không hợp lệ` : '';
    toast(added ? `Đã nhập ${added} mục tiêu từ file${skipNote}` : 'File không có mục tiêu mới để thêm', skipped ? 'warn' : 'ok');
  };

  const importState = useRef(null);
  importState.current = { form, allowed: canEdit && leaseReady && !saver.recovery && !finishing && !leaseError };
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
    <div className="page ga-page">
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
            actions={
              canEdit && (
                <>
                  <span className="muted text-sm">
                    {saveReady ? saver.label : leaseError || 'Chọn năm học và nhóm tuổi; đang chờ quyền sửa'}
                  </span>
                  <button
                    type="button"
                    className="btn btn--primary btn--sm"
                    onClick={saver.save}
                    disabled={!saveReady || saver.saving || (!saver.unsaved && !saver.error)}
                    title="Lưu (Ctrl+S)"
                  >
                    <Save size={16} aria-hidden /> Lưu
                  </button>
                  {/* Gửi / ban hành theo mẫu chung (reviewUi), có ở mọi bước */}
                  <ReviewActions
                    name="kế hoạch năm học"
                    sendTo="Phó HT"
                    approveLabel={pendingEdit ? 'Lưu và ban hành' : 'Ban hành'}
                    can={{ send: isLeader && !pendingEdit, approve: isVp }}
                    beforeOpen={checkBeforeFinish}
                    notes={{
                      submit: `Gửi "${form.title}" cho Phó hiệu trưởng duyệt? Bạn không sửa được cho tới khi được ban hành hoặc bị trả lại.`,
                      approve: `Ban hành "${form.title}"? Giáo viên trong khối sẽ thấy kế hoạch này. Sau đó xuất file để in và ký.`,
                    }}
                    onAct={finish}
                  />
                </>
              )
            }
          />
          <Stepper steps={STEPS} current={step} maxReached={maxReached} onStep={(i) => i <= maxReached && setStep(i)} />
          {step === 1 && (
            <Card
              title={tab === 'themes' ? 'Chủ đề, sự kiện trong năm' : 'Mục tiêu, nội dung giáo dục'}
              num="2"
              bodyClass={null}
              actions={
                tab === 'goals' && (
                  <div className="row">
                    <span className="muted text-xs nowrap">{totalGoals} mục tiêu</span>
                    <button
                      type="button"
                      className="btn btn--sm btn--ghost"
                      onClick={() => exportGoalsCsv(form.domains, numbers, themes, csvName)}
                    >
                      <FileDown size={16} aria-hidden /> Xuất file
                    </button>
                    <button type="button" className="btn btn--sm btn--ghost" onClick={() => fileRef.current?.click()}>
                      <Upload size={16} aria-hidden /> Nhập file
                    </button>
                    <input
                      ref={fileRef}
                      type="file"
                      accept=".csv,text/csv"
                      hidden
                      aria-label="Chọn file CSV kế hoạch năm học"
                      onChange={(e) => importCsv(e.target.files?.[0])}
                    />
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
                  </div>
                )
              }
              className="ga-sticky-bar"
            />
          )}
        </div>

        {step === 0 && (
          <Card title="Thông tin chung" num="1">
            <div className="grid-2">
              <Field label="Năm học" required inline>
                <input className="input" value={form.schoolYear} readOnly />
              </Field>
              <Field label="Phạm vi áp dụng" inline>
                <input className="input" value={SCHOOL_SCOPE} readOnly />
              </Field>
              <Field label="Nhóm tuổi áp dụng" required inline error={errors.ageGroupId} htmlFor="ag">
                <select
                  id="ag"
                  className={`select ${errors.ageGroupId ? 'is-invalid' : ''}`}
                  value={form.ageGroupId}
                  disabled={isLeader || !!existing}
                  onChange={(e) => {
                    const ageGroupId = e.target.value;
                    // Chỉ gợi ý tên khi người dùng chưa tự đặt tên
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
              </Field>
              <Field label="Người soạn" inline>
                <input className="input" value={`${user.name} (${user.title})`} readOnly />
              </Field>
            </div>
            <div className="stack mt-16">
              <Field label="Tên kế hoạch" required inline error={errors.title} htmlFor="title" counter={`${form.title.length}/150`}>
                <input
                  id="title"
                  className={`input ${errors.title ? 'is-invalid' : ''}`}
                  maxLength={150}
                  placeholder="Chọn nhóm tuổi áp dụng để hệ thống đề xuất tên"
                  value={form.title}
                  onChange={(e) => set({ title: e.target.value })}
                />
              </Field>
              <Field label="Mô tả" inline top htmlFor="desc" counter={`${form.description.length}/500`}>
                <textarea
                  id="desc"
                  className="textarea"
                  maxLength={500}
                  placeholder="Căn cứ xây dựng, phạm vi áp dụng"
                  value={form.description}
                  onChange={(e) => set({ description: e.target.value })}
                />
              </Field>
            </div>
          </Card>
        )}

        {step === 1 && (
          <Card bodyClass={null}>
            <PlanTabs tab={tab} onTab={switchTab} counts={{ themes: themes.length, goals: totalGoals }} />
            <div className="card__body stack">
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
              {tab === 'themes' ? (
                <>
                  {errors.themes ? <Notice tone="err">{errors.themes}</Notice> : themeIssue && <Notice tone="warn">{themeIssue}</Notice>}
                  <ThemeEventTable
                    yearRange={yearRange}
                    themes={form.themes}
                    breaks={form.breaks}
                    domains={form.domains}
                    numbers={numbers}
                    onChange={(patch) => set(patch)}
                  />
                </>
              ) : (
                <>
                  {errors.domains && <Notice tone="err">{errors.domains}</Notice>}
                  {themes.length === 0 && <Notice>{NO_THEME_NOTE}</Notice>}
                  <GoalTable
                    domains={form.domains}
                    themes={themes}
                    numbers={numbers}
                    ageGroupId={form.ageGroupId}
                    onChange={(domains) => set({ domains })}
                  />
                </>
              )}
            </div>
          </Card>
        )}

        {ministryOpen && (
          <CurriculumGoalsModal
            ageGroupId={form.ageGroupId}
            form={form}
            onClose={() => setMinistryOpen(false)}
            onImportGoals={importMinistryGoals}
            onAddContents={addMinistryContents}
          />
        )}

        {importing && (
          <ImportGoalsModal
            excludeId={form.id}
            defaultAgeGroupId={form.ageGroupId}
            onClose={() => setImporting(false)}
            onImport={importGoals}
          />
        )}

        {step === 2 && (
          <>
            <Card
              title="Duyệt lại nội dung"
              num="4"
              actions={
                <div className="row">
                  <button
                    type="button"
                    className="btn btn--sm btn--ghost"
                    onClick={() => downloadYearPlanDoc(build(existing?.status || EDU_STATUS.DRAFT), numbers)}
                  >
                    <FileDown size={16} aria-hidden /> Xuất Word
                  </button>
                  <button
                    type="button"
                    className="btn btn--sm btn--ghost"
                    onClick={() => printYearPlan(build(existing?.status || EDU_STATUS.DRAFT), numbers) || toast(POPUP_BLOCKED, 'warn')}
                  >
                    <Printer size={16} aria-hidden /> In / Lưu PDF
                  </button>
                </div>
              }
            >
              <dl className="info-list">
                <dt>Tên kế hoạch</dt>
                <dd className="fw-600">{form.title}</dd>
                <dt>Năm học</dt>
                <dd>{form.schoolYear}</dd>
                <dt>Nhóm tuổi áp dụng</dt>
                <dd>{ageName}</dd>
                <dt>Ngày lập</dt>
                <dd>{fmtDate(form.createdAt || new Date().toISOString())}</dd>
              </dl>
            </Card>
            <Card bodyClass={null} className="mt-16">
              <PlanTabs tab={tab} onTab={setTab} counts={{ themes: themes.length, goals: totalGoals }} />
              <div className="card__body">
                {tab === 'themes' ? (
                  <ThemeEventTable themes={themes} breaks={breaks} domains={form.domains} numbers={numbers} readOnly />
                ) : (
                  <GoalTable domains={form.domains} themes={themes} numbers={numbers} ageGroupId={form.ageGroupId} readOnly />
                )}
              </div>
            </Card>
          </>
        )}
      </fieldset>
      <div className="page-actions">
        {/* Đóng: còn thay đổi chưa lưu thì hỏi lưu / rời / ở lại */}
        <button
          type="button"
          className="btn"
          onClick={() => guard.leave(goals.some((g) => g.id === form.id) ? `/education/goals/${form.id}` : '/education/goals')}
        >
          Đóng
        </button>
        <div className="row">
          {step > 0 && (
            <button type="button" className="btn" onClick={() => setStep(step - 1)}>
              <ArrowLeft size={16} aria-hidden /> Quay lại
            </button>
          )}
          {step < STEPS.length - 1 && (
            <button type="button" className="btn btn--primary" onClick={next}>
              Tiếp theo <ArrowRight size={16} aria-hidden />
            </button>
          )}
        </div>
      </div>
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
