import { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { ArrowLeft, ArrowRight, Check, Download, FileDown, Printer, Send, Upload } from '@/components/ui/icons';
import { downloadYearPlanDoc, printYearPlan } from '@/utils/education-plan/yearPlanDoc';
import { useEducationPlan } from '@/hooks/education-plan/useEducationPlan';
import { useAutosave } from '@/hooks/education-plan/useAutosave';
import { ROLES } from '@/models/User';
import { AGE_GROUPS, DOMAINS, EDU_STATUS, SCHOOL_SCOPE, isStandardDomain } from '@/models/education-plan/educationPlanConstants';
import {
  goalIdsToTicks,
  initialsOf,
  isBlankBreak,
  isBlankTheme,
  nestUnderFirstSub,
  numberGoals,
  toRows,
} from '@/models/education-plan/goalTable';
import { GoalTable, PlanTabs, ThemeEventTable } from '@/components/education-plan/GoalTables';
import { exportGoalsCsv, parseGoalsCsv } from '@/utils/education-plan/goalCsv';
import ImportGoalsModal from '@/components/education-plan/ImportGoalsModal';
import { Card, Field, Modal, Notice, PageHead, Stepper, fmtDate } from '@/components/education-plan/eduUi';

const suggestTitle = (year, ageGroupId) => {
  const ag = AGE_GROUPS.find((a) => a.id === ageGroupId);
  return ag ? `Kế hoạch giáo dục năm học ${year} nhóm tuổi ${ag.name.split(' (')[0]}` : '';
};

const STEPS = ['Thông tin chung', 'Mục tiêu, nội dung và chủ đề', 'Xác nhận'];
const uid = () => Math.random().toString(36).slice(2, 9);

const emptyDomain = (name) => ({ id: uid(), name, rows: [] });
// Luôn đủ 5 lĩnh vực theo thứ tự I–V; lĩnh vực khác (dữ liệu cũ) xếp cuối.
const normalizeDomains = (domains) => [
  ...DOMAINS.map((name) => domains.find((d) => d.name === name) || emptyDomain(name)),
  ...domains.filter((d) => !isStandardDomain(d.name)),
];
const cleanContents = (cs) => cs.filter((c) => c.text.trim()).map((c) => ({ ...c, text: c.text.trim() }));
const editableStatus = (s) => !s || s === EDU_STATUS.DRAFT || s === EDU_STATUS.REJECTED;

const emptyForm = (schoolYear, ageGroupId = '') => ({
  title: suggestTitle(schoolYear, ageGroupId),
  ageGroupId,
  schoolYear,
  description: '',
  domains: DOMAINS.map((name) => emptyDomain(name)),
  themes: [],
  breaks: [],
});

const POPUP_BLOCKED = 'Trình duyệt chặn cửa sổ in. Cho phép cửa sổ bật lên rồi bấm lại.';
const NO_THEME_NOTE = 'Chưa có chủ đề. Thêm chủ đề ở tab "Chủ đề và sự kiện" để có cột tích chủ đề trong bảng này.';

/** Lập / sửa kế hoạch giáo dục năm học của một nhóm tuổi theo mẫu MN Thái Dương (Phó HT và tổ trưởng cùng soạn). */
export default function GoalFormPage() {
  const { id } = useParams();
  const [params] = useSearchParams();
  const { goals, schoolYear, saveGoal, toast, user } = useEducationPlan();
  const navigate = useNavigate();
  const existing = goals.find((g) => g.id === id);
  const isVp = user.role === ROLES.VICE_PRINCIPAL;
  const isLeader = user.role === ROLES.TEAM_LEADER;

  const [form, setForm] = useState(() =>
    existing
      ? {
          ...emptyForm(existing.schoolYear),
          ...existing,
          // Bản nháp từng chọn mục tiêu cho chủ đề được đổi sang dấu tích ở cột "Chủ đề thực hiện"
          ...goalIdsToTicks(
            normalizeDomains(existing.domains.map((d) => ({ id: d.id || uid(), name: d.name, rows: toRows(d, uid) }))),
            // Chủ đề chưa có tên viết tắt thì lấy chữ cái đầu của tên
            (existing.themes || []).map((t) => ({ ...t, abbr: t.abbr || initialsOf(t.name) })),
          ),
          breaks: existing.breaks || [],
        }
      : // Mã cố định ngay từ đầu để các lần tự lưu cùng ghi vào một kế hoạch
        { ...emptyForm(schoolYear, isLeader ? user.ageGroupId : ''), id: `g-${uid()}` },
  );
  // Mục tiêu là tab đầu (Tiền chọn 14/10); cột "Chủ đề thực hiện" hiện khi đã thêm chủ đề ở tab sau
  const [tab, setTab] = useState('goals');
  const [step, setStep] = useState(() => (params.get('buoc') === 'ky' ? 2 : 0));
  const [maxReached, setMaxReached] = useState(existing ? 2 : 0);
  const [errors, setErrors] = useState({});
  const [confirm, setConfirm] = useState(false);
  const [importing, setImporting] = useState(false);
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
  // Người tạo (tổ trưởng hoặc Phó HT) là người duy nhất sửa khi còn nháp; đang chờ duyệt thì Phó HT được tự sửa chỗ nhỏ
  const owner = existing?.owner || null;
  const isOwner = !owner || owner.userId === user.id;
  const pendingEdit = isVp && existing?.status === EDU_STATUS.PENDING_VP;
  const canEdit =
    pendingEdit || (editableStatus(existing?.status) && isOwner && (isVp || (isLeader && form.ageGroupId === user.ageGroupId)));

  // Dòng chủ đề / đợt nghỉ còn trống (vừa Enter thêm) không tính vào kiểm tra, cột tích và bản lưu
  const themes = form.themes.filter((t) => !isBlankTheme(t));
  const breaks = form.breaks.filter((b) => !isBlankBreak(b));
  const numbers = numberGoals(form.domains);
  const csvName = `ke-hoach-nam-hoc-${form.schoolYear.replace(/\s/g, '')}.csv`;
  const totalGoals = Object.keys(numbers).length;

  const validate = (s) => {
    const e = {};
    if (s === 0) {
      if (!form.title.trim()) e.title = 'Nhập tên kế hoạch';
      if (!form.ageGroupId) e.ageGroupId = 'Chọn nhóm tuổi áp dụng';
      const dup = goals.find((g) => g.id !== form.id && g.schoolYear === form.schoolYear && g.ageGroupId === form.ageGroupId);
      if (form.ageGroupId && dup) e.ageGroupId = 'Nhóm tuổi này đã có kế hoạch năm học. Mở kế hoạch đã có để chỉnh sửa.';
    }
    if (s === 1) {
      const abbrs = themes.map((t) => t.abbr.trim().toLowerCase());
      if (themes.some((t) => !t.name.trim() || !t.abbr.trim()))
        e.themes = 'Mỗi chủ đề cần có tên và tên viết tắt (dùng làm cột "Chủ đề thực hiện" ở bảng mục tiêu).';
      else if (abbrs.some((a, i) => abbrs.indexOf(a) !== i)) e.themes = 'Tên viết tắt của các chủ đề bị trùng.';
      else if (themes.some((t) => t.start && t.end && t.end < t.start)) e.themes = 'Có chủ đề có ngày kết thúc trước ngày bắt đầu.';
      else if (totalGoals === 0) e.domains = 'Nhập ít nhất một mục tiêu';
      // Mở đúng tab đang có lỗi
      if (e.themes) setTab('themes');
      else if (e.domains) setTab('goals');
    }
    setErrors(e);
    return Object.keys(e).length === 0;
  };

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
  const build = (status, extra = {}) => {
    const ag = AGE_GROUPS.find((a) => a.id === form.ageGroupId);
    const agCode = (ag?.name.split(' (')[0] || 'X')
      .split(' ')
      .map((w) => w[0])
      .join('')
      .slice(0, 3)
      .toUpperCase();
    // Hàng trống không được lưu; số MT đánh lại liên tục cho các mục tiêu còn lại.
    const domains = form.domains.map((d) => ({
      id: d.id,
      name: d.name,
      rows: nestUnderFirstSub(
        d.rows
          .filter((r) => r.text.trim() || (r.kind === 'goal' && r.contents.some((c) => c.text.trim())))
          .map((r) => ({ ...r, text: r.text.trim(), ...(r.kind === 'goal' ? { contents: cleanContents(r.contents) } : {}) })),
      ),
    }));
    const nos = numberGoals(domains);
    return {
      id: form.id || `g-${uid()}`,
      code: form.code || `KHNH-${form.schoolYear.slice(2, 4)}${form.schoolYear.slice(-2)}-${agCode}`,
      schoolYear: form.schoolYear,
      ageGroupId: form.ageGroupId,
      title: form.title.trim(),
      description: form.description.trim(),
      status,
      createdAt: form.createdAt || today(),
      sentAt: form.sentAt || null,
      createdBy: form.createdBy || user.name,
      owner: form.owner || me,
      sentBy: form.sentBy || null,
      issued: form.issued || null,
      history: form.history || [],
      file: form.file || null,
      themes: themes.map((t) => ({ ...t, name: t.name.trim(), abbr: t.abbr.trim() })),
      breaks,
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

  // Không còn nút Lưu nháp: tự lưu như trang chủ đề nhánh, khi đã có tên và nhóm tuổi (không trùng kế hoạch khác).
  // Phó HT tự sửa bản đang chờ duyệt: giữ trạng thái chờ, ghi lịch sử "chỉnh sửa" một lần cho mỗi lần mở trang
  const editLogged = useRef(false);
  // Đã gửi / ban hành: lần lưu nốt khi rời trang không được ghi đè bản vừa gửi bằng bản nháp
  const finished = useRef(false);
  const dupGoal = goals.some((g) => g.id !== form.id && g.schoolYear === form.schoolYear && g.ageGroupId === form.ageGroupId);
  const autosave = useAutosave({
    doc: form,
    enabled: canEdit && !!form.title.trim() && !!form.ageGroupId && !dupGoal && !confirm,
    save: async () => {
      if (finished.current) return true;
      const first = pendingEdit && !editLogged.current;
      const item = pendingEdit
        ? build(EDU_STATUS.PENDING_VP, first ? { history: log('Phó hiệu trưởng chỉnh sửa') } : {})
        : build(EDU_STATUS.DRAFT);
      await saveGoal(item);
      if (first) {
        editLogged.current = true;
        setForm((f) => ({ ...f, history: item.history }));
      }
      return item;
    },
  });
  useEffect(() => {
    autosave.markClean(form);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // send: tổ trưởng gửi Phó HT duyệt; issue: Phó HT duyệt ban hành (bản mình soạn hoặc bản đang chờ)
  const submit = () => {
    const item =
      confirm === 'send'
        ? build(EDU_STATUS.PENDING_VP, { sentAt: today(), sentBy: me, history: log('Gửi Phó hiệu trưởng duyệt') })
        : build(EDU_STATUS.APPROVED, { issued: me, history: log(pendingEdit ? 'Phó hiệu trưởng chỉnh sửa và ban hành' : 'Ban hành') });
    finished.current = true;
    saveGoal(item);
    setConfirm(false);
    toast(confirm === 'send' ? 'Đã gửi Phó hiệu trưởng duyệt' : 'Đã ban hành kế hoạch năm học. Xuất file để in và ký.');
    navigate(`/education/goals/${item.id}`);
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

  // Lấy từ kế hoạch có sẵn: chép mục tiêu và nội dung đã chọn; chưa có chủ đề thì chép luôn bảng chủ đề, đợt nghỉ của kế hoạch nguồn.
  const importGoals = (picked, source) => {
    let themes = form.themes;
    let breaks = form.breaks;
    if (!themes.length && source.themes?.length) {
      themes = source.themes.map(({ goalIds, ...t }) => ({ ...t, id: uid() }));
      breaks = (source.breaks || []).map((b) => ({ ...b, id: uid() }));
    }
    const srcAbbr = Object.fromEntries((source.themes || []).map((t) => [t.id, t.abbr.trim().toLowerCase()]));
    const ids = abbrToId(themes);
    let added = 0;
    const merged = form.domains.map((d) => {
      const src = picked.find((p) => p.name === d.name);
      if (!src) return d;
      const fresh = src.items
        .filter((it) => !d.rows.some((r) => r.kind === 'goal' && r.text.trim() === it.text.trim()))
        .map((it) => ({
          id: uid(),
          kind: 'goal',
          text: it.text,
          contents: (it.contents || (it.requirements || []).map((r) => ({ text: r.text, themes: [] }))).map((c) => ({
            id: uid(),
            text: c.text,
            themes: (c.themes || []).map((t) => ids[srcAbbr[t]]).filter(Boolean),
          })),
        }));
      added += fresh.length;
      return { ...d, rows: nestUnderFirstSub([...d.rows, ...fresh]) };
    });
    set({ domains: merged, themes, breaks });
    setImporting(false);
    toast(added ? `Đã thêm ${added} mục tiêu từ ${source.code}` : 'Không có mục tiêu mới được thêm');
  };

  if (!canEdit)
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
              : existing && !isOwner
                ? `Kế hoạch do ${owner.name} soạn. Khi còn là bản nháp, chỉ người soạn được sửa.`
                : 'Bạn chỉ lập, sửa được kế hoạch năm học của nhóm tuổi mình phụ trách.'}
        </Notice>
      </div>
    );

  return (
    <div className="page ga-page">
      <div className="ga-sticky-head">
        <PageHead
          crumbs={[
            { label: 'Kế hoạch giáo dục' },
            { label: 'Mục tiêu năm học', to: '/education/goals' },
            { label: existing ? 'Chỉnh sửa' : 'Lập kế hoạch' },
          ]}
          title={existing ? 'Chỉnh sửa kế hoạch giáo dục năm học' : 'Lập kế hoạch giáo dục năm học'}
          actions={
            autosave.error ? (
              <button type="button" className="btn btn--outline-primary" onClick={autosave.retry}>
                Chưa lưu được, thử lại
              </button>
            ) : (
              <span className="muted text-sm">
                {!form.title.trim() || !form.ageGroupId || dupGoal ? 'Nhập tên và nhóm tuổi để tự lưu' : autosave.label}
              </span>
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
          <PlanTabs tab={tab} onTab={setTab} counts={{ themes: themes.length, goals: totalGoals }} />
          <div className="card__body stack">
            {tab === 'themes' ? (
              <>
                {errors.themes && <Notice tone="err">{errors.themes}</Notice>}
                <ThemeEventTable
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

      {importing && (
        <ImportGoalsModal
          goals={goals}
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
                <GoalTable domains={form.domains} themes={themes} numbers={numbers} readOnly />
              )}
            </div>
          </Card>
        </>
      )}

      <div className="page-actions">
        {/* Đã tự lưu nên không còn "Hủy": đóng trang, phần chưa kịp lưu được lưu nốt khi rời trang */}
        <button
          type="button"
          className="btn"
          onClick={() => navigate(goals.some((g) => g.id === form.id) ? `/education/goals/${form.id}` : '/education/goals')}
        >
          Đóng
        </button>
        <div className="row">
          {step > 0 && (
            <button type="button" className="btn" onClick={() => setStep(step - 1)}>
              <ArrowLeft size={16} aria-hidden /> Quay lại
            </button>
          )}
          {step < STEPS.length - 1 ? (
            <button type="button" className="btn btn--primary" onClick={next}>
              Tiếp theo <ArrowRight size={16} aria-hidden />
            </button>
          ) : (
            <>
              {/* Tổ trưởng soạn thì gửi Phó HT duyệt; Phó HT (bản mình soạn hoặc bản đang chờ) duyệt ban hành luôn */}
              {isLeader && !pendingEdit && (
                <button type="button" className="btn btn--primary" onClick={() => setConfirm('send')}>
                  <Send size={16} aria-hidden /> Gửi Phó HT duyệt
                </button>
              )}
              {isVp && (
                <button type="button" className="btn btn--primary" onClick={() => setConfirm('issue')}>
                  <Check size={16} aria-hidden /> {pendingEdit ? 'Lưu và ban hành' : 'Ban hành'}
                </button>
              )}
            </>
          )}
        </div>
      </div>

      {confirm && (
        <Modal
          title={confirm === 'send' ? 'Gửi Phó hiệu trưởng duyệt' : 'Ban hành kế hoạch năm học'}
          onClose={() => setConfirm(false)}
          footer={
            <>
              <button className="btn" onClick={() => setConfirm(false)}>
                Quay lại kiểm tra
              </button>
              <button className="btn btn--primary" onClick={submit}>
                {confirm === 'send' ? <Send size={16} aria-hidden /> : <Check size={16} aria-hidden />}{' '}
                {confirm === 'send' ? 'Gửi' : 'Ban hành'}
              </button>
            </>
          }
        >
          <p>
            {confirm === 'send'
              ? `Gửi "${form.title}" cho Phó hiệu trưởng duyệt? Bạn không sửa được cho tới khi được ban hành hoặc bị trả lại.`
              : `Ban hành "${form.title}"? Giáo viên trong khối sẽ thấy kế hoạch này. Sau đó xuất file để in và ký.`}
          </p>
        </Modal>
      )}
    </div>
  );
}
